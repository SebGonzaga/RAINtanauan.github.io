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
  // Each entry: { name, number, numbers[], tag }  (tag: Police | Fire | Medical | NDRRMC | CDRRMO | Coast Guard | Traffic)
  // `number` is the first number (used by Emergency Mode's quick-dial); `numbers` lists every line shown on the Emergency page.
  // Numbers supplied by the project team -- verify each one with the CDRRMO before deployment.
  emergencyContacts: [
    {"name":"National Emergency","number":"911","numbers":["911"],"tag":"Police"},
    {"name":"CDRRMO Tanauan","number":"0962 347 5073","numbers":["0962 347 5073"],"tag":"CDRRMO"},
    {"name":"BFP Tanauan City","number":"(043) 702-9678","numbers":["(043) 702-9678","0922 344 8887"],"tag":"Fire"},
    {"name":"PNP Tanauan","number":"0939-322-7848","numbers":["0939-322-7848","0977-685-6947"],"tag":"Police"},
    {"name":"Philippine Red Cross","number":"0930 358 3051","numbers":["0930 358 3051"],"tag":"Medical"},
    {"name":"Philippine Coast Guard Batangas","number":"0956-904-6653","numbers":["0956-904-6653","0997-912-5851"],"tag":"Coast Guard"},
    {"name":"Traffic Management Office","number":"(043) 778 4829","numbers":["(043) 778 4829"],"tag":"Traffic"},
  ],

  // EVACUATION CENTERS -- source: Tanauan City CDRRMO (shelters, schools, covered courts).
  // Each entry: { name, type, category, address, lat, lng }  category: "shelter" | "government" | "mall"
  evacuationCenters: [
    {"name":"Tanauan City Gymnasium / Evacuation Hub (Poblacion)","category":"shelter","type":"Evacuation Center","address":"Brgy. Poblacion Barangay 1","lat":14.0865,"lng":121.1518},
    {"name":"Bañadero Covered Court & Evacuation Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Bañadero","lat":14.0861,"lng":121.0711},
    {"name":"Boot Barangay Gymnasium / Evacuation Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Boot","lat":14.0548,"lng":121.0858},
    {"name":"Balele Multi-Purpose Evacuation Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Balele","lat":14.0624,"lng":121.0916},
    {"name":"Darasa Barangay Covered Court & Evacuation Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Darasa","lat":14.0672,"lng":121.1531},
    {"name":"Altura South Covered Court & Evacuation Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Sambat","lat":14.0789,"lng":121.1238},
    {"name":"Natatas Multi-Purpose Evacuation Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Pagaspas","lat":14.0934,"lng":121.1442},
    {"name":"Janopol Oriental Evacuation Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Janopol Oriental","lat":14.0811,"lng":121.0983},
    {"name":"Trapiche Evacuation & Multi-Purpose Center","category":"shelter","type":"Evacuation Center","address":"Brgy. Poblacion Barangay 4","lat":14.0911,"lng":121.1488},
    {"name":"Ambulong Multi-Purpose Facility","category":"shelter","type":"Evacuation Center","address":"Brgy. Janopol","lat":14.0874,"lng":121.0851},
    {"name":"Tanauan North Central Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Poblacion Barangay 1","lat":14.0894,"lng":121.1494},
    {"name":"Tanauan South Central Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Poblacion Barangay 1","lat":14.0867,"lng":121.15},
    {"name":"Natatas Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Natatas","lat":14.082,"lng":121.1196},
    {"name":"Bañadero Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Bañadero","lat":14.0858,"lng":121.0715},
    {"name":"Boot Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Boot","lat":14.0545,"lng":121.0861},
    {"name":"Balele Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Balele","lat":14.062,"lng":121.0912},
    {"name":"Darasa Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Darasa","lat":14.0678,"lng":121.1528},
    {"name":"Janopol Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Janopol Oriental","lat":14.0815,"lng":121.098},
    {"name":"Trapiche Elementary School","category":"shelter","type":"Public Elementary School","address":"Tanauan City, Batangas","lat":14.0915,"lng":121.1485},
    {"name":"Ambulong Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Janopol","lat":14.087,"lng":121.0855},
    {"name":"Bagumbayan Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Poblacion Barangay 3","lat":14.0785,"lng":121.1525},
    {"name":"Santor Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Bagumbayan","lat":14.0715,"lng":121.1242},
    {"name":"Pantay Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Pantay Matanda","lat":14.122,"lng":121.1195},
    {"name":"Cale Elementary School","category":"shelter","type":"Public Elementary School","address":"Brgy. Pantay Matanda","lat":14.1205,"lng":121.1178},
    {"name":"Tanauan City National High School","category":"shelter","type":"Public High School","address":"Brgy. Poblacion Barangay 2","lat":14.0845,"lng":121.1502},
    {"name":"Tanauan School of Fisheries (Ambulong)","category":"shelter","type":"Public High School","address":"Brgy. Talaga","lat":14.088,"lng":121.0842},
    {"name":"Balele National High School","category":"shelter","type":"Public High School","address":"Brgy. Balele","lat":14.0628,"lng":121.092},
    {"name":"Boot National High School","category":"shelter","type":"Public High School","address":"Brgy. Boot","lat":14.055,"lng":121.0852},
    {"name":"Janopol National High School","category":"shelter","type":"Public High School","address":"Brgy. Janopol Oriental","lat":14.0808,"lng":121.0988},
    {"name":"Natatas National High School","category":"shelter","type":"Public High School","address":"Brgy. Pagaspas","lat":14.093,"lng":121.1438},
    {"name":"First Asia Institute of Technology and Humanities","category":"shelter","type":"College / Private School","address":"Brgy. Poblacion Barangay 3","lat":14.0812,"lng":121.1535},
    {"name":"La Consolacion College Tanauan","category":"shelter","type":"College / Private School","address":"Brgy. Poblacion Barangay 1","lat":14.0852,"lng":121.151},
    {"name":"Tanauan Institute","category":"shelter","type":"College / Private School","address":"Brgy. Poblacion Barangay 4","lat":14.087,"lng":121.149},
    {"name":"Christian College of Tanauan","category":"shelter","type":"College / Private School","address":"Brgy. Poblacion Barangay 2","lat":14.0838,"lng":121.152},
  ],

  // BARANGAY HALLS (48). approx:true = pin is the barangay centre from the boundary file, NOT a confirmed hall location.
  barangays: [
    {"name":"Altura Bata","hall":"Barangay centre (from boundary file)","lat":14.12492,"lng":121.07776,"approx":true},
    {"name":"Altura Matanda","hall":"Barangay centre (from boundary file)","lat":14.13463,"lng":121.08074,"approx":true},
    {"name":"Altura South","hall":"Barangay centre (from boundary file)","lat":14.1273,"lng":121.09013,"approx":true},
    {"name":"Ambulong","hall":"Barangay centre (from boundary file)","lat":14.09025,"lng":121.05844,"approx":true},
    {"name":"Bañadero","hall":"Banadero Barangay Hall","lat":14.0861,"lng":121.0711,"approx":false},
    {"name":"Bagbag","hall":"Barangay centre (from boundary file)","lat":14.04743,"lng":121.09748,"approx":true},
    {"name":"Bagumbayan","hall":"Barangay centre (from boundary file)","lat":14.075,"lng":121.13266,"approx":true},
    {"name":"Balele","hall":"Balele Barangay Hall","lat":14.0624,"lng":121.0916,"approx":false},
    {"name":"Banjo East","hall":"Barangay centre (from boundary file)","lat":14.05692,"lng":121.14094,"approx":true},
    {"name":"Banjo Laurel (West)","hall":"Barangay centre (from boundary file)","lat":14.05373,"lng":121.12449,"approx":true},
    {"name":"Bilog-bilog","hall":"Barangay centre (from boundary file)","lat":14.10938,"lng":121.0827,"approx":true},
    {"name":"Boot","hall":"Boot Barangay Hall","lat":14.0548,"lng":121.0858,"approx":false},
    {"name":"Cale","hall":"Barangay centre (from boundary file)","lat":14.11273,"lng":121.09802,"approx":true},
    {"name":"Darasa","hall":"Darasa Barangay Hall","lat":14.0672,"lng":121.1531,"approx":false},
    {"name":"Pagaspas","hall":"Pagaspas Barangay Hall","lat":14.0991,"lng":121.1375,"approx":false},
    {"name":"Gonzales","hall":"Barangay centre (from boundary file)","lat":14.07383,"lng":121.07364,"approx":true},
    {"name":"Hidalgo","hall":"Barangay Hidalgo Hall","lat":14.0709,"lng":121.1411,"approx":false},
    {"name":"Janopol","hall":"Barangay centre (from boundary file)","lat":14.08206,"lng":121.08486,"approx":true},
    {"name":"Janopol Oriental","hall":"Janopol Oriental Brgy Hall","lat":14.0811,"lng":121.0983,"approx":false},
    {"name":"Laurel","hall":"Barangay centre (from boundary file)","lat":14.14435,"lng":121.10605,"approx":true},
    {"name":"Luyos","hall":"Barangay centre (from boundary file)","lat":14.11989,"lng":121.0701,"approx":true},
    {"name":"Mabini","hall":"Barangay centre (from boundary file)","lat":14.05467,"lng":121.1053,"approx":true},
    {"name":"Malaking Pulo","hall":"Barangay centre (from boundary file)","lat":14.13742,"lng":121.09166,"approx":true},
    {"name":"Maria Paz","hall":"Barangay centre (from boundary file)","lat":14.03924,"lng":121.06655,"approx":true},
    {"name":"Maugat","hall":"Maugat Barangay Hall","lat":14.0988,"lng":121.0694,"approx":false},
    {"name":"Montaña (Ik-ik)","hall":"Barangay centre (from boundary file)","lat":14.12891,"lng":121.06478,"approx":true},
    {"name":"Natatas","hall":"Barangay centre (from boundary file)","lat":14.07633,"lng":121.11415,"approx":true},
    {"name":"Pantay Matanda","hall":"Barangay centre (from boundary file)","lat":14.11578,"lng":121.11935,"approx":true},
    {"name":"Pantay Bata","hall":"Barangay centre (from boundary file)","lat":14.12629,"lng":121.1112,"approx":true},
    {"name":"Poblacion Barangay 1","hall":"Poblacion 1 New Brgy Hall","lat":14.0863,"lng":121.1511,"approx":false},
    {"name":"Poblacion Barangay 2","hall":"Barangay centre (from boundary file)","lat":14.08355,"lng":121.15202,"approx":true},
    {"name":"Poblacion Barangay 3","hall":"Poblacion 3 Sampalucan Hall","lat":14.0789,"lng":121.1539,"approx":false},
    {"name":"Poblacion Barangay 4","hall":"Barangay centre (from boundary file)","lat":14.08843,"lng":121.14791,"approx":true},
    {"name":"Poblacion Barangay 5","hall":"Barangay centre (from boundary file)","lat":14.08248,"lng":121.14903,"approx":true},
    {"name":"Poblacion Barangay 6","hall":"Barangay centre (from boundary file)","lat":14.08711,"lng":121.14602,"approx":true},
    {"name":"Poblacion Barangay 7","hall":"Barangay centre (from boundary file)","lat":14.08022,"lng":121.14659,"approx":true},
    {"name":"Sala","hall":"Barangay centre (from boundary file)","lat":14.10202,"lng":121.1149,"approx":true},
    {"name":"Sambat","hall":"Barangay centre (from boundary file)","lat":14.08234,"lng":121.13389,"approx":true},
    {"name":"San Jose","hall":"Barangay centre (from boundary file)","lat":14.11305,"lng":121.06813,"approx":true},
    {"name":"Santol (Doña Jacoba Garcia)","hall":"Barangay centre (from boundary file)","lat":14.14989,"lng":121.08762,"approx":true},
    {"name":"Santor","hall":"Barangay centre (from boundary file)","lat":14.08748,"lng":121.11437,"approx":true},
    {"name":"Sulpoc","hall":"Barangay centre (from boundary file)","lat":14.14268,"lng":121.05703,"approx":true},
    {"name":"Suplang","hall":"Barangay centre (from boundary file)","lat":14.14764,"lng":121.06611,"approx":true},
    {"name":"Talaga","hall":"Barangay centre (from boundary file)","lat":14.09416,"lng":121.08317,"approx":true},
    {"name":"Tinurik","hall":"Barangay centre (from boundary file)","lat":14.06575,"lng":121.12084,"approx":true},
    {"name":"Trapiche","hall":"Barangay centre (from boundary file)","lat":14.09184,"lng":121.1291,"approx":true},
    {"name":"Ulango","hall":"Barangay centre (from boundary file)","lat":14.1362,"lng":121.11432,"approx":true},
    {"name":"Wawa","hall":"Barangay centre (from boundary file)","lat":14.06029,"lng":121.0778,"approx":true},
  ],

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
