-- Run ONCE in the Supabase SQL Editor (after 001-009). Non-destructive: one new table + a read policy.
-- Purpose: stores the nightly AI summary of public PHIVOLCS / PAGASA pages written by /api/daily-digest (service role).
-- This is an UNOFFICIAL, AI-generated add-on. It never replaces the admin-entered volcano_status / typhoon_bulletins data.
create table if not exists ai_digests (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('volcano','heat')),
  digest_date date not null,                                   -- Philippine calendar day the job ran for
  status text not null check (status in ('ok','source_unreachable','source_unparsed','ai_failed')),
  alert_level smallint check (alert_level is null or alert_level between 0 and 5),  -- only if the page text states ONE level
  summary text check (summary is null or char_length(summary) <= 1500),
  source_url text not null check (source_url ~ '^https://' and char_length(source_url) <= 500),
  source_fetched_at timestamptz,
  source_sha256 text,
  model text,
  created_at timestamptz not null default now(),
  unique (kind, digest_date)
);
alter table ai_digests enable row level security;
create policy "read ai digests" on ai_digests for select using (auth.role() = 'authenticated');
-- No insert/update policies on purpose: only the server (service role key) writes here.
