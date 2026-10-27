-- Run ONCE in the Supabase SQL Editor (after 010). Non-destructive.
-- Purpose: lets the nightly AI digest (/api/daily-digest) attach an AI-generated ILLUSTRATION to each summary.
-- Images are stored in a public bucket (they are generic illustrations, nothing personal); only the server
-- (service role key) can upload, because no storage insert/update policies are created on purpose.
alter table ai_digests
  add column if not exists image_url text
    check (image_url is null or (image_url ~ '^https://' and char_length(image_url) <= 600)),
  add column if not exists image_model text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('digest-images', 'digest-images', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
