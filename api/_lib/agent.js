// api/_lib/agent.js
// The Gemini <-> tools loop. The model may answer directly, or ask for one or
// more tools; we run them, hand the results back, and repeat (bounded) until
// it produces a final text answer.
//
// Follows Google's function-calling rules for Gemini 3 models:
//  * The model's returned `parts` are replayed VERBATIM and in order (they
//    carry `thoughtSignature`s that the API requires back, else HTTP 400).
//  * Exactly one functionResponse per functionCall, echoing the call's `id`
//    when it has one, grouped together in a single "user" turn.
//  * Tool output goes in `response` as data only -- no instructions inside it.

import { TOOL_DECLARATIONS, executeTool, toolMeta } from './tools.js';
import { HttpError } from './util.js';

const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const MAX_CALLS_PER_ROUND = 4;

async function callGemini({ apiKey, model, body, deadline }) {
  const remaining = deadline - Date.now();
  if (remaining < 1500) throw new HttpError(504, 'out of time');
  const res = await fetch(`${GEMINI_BASE}/${model}:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Header (not query param) keeps the key out of URLs / access logs.
      'x-goog-api-key': apiKey,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(Math.min(remaining, 15000)),
  });
  if (!res.ok) {
    console.error('Gemini error:', res.status, (await res.text()).slice(0, 600));
    throw new HttpError(res.status, 'upstream chat provider error');
  }
  return res.json();
}

/** If the model hit the token cap mid-sentence, end on the last full sentence. */
export function trimToSentence(text) {
  const t = text.trimEnd();
  if (/[.!?…)\]*_]$/.test(t)) return t;
  const cut = Math.max(t.lastIndexOf('. '), t.lastIndexOf('! '), t.lastIndexOf('? '), t.lastIndexOf('\n'));
  return cut >= 20 ? t.slice(0, cut + 1).trimEnd() : t;
}

export async function runAgent({
  apiKey, model, systemPrompt, contents, ctx,
  useTools = true, maxRounds = 3, deadline = Date.now() + 22000,
  maxOutputTokens = 1024,
}) {
  const messages = [...contents];
  const used = new Map(); // tool name -> { tool, label, source, ok }
  let rounds = 0;

  for (;;) {
    const forceAnswer = rounds >= maxRounds;
    const body = {
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: messages,
      generationConfig: { temperature: 0.5, maxOutputTokens },
      ...(useTools && {
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        // After the round budget is spent, forbid more calls so we always
        // finish with words rather than another tool request.
        ...(forceAnswer && { toolConfig: { functionCallingConfig: { mode: 'NONE' } } }),
      }),
    };

    const data = await callGemini({ apiKey, model, body, deadline });
    const candidate = data.candidates?.[0];
    const parts = candidate?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall);

    if (!calls.length || forceAnswer) {
      let reply = parts.filter((p) => typeof p.text === 'string' && !p.thought).map((p) => p.text).join('');
      if (candidate?.finishReason === 'MAX_TOKENS') reply = trimToSentence(reply);
      return { reply, toolsUsed: [...used.values()], rounds, finishReason: candidate?.finishReason };
    }

    rounds += 1;
    messages.push({ role: 'model', parts }); // verbatim, incl. thoughtSignature

    const results = await Promise.all(calls.map(async (p, i) => {
      const { name, args, id } = p.functionCall;
      if (i >= MAX_CALLS_PER_ROUND) {
        return { id, name, ok: false, result: { ok: false, error: 'Too many lookups requested at once; ask again more narrowly.' } };
      }
      const r = await executeTool(name, args, ctx);
      return { id, name, ...r };
    }));

    for (const r of results) {
      const meta = toolMeta(r.name);
      if (!meta) continue;
      const prev = used.get(r.name);
      used.set(r.name, { tool: r.name, label: meta.label, source: meta.source, ok: r.ok || !!prev?.ok });
    }

    messages.push({
      role: 'user',
      parts: results.map((r) => ({
        functionResponse: { ...(r.id && { id: r.id }), name: r.name, response: r.result },
      })),
    });
  }
}
