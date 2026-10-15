-- Run this ONCE in Supabase SQL Editor (after schema.sql, 002, and 003).
--
-- Bug in 003's prevent_self_role_status_change(): it fires on EVERY update
-- to profiles, including edits made directly in the Table Editor. Those
-- dashboard edits run with no logged-in user context, so is_admin() sees
-- nobody logged in and reverts the change — which is why promoting
-- yourself to 'admin' via the Table Editor kept snapping back to
-- 'resident'.
--
-- Fix: only enforce the rule when the update comes through a real user
-- session (auth.uid() is not null) — that's the case a resident hitting
-- your API directly would hit. Direct dashboard/service-role connections
-- have no auth.uid() at all, so they're left alone.

create or replace function prevent_self_role_status_change()
returns trigger as $$
begin
  if auth.uid() is not null and not is_admin() then
    new.role := old.role;
    new.status := old.status;
  end if;
  return new;
end;
$$ language plpgsql security definer;
