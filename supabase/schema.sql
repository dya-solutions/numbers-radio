-- ===========================================================================
-- Numbers Radio - database setup
--
-- HOW TO RUN THIS (one time):
--   1. Open your project at https://supabase.com/dashboard
--   2. In the left menu choose "SQL Editor"
--   3. Click "New query"
--   4. Copy everything in this file, paste it in, and click "Run"
--
-- This creates one table called "submissions" that holds both feedback
-- messages and prayer requests.
-- ===========================================================================

create table if not exists public.submissions (
  id          uuid primary key default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  type        text not null check (type in ('feedback', 'prayer')),
  name        text,
  email       text,
  message     text not null
);

-- Turn on row level security. The website talks to this table using the
-- private "service role" key on the server, which bypasses these rules, so
-- with no public policies added the table is closed to everyone else.
alter table public.submissions enable row level security;

-- Helpful index for the admin page (newest first).
create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);
