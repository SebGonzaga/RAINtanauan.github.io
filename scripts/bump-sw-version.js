/* =========================================================================
   bump-sw-version.js
   Runs automatically on every Vercel build (wired via the "vercel-build"
   npm script). Stamps sw.js's CACHE_VERSION / RUNTIME_CACHE with the
   current git commit short-SHA, so a code change always produces a new
   cache name -- no more relying on remembering to hand-edit sw.js.

   The activate handler in sw.js already deletes any cache whose name
   doesn't match the current CACHE_VERSION/RUNTIME_CACHE, so this is the
   only piece that needed automating.

   Falls back to a timestamp if git isn't available in the build
   environment (Vercel's build containers do have git, but this keeps
   the build from failing if that ever changes).
   ========================================================================= */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const swPath = path.join(__dirname, "..", "sw.js");

let versionId;
try {
  versionId = execSync("git rev-parse --short HEAD").toString().trim();
} catch (err) {
  versionId = String(Date.now());
  console.warn("bump-sw-version: git sha unavailable, falling back to timestamp:", versionId);
}

let sw = fs.readFileSync(swPath, "utf8");

const before = sw;

sw = sw.replace(
  /const CACHE_VERSION = ".*?";/,
  `const CACHE_VERSION = "rain-shell-${versionId}";`
);
sw = sw.replace(
  /const RUNTIME_CACHE = ".*?";/,
  `const RUNTIME_CACHE = "rain-runtime-${versionId}";`
);

if (sw === before) {
  console.warn("bump-sw-version: no CACHE_VERSION/RUNTIME_CACHE lines matched -- check sw.js hasn't changed shape.");
} else {
  fs.writeFileSync(swPath, sw);
  console.log(`bump-sw-version: sw.js cache version bumped to "${versionId}"`);
}
