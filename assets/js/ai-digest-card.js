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
      const { data, error } = await sb.from("ai_digests").select("*").eq("kind", kind).order("created_at", { ascending: false }).limit(5);
      if (error) throw error;
      let d = data && data[0], failNote = "";
      // Newest run failed (e.g. the source page had no readable text)? Keep showing the last GOOD summary (max 3 days old) instead of an empty card.
      if (d && d.status !== "ok") {
        const good = data.find((r) => r.status === "ok" && Date.now() - new Date(r.created_at).getTime() < 72 * 36e5);
        if (good) { failNote = MSG[d.status] || ""; d = good; }
      }
      if (!d) { body.textContent = "No daily summary yet. It is created automatically every day at 12:00 AM (Philippine time)."; return; }
      const age = (Date.now() - new Date(d.created_at).getTime()) / 36e5, link = /^https:\/\//.test(d.source_url) ? d.source_url : null,
        img = d.status === "ok" && typeof d.image_url === "string" && /^https:\/\/[^/]+\/storage\/v1\/object\/public\/digest-images\//.test(d.image_url) ? d.image_url : null;
      body.innerHTML =
        (age > 36 ? '<div style="color:#b45309;font-weight:600;">This summary is over a day old and may be outdated.</div>' : "") +
        (failNote ? '<div class="text-muted" style="font-size:.8rem;">The latest update did not complete: ' + esc(failNote) + "</div>" : "") +
        (d.status === "ok"
          ? (img ? '<figure class="m-0 mb-3" data-digest-fig><img src="' + esc(img) + '" alt="AI-generated illustration for the ' + esc(kind === "heat" ? "heat index" : "Taal volcano") + ' daily summary" loading="lazy" decoding="async" style="width:100%;max-height:280px;object-fit:cover;border-radius:12px;display:block;"><figcaption class="text-muted" style="font-size:.74rem;margin-top:.35rem;">AI-generated illustration of the summary below. It is not a real photo of current conditions.</figcaption></figure>' : "") +
            '<div style="white-space:pre-line;">' + esc(d.summary) + "</div>" +
            (d.alert_level != null ? '<div class="mt-2"><b>Alert level named in the page text: ' + esc(d.alert_level) + "</b> <small>(read by software, not confirmed)</small></div>" : "")
          : "<div>" + esc(MSG[d.status] || "No summary available.") + "</div>") +
        '<div class="text-muted mt-2" style="font-size:.74rem;">Summarized by AI from a public web page on ' + esc(new Date(d.created_at).toLocaleString()) +
        (d.source_fetched_at ? "; page read " + esc(new Date(d.source_fetched_at).toLocaleString()) : "") +
        ". It can contain errors and is not an official product. Always follow " + OFFICIAL[kind] + "." +
        (link ? ' <a href="' + esc(link) + '" target="_blank" rel="noopener noreferrer">Open source page</a>' : "") + "</div>";
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
