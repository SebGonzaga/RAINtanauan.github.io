-- Run ONCE in the Supabase SQL Editor (after 001-008). Non-destructive: one new table + policies.
-- Purpose: admins transcribe the current official PHIVOLCS alert level/bulletin for a volcano so volcano.html can show it with an "as of" time.
-- HUMAN-ENTERED, not an automated feed (PHIVOLCS has no verified public API). Official PHIVOLCS wording and levels remain authoritative.
create table if not exists volcano_status (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  volcano text not null default 'Taal' check (char_length(volcano) between 1 and 60),
  alert_level smallint not null check (alert_level between 0 and 5),
  bulletin_issued_at timestamptz not null,               -- time printed on the PHIVOLCS bulletin
  headline text check (headline is null or char_length(headline) <= 200),
  summary text check (summary is null or char_length(summary) <= 2000),
  source_url text not null check (source_url ~ '^https://' and char_length(source_url) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists volcano_status_issued_idx on volcano_status (volcano, bulletin_issued_at desc);
alter table volcano_status enable row level security;
create policy "read volcano status" on volcano_status for select using (auth.role() = 'authenticated');
create policy "admin insert volcano status" on volcano_status for insert with check (is_admin());
create policy "admin update volcano status" on volcano_status for update using (is_admin());
create policy "admin delete volcano status" on volcano_status for delete using (is_admin());
