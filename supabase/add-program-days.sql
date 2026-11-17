-- ===========================================================================
-- Numbers Radio - Program Guide: choose days with checkboxes
--
-- Run this ONCE in Supabase (running it again is safe).
--
--   1. Open https://supabase.com/dashboard  ->  your project
--   2. Left menu: "SQL Editor"  ->  "New query"
--   3. Paste everything in this file  ->  click "Run"
--
-- WHAT IT DOES
--   * Adds a "days" column to each program: which days of the week it airs
--     (1 = Monday ... 7 = Sunday). One program can air on several days.
--   * Keeps the old free-text "day" column exactly as it was and also copies it
--     to "day_original", so the original wording is never lost.
--   * Works out the days from the old text where it is clear: Monday, Mon,
--     Daily, Every day, Every Night, Weekdays, Mon-Fri, Weekend, Sat & Sun,
--     "Weekday Mornings (Monday - Friday)" ... in any capitalisation.
--   * Anything it cannot work out with confidence is NOT guessed and NOT
--     removed. It gets no days yet; the admin shows a "Choose days" warning on
--     it and the public Program Guide lists it under "Other times" until you
--     pick its days in /admin -> Edit Program Guide.
--   * Never deletes a program. It also saves a safety copy of every program as
--     it was before the first run (table "schedule_entries_backup_before_days").
--
-- At the end it shows a table: every program, its original day text, and the
-- days it now has. See the README ("Program Guide days") for how to check that
-- nothing was lost.
-- ===========================================================================

-- 0) Safety copy of the programs as they were (made once; never overwritten).
create table if not exists public.schedule_entries_backup_before_days as
  select * from public.schedule_entries;
alter table public.schedule_entries_backup_before_days enable row level security;

-- 1) The new columns.
alter table public.schedule_entries
  add column if not exists days smallint[] not null default '{}';
alter table public.schedule_entries
  add column if not exists day_original text;

-- Only the numbers 1 to 7 are allowed in "days".
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'schedule_entries_days_valid'
      and conrelid = 'public.schedule_entries'::regclass
  ) then
    alter table public.schedule_entries
      add constraint schedule_entries_days_valid
      check (days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]);
  end if;
end $$;

-- 2) Helper: turns day text into day numbers.
--    Returns NULL when the text contains anything it does not understand
--    (so a surprising entry is never mis-filed), or an array (possibly empty).
create or replace function public.schedule_parse_days_strict(p_text text)
returns smallint[]
language plpgsql
immutable
as $fn$
declare
  t         text := lower(coalesce(p_text, ''));
  tokens    text[];
  tok       text;
  d         int;
  last_day  int := null;      -- the day name just before a "to"
  pending   boolean := false; -- saw "to", waiting for the end of a range
  grp       int[] := '{}';    -- from words like weekdays / weekend / daily
  explicit  int[] := '{}';    -- from day names
  f         int;
  noise     text[] := array[
    'and', 'on', 'the', 'every', 'each', 'all', 'of', 'at',
    'morning', 'mornings', 'afternoon', 'afternoons', 'evening', 'evenings',
    'night', 'nights', 'midday', 'overnight'
  ];
