-- Run ONCE in the Supabase SQL Editor (after 001-005). Adds a new table only; nothing existing is changed.
-- Community mosquito sightings / breeding sites / stagnant water. These are REPORTS, not measurements of mosquito numbers.
create table mosquito_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  report_type text not null check (report_type in ('sighting','breeding_site','stagnant_water')),
  barangay text not null check (char_length(barangay) between 2 and 80),
  description text check (char_length(description) <= 500),
  lat double precision,
  lng double precision,
  observed_on date not null,
  photo_url text check (photo_url is null or photo_url like 'https://%'),
  status text not null default 'pending' check (status in ('pending','verified','rejected')),
  verified_by uuid references profiles(id) on delete set null,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((lat is null and lng is null) or (lat between 4 and 21.5 and lng between 116 and 127.5))
);
create index mosquito_reports_status_idx on mosquito_reports (status, created_at desc);

-- Server-side guards (cannot be bypassed from the browser): own identity, always starts pending,
-- date window, spam limit, duplicate block, coordinates rounded to ~100 m to protect home locations.
create or replace function mosquito_before_insert() returns trigger as $$
begin
  new.reporter_id := auth.uid();
  new.status := 'pending'; new.verified_by := null; new.verified_at := null;
  if new.observed_on > current_date or new.observed_on < current_date - 14 then
    raise exception 'Observation date must be within the last 14 days'; end if;
  if (new.lat is null) <> (new.lng is null) then raise exception 'Provide both latitude and longitude, or neither'; end if;
  if (select count(*) from mosquito_reports where reporter_id = new.reporter_id and created_at > now() - interval '24 hours') >= 5 then
    raise exception 'Too many reports: limit is 5 per 24 hours'; end if;
  if exists (select 1 from mosquito_reports where reporter_id = new.reporter_id and lower(barangay) = lower(new.barangay)
             and report_type = new.report_type and observed_on = new.observed_on) then
    raise exception 'Duplicate report for this barangay, type and date'; end if;
  new.lat := round(new.lat::numeric, 3); new.lng := round(new.lng::numeric, 3);
  return new;
end; $$ language plpgsql security definer set search_path = public;
create trigger mosquito_insert_guard before insert on mosquito_reports for each row execute procedure mosquito_before_insert();

create or replace function mosquito_before_update() returns trigger as $$
begin
  new.updated_at := now();
  if new.status is distinct from old.status then new.verified_by := auth.uid(); new.verified_at := now(); end if;
  return new;
end; $$ language plpgsql security definer set search_path = public;
create trigger mosquito_update_guard before update on mosquito_reports for each row execute procedure mosquito_before_update();

alter table mosquito_reports enable row level security;
create policy "read own or admin mosquito reports" on mosquito_reports for select using (reporter_id = auth.uid() or is_admin());
create policy "insert own mosquito report" on mosquito_reports for insert with check (auth.uid() = reporter_id);
create policy "admin moderate mosquito reports" on mosquito_reports for update using (is_admin());

-- Residents see only VERIFIED reports, without reporter identity, through this view (it runs as the table owner on purpose).
create view mosquito_reports_public as
  select id, report_type, barangay, observed_on, lat, lng, created_at from mosquito_reports where status = 'verified';
grant select on mosquito_reports_public to authenticated;
