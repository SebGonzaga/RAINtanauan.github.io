-- =========================================================================
-- RAIN — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor → New query → Run
-- =========================================================================

-- ---------------------------------------------------------------------
-- 1. PROFILES
-- Supabase Auth already creates a row in auth.users on signup (handles
-- password hashing + sessions for you). This table extends that with
-- app-specific fields: role, barangay, phone. One row per auth user.
-- ---------------------------------------------------------------------
create type user_role as enum ('resident', 'admin');

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role user_role not null default 'resident',
  barangay text,
  phone text,
  created_at timestamptz not null default now()
);

-- Auto-create a profile row whenever someone signs up via Supabase Auth.
-- New accounts default to 'resident' — promote to 'admin' manually in
-- the Supabase Table Editor for staff accounts.
create function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Resident'), 'resident');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ---------------------------------------------------------------------
-- 2. INCIDENTS
-- Resident-submitted reports (report.html) shown on the Live Situation
-- Map and reviewed in admin-incidents.html.
-- ---------------------------------------------------------------------
create type incident_status as enum ('pending', 'verified', 'resolved', 'dismissed');

create table incidents (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references profiles(id) on delete set null,
  title text not null,
  description text,
  category text not null,          -- e.g. 'Flooding', 'Ashfall', 'Road damage'
  area text not null,               -- human-readable location label
  lat double precision,
  lng double precision,
  status incident_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 3. ALERTS
-- Official alerts issued by admins (admin-alerts.html), displayed to
-- residents in alerts.html and dashboard.html.
-- ---------------------------------------------------------------------
create type alert_severity as enum ('advisory', 'warning', 'critical');

create table alerts (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references profiles(id) on delete set null,
  title text not null,
  type text not null,               -- 'Typhoon', 'Volcanic', 'Flood', etc.
  severity alert_severity not null,
  area text not null,
  message text not null,
  lat double precision,
  lng double precision,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- 4. ROW LEVEL SECURITY
-- Supabase exposes tables directly over its API, so RLS is what stops a
-- resident from editing someone else's incident or posting fake alerts.
-- ---------------------------------------------------------------------
alter table profiles enable row level security;
alter table incidents enable row level security;
alter table alerts enable row level security;

-- Helper: is the current user an admin?
create function is_admin()
returns boolean as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$ language sql security definer stable;

-- profiles: everyone can read their own profile; admins can read all
create policy "read own profile" on profiles
  for select using (auth.uid() = id or is_admin());
create policy "update own profile" on profiles
  for update using (auth.uid() = id);

-- incidents: anyone signed in can read; residents can insert their own;
-- only admins can update status (verify/resolve/dismiss)
create policy "read incidents" on incidents
  for select using (auth.role() = 'authenticated');
create policy "insert own incident" on incidents
  for insert with check (auth.uid() = reporter_id);
create policy "admin update incidents" on incidents
  for update using (is_admin());

-- alerts: anyone signed in can read; only admins can write
create policy "read alerts" on alerts
  for select using (auth.role() = 'authenticated');
create policy "admin write alerts" on alerts
  for insert with check (is_admin());
create policy "admin update alerts" on alerts
  for update using (is_admin());
create policy "admin delete alerts" on alerts
  for delete using (is_admin());
