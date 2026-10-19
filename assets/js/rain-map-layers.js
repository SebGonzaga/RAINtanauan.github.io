/* RAIN — map add-ons: satellite toggle, GeoJSON facility/boundary layers, search, legend, status.
   Usage: RainMapLayers.attach(map, { base: tileLayer, baseName: "Default" }). Data lives in /data/*.geojson (WGS84). */
window.RainMapLayers = (function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const inPH = (c) => Array.isArray(c) && c[0] >= 116 && c[0] <= 127.5 && c[1] >= 4 && c[1] <= 21.5;
  const DEFS = [
    { key: "barangays", label: "Barangay boundaries", file: "data/tanauan-barangays.geojson", color: "#2563eb" },
    { key: "schools", label: "Schools", file: "data/tanauan-schools.geojson", color: "#7c3aed", icon: "bi-mortarboard-fill" },
    { key: "halls", label: "Barangay halls", file: "data/tanauan-barangay-halls.geojson", color: "#0f766e", icon: "bi-bank2" },
    { key: "evac", label: "Evacuation centers", file: "data/tanauan-evacuation-centers.geojson", color: "#dc2626", icon: "bi-house-heart-fill" },
  ];

  function attach(map, opts) {
    opts = opts || {};
    const sat = L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { maxZoom: 19, attribution: "Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community" });
    const bases = {}; if (opts.base) bases[opts.baseName || "Default"] = opts.base; bases["Satellite"] = sat;
    const overlays = {}, index = [], loaded = {};
    if (map.attributionControl) map.attributionControl.addAttribution("Facility data: OpenStreetMap contributors (ODbL); boundaries: PSA/NAMRIA via OCHA");
    const ctl = L.control.layers(bases, overlays, { collapsed: window.innerWidth < 600 }).addTo(map);

    const status = L.control({ position: "bottomleft" });
    status.onAdd = function () { this._d = L.DomUtil.create("div", "leaflet-bar"); this._d.style.cssText = "background:#fff;padding:4px 8px;font-size:.72rem;max-width:230px"; this._d.textContent = "Loading map data…"; return this._d; };
    status.addTo(map);
    const lines = {};
    const setStatus = () => { status._d.innerHTML = DEFS.map((d) => esc(d.label) + ": " + esc(lines[d.key] || "…")).join("<br>"); };

    DEFS.forEach((d) => {
      fetch(d.file, { cache: "no-cache" }).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((gj) => {
        let skipped = 0;
        const feats = (gj.features || []).filter((f) => {
          const c = f.geometry && f.geometry.coordinates;
          const pt = f.geometry && f.geometry.type === "Point" ? c : f.geometry && (c.flat(3).slice(0, 2));
          const ok = f.geometry && inPH(pt); if (!ok) skipped++; return ok;
        });
        // Cluster point layers when the markercluster plugin is loaded (falls back to plain markers otherwise).
        const isPoint = d.key !== "barangays";
        const cluster = isPoint && L.markerClusterGroup ? L.markerClusterGroup({ showCoverageOnHover: false, maxClusterRadius: 45 }) : null;
        const layer = L.geoJSON({ type: "FeatureCollection", features: feats }, {
          style: { color: d.color, weight: 2, fillOpacity: 0.05 },
          pointToLayer: (f, ll) => L.marker(ll, { icon: window.rainPinIcon ? rainPinIcon(d.key, d.icon) : undefined }),
          onEachFeature: (f, l) => {
            const p = f.properties || {}, official = p.verification === "official";
            l.bindPopup(`<strong>${esc(p.name)}</strong><br>${esc(p.address || "")}<br><small>Source: ${esc(p.source || "not stated")}<br>` +
              `${official ? "Official" : p.verification === "indicative" ? "<b>Indicative</b> (not an official boundary)" : "<b>Unverified</b>"}${p.verifiedOn ? " · verified " + esc(p.verifiedOn) : ""}</small>`);
            if (p.name) index.push({ name: String(p.name), layer: l });
            if (d.key === "barangays" && p.name) l.bindTooltip(esc(p.name), { permanent: true, direction: "center", className: "rain-brgy-label" });
          },
        });
        let shown = layer;
        if (cluster) { cluster.addLayer(layer); shown = cluster; }
        loaded[d.key] = shown; ctl.addOverlay(shown, d.label); shown.addTo(map);
        lines[d.key] = feats.length ? feats.length + " loaded" + (skipped ? ", " + skipped + " skipped (invalid coords)" : "") : "no data yet";
        setStatus();
      }).catch((e) => { lines[d.key] = "failed to load"; setStatus(); console.warn("RainMapLayers", d.file, e); });
    });

    const search = L.control({ position: "topleft" });
    search.onAdd = function () {
      const i = L.DomUtil.create("input"); i.type = "search"; i.placeholder = "Search barangay/facility"; i.setAttribute("aria-label", "Search map");
      i.style.cssText = "padding:5px 8px;border:1px solid #ccc;border-radius:6px;font-size:.8rem;width:170px";
      L.DomEvent.disableClickPropagation(i);
      i.addEventListener("keydown", (e) => {
        if (e.key !== "Enter") return;
        const q = i.value.trim().toLowerCase(), hit = q && index.find((x) => x.name.toLowerCase().includes(q));
        if (!hit) { i.style.borderColor = "#dc2626"; return; }
        i.style.borderColor = "#ccc";
        if (hit.layer.getBounds) { map.fitBounds(hit.layer.getBounds()); hit.layer.openPopup(); }
        else { map.flyTo(hit.layer.getLatLng(), 17); map.once("moveend", () => hit.layer.openPopup()); }
      });
      return i;
    };
    search.addTo(map);

    const legend = L.control({ position: "bottomright" });
    legend.onAdd = function () {
      const d = L.DomUtil.create("div", "leaflet-bar");
      d.style.cssText = "background:#fff;padding:6px 8px;font-size:.72rem";
      d.innerHTML = "<b>Layers</b><br>" + DEFS.map((x) => `<span style="color:${x.color}">&#9632;</span> ${esc(x.label)}`).join("<br>") +
        "<br><small>Unverified items are labeled in their popup.</small>";
      return d;
    };
    legend.addTo(map);
    return { layers: loaded };
  }
  return { attach };
})();