begin
  t := regexp_replace(t, '[–—]', '-', 'g');
  t := regexp_replace(t, '[,;&/+]', ' and ', 'g');
  t := regexp_replace(t, '\s*-\s*', ' to ', 'g');
  t := regexp_replace(t, '\m(until|till|through|thru)\M', 'to', 'g');
  t := regexp_replace(t, '\m((every|each|all)\s+(day|days|night|nights|week)|(7|seven)\s+days)\M', 'alldays', 'g');
  t := regexp_replace(t, '\m(daily|everyday|nightly)\M', 'alldays', 'g');
  t := regexp_replace(t, '\m(weekdays?|week\s+days)\M', 'weekdays', 'g');
  t := regexp_replace(t, '\mweek\s*ends?\M', 'weekends', 'g');
  t := btrim(regexp_replace(t, '[^a-z0-9]+', ' ', 'g'));
  if t = '' then return '{}'::smallint[]; end if;
  tokens := regexp_split_to_array(t, '\s+');

  foreach tok in array tokens loop
    if tok = any (noise) then
      continue;
    elsif tok = 'to' then
      if last_day is null then return null; end if;   -- "to" must follow a day name
      pending := true;
      continue;
    end if;

    d := case
      when tok ~ '^(mon|monday)s?$'                     then 1
      when tok ~ '^(tue|tues|tuesday)s?$'               then 2
      when tok ~ '^(wed|weds|wednesday)s?$'             then 3
      when tok ~ '^(thu|thur|thurs|thursday)s?$'        then 4
      when tok ~ '^(fri|friday)s?$'                     then 5
      when tok ~ '^(sat|saturday)s?$'                   then 6
      when tok ~ '^(sun|sunday)s?$'                     then 7
      else null
    end;

    if d is not null then
      if pending then
        -- a range such as Mon to Fri (may wrap past Sunday, e.g. Fri to Mon)
        f := last_day;
        loop
          f := (f % 7) + 1;
          explicit := explicit || f;
          exit when f = d;
        end loop;
        pending := false;
        last_day := null;
      else
        explicit := explicit || d;
        last_day := d;
      end if;
    elsif tok = 'alldays' then
      if pending then return null; end if;
      grp := grp || array[1, 2, 3, 4, 5, 6, 7];
      last_day := null;
    elsif tok = 'weekdays' then
      if pending then return null; end if;
      grp := grp || array[1, 2, 3, 4, 5];
      last_day := null;
    elsif tok = 'weekends' then
      if pending then return null; end if;
      grp := grp || array[6, 7];
      last_day := null;
    else
      return null;                                      -- a word we don't understand
    end if;
  end loop;

  if pending then return null; end if;                  -- "Mon to" with no end

  -- "Weekdays Mon" is ambiguous: don't guess.
  if exists (select 1 from unnest(explicit) e where e = any (grp)) then
    return null;
  end if;

  return coalesce(
    (select array_agg(x::smallint order by x) from (select distinct unnest(explicit || grp) as x) u),
    '{}'::smallint[]
  );
end;
$fn$;

-- 3) Main helper. Handles text such as "Weekday Mornings (Monday - Friday)":
--    the days in the closing brackets win when the words before them agree.
create or replace function public.schedule_parse_days(p_text text)
returns smallint[]
language plpgsql
immutable
as $fn$
declare
  t        text := lower(btrim(coalesce(p_text, '')));
  inner_t  text;
  outer_t  text;
  r_in     smallint[];
  r_out    smallint[];
  r        smallint[];
begin
  inner_t := substring(t from '\(([^()]*)\)\s*$');
  if inner_t is not null then
    outer_t := btrim(regexp_replace(t, '\(([^()]*)\)\s*$', ''));
    r_in  := public.schedule_parse_days_strict(inner_t);
    r_out := public.schedule_parse_days_strict(outer_t);
    if r_in is not null and cardinality(r_in) > 0
       and r_out is not null
       and (cardinality(r_out) = 0 or r_in <@ r_out) then
      return r_in;
    end if;
  end if;

  r := public.schedule_parse_days_strict(regexp_replace(t, '[()]', ' ', 'g'));
  return coalesce(r, '{}'::smallint[]);
end;
$fn$;

-- Only the server (and you, in this editor) may call the helpers.
revoke all on function public.schedule_parse_days_strict(text) from public, anon, authenticated;
revoke all on function public.schedule_parse_days(text) from public, anon, authenticated;
grant execute on function public.schedule_parse_days_strict(text) to service_role;
grant execute on function public.schedule_parse_days(text) to service_role;

-- 4) Convert. Programs that already have days (chosen in the admin) are left alone.
--    The original wording is saved first, then the days are worked out from it.
update public.schedule_entries
   set day_original = day
 where day_original is null
   and cardinality(days) = 0;

update public.schedule_entries
   set days = public.schedule_parse_days(day_original)
 where cardinality(days) = 0
   and day_original is not null;

-- 5) REPORT - every program, what it said before, and the days it has now.
--    "CHOOSE DAYS" rows could not be worked out: fix them in /admin -> Edit Program Guide.
select
  case when cardinality(s.days) = 0 then 'CHOOSE DAYS' else 'ok' end as status,
  coalesce(s.day_original, s.day)                                     as original_day_text,
  coalesce(
    (select string_agg((array['Mon','Tue','Wed','Thu','Fri','Sat','Sun'])[x], ', ' order by x)
       from unnest(s.days) as x),
    '(none yet)'
  )                                                                   as days_now,
  s.time_label                                                        as time,
  s.show_name                                                         as program,
  (select count(*) from public.schedule_entries)                      as programs_now,
  (select count(*) from public.schedule_entries_backup_before_days)   as programs_in_backup
from public.schedule_entries s
order by (cardinality(s.days) > 0), s.time_label, s.created_at;
