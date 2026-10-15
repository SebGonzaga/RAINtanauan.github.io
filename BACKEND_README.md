# RAIN — Backend Integration Notes

This zip is your original frontend with the Supabase backend wired in.
Here's exactly what changed and what you still need to do.

## What's new
- `assets/js/supabase-client.js` — initializes the Supabase client (project
  URL + publishable key already filled in for your project).
- `assets/js/rain-auth.js` — replaces the old localStorage-only `RainAuth`.
  Same method names (`getUser`, `isAdmin`, `login`, `register`, `logout`),
  now backed by real Supabase Auth. `login`/`register`/`logout` are async.
- `api/chat.js` — Vercel serverless function proxying Google's Gemini API
  for `virtual-assistance.html`, so your Gemini key stays server-side.
- `api/weather.js` — same idea for OpenWeatherMap.
- `supabase/schema.sql` — the database schema (already run in your project,
  kept here for reference / re-deploying to a fresh project later).

## What changed in existing files
- Every page that calls `renderAppShell()` now loads the three Supabase
  script tags before `main.js`, and its bottom `<script>` is now
  `<script type="module">` with `await RainAuth.init();` as the first line
  — this refreshes the cached user from the real Supabase session.
- `login.html` / `register.html` — same script tags added, form handlers
  are now `async` and call the new `RainAuth.login()` / `.register()`.
- `assets/js/main.js` — the old fake `RainAuth` object was removed (now
  lives in `rain-auth.js`).
- `report.html` — incident submission now inserts a real row into the
  `incidents` table (lat/lng parsed from the geolocation string if present).
- `admin-incidents.html` — fetches/updates incidents from Supabase; maps
  the UI's Pending/Reviewed/Resolved labels to the DB's
  pending/verified/resolved enum values.
- `admin-alerts.html` — full create/edit/delete against the `alerts` table.
- `alerts.html` / `dashboard.html` — read alerts and map-pinnable incidents
  live from Supabase instead of localStorage.

## Still to do
1. **Deploy this to Vercel** (push to your connected GitHub repo).
2. **Environment variables** in Vercel → Settings → Environment Variables:
   `GEMINI_API_KEY`, `OPENWEATHER_API_KEY`.
3. **Run `supabase/002_add_information_severity.sql`** in the SQL Editor —
   a one-line addition so the alerts form's "Information" severity option
   matches the database enum (schema.sql only had advisory/warning/critical).
4. **Supabase Auth setting**: decide whether "Confirm email" is on or off
   under Authentication → Providers → Email.
5. **Promote an admin**: new signups default to `resident`. In Supabase's
   Table Editor, open `profiles` and change a row's `role` to `admin`.
6. **Still on localStorage (`RainStore`), not yet wired to Supabase:**
   - `admin-dashboard.html` and `admin-analytics.html` — stat counts still
     read the old `RainStore.getIncidents()/getAlerts()/getUsers()`, which
     now return empty/stale data since nothing writes there anymore. These
     numbers will look wrong until this is converted — ask Claude to
     continue with this next.
   - `admin-users.html` and `profile.html` — user management and profile
     editing still use the fake `RainStore` user records instead of
     `profiles` table.
7. **Photo uploads** on `report.html` are accepted in the form but not
   actually uploaded anywhere — needs a Supabase Storage bucket if you
   want that to work.
8. **Delete the demo account chips** in `login.html` before going live —
   those reference fake local accounts that no longer exist in Supabase.

## Email notifications (new)
`api/notifications.js` is a new serverless function that sends emails via
**Nodemailer over SMTP** (e.g. a Gmail account with an App Password) — no
sending domain required, which matters since this project doesn't have one.
It handles three triggers:

1. Admin publishes an alert → every resident with an email gets it.
2. Resident submits an incident report → every admin gets notified.
3. Admin changes an incident's status → the reporter gets notified.

Nothing in the frontend calls this function directly — it's driven by
**Supabase Database Webhooks**, so notifications fire even if the browser
that triggered them closes immediately after.

This is the only file in the project with an npm dependency
(`nodemailer`, in `package.json`) — `api/chat.js` and `api/weather.js`
still use plain `fetch()`.

### Setup steps
1. **Create a dedicated Gmail account** for this (e.g.
   `rainalerts@gmail.com`) rather than using your personal one.
2. **Turn on 2-Step Verification** on that account (required for app
   passwords): Google Account → Security → 2-Step Verification.
3. **Generate an App Password**: Google Account → Security → App
   Passwords → create one for "Mail". You'll get a 16-character password —
   copy it, you won't see it again.
4. **Add these environment variables in Vercel** (Settings → Environment
   Variables):
   - `SMTP_HOST` — `smtp.gmail.com`
   - `SMTP_PORT` — `465`
   - `SMTP_SECURE` — `true`
   - `SMTP_USER` — the Gmail address, e.g. `rainalerts@gmail.com`
   - `SMTP_PASS` — the 16-character App Password from step 3 (not your
     normal Gmail password)
   - `EMAIL_FROM` — e.g. `RAIN Alerts <rainalerts@gmail.com>` (must match
     `SMTP_USER`'s address or Gmail will reject/rewrite it)
   - `SUPABASE_URL` — same project URL as in `assets/js/supabase-client.js`
   - `SUPABASE_SERVICE_ROLE_KEY` — Supabase → Settings → API →
     `service_role` secret. **Never put this in any frontend file** — it
     bypasses every RLS policy. It's only safe here because it's a Vercel
     env var, used only inside a serverless function.
   - `EMAIL_WEBHOOK_SECRET` — make up any long random string.
   - `APP_URL` — e.g. `https://your-app.vercel.app`
5. **Redeploy** so those env vars (and the new `package.json` dependency)
   take effect.
6. **In Supabase → Database → Webhooks**, create three webhooks, all
   pointing at `https://your-app.vercel.app/api/notifications`, all with
   an HTTP header `x-webhook-secret: <the same string you set above>`:
   - Table `alerts`, event `INSERT`
   - Table `incidents`, event `INSERT`
   - Table `incidents`, event `UPDATE`
   (The function itself checks *what* changed — e.g. it only emails the
   reporter on an UPDATE if `status` actually changed — so it's fine that
   the incidents UPDATE webhook fires on every edit.)

That's it — no changes needed to `report.html` or `admin-alerts.html`;
they already insert/update the rows that trigger these webhooks.

> **Note on scale:** Gmail SMTP caps out around 500 sends/day, and
> deliverability can suffer at high volume from a personal-style account.
> This is a solid fit for tens to low hundreds of residents. If RAIN grows
> past that, revisit a proper transactional provider (Brevo, SendGrid, or
> AWS SES) — ask Claude to swap it back in; the webhook/trigger logic in
> this file won't need to change, only `sendEmail`/`sendEmailBatch`.
