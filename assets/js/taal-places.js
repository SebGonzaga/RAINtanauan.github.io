/* =========================================================================
   RAIN — assets/js/taal-places.js
   Curated list of cities/municipalities in RAIN's Calabarzon coverage area
   (Taal Volcano's danger zone + immediate vicinity, plus the Laguna/Calamba
   area also referenced elsewhere in the app). Used to power the City
   dropdown on register.html / profile.html, and to turn a browser
   geolocation reading into a nearest-match place name for the
   "Use my current location" option.

   Coordinates are town-center approximations — good enough for nearest-
   match lookups, not for precise routing or addressing.
   ========================================================================= */
window.TaalPlaces = (function () {
  "use strict";

  const PLACES = [
    // --- Batangas: Taal Volcano Permanent Danger Zone & immediate vicinity
    { name: "Talisay, Batangas", lat: 14.0994, lng: 121.0125, group: "Near Taal Volcano" },
    { name: "Laurel, Batangas", lat: 14.0000, lng: 120.9167, group: "Near Taal Volcano" },
    { name: "Agoncillo, Batangas", lat: 13.9667, lng: 120.9167, group: "Near Taal Volcano" },
    { name: "San Nicolas, Batangas", lat: 13.9167, lng: 121.0167, group: "Near Taal Volcano" },
    { name: "Balete, Batangas", lat: 14.0167, lng: 121.0000, group: "Near Taal Volcano" },
    { name: "Alitagtag, Batangas", lat: 13.8833, lng: 121.0000, group: "Near Taal Volcano" },
    { name: "Cuenca, Batangas", lat: 13.9167, lng: 121.0500, group: "Near Taal Volcano" },
    { name: "Mataasnakahoy, Batangas", lat: 13.9167, lng: 121.1000, group: "Near Taal Volcano" },
    { name: "Malvar, Batangas", lat: 14.0500, lng: 121.1500, group: "Near Taal Volcano" },
    { name: "Sto. Tomas, Batangas", lat: 14.1078, lng: 121.1414, group: "Near Taal Volcano" },
    { name: "Tanauan City, Batangas", lat: 14.0863, lng: 121.1497, group: "Near Taal Volcano" },
    { name: "Lipa City, Batangas", lat: 13.9411, lng: 121.1622, group: "Near Taal Volcano" },
    { name: "Bauan, Batangas", lat: 13.7925, lng: 121.0083, group: "Near Taal Volcano" },
    { name: "Batangas City, Batangas", lat: 13.7565, lng: 121.0583, group: "Near Taal Volcano" },
    // --- Cavite side of the lake
    { name: "Tagaytay City, Cavite", lat: 14.0975, lng: 120.9639, group: "Near Taal Volcano" },
    // --- Laguna / Calamba area (RAIN's other main coverage area)
    { name: "Calamba City, Laguna", lat: 14.2117, lng: 121.1653, group: "Laguna / Calamba Area" },
    { name: "Los Baños, Laguna", lat: 14.1693, lng: 121.2417, group: "Laguna / Calamba Area" },
    { name: "Alaminos, Laguna", lat: 14.0639, lng: 121.2453, group: "Laguna / Calamba Area" },
    { name: "San Pablo City, Laguna", lat: 14.0683, lng: 121.3256, group: "Laguna / Calamba Area" },
    { name: "Sta. Rosa, Laguna", lat: 14.3122, lng: 121.1114, group: "Laguna / Calamba Area" },
    { name: "Cabuyao, Laguna", lat: 14.2726, lng: 121.1256, group: "Laguna / Calamba Area" },
  ];

  const OTHER_VALUE = "__other__";

  function haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /** Finds the closest listed place to a given lat/lng. */
  function nearest(lat, lng) {
    let best = null;
    let bestDist = Infinity;
    for (const p of PLACES) {
      const d = haversineKm(lat, lng, p.lat, p.lng);
      if (d < bestDist) {
        bestDist = d;
        best = p;
      }
    }
    return best ? { place: best, distanceKm: bestDist } : null;
  }

  /** Fills a <select> with optgroups per region, plus a trailing "Other" option. */
  function populateSelect(selectEl) {
    const groups = {};
    PLACES.forEach((p) => {
      (groups[p.group] = groups[p.group] || []).push(p);
    });
    Object.keys(groups).forEach((groupName) => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = groupName;
      groups[groupName].forEach((p) => {
        const opt = document.createElement("option");
        opt.value = p.name;
        opt.textContent = p.name;
        optgroup.appendChild(opt);
      });
      selectEl.appendChild(optgroup);
    });
    const otherOpt = document.createElement("option");
    otherOpt.value = OTHER_VALUE;
    otherOpt.textContent = "Other (not listed)";
    selectEl.appendChild(otherOpt);
  }

  return { PLACES, OTHER_VALUE, haversineKm, nearest, populateSelect };
})();
