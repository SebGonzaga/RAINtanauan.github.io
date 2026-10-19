/* RAIN — shows the latest nightly AI digest (table ai_digests) in a clearly labeled, UNOFFICIAL card.
   Usage: RainDigest.mount("elementId", "volcano" | "heat"). Never shown as, or in place of, official data. */
window.RainDigest = (function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TITLE = { volcano: "Taal bulletin: daily AI summary", heat: "Heat index: daily AI summary" };
  const OFFICIAL = { volcano: "the official PHIVOLCS bulletin", heat: "the official PAGASA heat index bulletin" };
  const MSG = {
    source_unreachable: "The source page could not be reached during the last run.",
    source_unparsed: "The source page had no readable text (it may be an image or need scripts).",
    ai_failed: "The summary was not published because it could not be checked against the source text.",
  };
  async function render(el, kind) {
    el.innerHTML = '<div class="card-eyebrow"><span>' + esc(TITLE[kind]) + '</span><span class="demo-data-tag" style="background:#b45309">AI-GENERATED · UNOFFICIAL</span></div><div id="' + el.id + 'Body">Loading…</div>';
    const body = el.querySelector("#" + el.id + "Body");
    try {
      const { data, error } = await sb.from("ai_digests").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(1);
      if (error) throw error;
      const d = data && data[0];
      if (!d) { body.textContent = "No daily summary yet."; return; }
      const age = (Date.now() - new Date(d.created_at).getTime()) / 36e5, link = /^https:\/\//.test(d.source_url) ? d.source_url : null;
      body.innerHTML =
        (age > 36 ? '<div style="color:#b45309;font-weight:600;">This summary is over a day old and may be outdated.</div>' : "") +
        (d.status === "ok"
          ? '<div style="white-space:pre-line;">' + esc(d.summary) + "</div>" +
            (d.alert_level != null ? '<div class="mt-2"><b>Alert level named in the page text: ' + esc(d.alert_level) + "</b> <small>(read by software, not confirmed)</small></div>" : "")
          : "<div>" + esc(MSG[d.status] || "No summary available.") + "</div>") +
        '<div class="text-muted mt-2" style="font-size:.74rem;">Summarized by AI from a public web page on ' + esc(new Date(d.created_at).toLocaleString()) +
        (d.source_fetched_at ? "; page read " + esc(new Date(d.source_fetched_at).toLocaleString()) : "") +
        ". It can contain errors and is not an official product. Always follow " + OFFICIAL[kind] + "." +
        (link ? ' <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Open source page</a>' : "") + "</div>";
    } catch (e) { console.warn("digest", e); body.textContent = "The daily summary could not be loaded (has migration 010 been run?)."; }
  }
  function mount(id, kind) { // wait for the page template to be added to the DOM
    let tries = 0;
    const t = setInterval(() => { const el = document.getElementById(id); if (el) { clearInterval(t); render(el, kind); } else if (++tries > 40) clearInterval(t); }, 250);
  }
  return { mount };
})();
