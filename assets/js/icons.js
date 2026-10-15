/* =========================================================================
   RAIN — assets/js/icons.js
   Custom animated icon system: multi-stroke line icons that draw in on
   scroll, morph on hover, and pulse on click. Presentation only — no
   external icon service, no network dependency, fully self-hosted.
   Respects prefers-reduced-motion throughout (mirrors animations.js).
   ========================================================================= */

(function (global) {
  "use strict";

  const reduceMotion =
    global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Each icon is authored on a 0 0 48 48 grid, round caps/joins, two layers:
  //  - .dicon-base    the primary line-drawing (animates in via stroke-dash)
  //  - .dicon-accent  a secondary mark that morphs in on hover/click
  const ICONS = {
    "check-circle": `
      <circle class="dicon-base" cx="24" cy="24" r="16.5"/>
      <path class="dicon-base" d="M16 24.5l5.4 5.4L33 17.5"/>
      <path class="dicon-accent" d="M24 6.5v4M41.5 24h-4M24 41.5v-4M6.5 24h4"/>`,
    "cloud-sun": `
      <circle class="dicon-accent" cx="16" cy="15" r="5.4"/>
      <path class="dicon-accent" d="M16 5.5v3M8 12.5l2 2M24 12.5l-2 2"/>
      <path class="dicon-base" d="M14 33.5a8 8 0 1 1 2-15.8 10 10 0 0 1 19 3.4A6.6 6.6 0 0 1 34 33.5H14z"/>`,
    cloud: `
      <path class="dicon-base" d="M14.5 34a8 8 0 1 1 2-15.8 10 10 0 0 1 19 3.5A6.6 6.6 0 0 1 34.5 34h-20z"/>
      <path class="dicon-accent" d="M11 40h5M18 40h13M34 40h4"/>`,
    clouds: `
      <path class="dicon-base" d="M9 30.5a6.4 6.4 0 0 1 6.4-12 8 8 0 0 1 15.2 3 5.3 5.3 0 0 1-1.1 10.5H12.5A5.3 5.3 0 0 1 9 30.5z"/>
      <path class="dicon-accent" d="M17 39.5h18a4.2 4.2 0 1 0-1.4-8.2"/>`,
    "cloud-rain": `
      <path class="dicon-base" d="M13 26.5a7.4 7.4 0 1 1 1.9-14.6 9.3 9.3 0 0 1 17.6 3.2A6.1 6.1 0 0 1 32 26.5H13z"/>
      <path class="dicon-accent" d="M17 33l-2.4 6M25 33l-2.4 6M33 33l-2.4 6"/>`,
    "cloud-lightning": `
      <path class="dicon-base" d="M13 24.5a7.4 7.4 0 1 1 1.9-14.6 9.3 9.3 0 0 1 17.6 3.2A6.1 6.1 0 0 1 32 24.5H13z"/>
      <path class="dicon-accent" d="M25 26l-6.5 10h6L23 43l7.5-11h-6z"/>`,
    snow: `
      <path class="dicon-base" d="M13 22.5a7.4 7.4 0 1 1 1.9-14.6 9.3 9.3 0 0 1 17.6 3.2A6.1 6.1 0 0 1 32 22.5H13z"/>
      <path class="dicon-accent" d="M17 30v10M12 32.5l10 5M22 32.5l-10 5M31 30v10M26 32.5l10 5M36 32.5l-10 5"/>`,
    "exclamation-triangle": `
      <path class="dicon-base" d="M24 6.5L44 40.5H4L24 6.5z"/>
      <path class="dicon-accent" d="M24 20v9"/>
      <circle class="dicon-accent" cx="24" cy="33.5" r="1.4" fill="currentColor" stroke="none"/>`,
    "exclamation-octagon": `
      <path class="dicon-base" d="M15 6.5h18L42 15v18L33 41.5H15L6 33V15z"/>
      <path class="dicon-accent" d="M24 16v10"/>
      <circle class="dicon-accent" cx="24" cy="31.5" r="1.4" fill="currentColor" stroke="none"/>`,
    triangle: `
      <path class="dicon-base" d="M24 7L44 40.5H4L24 7z"/>
      <path class="dicon-accent" d="M24 20v10"/>`,
    flag: `
      <path class="dicon-base" d="M11 6.5v35"/>
      <path class="dicon-accent" d="M11 9.5c7-4 11 4 18 0v16c-7 4-11-4-18 0z"/>`,
    "clock-history": `
      <circle class="dicon-base" cx="24" cy="25" r="15.5"/>
      <path class="dicon-accent" d="M24 15.5V25l8 5"/>
      <path class="dicon-accent" d="M9.5 15a15.5 15.5 0 0 0-2 6.5"/>`,
    "geo-alt": `
      <path class="dicon-base" d="M24 43S9 28.4 9 18.3a15 15 0 1 1 30 0C39 28.4 24 43 24 43z"/>
      <circle class="dicon-accent" cx="24" cy="18" r="5.4"/>`,
    bell: `
      <path class="dicon-base" d="M13 32.5V22a11 11 0 0 1 22 0v10.5l3.5 5H9.5l3.5-5z"/>
      <path class="dicon-accent" d="M19.5 40.5a4.5 4.5 0 0 0 9 0"/>`,
    telephone: `
      <path class="dicon-base" d="M12 8.5l6.5-1.5 3 8-4 3.5a20 20 0 0 0 11 11l3.5-4 8 3-1.5 6.5c-1 3-3 4-6 3.5A29 29 0 0 1 9 15.5c-.5-3 .5-6 3-7z"/>
      <path class="dicon-accent" d="M28 10a10 10 0 0 1 10 10M28 16.5a4 4 0 0 1 4 4"/>`,
    "chat-dots": `
      <path class="dicon-base" d="M6 22.5C6 13.4 14.1 6 24 6s18 7.4 18 16.5S33.9 39 24 39a21 21 0 0 1-6.6-1L8 41.5l3-8.4A15.6 15.6 0 0 1 6 22.5z"/>
      <path class="dicon-accent" d="M17 22.5h.03M24 22.5h.03M31 22.5h.03"/>`,
    sun: `
      <circle class="dicon-base" cx="24" cy="24" r="9"/>
      <path class="dicon-accent" d="M24 4.5v6M24 37.5v6M43.5 24h-6M10.5 24h-6M37.9 10.1l-4.2 4.2M14.3 33.6l-4.2 4.2M37.9 37.9l-4.2-4.2M14.3 14.3L10.1 10.1"/>`,
    "moon-stars": `
      <path class="dicon-base" d="M31 8a16.6 16.6 0 1 0 9 30 16.6 16.6 0 0 1-9-30z"/>
      <path class="dicon-accent" d="M38 8v5M35.5 10.5h5M42 20v3.5M40.3 21.8h3.4"/>`,
    wind: `
      <path class="dicon-base" d="M6 17.5h22a5 5 0 1 0-4.6-7"/>
      <path class="dicon-accent" d="M6 25.5h29a5.4 5.4 0 1 1-5 7.5M6 33.5h16"/>`,
    robot: `
      <rect class="dicon-base" x="11" y="16" width="26" height="20" rx="6"/>
      <path class="dicon-base" d="M24 16V9M19 9h10"/>
      <circle class="dicon-accent" cx="19" cy="26" r="2.1" fill="currentColor" stroke="none"/>
      <circle class="dicon-accent" cx="29" cy="26" r="2.1" fill="currentColor" stroke="none"/>
      <path class="dicon-accent" d="M18 32h12"/>`,
    "person-fill": `
      <circle class="dicon-base" cx="24" cy="16" r="8"/>
      <path class="dicon-base" d="M8 41c1.5-9.5 8-14 16-14s14.5 4.5 16 14"/>
      <path class="dicon-accent" d="M24 8.5a7.6 7.6 0 0 1 4.8 13.5"/>`,
    people: `
      <circle class="dicon-base" cx="17.5" cy="16" r="6.6"/>
      <path class="dicon-base" d="M5 40c1.3-8 6-12 12.5-12S29.7 32 31 40"/>
      <path class="dicon-accent" d="M30 12a6.2 6.2 0 0 1 0 12.3M35 40c-.8-5.7-3-9.4-6.5-11.4"/>`,
    layers: `
      <path class="dicon-base" d="M24 6.5L43 17 24 27.5 5 17z"/>
      <path class="dicon-accent" d="M5 25.5L24 36l19-10.5M5 34L24 44.5 43 34"/>`,
    key: `
      <circle class="dicon-base" cx="16" cy="24" r="9.5"/>
      <path class="dicon-base" d="M23 24h20M35 24v7M41 24v5"/>
      <path class="dicon-accent" d="M16 20.5h.03" stroke-width="4"/>`,
    house: `
      <path class="dicon-base" d="M8 23L24 8l16 15"/>
      <path class="dicon-base" d="M12.5 19.5V40h23V19.5"/>
      <path class="dicon-accent" d="M20 40V28h8v12"/>`,
    "house-heart-fill": `
      <path class="dicon-base" d="M8 23L24 8l16 15"/>
      <path class="dicon-base" d="M12.5 19.5V40h23V19.5"/>
      <path class="dicon-accent" d="M24 36.5c-5.5-3.4-7.5-6-7.5-9a4 4 0 0 1 7.5-2 4 4 0 0 1 7.5 2c0 3-2 5.6-7.5 9z" fill="currentColor" stroke="none"/>`,
    broadcast: `
      <circle class="dicon-base" cx="24" cy="24" r="4.5"/>
      <path class="dicon-accent" d="M16.5 16.5a10.5 10.5 0 0 0 0 15M31.5 16.5a10.5 10.5 0 0 1 0 15"/>
      <path class="dicon-accent" d="M10 10a17.5 17.5 0 0 0 0 28M38 10a17.5 17.5 0 0 1 0 28"/>`,
    "shield-check": `
      <path class="dicon-base" d="M24 5.5l15 5.5v12c0 10-6.5 17-15 19.5C15.5 40 9 33 9 23V11z"/>
      <path class="dicon-accent" d="M17 23.5l5 5 9.5-10.5"/>`,
    "shield-lock": `
      <path class="dicon-base" d="M24 5.5l15 5.5v12c0 10-6.5 17-15 19.5C15.5 40 9 33 9 23V11z"/>
      <rect class="dicon-accent" x="18.5" y="22" width="11" height="8.5" rx="1.6"/>
      <path class="dicon-accent" d="M20.5 22v-3a3.5 3.5 0 0 1 7 0v3"/>`,
    "arrow-right-circle": `
      <circle class="dicon-base" cx="24" cy="24" r="16.5"/>
      <path class="dicon-accent" d="M17 24h13M25 18l6 6-6 6"/>`,
    "arrow-right": `
      <path class="dicon-base" d="M6 24h32"/>
      <path class="dicon-accent" d="M28 12l14 12-14 12"/>`,
    search: `
      <circle class="dicon-base" cx="21" cy="21" r="12.5"/>
      <path class="dicon-accent" d="M30 30l10.5 10.5"/>`,
    "info-circle": `
      <circle class="dicon-base" cx="24" cy="24" r="16.5"/>
      <path class="dicon-accent" d="M24 22v11" stroke-width="3.4"/>
      <circle class="dicon-accent" cx="24" cy="15.5" r="1.6" fill="currentColor" stroke="none"/>`,
    "box-arrow-in-right": `
      <path class="dicon-base" d="M20 8.5H10a2.5 2.5 0 0 0-2.5 2.5v26A2.5 2.5 0 0 0 10 39.5h10"/>
      <path class="dicon-accent" d="M18.5 24H41M31 14l10 10-10 10"/>`,
    "box-arrow-up-right": `
      <path class="dicon-base" d="M18 30L38 10"/>
      <path class="dicon-base" d="M24 8.5h13.5V22"/>
      <path class="dicon-accent" d="M31 24v13.5H10.5V17H24"/>`,
    activity: `
      <path class="dicon-base" d="M5 26h8l4-13 8 26 4-13h14"/>`,
    water: `
      <path class="dicon-base" d="M24 6c6 9 12.5 16.3 12.5 24.3A12.5 12.5 0 0 1 24 43a12.5 12.5 0 0 1-12.5-12.7C11.5 22.3 18 15 24 6z"/>
      <path class="dicon-accent" d="M17.5 30a6.5 6.5 0 0 0 6.5 6.5"/>`,
    fire: `
      <path class="dicon-base" d="M24 5.5c1.5 6-6 8.5-6 16A6 6 0 0 0 24 27a5 5 0 0 0 5-5c3 2 5 6 5 10.5 0 8-6.5 12-10 12s-13-3.5-13-14c0-9 6-12.5 9-16.5 1 2 1.5 4 1.5 6.5 1-2.5 1.8-8.5-1.5-15z"/>`,
    trash3: `
      <path class="dicon-base" d="M8 12.5h32M18 12.5V8h12v4.5"/>
      <path class="dicon-base" d="M11.5 12.5L14 41h20l2.5-28.5"/>
      <path class="dicon-accent" d="M20 19.5v14M28 19.5v14"/>`,
    "chevron-down": `
      <path class="dicon-base" d="M10 17.5L24 31l14-13.5"/>`,
    "calendar3": `
      <rect class="dicon-base" x="7" y="9" width="34" height="31" rx="4"/>
      <path class="dicon-base" d="M7 18.5h34M15 5v8M33 5v8"/>
      <path class="dicon-accent" d="M15 26h4v4h-4zM22 26h4v4h-4zM29 26h4v4h-4z" fill="currentColor" stroke="none"/>`,
    inbox: `
      <path class="dicon-base" d="M6 24.5h11l3 5h8l3-5h11"/>
      <path class="dicon-base" d="M9.5 12.5h29L42 24.5v11a3 3 0 0 1-3 3H9a3 3 0 0 1-3-3v-11z"/>`,
    "graph-up": `
      <path class="dicon-base" d="M6 38h36"/>
      <path class="dicon-accent" d="M8 32l9-10 7 6 13-16"/>
      <path class="dicon-accent" d="M29 12h8v8"/>`,
    "bar-chart": `
      <path class="dicon-base" d="M6 40V6M6 40h36"/>
      <path class="dicon-accent" d="M14 34V24M23 34V16M32 34V22M40 34v-8"/>`,
    "bell-slash": `
      <path class="dicon-base" d="M13 30.5V22a11 11 0 0 1 15.3-10.1M31 15.3A11 11 0 0 1 35 22v8.5l3.5 5H15"/>
      <path class="dicon-accent" d="M8 8l32 32"/>`,
    "slash-circle": `
      <circle class="dicon-base" cx="24" cy="24" r="16.5"/>
      <path class="dicon-accent" d="M13 35L35 13"/>`,
    "signpost-split": `
      <path class="dicon-base" d="M22 6h-9l-5 7 5 7h9M26 12h9l5 7-5 7h-9"/>
      <path class="dicon-base" d="M22 6v36M26 12v30"/>`,
    "diagram-3": `
      <circle class="dicon-base" cx="24" cy="10" r="5"/>
      <circle class="dicon-base" cx="11" cy="38" r="5"/>
      <circle class="dicon-base" cx="37" cy="38" r="5"/>
      <path class="dicon-accent" d="M24 15v9M24 24l-13 9M24 24l13 9"/>`,
    hurricane: `
      <path class="dicon-base" d="M24 8a16 16 0 0 0-15 10.5"/>
      <path class="dicon-base" d="M24 40a16 16 0 0 0 15-10.5"/>
      <path class="dicon-accent" d="M11 24a13 13 0 0 1 22-9M37 24a13 13 0 0 1-22 9"/>`,
    "heart-pulse": `
      <path class="dicon-base" d="M24 40S6 29 6 17.5A9.5 9.5 0 0 1 24 13a9.5 9.5 0 0 1 18 4.5C42 29 24 40 24 40z"/>
      <path class="dicon-accent" d="M11 24h6l3-6 4 10 3-7 2 3h8"/>`,
    "person-plus": `
      <circle class="dicon-base" cx="19" cy="16" r="7.5"/>
      <path class="dicon-base" d="M6 40c1.5-9 7-13.5 13-13.5S31.5 31 33 40"/>
      <path class="dicon-accent" d="M38 16v10M33 21h10"/>`,
    pencil: `
      <path class="dicon-base" d="M31 8l9 9-21 21H10v-9z"/>
      <path class="dicon-accent" d="M26 13l9 9"/>`,
    paperclip: `
      <path class="dicon-base" d="M31 12L15.5 27.5a6 6 0 0 0 8.5 8.5L38 22a10 10 0 0 0-14-14L9.5 22.5a13.5 13.5 0 0 0 19 19"/>`,
    send: `
      <path class="dicon-base" d="M6 24l37-16-13.5 37-6.5-14z"/>
      <path class="dicon-accent" d="M23 27l-9 11"/>`,
    "plus-circle": `
      <circle class="dicon-base" cx="24" cy="24" r="16.5"/>
      <path class="dicon-accent" d="M24 16v16M16 24h16"/>`,
  };

  // Alias table — icon names that are visually the same concept as one
  // already authored above (fill variants, near-synonyms).
  const ALIASES = {
    "check-circle-fill": "check-circle",
    "exclamation-triangle-fill": "exclamation-triangle",
    "flag-fill": "flag",
    "cloud-moon": "moon-stars",
    "cloud-haze": "clouds",
    "cloud-haze2": "clouds",
    "cloud-drizzle": "cloud-rain",
    "cloud-rain-heavy": "cloud-rain",
    "telephone-fill": "telephone",
    geo: "geo-alt",
  };

  function resolve(name) {
    if (ICONS[name]) return name;
    if (ALIASES[name]) return ALIASES[name];
    return null;
  }

  function buildSvg(key) {
    // pathLength="1" normalizes every shape to a 0–1 draw range, so one
    // shared stroke-dasharray/-dashoffset value in CSS animates every icon
    // at the same visual rate regardless of its actual path length.
    const withPathLength = ICONS[key].replace(
      /class="dicon-base"/g,
      'class="dicon-base" pathLength="1"'
    );
    return (
      '<svg class="dicon-svg-inner" viewBox="0 0 48 48" fill="none" stroke="currentColor" ' +
      'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      withPathLength +
      "</svg>"
    );
  }

  function pulse(el) {
    if (reduceMotion) return;
    el.classList.remove("dicon-pulse");
    // eslint-disable-next-line no-unused-expressions
    void el.offsetWidth; // restart animation
    el.classList.add("dicon-pulse");
    const type = ICON_FX[iconKeyOf(el)];
    if (type) playFx(el, type);
  }

  /* =======================================================================
     Themed click effects — every icon family gets its own tiny "moment"
     on click/tap instead of the generic scale-pulse: the volcano/fire icon
     erupts with rising embers, a bell rings with sound arcs, a raincloud
     dumps extra drops, and so on. Falls back to the plain pulse above for
     any icon with no themed entry (and is skipped entirely under
     prefers-reduced-motion, same as the pulse itself).
     ========================================================================= */

  // Icon key -> effect name. Add an entry here to give any icon its own click moment.
  const ICON_FX = {
    fire: "erupt",
    water: "ripple",
    "cloud-rain": "downpour",
    "cloud-lightning": "flash",
    snow: "flurry",
    wind: "gust",
    sun: "flare",
    "exclamation-triangle": "alert",
    "exclamation-octagon": "alert",
    triangle: "alert",
    bell: "ring",
    "bell-slash": "ring",
    telephone: "vibrate",
    "shield-check": "shine",
    "shield-lock": "shine",
    "check-circle": "confirm",
    "heart-pulse": "beat",
    activity: "beat",
    hurricane: "spin",
    "geo-alt": "drop",
    broadcast: "signal",
    robot: "blink",
    send: "launch",
    search: "zoom",
    "arrow-right": "dash",
    "arrow-right-circle": "dash",
    "box-arrow-in-right": "dash",
    "box-arrow-up-right": "dash",
    "chevron-down": "dash",
    calendar3: "flip",
    "clock-history": "tick",
    "bar-chart": "grow",
    "graph-up": "grow",
    house: "bounce",
    "house-heart-fill": "bounce",
    people: "wave",
    "person-fill": "wave",
    "person-plus": "wave",
    "moon-stars": "twinkle",
    trash3: "squish",
    key: "unlock",
  };

  // All the transient "fx-*" classes playFx() ever adds, so they can be
  // cleared in one shot once the animation has had time to finish.
  const FX_CLASSES = [
    "dicon-fx-erupt", "dicon-fx-shudder", "dicon-fx-flash", "dicon-fx-gust",
    "dicon-fx-flare", "dicon-fx-alert", "dicon-fx-ring", "dicon-fx-vibrate",
    "dicon-fx-shine", "dicon-fx-confirm", "dicon-fx-beat", "dicon-fx-spin",
    "dicon-fx-drop", "dicon-fx-blink", "dicon-fx-launch", "dicon-fx-zoom",
    "dicon-fx-dash", "dicon-fx-flip", "dicon-fx-tick", "dicon-fx-grow",
    "dicon-fx-bounce", "dicon-fx-wave", "dicon-fx-twinkle", "dicon-fx-squish",
    "dicon-fx-unlock",
  ];

  // Resolves the icon "key" (e.g. "fire") behind either a custom <svg data-dicon>
  // icon or a long-tail Bootstrap Icon font glyph (class="bi-fire bi-anim").
  function iconKeyOf(el) {
    if (el.hasAttribute("data-dicon")) return resolve(el.getAttribute("data-dicon"));
    for (const c of el.classList) {
      if (c.indexOf("bi-") === 0) {
        const key = resolve(c.slice(3));
        if (key) return key;
      }
    }
    return null;
  }

  // Spawns `count` short-lived particle elements inside `el`, each tagged
  // with `cls` and positioned/timed by `setVars(particle, index)`. Particles
  // clean themselves up after their animation ends (with a timeout backstop
  // in case a browser skips the animationend event, e.g. tab backgrounded).
  function spawnParticles(el, cls, count, setVars) {
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      p.className = "dicon-particle " + cls;
      p.setAttribute("aria-hidden", "true");
      if (setVars) setVars(p, i);
      el.appendChild(p);
      p.addEventListener("animationend", () => p.remove(), { once: true });
      setTimeout(() => p.remove(), 1600);
    }
  }

  function playFx(el, type) {
    switch (type) {
      case "erupt":
        el.classList.add("dicon-fx-erupt");
        spawnParticles(el, "dicon-ember", 7, (p, i) => {
          const angle = -90 + (Math.random() * 70 - 35);
          p.style.setProperty("--ang", angle + "deg");
          p.style.setProperty("--dist", 14 + Math.random() * 11 + "px");
          p.style.setProperty("--dur", 0.55 + Math.random() * 0.3 + "s");
          p.style.setProperty("--fx-delay", i * 0.02 + "s");
        });
        spawnParticles(el, "dicon-smoke", 3, (p, i) => {
          p.style.setProperty("--x", Math.random() * 16 - 8 + "px");
          p.style.setProperty("--fx-delay", 0.05 + i * 0.06 + "s");
        });
        break;
      case "ripple":
        spawnParticles(el, "dicon-ripple-ring", 3, (p, i) =>
          p.style.setProperty("--fx-delay", i * 0.14 + "s")
        );
        break;
      case "downpour":
        el.classList.add("dicon-fx-shudder");
        spawnParticles(el, "dicon-drop-extra", 5, (p, i) => {
          p.style.setProperty("--x", Math.random() * 30 - 15 + "px");
          p.style.setProperty("--fx-delay", i * 0.05 + "s");
        });
        break;
      case "flash":
        el.classList.add("dicon-fx-flash");
        break;
      case "flurry":
        spawnParticles(el, "dicon-flake-extra", 6, (p, i) => {
          p.style.setProperty("--x", Math.random() * 36 - 18 + "px");
          p.style.setProperty("--fx-delay", i * 0.04 + "s");
          p.style.setProperty("--dur", 0.8 + Math.random() * 0.4 + "s");
        });
        break;
      case "gust":
        el.classList.add("dicon-fx-gust");
        spawnParticles(el, "dicon-streak", 3, (p, i) =>
          p.style.setProperty("--fx-delay", i * 0.06 + "s")
        );
        break;
      case "flare":
        el.classList.add("dicon-fx-flare");
        break;
      case "alert":
        el.classList.add("dicon-fx-alert");
        break;
      case "ring":
        el.classList.add("dicon-fx-ring");
        spawnParticles(el, "dicon-sound-arc", 2, (p, i) =>
          p.style.setProperty("--fx-delay", i * 0.1 + "s")
        );
        break;
      case "vibrate":
        el.classList.add("dicon-fx-vibrate");
        break;
      case "shine":
        el.classList.add("dicon-fx-shine");
        break;
      case "confirm":
        el.classList.add("dicon-fx-confirm");
        break;
      case "beat":
        el.classList.add("dicon-fx-beat");
        break;
      case "spin":
        el.classList.add("dicon-fx-spin");
        break;
      case "drop":
        el.classList.add("dicon-fx-drop");
        spawnParticles(el, "dicon-ping-ground", 1);
        break;
      case "signal":
        spawnParticles(el, "dicon-signal-ring", 3, (p, i) =>
          p.style.setProperty("--fx-delay", i * 0.15 + "s")
        );
        break;
      case "blink":
        el.classList.add("dicon-fx-blink");
        break;
      case "launch":
        el.classList.add("dicon-fx-launch");
        break;
      case "zoom":
        el.classList.add("dicon-fx-zoom");
        break;
      case "dash":
        el.classList.add("dicon-fx-dash");
        break;
      case "flip":
        el.classList.add("dicon-fx-flip");
        break;
      case "tick":
        el.classList.add("dicon-fx-tick");
        break;
      case "grow":
        el.classList.add("dicon-fx-grow");
        break;
      case "bounce":
        el.classList.add("dicon-fx-bounce");
        break;
      case "wave":
        el.classList.add("dicon-fx-wave");
        break;
      case "twinkle":
        el.classList.add("dicon-fx-twinkle");
        break;
      case "squish":
        el.classList.add("dicon-fx-squish");
        break;
      case "unlock":
        el.classList.add("dicon-fx-unlock");
        break;
      default:
        return;
    }
    setTimeout(() => el.classList.remove.apply(el.classList, FX_CLASSES), 900);
  }

  function init() {
    const nodes = document.querySelectorAll("[data-dicon]");
    nodes.forEach((node, i) => {
      const raw = node.getAttribute("data-dicon");
      const key = resolve(raw);
      if (!key) return;
      node.classList.add("dicon", "dicon-enhanced");
      node.style.setProperty("--dicon-delay", (i % 10) * 40 + "ms");
      node.insertAdjacentHTML("beforeend", buildSvg(key));
      node.setAttribute("role", "img");
    });

    // Legacy Bootstrap Icons left in place (long-tail, single-use glyphs)
    // still get the shared hover/entrance treatment for visual consistency.
    document.querySelectorAll(".bi-anim").forEach((el, i) => {
      el.style.setProperty("--dicon-delay", (i % 10) * 40 + "ms");
    });

    if (!reduceMotion && "IntersectionObserver" in global) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              entry.target.classList.add("dicon-in-view");
              io.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.3 }
      );
      document.querySelectorAll(".dicon, .bi-anim").forEach((el) => io.observe(el));
    } else {
      document.querySelectorAll(".dicon, .bi-anim").forEach((el) => el.classList.add("dicon-in-view"));
    }

    // Click morph/pulse — delegated so it works for icons injected later.
    document.addEventListener("click", (e) => {
      const target = e.target.closest(".dicon, .bi-anim");
      if (target) pulse(target);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  /* =======================================================================
     Weather condition icons — small continuously-animated scenes (falling
     rain/snow, drifting cloud, spinning sun rays, flashing bolt) rather
     than the hover-morph line icons above. Used for the live weather
     widget and the forecast strip, where the icon represents an ongoing
     condition rather than a clickable action.
     ========================================================================= */

  // Maps every "bi-xxxx" condition string the app already uses to a scene.
  const WEATHER_TYPES = {
    "bi-sun": "sun",
    "bi-moon-stars": "moon",
    "bi-cloud-sun": "cloud-sun",
    "bi-cloud-moon": "cloud-moon",
    "bi-cloud": "cloud",
    "bi-clouds": "clouds",
    "bi-cloud-drizzle": "drizzle",
    "bi-cloud-rain": "rain",
    "bi-cloud-rain-heavy": "rain-heavy",
    "bi-cloud-lightning": "storm",
    "bi-snow": "snow",
    "bi-cloud-haze": "haze",
    "bi-cloud-haze2": "haze",
    "bi-wind": "wind",
  };

  const CLOUD_PATH =
    '<path class="wbody" d="M13.5 33.5a7.6 7.6 0 1 1 1.9-15 9.6 9.6 0 0 1 18.2 3.3A6.3 6.3 0 0 1 32.5 33.5h-19z"/>';
  const CLOUD_DARK_PATH =
    '<path class="wbody wbody-dark" d="M11.5 30.5a7 7 0 1 1 1.8-13.8 8.8 8.8 0 0 1 16.7 3A5.8 5.8 0 0 1 29 30.5h-17.5z"/>';

  function rays(cx, cy, inner, outer, extraClass) {
    let r = "";
    for (let i = 0; i < 8; i++) {
      r += `<line class="wray${extraClass ? " " + extraClass : ""}" x1="${cx}" y1="${cy - outer}" x2="${cx}" y2="${cy - inner}" transform="rotate(${i * 45} ${cx} ${cy})"/>`;
    }
    return `<g class="wrays" style="transform-origin:${cx}px ${cy}px">${r}</g>`;
  }
  function drops(n, cls, startY) {
    let d = "";
    const xs = [15, 21, 27, 33];
    for (let i = 0; i < n; i++) {
      d += `<line class="${cls}" style="--i:${i}" x1="${xs[i % xs.length]}" y1="${startY}" x2="${xs[i % xs.length] - 2}" y2="${startY + 6}"/>`;
    }
    return d;
  }
  function flakes(n, startY) {
    let f = "";
    const xs = [16, 22, 28, 34];
    for (let i = 0; i < n; i++) {
      f += `<circle class="wflake" style="--i:${i}" cx="${xs[i % xs.length]}" cy="${startY}" r="1.6" fill="currentColor" stroke="none"/>`;
    }
    return f;
  }

  const WEATHER_BUILDERS = {
    sun: () => `<circle class="wsun" cx="24" cy="24" r="9"/>${rays(24, 24, 14, 20)}`,
    moon: () =>
      `<path class="wmoon" d="M31 8a16.6 16.6 0 1 0 9 30 16.6 16.6 0 0 1-9-30z"/>
       <circle class="wstar" style="--i:0" cx="38" cy="11" r="1.3" fill="currentColor" stroke="none"/>
       <circle class="wstar" style="--i:1" cx="43" cy="19" r="1" fill="currentColor" stroke="none"/>
       <circle class="wstar" style="--i:2" cx="35" cy="18" r=".8" fill="currentColor" stroke="none"/>`,
    "cloud-sun": () =>
      `<g class="wpeek"><circle class="wsun wsun-sm" cx="16" cy="14" r="5.2"/>${rays(16, 14, 8, 12, "wray-sm")}</g>
       ${CLOUD_PATH}`,
    "cloud-moon": () =>
      `<path class="wpeek wmoon-sm" d="M20 6.5a7.4 7.4 0 1 0 4 13.6 7.4 7.4 0 0 1-4-13.6z"/>${CLOUD_PATH}`,
    cloud: () => CLOUD_PATH,
    clouds: () =>
      `<path class="wbody wbody-back" d="M8 22.5a6 6 0 1 1 1.4-11.8 7.6 7.6 0 0 1 14.2 2.6A5 5 0 0 1 22.5 22.5H8z"/>
       <path class="wbody" d="M17.5 34.5a7.6 7.6 0 1 1 1.9-15 9.6 9.6 0 0 1 18.2 3.3 6.3 6.3 0 0 1-1.1 11.7h-19z"/>`,
    drizzle: () => `${CLOUD_PATH}${drops(3, "wdrop wdrop-light", 33)}`,
    rain: () => `${CLOUD_PATH}${drops(4, "wdrop", 33)}`,
    "rain-heavy": () => `${CLOUD_DARK_PATH}${drops(4, "wdrop wdrop-fast", 30)}`,
    storm: () =>
      `${CLOUD_DARK_PATH}<path class="wbolt" d="M25 25l-6.5 10h6L23 44l7.5-11.5h-6z" fill="currentColor" stroke="none"/>`,
    snow: () => `${CLOUD_PATH}${flakes(4, 34)}`,
    haze: () =>
      `<path class="whaze" style="--i:0" d="M6 16h20"/><path class="whaze" style="--i:1" d="M10 24h28"/><path class="whaze" style="--i:2" d="M6 32h22"/><path class="whaze" style="--i:3" d="M14 40h24"/>`,
    wind: () =>
      `<path class="wbody" d="M6 17.5h22a5 5 0 1 0-4.6-7"/><path class="wbody" d="M6 25.5h29a5.4 5.4 0 1 1-5 7.5M6 33.5h16"/>`,
  };

  function weatherType(biClass) {
    return WEATHER_TYPES[biClass] || "cloud";
  }

  function weatherIconHTML(biClass) {
    const type = weatherType(biClass);
    const inner = (WEATHER_BUILDERS[type] || WEATHER_BUILDERS.cloud)();
    return (
      '<span class="wicon wicon-' +
      type +
      '" role="img"><svg class="wicon-svg" viewBox="0 0 48 48" fill="none" stroke="currentColor" ' +
      'stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">' +
      inner +
      "</svg></span>"
    );
  }

  function renderWeatherIcon(el, biClass) {
    if (!el) return;
    el.innerHTML = weatherIconHTML(biClass);
  }

  global.RainIcons = { init, ICONS, resolve, weatherIconHTML, renderWeatherIcon };
})(window);
