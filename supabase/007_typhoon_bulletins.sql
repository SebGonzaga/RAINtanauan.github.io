-- Run ONCE in the Supabase SQL Editor (after 001-006). Non-destructive: creates one new table + policies.
-- Purpose: admins transcribe the current official PAGASA tropical-cyclone bulletin so residents see it on typhoon-map.html.
-- This is HUMAN-ENTERED data copied from PAGASA, not an automated feed. Every row must carry a source link and an expiry.
create table if not exists typhoon_bulletins (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  storm_name text not null check (char_length(storm_name) between 1 and 60),
  local_name text check (local_name is null or char_length(local_name) <= 60),
  bulletin_no text check (bulletin_no is null or char_length(bulletin_no) <= 30),
  issued_at timestamptz not null,                       -- time printed on the PAGASA bulletin
  expires_at timestamptz not null,                      -- hide automatically after this; next bulletin replaces it
  lat double precision check (lat is null or lat between -90 and 90),
  lng double precision check (lng is null or lng between -180 and 180),
  intensity text check (intensity is null or char_length(intensity) <= 80),   -- e.g. category wording as printed by PAGASA
  max_wind_kph numeric check (max_wind_kph is null or (max_wind_kph >= 0 and max_wind_kph <= 450)),
  movement text check (movement is null or char_length(movement) <= 120),
  signal_areas text check (signal_areas is null or char_length(signal_areas) <= 1500),  -- wind-signal areas as printed
  summary text check (summary is null or char_length(summary) <= 1500),
  source_url text not null check (source_url ~ '^https://' and char_length(source_url) <= 500),
  created_at timestamptz not null default now(),
  check (expires_at > issued_at),
  check ((lat is null) = (lng is null))
);
create index if not exists typhoon_bulletins_issued_idx on typhoon_bulletins (issued_at desc);

alter table typhoon_bulletins enable row level security;
-- Same pattern as alerts: signed-in users read, only admins write.
create policy "read typhoon bulletins" on typhoon_bulletins for select using (auth.role() = 'authenticated');
create policy "admin insert typhoon bulletins" on typhoon_bulletins for insert with check (is_admin());
create policy "admin update typhoon bulletins" on typhoon_bulletins for update using (is_admin());
create policy "admin delete typhoon bulletins" on typhoon_bulletins for delete using (is_admin());
