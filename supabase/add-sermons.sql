-- ===========================================================================
-- Numbers Radio - add the Sermons table
--
-- Run this ONCE if you already had the site running and just need the new
-- Sermons feature. (If you are setting up fresh, run schema.sql instead -
-- it already includes this.)
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard  ->  your project
--   2. Left menu: "SQL Editor"  ->  "New query"
--   3. Paste everything in this file  ->  click "Run"
--
-- Running it more than once is safe.
-- ===========================================================================

create table if not exists public.sermons (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null default '',
  url         text not null default ''
);

alter table public.sermons enable row level security;

create index if not exists sermons_created_at_idx
  on public.sermons (created_at desc);
