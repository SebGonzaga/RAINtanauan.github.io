# Map datasets (Tanauan City) — status
All files are EMPTY until real data is supplied. Nothing is invented or approximated.
Each feature needs: name, address, source, verification ('official'|'unverified'), verifiedOn. Coordinates: WGS84 GeoJSON [lng, lat]; reproject (e.g. PRS92/UTM 51N -> EPSG:4326) before adding.
| File | Wanted source | Status |
|---|---|---|
| tanauan-barangays.geojson | NAMRIA / Geoportal PH / LGU boundary file | empty |
| tanauan-schools.geojson | DepEd list + LGU coordinates | empty |
| tanauan-barangay-halls.geojson | LGU/CDRRMO confirmation | empty |
| evacuation centers | CDRRMO (assets/js/demo-data.js `evacuationCenters`) | empty |
Basemaps: Carto Voyager (default), Esri World Imagery (satellite; attribution shown on map, check Esri terms for production use).
Marker clustering for facility points: done (Leaflet.markercluster 1.5.3 from unpkg; falls back to plain markers if it fails to load). Traffic: not done (no source verified).

## Hazard services used by flood-landslide.html (live, not stored here)
- Flood susceptibility: https://ulap-hazards.georisk.gov.ph/arcgis/rest/services/MGBPublic/Flood/MapServer (MGB, data as of July 2018 per metadata; WGS84 service, requested in EPSG:3857)
- Rain-induced landslide: https://ulap-hazards.georisk.gov.ph/arcgis/rest/services/MGBPublic/RainInducedLandslide/MapServer (MGB 2012, READY Project)
- Unverified: scale, license/terms, update cadence, whether the server allows hotlinking from your domain. Not tested from the build sandbox (no network access to this host).
- 3D terrain (flood-landslide-3d.html): AWS Open Data Terrain Tiles, Terrarium encoding, https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png (global; built from SRTM and other sources; coarse). Rendered with MapLibre GL JS 4.7.1.
- NOT USED: a third-party Hugging Face copy of "Project NOAH" PMTiles (Siesta-22/project-noah-hazard-maps). Unofficial; provenance, license and currency unverified. Official NOAH data must come from UP Resilience Institute / DOST.
- 3D buildings: OpenFreeMap vector tiles (https://tiles.openfreemap.org/planet, free, no key; attribution "OpenFreeMap (c) OpenMapTiles, data from OpenStreetMap"). Heights from OSM, default 5 m when absent.
- Point lookup: api/hazard-point.js calls the MGB MapServer `identify` operation. Response field names were NOT verified; the UI shows attributes exactly as returned.

## Research findings: public sources for the four facility layers (checked Oct 2026; downloads NOT tested from the build sandbox)
| Layer | Best public source | Status / limits |
|---|---|---|
| Barangay boundaries | HDX "Philippines - Subnational Administrative Boundaries" (COD-AB, admin levels 0-4, 42,048 barangays), from PSA/NAMRIA via OCHA; https://data.humdata.org/dataset/philippines-administrative-levels-0-to-3 ; SHP zip ~883 MB (Nov 2023 files) | Free. OCHA states the boundaries are **indicative, not official** (LMB is the official source). NAMRIA/PSA FOI replies say barangay shapefiles go through a formal request to the NAMRIA Administrator. Labeled "indicative" in the map. |
| Schools | OpenStreetMap (OSMaPaaralan project mapped ~46k schools, many from DepEd data) via Overpass; HDX "Philippines - School locations" is DepEd 2008, never updated | OSM is community data (ODbL, attribution required), "should not be considered authoritative". DepEd's masterlist has incomplete coordinates. Labeled "unverified". |
| Barangay halls | No national dataset found. Only OSM, where coverage is likely partial | Labeled "unverified"; the LGU/DILG should confirm. |
| Evacuation centers | No public official list with coordinates found (Batangas provincial and Tanauan sites have none). News reports mention DPWH/DHSUD-built centers in Tanauan without coordinates | Only the CDRRMO can supply an official list: fill data/evacuation-centers.template.csv. OSM-tagged shelters are shown as unverified candidates. |
Tanauan City facts from the city site: 48 barangays; CDRRMO (043) 728-8004 (verify before publishing).

### How to build the files (run locally, then commit data/)
**Simplest (Node 18+ only, no GIS tools):** `node scripts/build-tanauan-data.mjs --osm-boundaries` fetches boundaries, schools, halls and shelters from OpenStreetMap. All of it is labeled unverified. Upgrade later with the steps below. Check the printed barangay count (expected 48) and that the features really are in Tanauan City, Batangas.
**Better boundaries:**
1. Boundaries: download the HDX SHP zip, then e.g. `ogr2ogr -f GeoJSON -t_srs EPSG:4326 -where "adm3_pcode='PH0401031'" tanauan_adm4.geojson <the barangay (admin 4) .shp>`. Field names (adm4_name, adm3_pcode, ...) and the code PH0401031 (City of Tanauan, Batangas) were confirmed in the HDX xlsx; the shapefile's own file names were not seen. Expect 48 features.
2. `node scripts/build-tanauan-data.mjs --boundaries tanauan_adm4.geojson --evac cdrrmo-evac.csv` (omit either flag if you don't have that file; Overpass step needs internet).
3. Open the dashboard and check the layer status box. Spot-check a few schools and halls against the ground before calling anything verified.

### Verified from the HDX xlsx (v03, valid 2025-02-13; uploaded by the project owner)
- City of Tanauan, Batangas: adm3_pcode PH0401031, 48 barangays, listed in data/tanauan-barangay-list.csv (names + pcodes). Other "Tanauan" entries (Leyte PH0803748) and Catanauan (Quezon) are different places.
- The xlsx has NO polygons. Its center_lat/center_lon are area centers, not facility locations: never use them as school/hall/shelter coordinates.
- Boundary area sums to about 112.08 sq km vs 107.16 sq km on the city website (different sources/methods; unreconciled).

## Mosquito Watch (mosquito.html, supabase/006_mosquito_reports.sql)
- Reports are community data, shown unverified until an admin verifies them; residents only see verified reports, via a view that hides reporter identity. Coordinates are rounded to ~100 m by a database trigger.
- The suitability panel uses 3 simple rules on OpenWeatherMap temperature, humidity and rain (current + 5-day forecast). It is NOT a validated model and uses no mosquito or disease data. Past-week rainfall is excluded for lack of a verified source.
- Prevention text follows the DOH "4S" campaign wording.

## Air quality (air-quality.html, api/weather.js `air=` routes)
- Source: OpenWeatherMap Air Pollution API (current, forecast, history; same OPENWEATHER_API_KEY). Modeled/satellite-blended grid data, NOT a ground station and NOT DENR-EMB. Index is OpenWeatherMap's own 1-5 scale. Units: ug/m3. Free-tier limits and terms: check OpenWeatherMap pricing page before launch (not verified here).
- Page shows a staleness warning when the latest reading is over 3 h old, never fills missing pollutants with zeros, and labels the WHO 2021 24-h guideline column as reference only.
- No official DENR-EMB / PAGASA air feed integrated: no verified public API found.

## Incident export (admin-incidents.html)
- Real .xlsx via SheetJS 0.18.5 (cdnjs), plus CSV. Filters: view (active/archived), date range, category, status, barangay. Barangay filter matches the free-text location (incidents have no barangay column yet). A second sheet records the filters used. Formula-injection guard on both formats.
- Access control is Supabase RLS + the page's admin check; the export runs in the admin's browser on rows RLS already allows.

## Still NOT done (needs data, credentials, or a verified source)
- Facility/boundary GeoJSON files are still empty: the build sandbox has no network. Run `node scripts/build-tanauan-data.mjs --osm-boundaries` locally, then get the CDRRMO evacuation CSV.
- Typhoon tracking and landfall alerts: PAGASA has no verified public API; nothing implemented rather than inventing tracks.
- Traffic layer: no provider verified (TomTom/HERE need keys and terms review).
- Volcano page: no SO2/NO2/seismicity/deformation feed and no Gemini analysis added (no verified PHIVOLCS API). Existing USGS VolcView location data kept.
- "Komunidad Provider": the term appears nowhere in the code or SQL. Needs your definition before anything is built.
- Incidents lack barangay, assignee and verification columns; adding them needs a migration you should approve.

## Typhoon & Satellite Map (typhoon-map.html, api/owm-tile.js)
- Satellite loop: NASA GIBS WMTS (no key), layer Himawari_AHI_Band13_Clean_Infrared_v0_NRT_ZENJPEG, EPSG:3857 REST tiles, 30-min steps over 6 h. Layer name confirmed on GIBS servers. The tile-matrix name (GoogleMapsCompatible_Level6), max native zoom 6 and the 1-hour request lag are UNVERIFIED guesses: test live and adjust the constants at the top of the page script. Imagery (c) JMA via NASA GIBS/EOSDIS; check NASA GIBS and JMA terms before commercial/government use.
- Cloud, wind-speed, rain and pressure layers: OpenWeatherMap Weather Maps 1.0 tiles, proxied by api/owm-tile.js so OPENWEATHER_API_KEY stays server-side. Modeled data; wind layer has no direction. Tile requests count against your OpenWeatherMap plan (edge-cached 10 min); confirm the free-tier limits.
- Deliberately NOT shown: official storm position/track/signals (no verified PAGASA API). The page says so and links to PAGASA's bulletin.

## Official storm bulletin (typhoon-map.html, supabase/007_typhoon_bulletins.sql)
- Human-entered copy of the current PAGASA tropical-cyclone bulletin: storm name, issue time, optional center position, intensity, max winds, movement, wind-signal areas, summary, mandatory https source link and mandatory expiry. NOT an automated feed.
- RLS: signed-in users read; only admins insert/update/delete (same is_admin() pattern as alerts). Page shows only unexpired rows, warns when the bulletin is over 6 h old, and says an empty state does not mean no storm.
- Run 007 in the Supabase SQL Editor before use. Until then the card says the table may not be set up.

## Incident barangay + assignee (supabase/008_incident_barangay_assignee.sql)
- Adds incidents.barangay (chosen in report.html from data/tanauan-barangay-list.csv) and incidents.assigned_to (no FK on purpose: a second FK to profiles would make the existing `profiles(full_name)` embeds in dashboard.html and admin-incidents.html ambiguous).
- Tightens the resident INSERT policy: new rows must be pending, unassigned and unarchived (the old policy let a direct API call insert an already-verified row).
- report.html retries without `barangay` if the column doesn't exist yet, so reports keep working before the migration is run. Admin "Assign to me" and the barangay filter need 008.
- Older reports have no barangay; the admin barangay filter also matches their location text (usually raw coordinates, so it rarely hits).

## Volcano alert level (volcano.html, supabase/009_volcano_status.sql)
- Replaces the hardcoded "Level 1" card. Admins copy the current PHIVOLCS level, bulletin time and link; residents see it with an "as of" time and a stale warning after 3 days. With no entry the page says so instead of showing a level. Human-entered, not an automated feed.
- Links to air-quality.html with a note that those values are modeled, not Taal gas measurements.
- Still NOT done for the volcano page: SO2/NO2 satellite or station data, seismicity, deformation, Gemini summary.

## API rate limiting (api/_lib/ratelimit.js)
- /api/weather: 90 requests/min per IP; /api/owm-tile: 900/min per IP (a map load fetches many tiles). Best effort only: counters live in one warm serverless instance, so this is not a hard global limit. Use a shared store (Vercel KV/Upstash/Supabase) if you need one. api/chat.js and api/notifications.js were not changed.

## Nightly AI digest (additional feature; api/daily-digest.js, supabase/010_ai_digests.sql, assets/js/ai-digest-card.js)
- Does NOT replace the admin-entered PHIVOLCS/PAGASA data, the weather API data or any existing card. It adds a separate card labeled "AI-generated, unofficial" on volcano.html and heat-index.html.
- Runs from Vercel Cron: `0 16 * * *` UTC = 00:00 Philippine time. Vercel cron is UTC-only; on the Hobby plan it runs once a day and may fire anywhere within that hour. Production deployments only. Cron may rarely fire twice; the job is idempotent (one row per kind per Philippine day, a good row is never overwritten).
- Reads ONLY the pages you set: DIGEST_VOLCANO_URL, DIGEST_HEAT_URL (https). No URLs are hardcoded because no stable "latest bulletin" address was verified (PHIVOLCS posts each bulletin as its own dated page). Check each site's terms of use before enabling; sites may block server requests or change layout, in which case the card says so instead of showing guesses.
- Safeguards: the model sees only the fetched text; any number in its summary must appear in the source text or the summary is not published; the alert level is read by a regex only if the page names exactly one level; every row stores source URL, fetch time and a hash of the text.
- Env vars: CRON_SECRET (required, 16+ random characters), SUPABASE_SERVICE_ROLE_KEY, SUPABASE_URL, GEMINI_API_KEY, DIGEST_VOLCANO_URL, DIGEST_HEAT_URL.
- Not done: heat-index bulletins that are images (needs a vision step); a manual "run now" button (use Vercel dashboard > Cron Jobs > Run, or call the endpoint with the Bearer secret).

## "Air condition at my location" (chat tool get_air_quality, air-quality.html, virtual-assistance.html)
- The assistant's get_air_quality tool reads OpenWeather Air Pollution (modeled/satellite-based grid estimate, not a ground station) for the person's shared location, saved city, a named place, or the Tanauan City center as the last fallback; it says when it assumed the default. WHO 2021 24-hour guideline exceedances are computed in code, not by the AI.
- "Use my location" (chat page and air-quality page) asks the browser once, rounds to about 100 m, and keeps the point only in sessionStorage (chat) or page memory (air page). It is sent to our API and to OpenWeather to look up the reading, and is not written to the database by this code.
- Volcanic gas near Taal is not separately monitored here; SO2 shown is the model's grid value. Volcanic hazards stay with PHIVOLCS.
