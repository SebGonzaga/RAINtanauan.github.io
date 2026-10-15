-- Run this ONCE in Supabase SQL Editor (after schema.sql and
-- 002_add_information_severity.sql, which you've already run).
--
-- admin-users.html needs two things the original schema didn't have:
--   1. Each account's email, so admins can see/search it. The anon/
--      authenticated API can't read auth.users directly, so we mirror
--      the email onto profiles instead (backfilled here, kept in sync
--      for new signups via the trigger below).
--   2. A status flag so admins can suspend/reactivate an account.
--      Note: this only flags the row for now — it does not yet block a
--      suspended user from signing in. Enforcing that requires a
--      Supabase Auth Hook (Authentication → Hooks) checking this column
--      on sign-in; add that when you're ready to make suspension real.

alter table profiles add column if not exists email text;
alter table profiles add column if not exists status text not null default 'active'
  check (status in ('active', 'suspended'));

update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email is null;

-- Keep email populated for future signups too.
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, role, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', 'Resident'), 'resident', new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Admins need to update OTHER people's rows (role/status toggles in
-- admin-users.html) — the original "update own profile" policy only
-- covers auth.uid() = id, so it never allowed that.
create policy "admin update profiles" on profiles
  for update using (is_admin());

-- Hardening: "update own profile" has no column restriction, so as
-- written a resident could call the API directly and set their own
-- role to 'admin' or un-suspend themselves. This trigger silently
-- reverts role/status changes made by anyone who isn't already an
-- admin, so only the new "admin update profiles" policy path can
-- actually change those two columns.
create or replace function prevent_self_role_status_change()
returns trigger as $$
begin
  if not is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger enforce_profile_role_status
  before update on profiles
  for each row execute procedure prevent_self_role_status_change();
