-- Run ONCE in the Supabase SQL Editor (after 001-004). Non-destructive: adds columns/functions only.
-- POLICY: an incident that is 'resolved' or 'dismissed' and has not been modified for 30 days is ARCHIVED
-- (archived_at is stamped). Rows are never deleted. Pending/verified incidents are never auto-archived.
alter table incidents add column if not exists archived_at timestamptz;
create index if not exists incidents_archived_at_idx on incidents (archived_at);

-- updated_at had no trigger, so the 30-day clock would never move. Keep it current.
create or replace function touch_incident_updated_at() returns trigger as $$
begin new.updated_at := now(); return new; end; $$ language plpgsql;
drop trigger if exists incidents_touch_updated_at on incidents;
create trigger incidents_touch_updated_at before update on incidents
  for each row execute procedure touch_incident_updated_at();

-- Idempotent: only touches rows not yet archived, so re-running changes nothing new.
create or replace function archive_expired_incidents(keep_days int default 30) returns int as $$
declare n int;
begin
  update incidents set archived_at = now()
   where archived_at is null and status in ('resolved','dismissed')
     and updated_at < now() - make_interval(days => keep_days);
  get diagnostics n = row_count; return n;
end; $$ language plpgsql security definer;
revoke all on function archive_expired_incidents(int) from public, anon, authenticated;

-- Schedule daily (Dashboard > Database > Extensions > enable pg_cron first), then run:
-- select cron.schedule('archive-incidents', '15 18 * * *', $$select archive_expired_incidents(30)$$);
-- (18:15 UTC = 02:15 Philippine time.) Un-archive: update incidents set archived_at = null where id = '...';
-- Note: moving a resolved incident back to pending does not clear archived_at; admins should un-archive it too.
