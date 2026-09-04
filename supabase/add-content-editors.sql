-- ===========================================================================
-- Numbers Radio - add the Daily Devotion + Program Guide editors
--
-- Run this ONCE if you already set up the database earlier and just need the
-- new tables for the /admin content editors.
-- (If you are setting up fresh, run schema.sql instead - it includes this.)
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard  ->  your project
--   2. Left menu: "SQL Editor"  ->  "New query"
--   3. Paste everything in this file  ->  click "Run"
--
-- Running it more than once is safe.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- DAILY DEVOTION  (one single row, id is always 1)
-- ---------------------------------------------------------------------------
create table if not exists public.devotion (
  id                   integer primary key default 1 check (id = 1),
  date_label           text not null default '',
  title                text not null default '',
  scripture_reference  text not null default '',
  scripture_text       text not null default '',
  reflection           text not null default '',
  prayer               text not null default '',
  updated_at           timestamptz not null default now()
);

alter table public.devotion enable row level security;

insert into public.devotion
  (id, date_label, title, scripture_reference, scripture_text, reflection, prayer)
values (
  1,
  'September 2, 2026',
  'Known by Name',
  'Isaiah 43:1',
  'But now, this is what the LORD says - he who created you, Jacob, he who formed you, Israel: "Do not fear, for I have redeemed you; I have summoned you by name; you are mine."',
  E'Long before you knew to look for God, he knew you. Not as a face in a crowd, but by name - the way a shepherd knows each sheep, the way a parent knows a child''s step in the hallway.\n\nWe live in a world of large numbers, where it is easy to feel unseen. But heaven keeps a different kind of count. Every soul matters. Every name is spoken.\n\nWhatever this day holds, begin it with that quiet certainty: you have been summoned by name, redeemed, and claimed. You are his.',
  'Father, thank you for knowing me by name. Help me walk today without fear, sure that I belong to you. Amen.'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- PROGRAM GUIDE  (one row per show)
-- ---------------------------------------------------------------------------
create table if not exists public.schedule_entries (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  day          text not null default '',
  time_label   text not null default '',
  show_name    text not null default '',
  description  text not null default ''
);

alter table public.schedule_entries enable row level security;

create index if not exists schedule_entries_created_at_idx
  on public.schedule_entries (created_at asc);

insert into public.schedule_entries (day, time_label, show_name, description)
select * from (values
  ('Weekday Mornings (Monday - Friday)', '6:00 AM',  'First Light',       'Gentle worship and Scripture to begin the day. With Grace Okafor.'),
  ('Weekday Mornings (Monday - Friday)', '8:00 AM',  'The Morning Word',   'A short teaching and prayer over the day ahead. With Pastor Daniel Reyes.'),
  ('Weekday Mornings (Monday - Friday)', '10:00 AM', 'Hymns & History',    'Classic hymns and the stories behind them.'),
  ('Weekday Afternoons (Monday - Friday)', '12:00 PM', 'Midday Rest',      'Quiet instrumental worship for the lunch hour.'),
  ('Weekday Afternoons (Monday - Friday)', '3:00 PM',  'Every Soul Counts','Listener stories, encouragement, and prayer requests.'),
  ('Weekday Afternoons (Monday - Friday)', '5:00 PM',  'Drive Home Praise','Uplifting contemporary worship for the commute.'),
  ('Evenings (Every Night)', '8:00 PM',  'Evening Prayer',   'A guided time of prayer and reflection.'),
  ('Evenings (Every Night)', '10:00 PM', 'Through the Night','Soft worship music until morning.'),
  ('Sunday', '9:00 AM', 'Sunday Gathering',  'A full worship service with teaching.'),
  ('Sunday', '6:00 PM', 'Songs of the Church','Worship music from around the world.')
) as seed(day, time_label, show_name, description)
where not exists (select 1 from public.schedule_entries);
