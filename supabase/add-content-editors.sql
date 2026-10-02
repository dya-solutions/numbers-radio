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
-- Eight sections, in order: date, source line, title, scripture, body,
-- further study, golden nugget, prayer.
-- ---------------------------------------------------------------------------
create table if not exists public.devotion (
  id                   integer primary key default 1 check (id = 1),
  date_label           text not null default '',
  source_line          text not null default '',
  title                text not null default '',
  scripture_reference  text not null default '',
  scripture_text       text not null default '',
  body                 text not null default '',
  further_study        text not null default '',
  golden_nugget        text not null default '',
  prayer               text not null default '',
  updated_at           timestamptz not null default now()
);

alter table public.devotion enable row level security;

-- Bring older installations up to date (safe to run repeatedly).
alter table public.devotion add column if not exists source_line   text not null default '';
alter table public.devotion add column if not exists body          text not null default '';
alter table public.devotion add column if not exists further_study text not null default '';
alter table public.devotion add column if not exists golden_nugget text not null default '';

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'devotion' and column_name = 'reflection'
  ) then
    update public.devotion
       set body = reflection
     where coalesce(body, '') = '' and coalesce(reflection, '') <> '';
    alter table public.devotion drop column reflection;
  end if;
end $$;

insert into public.devotion
  (id, date_label, source_line, title, scripture_reference, scripture_text,
   body, further_study, golden_nugget, prayer)
values (
  1,
  'September 2, 2026',
  'From Every Soul Counts, by the Numbers Radio team',
  'Known by Name',
  'Isaiah 43:1',
  'But now, this is what the LORD says - he who created you, Jacob, he who formed you, Israel: "Do not fear, for I have redeemed you; I have summoned you by name; you are mine."',
  E'Long before you knew to look for God, he knew you. Not as a face in a crowd, but by name - the way a shepherd knows each sheep, the way a parent knows a child''s step in the hallway.\n\nWe live in a world of large numbers, where it is easy to feel unseen. But heaven keeps a different kind of count. Every soul matters. Every name is spoken.\n\nWhatever this day holds, begin it with that quiet certainty: you have been summoned by name, redeemed, and claimed. You are his.',
  E'Psalm 139:1-18 - God knows every one of your days and thoughts.\nJohn 10:14-15 - The good shepherd knows his sheep, and they know him.\nLuke 15:3-7 - Heaven celebrates over the one.',
  'You are not a number to God. He calls you by name.',
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
  ('Weekday Mornings (Monday - Friday)', '06:00',  'First Light',       'Gentle worship and Scripture to begin the day. With Grace Okafor.'),
  ('Weekday Mornings (Monday - Friday)', '08:00',  'The Morning Word',   'A short teaching and prayer over the day ahead. With Pastor Daniel Reyes.'),
  ('Weekday Mornings (Monday - Friday)', '10:00', 'Hymns & History',    'Classic hymns and the stories behind them.'),
  ('Weekday Afternoons (Monday - Friday)', '12:00', 'Midday Rest',      'Quiet instrumental worship for the lunch hour.'),
  ('Weekday Afternoons (Monday - Friday)', '15:00',  'Every Soul Counts','Listener stories, encouragement, and prayer requests.'),
  ('Weekday Afternoons (Monday - Friday)', '17:00',  'Drive Home Praise','Uplifting contemporary worship for the commute.'),
  ('Evenings (Every Night)', '20:00',  'Evening Prayer',   'A guided time of prayer and reflection.'),
  ('Evenings (Every Night)', '22:00', 'Through the Night','Soft worship music until morning.'),
  ('Sunday', '09:00', 'Sunday Gathering',  'A full worship service with teaching.'),
  ('Sunday', '18:00', 'Songs of the Church','Worship music from around the world.')
) as seed(day, time_label, show_name, description)
where not exists (select 1 from public.schedule_entries);
