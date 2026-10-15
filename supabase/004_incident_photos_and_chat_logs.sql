-- Run this ONCE in Supabase SQL Editor (after 001-003).
--
-- Two independent additions:
--   A) Incident photos — report.html accepted a photo but never uploaded
--      it anywhere. Adds a photo_url column plus a public Storage bucket
--      and the policy letting residents upload into it.
--   B) Chat usage logging — the "Chatbot Usage" / "User Registrations"
--      charts on the admin side were hardcoded arrays. Registrations can
--      already be computed from profiles.created_at, but chat usage had
--      nothing to count from — this adds a minimal log (who, when — no
--      message content) that virtual-assistance.html writes to on every
--      exchange.

-- ---------------------------------------------------------------------
-- A) Incident photos
-- ---------------------------------------------------------------------
alter table incidents add column if not exists photo_url text;

insert into storage.buckets (id, name, public)
values ('incident-photos', 'incident-photos', true)
on conflict (id) do nothing;

-- Residents can only upload into a folder named after their own user id
-- (report.html uploads to `${user.id}/${filename}`) — this stops one
-- resident from writing into another's folder. Public buckets serve
-- reads via the public URL directly, so no SELECT policy is needed for
-- <img> tags to work.
create policy "residents upload incident photos"
  on storage.objects for insert
  with check (
    bucket_id = 'incident-photos'
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------
-- B) Chat usage log
-- ---------------------------------------------------------------------
create table chat_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table chat_logs enable row level security;

create policy "insert own chat log" on chat_logs
  for insert with check (auth.uid() = user_id);
create policy "admin read chat logs" on chat_logs
  for select using (is_admin());
