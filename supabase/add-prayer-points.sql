-- ===========================================================================
-- Numbers Radio - add the Prayer Points table
--
-- Run this ONCE if you already had the site running and just need the new
-- Prayer Points feature. (If you are setting up fresh, run schema.sql
-- instead - it already includes this.)
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard  ->  your project
--   2. Left menu: "SQL Editor"  ->  "New query"
--   3. Paste everything in this file  ->  click "Run"
--
-- Running it more than once is safe.
-- ===========================================================================

create table if not exists public.prayer_points (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  title       text not null default '',
  url         text not null default ''
);

alter table public.prayer_points enable row level security;

create index if not exists prayer_points_created_at_idx
  on public.prayer_points (created_at desc);
