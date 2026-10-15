/* =========================================================================
   RAIN — assets/js/demo-data.js
   Frontend-only DEMO DATA. This file stands in for the PHP /api endpoints
   until the backend (Phase 3+ of the build plan) is connected. Reference values
   here are labeled in the UI — nothing here should ever be
   presented to the user as a live PHIVOLCS/PAGASA/OpenWeather reading.
   ========================================================================= */

/** Builds a structured RAIN chat reply: icon + heading, intro line,
 *  a numbered "what to do" list, and an optional follow-up action link. */
function rainStructuredReply(r) {
  const steps = r.steps.map((s, i) => `<li><span class="step-num">${String(i + 1).padStart(2, "0")}</span><span>${s}</span></li>`).join("");
  const cta = r.cta ? `<a href="${r.cta.href}" class="btn-rain btn-rain-primary btn-rain-sm mt-2">${r.cta.label} <i class="bi bi-arrow-right"></i></a>` : "";
  return `<div class="rain-reply tone-${r.tone}">
    <div class="rain-reply-heading"><i class="bi ${r.icon}"></i> ${r.heading}</div>
    <p class="rain-reply-intro">${r.intro}</p>
    <div class="rain-reply-label">What to do</div>
    <ol class="rain-reply-steps">${steps}</ol>
    ${cta}
  </div>`;
}

// Lighter variant of rainStructuredReply for questions the chatbot can't
// answer with live numbers (incidents/alerts/weather/quakes near you) —
// no "What to do" steps list, just a short note + a button to the page
// that actually has that data. See virtual-assistance.html's
// detectDataIntent().
function rainQuickLinkReply(r) {
  const cta = r.cta ? `<a href="${r.cta.href}" class="btn-rain btn-rain-primary btn-rain-sm mt-2">${r.cta.label} <i class="bi bi-arrow-right"></i></a>` : "";
  return `<div class="rain-reply tone-${r.tone || "info"}">
    <div class="rain-reply-heading"><i class="bi ${r.icon}"></i> ${r.heading}</div>
    <p class="rain-reply-intro">${r.intro}</p>
    ${cta}
  </div>`;
}

