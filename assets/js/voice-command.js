/* =========================================================================
   RAIN — assets/js/voice-command.js
   "Hey RAIN" voice command feature.

   Mounted into the app shell by renderAppShell() (see main.js) — every page
   that builds the shell gets a persistent mic button for free, and only for
   a logged-in user (renderAppShell already gates on that).

   Flow: tap mic -> Web Speech API SpeechRecognition captures one phrase
   ("Hey RAIN, <command>") -> strip the wake word -> check the command
   against a small set of known keywords -> navigate to the matching page
   (speaking a short confirmation first via SpeechSynthesis), or, if nothing
   matches, send the command to the existing Gemini chat backend
   (api/chat.js) via RainChatAPI.send() (assets/js/main.js) — the same
   helper virtual-assistance.html's chat UI uses, so the request/parsing
   logic isn't duplicated — and speak + display the reply.

   Native Web Speech API only (SpeechRecognition + SpeechSynthesis) — no new
   dependencies. If either isn't supported (e.g. non-Chrome browsers), the
   mic button simply never mounts.
   ========================================================================= */
const VoiceCommand = {
  MUTE_KEY: "rain_voice_muted",

  // Known intents, checked in order — first keyword match wins. Kept small
  // and literal on purpose: this is a fast local check, not a substitute
  // for the AI fallback below.
  INTENTS: [
    { keywords: ["report", "incident"], label: "incident report", href: "report.html", voiceIntent: "report_incident" },
    { keywords: ["weather"], label: "weather", href: "weather.html", voiceIntent: "weather" },
    { keywords: ["alerts", "alert"], label: "alerts", href: "alerts.html", voiceIntent: "alerts" },
    { keywords: ["emergency", "help", "sos"], label: "emergency help", href: "emergency.html", voiceIntent: "emergency" },
    { keywords: ["volcano", "volcanic"], label: "volcano monitoring", href: "volcano.html", voiceIntent: "volcano" },
    { keywords: ["dashboard"], label: "dashboard", href: "dashboard.html", voiceIntent: "dashboard" },
  ],

  // Matches an optional lead-in ("hey"/"hi"/"ok"/"okay") plus "rain" and a
  // few speech-to-text mishearings of it ("reign", "rein", "wren"), so
  // "Hey RAIN, ..." and near-variants all strip cleanly. If the phrase
  // doesn't start with anything wake-word-shaped, the transcript is used
  // as-is rather than rejected outright — recognizers sometimes clip the
  // first word, and failing loudly there would be worse UX than just
  // treating the rest of the sentence as the command.
  WAKE_WORD_RE: /^[\s,.!?]*(?:hey|hi|hay|ho|okay|ok)?[\s,]*(?:rain|reign|rein|wren)\b[\s,.!?-]*/i,

  _mounted: false,
  _state: "idle", // idle | listening | processing
  _muted: false,
  _recognition: null,
  _hideBubbleTimer: null,

  _speechSupported() {
    return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  },
  _ttsSupported() {
    return "speechSynthesis" in window;
  },
  _supported() {
    return this._speechSupported() && this._ttsSupported();
  },

  _getMutedPref() {
    try { return localStorage.getItem(this.MUTE_KEY) === "1"; } catch (e) { return false; }
  },
  _setMutedPref(v) {
    try { localStorage.setItem(this.MUTE_KEY, v ? "1" : "0"); } catch (e) { /* storage unavailable — non-fatal */ }
  },

  /** Call once per page load, after the app shell has been built. No-ops if
   *  already mounted (defensive — renderAppShell() only calls this once
   *  per page anyway). If SpeechRecognition isn't available, still mounts
   *  a disabled mic with an explanatory note instead of hiding entirely —
   *  a silently-missing button is indistinguishable from a bug. */
  mount() {
    if (this._mounted) return;
    this._mounted = true;
    if (!this._supported()) {
      this._buildUnsupportedWidget();
      return;
    }
    this._muted = this._getMutedPref();
    this._buildWidget();
    this._wireEvents();
    this._primeVoices();
  },

  _buildUnsupportedWidget() {
    const el = document.createElement("div");
    el.className = "voice-widget voice-widget-unsupported";
    el.id = "voiceWidget";
    el.innerHTML = `
      <div class="voice-response-bubble show" id="voiceUnsupportedNote">
        Voice commands ("Hey RAIN") need Chrome or Edge — not supported in this browser.
      </div>
      <button type="button" class="voice-mic-btn" disabled aria-label="Hey RAIN voice command — not supported in this browser" title="Not supported in this browser">
        <i class="bi bi-mic-mute-fill"></i>
      </button>
    `;
    document.body.appendChild(el);
    setTimeout(() => {
      const note = document.getElementById("voiceUnsupportedNote");
      if (note) note.classList.remove("show");
    }, 6000);
  },

  // Chrome (especially on first page load) returns an empty voice list
  // until the async 'voiceschanged' event fires once. Priming it here just
  // triggers that load early, so the first spoken response can already
  // pick a matching voice instead of falling back to the engine default.
  _primeVoices() {
    if (!this._ttsSupported()) return; // belt-and-suspenders: mount() already checks this
    if (window.speechSynthesis.getVoices().length) return;
    window.speechSynthesis.addEventListener("voiceschanged", () => {}, { once: true });
  },

  _buildWidget() {
    const el = document.createElement("div");
    el.className = "voice-widget";
    el.id = "voiceWidget";
    el.innerHTML = `
      <div class="voice-response-bubble" id="voiceResponseBubble" role="status" aria-live="polite"></div>
      <div class="voice-thinking" id="voiceThinking" aria-hidden="true"><span></span><span></span><span></span></div>
      <button type="button" class="voice-mute-btn" id="voiceMuteBtn" aria-pressed="false" aria-label="Mute RAIN voice responses" title="Mute voice responses">
        <i class="bi bi-volume-up-fill"></i>
      </button>
      <button type="button" class="voice-mic-btn" id="voiceMicBtn" aria-label="Activate Hey RAIN voice command" title="Hey RAIN — tap and say a command">
        <i class="bi bi-mic-fill"></i>
      </button>
    `;
    document.body.appendChild(el);
    this._els = {
      widget: el,
      mic: el.querySelector("#voiceMicBtn"),
      mute: el.querySelector("#voiceMuteBtn"),
      thinking: el.querySelector("#voiceThinking"),
      bubble: el.querySelector("#voiceResponseBubble"),
    };
    this._syncMuteBtn();
  },

  _syncMuteBtn() {
    const { mute } = this._els;
    mute.classList.toggle("is-muted", this._muted);
    mute.setAttribute("aria-pressed", this._muted ? "true" : "false");
    mute.setAttribute("title", this._muted ? "Unmute voice responses" : "Mute voice responses");
    mute.innerHTML = `<i class="bi ${this._muted ? "bi-volume-mute-fill" : "bi-volume-up-fill"}"></i>`;
  },

  _wireEvents() {
    this._els.mic.addEventListener("click", () => this._onMicTap());
    this._els.mute.addEventListener("click", () => {
      this._muted = !this._muted;
      this._setMutedPref(this._muted);
      this._syncMuteBtn();
      if (this._muted) window.speechSynthesis.cancel();
    });
  },

  _setState(state) {
    this._state = state;
    this._els.widget.classList.toggle("is-listening", state === "listening");
    this._els.widget.classList.toggle("is-processing", state === "processing");
    this._els.thinking.classList.toggle("show", state === "listening" || state === "processing");
    // Only disable the mic while a command is actively being processed —
    // it stays tappable during "listening" so tapping again is how the
    // user tells RAIN they're finished talking (see _onMicTap()).
    this._els.mic.disabled = state === "processing";
    this._syncMicIcon(state);
  },

  _syncMicIcon(state) {
    const { mic } = this._els;
    if (state === "listening") {
      mic.innerHTML = '<i class="bi bi-stop-fill"></i>';
      mic.setAttribute("aria-label", "Stop listening and send your command");
      mic.setAttribute("title", "Tap again when you\u2019re done talking");
    } else {
      mic.innerHTML = '<i class="bi bi-mic-fill"></i>';
      mic.setAttribute("aria-label", "Activate Hey RAIN voice command");
      mic.setAttribute("title", "Hey RAIN \u2014 tap and say a command");
    }
  },

  _showResponseBubble(text, autoHideMs) {
    const { bubble } = this._els;
    bubble.textContent = text;
    bubble.classList.add("show");
    clearTimeout(this._hideBubbleTimer);
    if (autoHideMs) {
      this._hideBubbleTimer = setTimeout(() => bubble.classList.remove("show"), autoHideMs);
    }
  },
  _hideResponseBubble() {
    this._els.bubble.classList.remove("show");
    clearTimeout(this._hideBubbleTimer);
  },

  _onMicTap() {
    // Tap-to-finish: while RAIN is listening, tapping the mic again is how
    // the user says "that's everything" — .stop() finalizes whatever's
    // been captured so far instead of discarding it.
    if (this._state === "listening") {
      if (this._recognition) { try { this._recognition.stop(); } catch (e) {} }
      return;
    }
    if (this._state !== "idle") return; // a command is still processing — ignore extra taps
    // Unlock speechSynthesis for this page session. Chrome and mobile
    // Safari both require speech output to be tied to a direct user
    // gesture the *first* time it's used per page — by the time our real
    // reply is ready (after speech recognition + an async chat fetch),
    // that gesture context is long gone and speak() gets silently
    // swallowed. Speaking an empty utterance here, inside the actual
    // click handler, registers the gesture up front so later speak()
    // calls in this session go through normally.
    this._unlockSpeechSynthesis();
    // A new command always wins over RAIN still talking from the last one.
    if (this._ttsSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }
    this._hideResponseBubble();
    this._startListening();
  },

  _unlockSpeechSynthesis() {
    if (this._synthUnlocked || !this._ttsSupported()) return;
    this._synthUnlocked = true;
    try {
      window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
    } catch (e) { /* non-fatal — worst case the first real reply stays silent */ }
  },

  // How long RAIN keeps listening on its own if the user never taps the
  // mic again to say they're done — generous enough not to feel like a
  // cutoff, just a safety net against the mic staying open indefinitely.
  MAX_LISTEN_MS: 20000,

  _startListening() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const rec = new SR();
    rec.lang = (navigator.language && navigator.language.toLowerCase().startsWith("en")) ? navigator.language : "en-US";
    // continuous + interim results, rather than the single-shot default,
    // so a normal mid-sentence pause (thinking about wording, a breath)
    // doesn't get treated as "done" by the browser's own pause detector —
    // recognition keeps running, accumulating each finalized chunk, until
    // the user explicitly taps the mic again (or the safety timeout below).
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    let finalTranscript = "";

    rec.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += chunk + " ";
        else interim += chunk;
      }
      // Live "here's what I'm hearing" feedback while they keep talking —
      // also doubles as visible proof the mic didn't just silently die.
      this._showResponseBubble((finalTranscript + interim).trim() || "Listening\u2026");
    };
    rec.onerror = (e) => {
      clearTimeout(this._listenTimeout);
      this._setState("idle");
      this._hideResponseBubble();
      if (e.error === "no-speech") {
        rainToast('Didn\u2019t catch that \u2014 try "Hey RAIN" again.', "bi-mic-mute");
      } else if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        rainToast("Microphone access is blocked for this site.", "bi-mic-mute");
      } else if (e.error !== "aborted") {
        rainToast("Voice command couldn't start. Please try again.", "bi-exclamation-triangle");
      }
    };
    rec.onend = () => {
      clearTimeout(this._listenTimeout);
      // Only act here if we're still in "listening" — this fires whether
      // the user tapped to stop, the safety timeout hit, or the browser
      // gave up entirely (e.g. total silence), so it's the one place that
      // decides what happens with whatever got captured.
      if (this._state !== "listening") return;
      const transcript = finalTranscript.trim();
      if (transcript) {
        this._handleTranscript(transcript);
      } else {
        this._setState("idle");
        this._hideResponseBubble();
        rainToast('Say "Hey RAIN" followed by a command.', "bi-mic");
      }
    };

    this._recognition = rec;
    this._setState("listening");
    try {
      rec.start();
      this._listenTimeout = setTimeout(() => {
        if (this._recognition === rec && this._state === "listening") {
          try { rec.stop(); } catch (e) {}
        }
      }, this.MAX_LISTEN_MS);
    } catch (err) {
      console.error("VoiceCommand: recognition failed to start:", err);
      this._setState("idle");
    }
  },

  _stripWakeWord(text) {
    return text.replace(this.WAKE_WORD_RE, "");
  },

  _matchIntent(text) {
    const t = text.toLowerCase();
    for (const intent of this.INTENTS) {
      for (const kw of intent.keywords) {
        if (new RegExp("\\b" + kw + "\\b", "i").test(t)) return intent;
      }
    }
    return null;
  },

  async _handleTranscript(rawTranscript) {
    this._setState("processing");
    const command = this._stripWakeWord(rawTranscript).trim();

    if (!command) {
      this._setState("idle");
      rainToast('Say "Hey RAIN" followed by a command.', "bi-mic");
      return;
    }

    const intent = this._matchIntent(command);
    if (intent) {
      // Simple context for the destination page to pre-focus/pre-fill from
      // (e.g. report.html focuses the incident type field on
      // voiceIntent === "report_incident"). Cleared once removed — this is
      // navigation context, not permanent state — so it doesn't linger.
      try {
        sessionStorage.setItem("voiceIntent", JSON.stringify({ voiceIntent: intent.voiceIntent, raw: command }));
      } catch (e) { /* storage unavailable — page just won't get the pre-focus hint */ }
      this._setState("idle");
      const confirmation = `Opening ${intent.label}.`;
      this._showResponseBubble(confirmation);
      this._speakThenNavigate(confirmation, intent.href);
      return;
    }

    // No keyword match — fall back to the existing Gemini chat backend,
    // reusing the exact same call virtual-assistance.html makes.
    try {
      // voice: true — keeps the reply short server-side so it fits the
      // small popup bubble/spoken response without overflowing (see
      // api/chat.js). The full chat page (virtual-assistance.html) doesn't
      // set this, so its answers are unaffected.
      const reply = await RainChatAPI.send(command, { lang: "en", history: [], voice: true });
      this._setState("idle");
      const spoken = this._forSpeech(reply);
      this._showResponseBubble(this._forDisplay(reply), 12000);
      this._speak(spoken);
    } catch (err) {
      console.error("VoiceCommand: chat fallback failed:", err);
      this._setState("idle");
      const message = "I couldn't reach the assistant right now. Please try again in a moment.";
      this._showResponseBubble(message, 8000);
      this._speak(message);
    }
  },

  // Gemini replies come back as raw markdown (see api/chat.js /
  // virtual-assistance.html's renderMarkdown()). The voice bubble is a
  // plain-text popup, not a full chat view, so this strips markdown syntax
  // down to readable text rather than pulling in a markdown renderer for
  // a small transient surface.
  _forDisplay(mdText) {
    return String(mdText)
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, "$1")
      .replace(/\[([^\]]+)\]\((?:https?:\/\/[^\s)]+)\)/g, "$1")
      .replace(/^[ \t]*[-*]\s+/gm, "\u2022 ")
      .trim();
  },
  // Speech needs an extra pass beyond _forDisplay: no bullet glyphs, no
  // stray emoji, and line breaks read as pauses rather than silence.
  _forSpeech(mdText) {
    return this._forDisplay(mdText)
      .replace(/\u2022\s*/g, "")
      .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, "")
      .replace(/\n+/g, ". ")
      .replace(/\s{2,}/g, " ")
      .trim();
  },

  _applyVoiceDefaults(utter) {
    utter.rate = 1.0;
    utter.pitch = 1.0;
    utter.volume = 1.0;
    utter.lang = "en-US";
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length) {
      const preferred =
        voices.find((v) => /^en/i.test(v.lang) && /female|samantha|zira|google us english/i.test(v.name)) ||
        voices.find((v) => /^en/i.test(v.lang)) ||
        voices[0];
      if (preferred) utter.voice = preferred;
    }
  },

  _speak(text) {
    if (this._muted || !this._ttsSupported() || !text) return;
    const utter = new SpeechSynthesisUtterance(text);
    this._applyVoiceDefaults(utter);
    this._safeSpeak(utter);
  },

  /** Speaks a confirmation, then navigates once speech finishes (so the
   *  page doesn't unload mid-sentence). Falls back to navigating
   *  immediately if voice is muted/unsupported, and includes a timeout
   *  safety net in case `onend` never fires (seen on some mobile browsers). */
  _speakThenNavigate(text, href) {
    const go = () => { window.location.href = href; };
    if (this._muted || !this._ttsSupported()) { go(); return; }
    const utter = new SpeechSynthesisUtterance(text);
    this._applyVoiceDefaults(utter);
    let navigated = false;
    const navigateOnce = () => { if (navigated) return; navigated = true; go(); };
    utter.onend = navigateOnce;
    utter.onerror = navigateOnce;
    setTimeout(navigateOnce, 4000);
    this._safeSpeak(utter);
  },

  /** Cancels anything currently speaking/queued and speaks `utter`, working
   *  around two long-standing Chrome speechSynthesis bugs that otherwise
   *  make voice output silently fail (most visible on desktop Chrome):
   *   1. Calling speak() in the same tick as cancel() can get the new
   *      utterance silently dropped — cancel() isn't fully synchronous
   *      internally, so the new speak() races it. Queuing speak() on the
   *      next tick avoids that.
   *   2. speechSynthesis can just stop mid-utterance after ~15s on longer
   *      text (e.g. a multi-sentence Gemini reply) — a still-open Chromium
   *      bug. Nudging it with pause()/resume() every few seconds while it's
   *      actively speaking keeps it from stalling, with no audible glitch. */
  _safeSpeak(utter) {
    const synth = window.speechSynthesis;
    const wasBusy = synth.speaking || synth.pending;
    if (wasBusy) synth.cancel();

    let keepAliveTimer = null;
    const stopKeepAlive = () => { if (keepAliveTimer) { clearInterval(keepAliveTimer); keepAliveTimer = null; } };
    const originalOnEnd = utter.onend;
    const originalOnError = utter.onerror;
    utter.onstart = () => {
      keepAliveTimer = setInterval(() => {
        if (!synth.speaking) { stopKeepAlive(); return; }
        synth.pause();
        synth.resume();
      }, 8000);
    };
    utter.onend = (e) => { stopKeepAlive(); if (originalOnEnd) originalOnEnd(e); };
    utter.onerror = (e) => {
      stopKeepAlive();
      console.error("VoiceCommand: speechSynthesis error:", e.error || e);
      if (originalOnError) originalOnError(e);
    };

    const doSpeak = () => synth.speak(utter);
    if (wasBusy) setTimeout(doSpeak, 50);
    else doSpeak();
  },


  /** Reads back ({voiceIntent, raw} or null) and clears the sessionStorage
   *  entry a matched intent left for the destination page — one-shot, so a
   *  page refresh doesn't re-trigger the same pre-focus/pre-fill behavior.
   *  Destination pages (e.g. report.html) call this on load. */
  consumeIntent() {
    try {
      const raw = sessionStorage.getItem("voiceIntent");
      if (!raw) return null;
      sessionStorage.removeItem("voiceIntent");
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  },
};
