-- ===========================================================================
-- Numbers Radio - database setup
--
-- HOW TO RUN THIS (one time):
--   1. Open your project at https://supabase.com/dashboard
--   2. In the left menu choose "SQL Editor"
--   3. Click "New query"
--   4. Copy everything in this file, paste it in, and click "Run"
--
-- This creates the tables the website needs:
--   submissions      - feedback messages and prayer requests
--   devotion         - the single Daily Devotion shown on the site
--   schedule_entries - the shows listed on the Program Guide
--
-- Running it more than once is safe.
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


-- ---------------------------------------------------------------------------
-- DAILY DEVOTION
-- One single row (id is always 1). The /admin editor updates this row.
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

-- Put the starting devotion in place (only if the row does not exist yet).
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
-- PROGRAM GUIDE
-- One row per show. The /admin editor adds, changes, and removes these.
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

-- Put the starting schedule in place (only if the table is completely empty).
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
