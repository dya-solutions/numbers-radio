-- ===========================================================================
-- Numbers Radio - update the Daily Devotion to the 8-section format
--
-- Run this ONCE in Supabase to add the new devotion sections
-- (Source line, Further Study, Golden Nugget) and rename "reflection" to
-- "body". Your existing devotion text is kept - the old "reflection"
-- content is moved into "body".
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard  ->  your project
--   2. Left menu: "SQL Editor"  ->  "New query"
--   3. Paste everything in this file  ->  click "Run"
--
-- Running it more than once is safe.
-- ===========================================================================

-- Make sure the table exists (fresh projects).
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

-- Add the new columns to older installations (safe to repeat).
alter table public.devotion add column if not exists source_line   text not null default '';
alter table public.devotion add column if not exists body          text not null default '';
alter table public.devotion add column if not exists further_study text not null default '';
alter table public.devotion add column if not exists golden_nugget text not null default '';

-- Move any existing "reflection" text into "body", then drop "reflection".
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'devotion'
      and column_name = 'reflection'
  ) then
    update public.devotion
       set body = reflection
     where coalesce(body, '') = ''
       and coalesce(reflection, '') <> '';

    alter table public.devotion drop column reflection;
  end if;
end $$;

-- Seed a starting row only if the devotion has never been set up.
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
