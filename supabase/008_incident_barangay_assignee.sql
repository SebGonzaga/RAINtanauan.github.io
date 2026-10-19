-- Run ONCE in the Supabase SQL Editor (after 001-007). Non-destructive: adds two nullable columns and tightens one INSERT policy.
-- 1) barangay: reports previously stored only a free-text "area" (usually raw "lat, lng"), so barangay filtering/exports had nothing reliable to match.
-- 2) assigned_to: which administrator is handling the report. Deliberately NO foreign key: incidents already embed profiles(full_name)
--    via the reporter_id FK in dashboard.html and admin-incidents.html, and a second FK to profiles would make that embed ambiguous.
-- 3) The old insert policy only checked reporter_id, so a signed-in resident calling the API directly could insert a row that is already
--    'verified', assigned, or archived. The new policy forces new rows to start as pending/unassigned/unarchived.
alter table incidents add column if not exists barangay text check (barangay is null or char_length(barangay) <= 60);
alter table incidents add column if not exists assigned_to uuid;
create index if not exists incidents_barangay_idx on incidents (barangay);

drop policy if exists "insert own incident" on incidents;
create policy "insert own incident" on incidents
  for insert with check (
    auth.uid() = reporter_id
    and status = 'pending'
    and assigned_to is null
    and archived_at is null
  );
-- Existing "admin update incidents" policy (is_admin()) already limits who can change assigned_to/status later.
