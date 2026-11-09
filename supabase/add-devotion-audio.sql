-- ===========================================================================
-- Numbers Radio - "Listen to today's devotion" audio
--
-- Run this ONCE in Supabase. It adds:
--   * two new columns on the devotion record:
--       audio_url   - the address of the current MP3
--       audio_hash  - a fingerprint of the exact text that MP3 was made from
--                     (used to tell when the audio is out of date)
--   * a PUBLIC storage bucket called "devotion-audio" that holds the MP3.
--     Anyone can play the file; only the website's server can add or delete.
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard  ->  your project
--   2. Left menu: "SQL Editor"  ->  "New query"
--   3. Paste everything in this file  ->  click "Run"
--
-- Running it more than once is safe. Your existing devotion text is not touched.
-- ===========================================================================

alter table public.devotion add column if not exists audio_url  text;
alter table public.devotion add column if not exists audio_hash text;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('devotion-audio', 'devotion-audio', true, 52428800, array['audio/mpeg'])
on conflict (id) do update
  set public             = true,
      file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;
