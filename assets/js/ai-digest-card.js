/* RAIN — shows the latest nightly digest (table ai_digests).
   Volcano: top = OFFICIAL numbers copied word-for-word by code from the PHIVOLCS bulletin (tiles, no AI);
            below = a plain-language summary written by AI, always labeled UNOFFICIAL.
   Heat: AI summary only. Usage: RainDigest.mount("elementId", "volcano" | "heat"). */
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
  const LV_COLOR = ["#15803d", "#b45309", "#c2410c", "#b91c1c", "#7f1d1d", "#7f1d1d"]; // white text on each is >= 4.5:1
  const TAG_AI = '<span class="demo-data-tag" style="background:#b45309">AI-GENERATED · UNOFFICIAL</span>';
  const TAG_AI_SUM = '<span class="demo-data-tag" style="background:#b45309">AI-GENERATED SUMMARY</span>'; // under the official tiles: still says AI, drops "unofficial"
  const TAG_OFFICIAL = '<span class="demo-data-tag" style="background:#0f766e">OFFICIAL DATA · PHIVOLCS BULLETIN</span>';

  function injectCss() {
    if (document.getElementById("rainDigestCss")) return;
    const st = document.createElement("style");
    st.id = "rainDigestCss";
    st.textContent =
      ".rd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.6rem;}" +
      ".rd-tile{border:1px solid rgba(127,127,127,.3);border-radius:12px;padding:.65rem .8rem;background:rgba(127,127,127,.07);}" +
      ".rd-alert{color:#fff;border-color:transparent;}" +
      ".rd-label{font-size:.72rem;letter-spacing:.02em;opacity:.85;}" +
      ".rd-big{font-size:1.7rem;font-weight:700;line-height:1.15;}" +
      ".rd-txt{font-size:.92rem;font-weight:600;line-height:1.35;}" +
      ".rd-unit{font-size:.8rem;font-weight:500;opacity:.85;margin-left:.3rem;}" +
      ".rd-note{font-size:.72rem;opacity:.8;}" +
      ".rd-wide{grid-column:span 2;}" +
      "@media(max-width:520px){.rd-wide{grid-column:auto;}}";
    document.head.appendChild(st);
  }

  const splitNum = (v) => { const m = /^([-+]?\d[\d,]*(?:\.\d+)?)\s*(.*)$/.exec(String(v || "")); return m ? [m[1], m[2]] : [null, v]; };

  function officialGrid(m) {
    const t = [];
    if (m.alert_level != null)
      t.push('<div class="rd-tile rd-alert" style="background:' + (LV_COLOR[m.alert_level] || "#475569") + ';"><div class="rd-label">Alert level</div><div class="rd-big">' +
        esc(m.alert_level) + '</div><div class="rd-note">' + esc(m.alert_label || "") + "</div></div>");
    const num = (label, f) => {
      if (!f || !f.v) return;
      const p = splitNum(f.v);
      t.push('<div class="rd-tile"><div class="rd-label">' + esc(label) + "</div>" +
        (p[0] != null ? '<div class="rd-big">' + esc(p[0]) + (p[1] ? '<span class="rd-unit">' + esc(p[1]) + "</span>" : "") + "</div>" : '<div class="rd-txt">' + esc(f.v) + "</div>") +
        (f.d ? '<div class="rd-note">as of ' + esc(f.d) + "</div>" : "") + "</div>");
    };
    const txt = (label, f) => {
      if (!f || !f.v) return;
      t.push('<div class="rd-tile rd-wide"><div class="rd-label">' + esc(label) + '</div><div class="rd-txt">' + esc(f.v) + "</div>" + (f.d ? '<div class="rd-note">as of ' + esc(f.d) + "</div>" : "") + "</div>");
    };
    num("Sulfur dioxide", m.so2);
    num("Crater lake temperature", m.temperature);
    num("Crater lake acidity", m.acidity);
    txt("Volcanic earthquakes (past 24 hours)", m.seismicity);
    txt("Plume", m.plume);
    txt("Ground deformation", m.deformation);
    return t.length ? '<div class="rd-grid">' + t.join("") + "</div>" : "";
  }

  async function render(el, kind) {
    injectCss();
    el.innerHTML = '<div class="card-eyebrow"><span>' + esc(TITLE[kind]) + "</span>" + TAG_AI + '</div><div id="' + el.id + 'Body">Loading…</div>';
    const body = el.querySelector("#" + el.id + "Body");
    try {
      const { data, error } = await sb.from("ai_digests").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      const rows = data || [], fresh = (r, h) => Date.now() - new Date(r.created_at).getTime() < h * 36e5;
      let d = rows[0], failNote = "";
      // Newest run failed (e.g. the source page had no readable text)? Keep showing the last GOOD summary (max 3 days old) instead of an empty card.
      if (d && d.status !== "ok") {
        const good = rows.find((r) => r.status === "ok" && fresh(r, 72));
        if (good) { failNote = MSG[d.status] || ""; d = good; }
      }
      // Official numbers: newest row (max 3 days old) that has them, even when its AI summary failed.
      const mRow = rows.find((r) => r.metrics && typeof r.metrics === "object" && Object.keys(r.metrics).length && fresh(r, 72));
      if (!d) { body.textContent = "No daily summary yet. It is created automatically every day at 12:00 AM (Philippine time)."; return; }

      const link = (r) => (r && /^https:\/\//.test(r.source_url) ? r.source_url : null);
      const img = d.status === "ok" && typeof d.image_url === "string" && /^https:\/\/[^/]+\/storage\/v1\/object\/public\/digest-images\//.test(d.image_url) ? d.image_url : null;
      const stale = (r) => (Date.now() - new Date(r.created_at).getTime()) / 36e5 > 36 ? '<div style="color:#b45309;font-weight:600;margin-bottom:.5rem;">This data is over a day old and may be outdated.</div>' : "";

      let html = "";
      if (mRow) {
        const m = mRow.metrics, head = el.querySelector(".card-eyebrow");
        head.innerHTML = "<span>Taal Volcano: bulletin data</span>" + TAG_OFFICIAL;
        html += stale(mRow) + officialGrid(m) +
          '<div class="rd-note" style="margin-top:.55rem;">Copied automatically by software from the PHIVOLCS bulletin' + (m.bulletin_date ? " dated " + esc(m.bulletin_date) : "") +
          ". Each reading keeps the date PHIVOLCS gave it. If anything here differs from PHIVOLCS, follow PHIVOLCS." +
          (link(mRow) ? ' <a href="' + esc(link(mRow)) + '" target="_blank" rel="noopener noreferrer">Open source page</a>' : "") + "</div>" +
          '<hr style="opacity:.2;margin:.9rem 0;"><div class="d-flex justify-content-between align-items-center flex-wrap gap-2 mb-2"><b style="font-size:.88rem;">Plain-language summary</b>' + TAG_AI_SUM + "</div>";
      } else {
        html += stale(d);
      }
      if (failNote) html += '<div class="text-muted" style="font-size:.8rem;">The latest update did not complete: ' + esc(failNote) + "</div>";
      if (d.status === "ok") {
        if (img) html += '<figure class="m-0 mb-3" data-digest-fig><img src="' + esc(img) + '" alt="AI-generated illustration for the ' + esc(kind === "heat" ? "heat index" : "Taal volcano") + ' daily summary" loading="lazy" decoding="async" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;display:block;"><figcaption class="text-muted" style="font-size:.74rem;margin-top:.35rem;">AI-generated illustration of the summary below. It is not a real photo of current conditions.</figcaption></figure>';
        html += '<div style="white-space:pre-line;">' + esc(d.summary) + "</div>";
        if (!mRow && d.alert_level != null) html += '<div class="mt-2"><b>Alert level named in the page text: ' + esc(d.alert_level) + "</b> <small>(read by software, not confirmed)</small></div>";
      } else if (!mRow || !failNote) {
        html += "<div>" + esc(MSG[d.status] || "No summary available.") + "</div>";
      }
      html += '<div class="text-muted mt-2" style="font-size:.74rem;">' + (mRow ? "The summary was written" : "Summarized") + " by AI from a public web page on " + esc(new Date(d.created_at).toLocaleString()) +
        (d.source_fetched_at ? "; page read " + esc(new Date(d.source_fetched_at).toLocaleString()) : "") +
        ". It can contain errors and is not an official product. Always follow " + OFFICIAL[kind] + "." +
        (!mRow && link(d) ? ' <a href="' + esc(link(d)) + '" target="_blank" rel="noopener noreferrer">Open source page</a>' : "") + "</div>";
      body.innerHTML = html;
      const fig = body.querySelector("[data-digest-fig]"), im = fig && fig.querySelector("img");
      if (im) im.addEventListener("error", () => fig.remove()); // picture missing/unreachable: keep the text, drop the empty frame
    } catch (e) { console.warn("digest", e); body.textContent = "The daily summary could not be loaded (has migration 010 been run?)."; }
  }
  function mount(id, kind) { // wait for the page template to be added to the DOM
    let tries = 0;
    const t = setInterval(() => { const el = document.getElementById(id); if (el) { clearInterval(t); render(el, kind); } else if (++tries > 40) clearInterval(t); }, 250);
  }
  return { mount };
})();
