/* =========================================================================
   RAIN — sw.js (service worker)
   Makes the app shell (HTML/CSS/JS + the emergency-critical pages) load
   offline. This is deliberately NOT a "cache everything forever" worker:

   - App-shell files (HTML/CSS/JS/icons/manifest) are precached on install
     and served network-first with a cache fallback, so an online device
     always gets the current build and an offline device still opens using
     whatever was last cached.
   - Navigating to any known page falls back to the cached copy of THAT
     page if the network is unavailable (network-first, cache fallback),
     and falls back to the cached dashboard if the exact page was never
     visited before.
   - Live data requests (Supabase, USGS, OpenWeather, the /api/* Vercel
     functions, PHIVOLCS/volcview) are deliberately left alone — they go
     to the network as normal. Offline *readings* for that data are
     handled by assets/js/offline-store.js writing known-good snapshots
     to localStorage, not by the service worker caching API responses.
     That keeps "what the user sees offline" honest and explicit instead
     of silently replaying a stale network response.
   ========================================================================= */

// These get auto-filled at deploy time by scripts/build-sw.js (run via
// `npm run build` in Vercel) with the current git commit hash, so a new
// cache name — and therefore a full cache bust — happens on EVERY deploy
// automatically. No one has to remember to hand-edit a version string.
// If you're running this file locally without the build step, these
// placeholders just mean "always treat this as a fresh version."
const CACHE_VERSION = "rain-shell-__SW_BUILD_ID__";
const RUNTIME_CACHE = "rain-runtime-__SW_BUILD_ID__";

// Every page in the app, so a resident who only ever opened the dashboard
// can still navigate to Emergency/Alerts/Weather/etc. once offline, not
// just reload the one page they happened to be on.
const APP_PAGES = [
  "./index.html",
  "./login.html",
  "./register.html",
  "./dashboard.html",
  "./weather.html",
  "./volcano.html",
  "./earthquake.html",
  "./virtual-assistance.html",
  "./emergency.html",
  "./alerts.html",
  "./report.html",
  "./profile.html",
  "./admin-dashboard.html",
  "./admin-alerts.html",
  "./admin-incidents.html",
  "./admin-analytics.html",
  "./admin-users.html",
];

const STATIC_ASSETS = [
  "./",
  "./manifest.json",
  "./assets/css/style.css",
  "./assets/js/animations.js",
  "./assets/js/demo-data.js",
  "./assets/js/weather-timely.js",
  "./assets/js/rain-auth.js",
  "./assets/js/icons.js",
  "./assets/js/main.js",
  "./assets/js/offline-store.js",
  "./assets/js/supabase-client.js",
  "./assets/js/taal-places.js",
  "./assets/icons/icon-192.png",
  "./assets/icons/icon-512.png",
  "./assets/icons/icon-maskable-512.png",
];

const PRECACHE_URLS = [...APP_PAGES, ...STATIC_ASSETS];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION && key !== RUNTIME_CACHE)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Requests we never want to intercept: live/third-party data APIs. Letting
// these fall straight through to the network keeps alerts, weather, quake
// and chat data honest — the service worker never serves a stale API
// response as if it were current.
const NEVER_CACHE_PATTERNS = [
  /\/api\//,                          // Vercel functions: chat, weather, notifications
  /supabase\.co/,                     // Supabase REST/auth/realtime
  /earthquake\.usgs\.gov/,            // USGS quake feed
  /volcview\.wr\.usgs\.gov/,          // PHIVOLCS-style volcano feed
  /openstreetmap\.org\/directions/,   // external directions link, not app content
];

function isNeverCache(url) {
  return NEVER_CACHE_PATTERNS.some((re) => re.test(url));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never touch POST/PUT (form submits, API writes)

  const url = new URL(req.url);
  if (isNeverCache(req.url)) return; // let live data hit the network untouched

  // App navigations (typing a URL, following a link, reloading a page):
  // try the network first so logged-in users see fresh content, but fall
  // back to the cached shell — and finally the cached dashboard — the
  // moment the network is unreachable.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(req);
          if (cached) return cached;
          const fallback = await caches.match("./dashboard.html");
          return fallback || caches.match("./index.html");
        })
    );
    return;
  }

  // Same-origin static assets (CSS/JS/icons): network-first, cache
  // fallback. This used to be cache-first (serve the cached copy
  // instantly, refresh in the background for "next time"), but that meant
  // a device that had ever cached an older build would keep serving that
  // exact same JS/CSS forever — the version bump above only clears the
  // *old* cache name, it doesn't help if CACHE_VERSION itself never
  // changes on a given deploy. Network-first costs one round-trip per
  // asset when online, but guarantees a live page always gets the code
  // that matches it, and offline devices still fall back to whatever was
  // last cached.
  if (url.origin === self.location.origin) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Third-party static resources (Bootstrap/Leaflet/fonts from a CDN):
  // stale-while-revalidate via a runtime cache, so the app shell still
  // renders its styling/icons/map library offline after the first visit.
  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.ok) {
            const copy = res.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