const RAIN_DEMO = {
  // Composite community risk score for the Dashboard's risk meter.
  // DEMO DATA — a real deployment would derive this from live PAGASA/
  // PHIVOLCS/NDRRMC feeds plus the user's registered barangay.
  // NOTE: Community Risk is intentionally NOT seeded here. It's computed
  // live in dashboard.html from the app's real current state (active alerts,
  // resident-submitted incidents, volcano alert levels, and the cached
  // weather reading) instead of being a fabricated static number — see
  // computeCommunityRisk() in dashboard.html.

  // Reported incidents shown on the Live Situation Map. Left empty on purpose:
  // real incidents come from resident reports stored in Supabase.
  incidents: [],

  // REFERENCE ONLY -- not a live feed. The official alert level has no public
  // API, so this value is typed in by hand and shown as static reference
  // information. Always verify the current level at phivolcs.dost.gov.ph.
  // (Live volcano data on volcano.html comes from the USGS VolcView API.)
  volcanoes: [
    { name: "Taal Volcano", location: "Batangas, Calabarzon", level: 1, status: "Low-Level Unrest", eruptions: 33, updated: "Reference value — check PHIVOLCS for the current level", lat: 14.0021, lng: 120.9932, desc: "Continuing background degassing from the Main Crater. The entire Taal Volcano Island is a Permanent Danger Zone." },
  ],

  // Each alert carries its OWN real coordinates now (matching its "area"
  // text) instead of being plotted at a fabricated offset from the user's
  // location. The dashboard's local map only pins alerts that are actually
  // near the user — see distance filtering in dashboard.html.
  // Left empty on purpose: live alerts are issued by administrators and read
  // from the Supabase `alerts` table, not from sample records.
  alerts: [],

  // EMERGENCY CONTACTS -- source: Tanauan City CDRRMO.
  // TODO: replace/extend with the contact list provided by the CDRRMO.
  // Each entry: { name, number, tag }  (tag: Police | Fire | Medical | NDRRMC | CDRRMO)
  // The four national hotlines below are placeholders until the CDRRMO list is
  // entered -- verify every number before deployment.
  emergencyContacts: [
    { name: "Philippine National Police", number: "117", tag: "Police" },
    { name: "Bureau of Fire Protection", number: "160", tag: "Fire" },
    { name: "Medical Emergency", number: "911", tag: "Medical" },
    { name: "NDRRMC Operations Center", number: "(02) 8911-1406", tag: "NDRRMC" },
  ],

  // EVACUATION CENTERS -- source: Tanauan City CDRRMO.
  // TODO: enter the evacuation centers provided by the CDRRMO. Sample records
  // from other cities were removed so the app only shows CDRRMO data.
  // Each entry:
  //   { name, type, category, address, lat, lng, contact, facilities }
  //   category: "shelter" | "government" | "mall"   (drives the map pin)
  //   lat/lng : the center's actual coordinates
  // Example (do not use as real data):
  //   { name: "Barangay X Covered Court", type: "Covered Court", category: "shelter",
  //     address: "Brgy. X, Tanauan City, Batangas", lat: 0, lng: 0,
  //     contact: "(043) 000-0000", facilities: "Water, first aid" },
  evacuationCenters: [],

  quickPrompts: [
    "What to do during an earthquake?",
    "How to prepare for a typhoon?",
    "Volcanic eruption signs?",
    "Where can I find emergency contacts?",
  ],

  aiReplies: {
    en: {
      earthquake: rainStructuredReply({ icon: "bi-activity", tone: "warning", heading: "EARTHQUAKE SAFETY", intro: "Follow these steps immediately when shaking starts.", steps: ["Drop, Cover, and Hold On under sturdy furniture", "Stay away from windows and heavy objects", "If outdoors, move to an open area away from buildings and power lines", "After shaking stops, check for injuries and hazards like gas leaks before evacuating calmly"], cta: { label: "View evacuation centers", href: "emergency.html#evac" } }),
      typhoon: rainStructuredReply({ icon: "bi-hurricane", tone: "caution", heading: "TYPHOON PREPARATION", intro: "Heavy rainfall and strong winds may affect your area.", steps: ["Secure loose outdoor items", "Charge devices and power banks", "Store at least 3 days of water and food", "Know your barangay's evacuation center", "Monitor official PAGASA bulletins for the storm's track and signal number"], cta: { label: "Check current weather", href: "weather.html" } }),
      flood: rainStructuredReply({ icon: "bi-water", tone: "critical", heading: "FLOOD PRECAUTION", intro: "Heavy rainfall is currently affecting parts of your area.", steps: ["Move valuables to higher ground", "Avoid flooded roads and fast-moving water", "Prepare your emergency kit and important documents", "Follow evacuation orders from local officials without delay"], cta: { label: "View nearest shelter", href: "emergency.html#evac" } }),
      volcano: rainStructuredReply({ icon: "bi-triangle", tone: "warning", heading: "VOLCANIC ACTIVITY", intro: "Signs of possible unrest include increased seismicity, ground deformation, sulfur odor, and steaming.", steps: ["Always rely on official PHIVOLCS alert levels, not signs alone", "Avoid entry into the Permanent Danger Zone for your volcano", "Prepare dust masks and goggles in case of ashfall", "Follow evacuation guidance for your area's danger zone if issued"], cta: { label: "View volcano monitoring", href: "volcano.html" } }),
      contacts: rainStructuredReply({ icon: "bi-telephone", tone: "info", heading: "EMERGENCY CONTACTS", intro: "Official emergency numbers for the Philippines.", steps: ["Philippine National Police — 117", "Bureau of Fire Protection — 160", "Medical Emergency — 911", "NDRRMC Operations Center"], cta: { label: "Open Emergency page", href: "emergency.html" } }),
      default: "I can help with general guidance on earthquakes, typhoons, floods, volcanic eruptions, and evacuation preparedness. For life-threatening emergencies happening right now, please contact 911 or your local emergency services immediately — I'm not a substitute for official responders.",
    },
    fil: {
      earthquake: rainStructuredReply({ icon: "bi-activity", tone: "warning", heading: "KALIGTASAN SA LINDOL", intro: "Sundin ang mga hakbang na ito kapag nagsimula ang pagyanig.", steps: ["Duck, Cover, at Hold sa ilalim ng matibay na mesa", "Lumayo sa bintana at mabibigat na bagay", "Kung nasa labas, pumunta sa bukas na lugar na malayo sa gusali at wire", "Pagkatapos ng pagyanig, suriin ang mga sugat at panganib tulad ng gas leak bago lumikas"], cta: { label: "Tingnan ang evacuation centers", href: "emergency.html#evac" } }),
      typhoon: rainStructuredReply({ icon: "bi-hurricane", tone: "caution", heading: "PAGHAHANDA SA BAGYO", intro: "Maaaring magdulot ng malakas na ulan at hangin ang bagyo sa inyong lugar.", steps: ["Siguraduhing naka-ayos ang mga bagay sa labas", "I-charge ang mga gamit at power bank", "Mag-imbak ng tubig at pagkain para sa hindi bababa sa 3 araw", "Alamin ang evacuation center ng inyong barangay", "Bantayan ang opisyal na bulletin ng PAGASA"], cta: { label: "Tingnan ang panahon", href: "weather.html" } }),
      flood: rainStructuredReply({ icon: "bi-water", tone: "critical", heading: "PAG-IINGAT SA BAHA", intro: "Kasalukuyang may malakas na ulan sa ilang bahagi ng inyong lugar.", steps: ["Ilipat ang mga mahahalagang gamit sa mataas na lugar", "Iwasan ang mga bahang daan at malakas na agos", "Ihanda ang emergency kit at mahahalagang dokumento", "Sumunod agad sa evacuation order ng mga lokal na opisyal"], cta: { label: "Tingnan ang pinakamalapit na shelter", href: "emergency.html#evac" } }),
      volcano: rainStructuredReply({ icon: "bi-triangle", tone: "warning", heading: "AKTIBIDAD NG BULKAN", intro: "Ang mga senyales ng posibleng aktibidad ay kinabibilangan ng dagdag na seismicity, pagbabago ng hugis ng lupa, amoy asupre, at pag-usok.", steps: ["Palaging sumangguni sa opisyal na alert level ng PHIVOLCS", "Iwasan ang Permanent Danger Zone ng bulkan", "Maghanda ng dust mask at goggles kung sakaling umulan ng abo", "Sumunod sa evacuation guidance kung ito ay ipinag-utos"], cta: { label: "Tingnan ang volcano monitoring", href: "volcano.html" } }),
      contacts: rainStructuredReply({ icon: "bi-telephone", tone: "info", heading: "MGA EMERGENCY CONTACT", intro: "Opisyal na numero ng emergency sa Pilipinas.", steps: ["Pulis — 117", "Bumbero — 160", "Medical Emergency — 911", "NDRRMC Operations Center"], cta: { label: "Buksan ang Emergency page", href: "emergency.html" } }),
      default: "Kaya kong tumulong sa pangkalahatang gabay tungkol sa lindol, bagyo, baha, pagputok ng bulkan, at paghahanda sa evacuation. Para sa emergency na banta sa buhay ngayon, mangyaring tumawag agad sa 911 o sa lokal na emergency services — hindi ako kapalit ng opisyal na responder.",
    },
  },
};
