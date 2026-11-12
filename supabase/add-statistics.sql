-- ===========================================================================
-- Numbers Radio - Statistics (anonymous, privacy-friendly site analytics)
--
-- HOW TO RUN THIS (one time):
--   1. Open your project at https://supabase.com/dashboard
--   2. In the left menu choose "SQL Editor" -> "New query"
--   3. Copy everything in this file, paste it in, and click "Run"
--
-- Running it more than once is safe (it never deletes your statistics).
--
-- What this creates
--   analytics_events          raw events (page views, clicks, ...), kept 120 days
--   analytics_player_sessions one row per listening session, kept 120 days
--   analytics_daily           one row of totals per day, kept FOREVER
--   analytics_meta            a tiny note of when the nightly cleanup last ran
--   functions                 the tracker, the dashboard numbers, the cleanup
--   a nightly job             prunes old raw rows (see the bottom of this file)
--
-- Privacy by design
--   * No IP addresses are stored. Ever. The website turns IP + browser details
--     into an anonymous code with a secret that changes every day, so a
--     visitor can be counted for one day but not followed across days.
--   * Everything here is locked: row level security is ON with no policies and
--     all access is taken away from the public "anon"/"authenticated" roles.
--     Only the website's server (service role) can write, and only the admin
--     Statistics page can read.
--
-- "Days" and "hours" in the statistics are Gulf Standard Time (GST, UTC+4).
-- Timestamps themselves are stored in UTC.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- TABLES
-- ---------------------------------------------------------------------------

create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  type        text not null check (type in (
                'pageview', 'sermon_click', 'prayer_click',
                'devotion_play', 'devotion_finish', 'form_submit', 'install')),
  visitor_id  text not null check (char_length(visitor_id) between 8 and 64),
  path        text check (path is null or char_length(path) <= 200),
  referrer    text check (referrer is null or char_length(referrer) <= 100),
  label       text check (label is null or char_length(label) <= 200),
  ref_id      text check (ref_id is null or char_length(ref_id) <= 64),
  country     text check (country is null or char_length(country) <= 2),
  region      text check (region is null or char_length(region) <= 80),
  city        text check (city is null or char_length(city) <= 80),
  device      text check (device is null or char_length(device) <= 20),
  browser     text check (browser is null or char_length(browser) <= 30),
  os          text check (os is null or char_length(os) <= 30),
  is_returning boolean not null default false,
  is_app       boolean not null default false,   -- opened as an installed app
  is_landing   boolean not null default false    -- first page of a visit
);

create index if not exists analytics_events_created_idx on public.analytics_events (created_at);
create index if not exists analytics_events_type_created_idx on public.analytics_events (type, created_at);
create index if not exists analytics_events_visitor_idx on public.analytics_events (visitor_id, created_at);
create index if not exists analytics_events_ref_idx on public.analytics_events (ref_id)
  where type in ('devotion_play', 'devotion_finish');

create table if not exists public.analytics_player_sessions (
  id            text primary key check (char_length(id) between 8 and 64),
  visitor_id    text not null check (char_length(visitor_id) between 8 and 64),
  started_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  ended         boolean not null default false,
  seconds       integer not null default 0 check (seconds >= 0),
  reconnects    integer not null default 0 check (reconnects >= 0),
  errors        integer not null default 0 check (errors >= 0)
);

create index if not exists analytics_sessions_started_idx on public.analytics_player_sessions (started_at);
create index if not exists analytics_sessions_visitor_idx on public.analytics_player_sessions (visitor_id, started_at);

-- One row of totals per Gulf Standard Time day. Kept forever.
create table if not exists public.analytics_daily (
  day                   date primary key,
  visitors              integer not null default 0,
  pageviews             integer not null default 0,
  app_visitors          integer not null default 0,
  player_sessions       integer not null default 0,
  listening_sessions    integer not null default 0,
  listening_seconds     bigint  not null default 0,
  reconnects            integer not null default 0,
  errors                integer not null default 0,
  devotion_plays        integer not null default 0,
  devotion_finishes     integer not null default 0,
  feedback_submissions  integer not null default 0,
  prayer_submissions    integer not null default 0,
  sermon_clicks         integer not null default 0,
  prayer_point_clicks   integer not null default 0,
  installs              integer not null default 0
);

create table if not exists public.analytics_meta (
  key         text primary key,
  value       text not null,
  updated_at  timestamptz not null default now()
);


-- ---------------------------------------------------------------------------
-- HELPERS
-- ---------------------------------------------------------------------------

-- A UTC timestamp -> the same moment on a Gulf Standard Time wall clock.
-- (GST is UTC+4 all year with no daylight saving, so a fixed offset is exact.)
create or replace function public.analytics_gst(ts timestamptz)
returns timestamp
language sql
immutable
as $$
  select (ts at time zone 'UTC') + interval '4 hours'
$$;

-- Listening time, cut into whole GST hours. A session that started at 21:40 and
-- listened for 50 minutes counts 20 minutes in the 21:00 hour and 30 in 22:00.
create or replace function public.analytics_listen_hours(p_from timestamptz, p_to timestamptz)
returns table (hour_start timestamp, secs double precision)
language sql
stable
as $$
  with s as (
    select public.analytics_gst(started_at) as s_start,
           public.analytics_gst(started_at) + make_interval(secs => seconds) as s_end
      from public.analytics_player_sessions
     where seconds >= 5
       and started_at < p_to
       and started_at + make_interval(secs => seconds) > p_from
  ),
  w as (
    select public.analytics_gst(p_from) as w_from, public.analytics_gst(p_to) as w_to
  )
  select h,
         extract(epoch from (least(s.s_end, h + interval '1 hour', w.w_to)
                           - greatest(s.s_start, h, w.w_from)))::double precision
    from s
   cross join w
   cross join lateral generate_series(
          date_trunc('hour', greatest(s.s_start, w.w_from)),
          date_trunc('hour', least(s.s_end, w.w_to)),
          interval '1 hour') as h
   where least(s.s_end, h + interval '1 hour', w.w_to) > greatest(s.s_start, h, w.w_from)
$$;


-- ---------------------------------------------------------------------------
-- WRITING: one event
-- Called only by the website's server. Returns true when the event was stored.
-- Besides the checks done in the website, this repeats the important ones, so
-- even a bug there could not fill the table with junk.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_track_event(
  p_type         text,
  p_visitor      text,
  p_path         text    default null,
  p_referrer     text    default null,
  p_ref_id       text    default null,
  p_label        text    default null,
  p_country      text    default null,
  p_region       text    default null,
  p_city         text    default null,
  p_device       text    default null,
  p_browser      text    default null,
  p_os           text    default null,
  p_is_returning boolean default false,
  p_is_app       boolean default false,
  p_is_landing   boolean default false
)
returns boolean
language plpgsql
as $$
declare
  v_label text := left(p_label, 200);
  v_recent integer;
begin
  if p_type is null or p_type not in (
       'pageview', 'sermon_click', 'prayer_click',
       'devotion_play', 'devotion_finish', 'form_submit', 'install') then
    return false;
  end if;
  if p_visitor is null or char_length(p_visitor) < 8 or char_length(p_visitor) > 64 then
    return false;
  end if;

  -- Per-visitor limit, enforced here as well: at most 60 events a minute.
  select count(*) into v_recent
    from public.analytics_events
   where visitor_id = p_visitor and created_at > now() - interval '1 minute';
  if v_recent >= 60 then
    return false;
  end if;

  if p_type = 'pageview' then
    if p_path is null or left(p_path, 1) <> '/' or p_path like '/admin%' then
      return false;
    end if;

  elsif p_type = 'sermon_click' then
    -- The title comes from OUR table, never from the visitor's browser.
    select title into v_label from public.sermons where id::text = p_ref_id;
    if not found then return false; end if;

  elsif p_type = 'prayer_click' then
    select title into v_label from public.prayer_points where id::text = p_ref_id;
    if not found then return false; end if;

  elsif p_type = 'form_submit' then
    if v_label is null or v_label not in ('feedback', 'prayer') then return false; end if;
    -- (only the TYPE is stored, never the message)

  elsif p_type = 'devotion_play' then
    if p_ref_id is null or v_label is null or v_label not in ('ai', 'device') then return false; end if;
    if exists (select 1 from public.analytics_events where type = 'devotion_play' and ref_id = p_ref_id) then
      return false;  -- each play is counted once
    end if;

  elsif p_type = 'devotion_finish' then
    -- A finish only counts for a play we know about, and only once.
    if p_ref_id is null then return false; end if;
    select label into v_label from public.analytics_events
     where type = 'devotion_play' and ref_id = p_ref_id limit 1;
    if not found then return false; end if;
    if exists (select 1 from public.analytics_events where type = 'devotion_finish' and ref_id = p_ref_id) then
      return false;
    end if;

  elsif p_type = 'install' then
    -- One install per visitor per day is plenty.
    if exists (select 1 from public.analytics_events
                where type = 'install' and visitor_id = p_visitor
                  and created_at > now() - interval '1 day') then
      return false;
    end if;
  end if;

  insert into public.analytics_events
    (type, visitor_id, path, referrer, label, ref_id, country, region, city,
     device, browser, os, is_returning, is_app, is_landing)
  values
    (p_type, p_visitor,
     case when p_type = 'pageview' then left(p_path, 200) end,
     left(p_referrer, 100),
     v_label,
     case when p_type in ('sermon_click', 'prayer_click', 'devotion_play', 'devotion_finish')
          then left(p_ref_id, 64) end,
     left(upper(p_country), 2), left(p_region, 80), left(p_city, 80),
     left(p_device, 20), left(p_browser, 30), left(p_os, 30),
     coalesce(p_is_returning, false), coalesce(p_is_app, false), coalesce(p_is_landing, false));

  return true;
end;
$$;


-- ---------------------------------------------------------------------------
-- WRITING: the radio player's listening session
-- "start" when play is pressed, "beat" about every 30 seconds while listening,
-- "end" when the listener pauses or leaves. Numbers can only go UP, and the
-- listened seconds can never be more than the real time that has passed.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_player_beat(
  p_id         text,
  p_visitor    text,
  p_phase      text,
  p_seconds    integer default 0,
  p_reconnects integer default 0,
  p_errors     integer default 0
)
returns boolean
language plpgsql
as $$
declare
  v_secs integer := greatest(0, least(coalesce(p_seconds, 0), 172800));
  v_rec  integer := greatest(0, least(coalesce(p_reconnects, 0), 1000));
  v_err  integer := greatest(0, least(coalesce(p_errors, 0), 1000));
  v_row  public.analytics_player_sessions%rowtype;
  v_recent integer;
begin
  if p_phase is null or p_phase not in ('start', 'beat', 'end') then return false; end if;
  if p_id is null or char_length(p_id) < 8 or char_length(p_id) > 64 then return false; end if;
  if p_visitor is null or char_length(p_visitor) < 8 or char_length(p_visitor) > 64 then return false; end if;

  select * into v_row from public.analytics_player_sessions where id = p_id;

  if found then
    -- Ignore beats that come in faster than every 5 seconds (the final "end" always counts).
    if p_phase = 'beat' and v_row.last_seen_at > now() - interval '5 seconds' then
      return true;
    end if;
    update public.analytics_player_sessions
       set last_seen_at = now(),
           ended        = ended or p_phase = 'end',
           seconds      = least(greatest(seconds, v_secs),
                                greatest(seconds, extract(epoch from (now() - started_at))::integer + 30)),
           reconnects   = greatest(reconnects, v_rec),
           errors       = greatest(errors, v_err)
     where id = p_id;
    return true;
  end if;

  -- A new session. At most 40 an hour per visitor.
  -- We only trust "I have listened N seconds" from a session we have SEEN start.
  -- One we hear of for the first time (its "start" got lost) may claim at most
  -- 2 minutes; after that it can only grow with real time passing. This stops
  -- anyone inventing hours of listening with a single made-up request.
  if p_phase = 'start' then
    v_secs := 0;
  else
    v_secs := least(v_secs, 120);
  end if;
  select count(*) into v_recent
    from public.analytics_player_sessions
   where visitor_id = p_visitor and started_at > now() - interval '1 hour';
  if v_recent >= 40 then return false; end if;

  insert into public.analytics_player_sessions
    (id, visitor_id, started_at, last_seen_at, ended, seconds, reconnects, errors)
  values
    (p_id, p_visitor, now() - make_interval(secs => v_secs), now(),
     p_phase = 'end', v_secs, v_rec, v_err);
  return true;
end;
$$;


-- ---------------------------------------------------------------------------
-- READING: every number on the admin Statistics page, in one call.
-- p_days is 1 (today), 7, 30 or 90. Days end today and are Gulf Standard Time.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_dashboard(p_days integer default 7)
returns jsonb
language plpgsql
stable
as $$
declare
  v_days   integer := case when p_days in (1, 7, 30, 90) then p_days else 7 end;
  v_now    timestamptz := now();
  v_today  date := public.analytics_gst(v_now)::date;
  v_first  date := v_today - (v_days - 1);
  v_from   timestamptz := (v_first::timestamp - interval '4 hours') at time zone 'UTC';
  v_hourly boolean := (v_days = 1);
  v_unit   text := case when v_days = 1 then 'hour' else 'day' end;
  v_step   interval := case when v_days = 1 then interval '1 hour' else interval '1 day' end;

  v_totals    jsonb;
  v_series    jsonb;
  v_heat      jsonb;
  v_sections  jsonb;
  v_dims      jsonb;
  v_referrers jsonb;
  v_sermons   jsonb;
  v_prayers   jsonb;
  v_health    jsonb;
  v_house     jsonb;
begin
  -- ---- summary cards --------------------------------------------------
  select jsonb_build_object(
    'visitors',
      (select count(distinct visitor_id) from public.analytics_events
        where type = 'pageview' and created_at >= v_from and created_at <= v_now),
    'pageviews',
      (select count(*) from public.analytics_events
        where type = 'pageview' and created_at >= v_from and created_at <= v_now),
    'listening_sessions',
      (select count(*) from public.analytics_player_sessions
        where started_at >= v_from and started_at <= v_now and seconds >= 5),
    'avg_session_seconds',
      coalesce((select round(avg(seconds)) from public.analytics_player_sessions
        where started_at >= v_from and started_at <= v_now and seconds >= 5), 0),
    'listening_seconds',
      coalesce((select round(sum(secs)) from public.analytics_listen_hours(v_from, v_now)), 0),
    'devotion_plays',
      (select count(*) from public.analytics_events p
        where p.type = 'devotion_play' and p.created_at >= v_from and p.created_at <= v_now),
    'devotion_finished',
      (select count(*) from public.analytics_events p
        where p.type = 'devotion_play' and p.created_at >= v_from and p.created_at <= v_now
          and exists (select 1 from public.analytics_events f
                       where f.type = 'devotion_finish' and f.ref_id = p.ref_id)),
    'devotion_ai',
      (select count(*) from public.analytics_events
        where type = 'devotion_play' and label = 'ai' and created_at >= v_from and created_at <= v_now),
    'devotion_device',
      (select count(*) from public.analytics_events
        where type = 'devotion_play' and label = 'device' and created_at >= v_from and created_at <= v_now),
    'feedback',
      (select count(*) from public.analytics_events
        where type = 'form_submit' and label = 'feedback' and created_at >= v_from and created_at <= v_now),
    'prayer',
      (select count(*) from public.analytics_events
        where type = 'form_submit' and label = 'prayer' and created_at >= v_from and created_at <= v_now),
    'installs',
      (select count(*) from public.analytics_events
        where type = 'install' and created_at >= v_from and created_at <= v_now)
  ) into v_totals;

  -- ---- per day (or per hour when the range is "Today") -----------------
  select coalesce(jsonb_agg(x.item order by x.bucket), '[]'::jsonb) into v_series
  from (
    select b.bucket,
           jsonb_build_object(
             't', to_char(b.bucket, case when v_hourly then 'YYYY-MM-DD"T"HH24":00"' else 'YYYY-MM-DD' end),
             'visitors', coalesce(p.visitors, 0),
             'pageviews', coalesce(p.views, 0),
             'listen_seconds', round(coalesce(l.secs, 0))
           ) as item
      from (select generate_series(v_first::timestamp,
                                   date_trunc(v_unit, public.analytics_gst(v_now)),
                                   v_step) as bucket) b
      left join (
        select date_trunc(v_unit, public.analytics_gst(created_at)) as bk,
               count(*) as views, count(distinct visitor_id) as visitors
          from public.analytics_events
         where type = 'pageview' and created_at >= v_from and created_at <= v_now
         group by 1
      ) p on p.bk = b.bucket
      left join (
        select date_trunc(v_unit, hour_start) as bk, sum(secs) as secs
          from public.analytics_listen_hours(v_from, v_now)
         group by 1
      ) l on l.bk = b.bucket
  ) x;

  -- ---- listening by day of week x hour of day (GST); [isodow 1=Mon..7=Sun, hour, seconds]
  select coalesce(jsonb_agg(jsonb_build_array(dow, hr, round(secs)) order by dow, hr), '[]'::jsonb) into v_heat
  from (
    select extract(isodow from hour_start)::integer as dow,
           extract(hour from hour_start)::integer as hr,
           sum(secs) as secs
      from public.analytics_listen_hours(v_from, v_now)
     group by 1, 2
  ) h;

  -- ---- most visited pages ----------------------------------------------
  select coalesce(jsonb_agg(jsonb_build_object('path', path, 'n', n) order by n desc, path), '[]'::jsonb) into v_sections
  from (
    select path, count(*) as n
      from public.analytics_events
     where type = 'pageview' and created_at >= v_from and created_at <= v_now
     group by path
     order by n desc, path
     limit 25
  ) s;

  -- ---- who and what: one row per visitor (per day), then counted --------
  with v as (
    select visitor_id,
           (array_agg(country order by created_at) filter (where country is not null))[1] as country,
           (array_agg(city order by created_at)    filter (where city is not null))[1]    as city,
           (array_agg(device order by created_at)  filter (where device is not null))[1]  as device,
           (array_agg(browser order by created_at) filter (where browser is not null))[1] as browser,
           (array_agg(os order by created_at)      filter (where os is not null))[1]      as os,
           bool_or(is_returning) as is_returning,
           bool_or(is_app) as is_app
      from public.analytics_events
     where type = 'pageview' and created_at >= v_from and created_at <= v_now
     group by visitor_id
  )
  select jsonb_build_object(
    'countries', coalesce((select jsonb_agg(jsonb_build_object('code', code, 'n', n) order by n desc, code)
                           from (select coalesce(country, '') as code, count(*) as n from v
                                 group by 1 order by n desc, code limit 15) t), '[]'::jsonb),
    'cities',    coalesce((select jsonb_agg(jsonb_build_object('city', city, 'code', code, 'n', n) order by n desc, city)
                           from (select city, coalesce(country, '') as code, count(*) as n from v
                                  where city is not null
                                  group by city, country order by n desc, city limit 15) t), '[]'::jsonb),
    'devices',   coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc, name)
                           from (select coalesce(device, '') as name, count(*) as n from v
                                  group by 1 order by n desc, name limit 10) t), '[]'::jsonb),
    'browsers',  coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc, name)
                           from (select coalesce(browser, '') as name, count(*) as n from v
                                  group by 1 order by n desc, name limit 10) t), '[]'::jsonb),
    'systems',   coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n) order by n desc, name)
                           from (select coalesce(os, '') as name, count(*) as n from v
                                  group by 1 order by n desc, name limit 10) t), '[]'::jsonb),
    'returning', jsonb_build_object(
                   'new',       (select count(*) from v where not is_returning),
                   'returning', (select count(*) from v where is_returning)),
    'app',       jsonb_build_object(
                   'installed', (select count(*) from v where is_app),
                   'browser',   (select count(*) from v where not is_app))
  ) into v_dims;

  -- ---- where visits came from (only the first page of each visit) ---------
  select coalesce(jsonb_agg(jsonb_build_object('host', host, 'n', n) order by n desc, host), '[]'::jsonb) into v_referrers
  from (
    select coalesce(referrer, '') as host, count(*) as n
      from public.analytics_events
     where type = 'pageview' and is_landing and created_at >= v_from and created_at <= v_now
     group by 1
     order by n desc, host
     limit 12
  ) r;

  -- ---- most clicked sermons / prayer points -------------------------------
  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc, label), '[]'::jsonb) into v_sermons
  from (select label, count(*) as n from public.analytics_events
         where type = 'sermon_click' and created_at >= v_from and created_at <= v_now
         group by label order by n desc, label limit 10) s;

  select coalesce(jsonb_agg(jsonb_build_object('label', label, 'n', n) order by n desc, label), '[]'::jsonb) into v_prayers
  from (select label, count(*) as n from public.analytics_events
         where type = 'prayer_click' and created_at >= v_from and created_at <= v_now
         group by label order by n desc, label limit 10) s;

  -- ---- is the player working well? ---------------------------------------
  select jsonb_build_object(
    'sessions',        count(*),
    'never_started',   count(*) filter (where seconds < 1),
    'listened',        count(*) filter (where seconds >= 5),
    'smooth',          count(*) filter (where seconds >= 5 and reconnects = 0 and errors = 0),
    'with_reconnects', count(*) filter (where reconnects > 0),
    'with_errors',     count(*) filter (where errors > 0),
    'reconnects',      coalesce(sum(reconnects), 0),
    'errors',          coalesce(sum(errors), 0)
  ) into v_health
  from public.analytics_player_sessions
  where started_at >= v_from and started_at <= v_now;

  -- ---- housekeeping status (for the little note at the bottom) -----------
  select jsonb_build_object(
    'last_cleanup', (select value from public.analytics_meta where key = 'last_maintenance'),
    'events',       (select count(*) from public.analytics_events),
    'sessions',     (select count(*) from public.analytics_player_sessions),
    'oldest',       (select to_char(public.analytics_gst(min(created_at)), 'YYYY-MM-DD') from public.analytics_events),
    'daily_rows',   (select count(*) from public.analytics_daily)
  ) into v_house;

  return jsonb_build_object(
    'range', jsonb_build_object(
               'days', v_days,
               'from', to_char(v_first, 'YYYY-MM-DD'),
               'to', to_char(v_today, 'YYYY-MM-DD'),
               'bucket', v_unit),
    'totals', v_totals,
    'series', v_series,
    'heatmap', v_heat,
    'sections', v_sections,
    'who', v_dims,
    'referrers', v_referrers,
    'sermons', v_sermons,
    'prayer_points', v_prayers,
    'health', v_health,
    'housekeeping', v_house
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- CLEANUP: keep raw events 120 days, keep daily totals forever.
-- 1. Writes the totals for every finished day into analytics_daily
--    (re-doing the last 3 days each time, so late updates are not missed).
-- 2. Deletes raw events and sessions older than 120 days.
-- Safe to run any number of times. Run nightly by the job at the bottom.
-- ---------------------------------------------------------------------------
create or replace function public.analytics_maintenance(p_keep_days integer default 120)
returns jsonb
language plpgsql
as $$
declare
  v_today  date := public.analytics_gst(now())::date;
  v_from   date;
  v_start  timestamptz;
  v_end    timestamptz := (v_today::timestamp - interval '4 hours') at time zone 'UTC';
  v_ev     bigint := 0;
  v_se     bigint := 0;
  v_keep   integer := greatest(coalesce(p_keep_days, 120), 30);
begin
  select coalesce(
           (select max(day) - 2 from public.analytics_daily),
           (select least(min(public.analytics_gst(created_at)::date), v_today) from public.analytics_events),
           v_today)
    into v_from;
  -- Also cover sessions that are older than any event.
  select least(v_from, coalesce(min(public.analytics_gst(started_at)::date), v_from))
    into v_from from public.analytics_player_sessions;

  if v_from < v_today then
    v_start := (v_from::timestamp - interval '4 hours') at time zone 'UTC';

    insert into public.analytics_daily
      (day, visitors, pageviews, app_visitors, player_sessions, listening_sessions,
       listening_seconds, reconnects, errors, devotion_plays, devotion_finishes,
       feedback_submissions, prayer_submissions, sermon_clicks, prayer_point_clicks, installs)
    select d.day,
           coalesce(e.visitors, 0), coalesce(e.pageviews, 0), coalesce(e.app_visitors, 0),
           coalesce(s.player_sessions, 0), coalesce(s.listening_sessions, 0),
           coalesce(l.secs, 0), coalesce(s.reconnects, 0), coalesce(s.errors, 0),
           coalesce(e.devotion_plays, 0), coalesce(e.devotion_finishes, 0),
           coalesce(e.feedback, 0), coalesce(e.prayer, 0),
           coalesce(e.sermon_clicks, 0), coalesce(e.prayer_clicks, 0), coalesce(e.installs, 0)
      from (select generate_series(v_from::timestamp, (v_today - 1)::timestamp, interval '1 day')::date as day) d
      left join (
        select public.analytics_gst(created_at)::date as day,
               count(distinct visitor_id) filter (where type = 'pageview') as visitors,
               count(*) filter (where type = 'pageview') as pageviews,
               count(distinct visitor_id) filter (where type = 'pageview' and is_app) as app_visitors,
               count(*) filter (where type = 'devotion_play') as devotion_plays,
               count(*) filter (where type = 'devotion_finish') as devotion_finishes,
               count(*) filter (where type = 'form_submit' and label = 'feedback') as feedback,
               count(*) filter (where type = 'form_submit' and label = 'prayer') as prayer,
               count(*) filter (where type = 'sermon_click') as sermon_clicks,
               count(*) filter (where type = 'prayer_click') as prayer_clicks,
               count(*) filter (where type = 'install') as installs
          from public.analytics_events
         where created_at >= v_start and created_at < v_end
         group by 1
      ) e on e.day = d.day
      left join (
        select public.analytics_gst(started_at)::date as day,
               count(*) as player_sessions,
               count(*) filter (where seconds >= 5) as listening_sessions,
               coalesce(sum(reconnects), 0) as reconnects,
               coalesce(sum(errors), 0) as errors
          from public.analytics_player_sessions
         where started_at >= v_start and started_at < v_end
         group by 1
      ) s on s.day = d.day
      left join (
        select hour_start::date as day, round(sum(secs))::bigint as secs
          from public.analytics_listen_hours(v_start, v_end)
         group by 1
      ) l on l.day = d.day
    on conflict (day) do update set
      visitors = excluded.visitors, pageviews = excluded.pageviews,
      app_visitors = excluded.app_visitors, player_sessions = excluded.player_sessions,
      listening_sessions = excluded.listening_sessions, listening_seconds = excluded.listening_seconds,
      reconnects = excluded.reconnects, errors = excluded.errors,
      devotion_plays = excluded.devotion_plays, devotion_finishes = excluded.devotion_finishes,
      feedback_submissions = excluded.feedback_submissions, prayer_submissions = excluded.prayer_submissions,
      sermon_clicks = excluded.sermon_clicks, prayer_point_clicks = excluded.prayer_point_clicks,
      installs = excluded.installs;
  end if;

  -- Only after the totals are safely written: remove the old raw rows.
  delete from public.analytics_events where created_at < now() - make_interval(days => v_keep);
  get diagnostics v_ev = row_count;
  delete from public.analytics_player_sessions where started_at < now() - make_interval(days => v_keep);
  get diagnostics v_se = row_count;

  insert into public.analytics_meta (key, value, updated_at)
  values ('last_maintenance', to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now())
  on conflict (key) do update set value = excluded.value, updated_at = now();

  return jsonb_build_object(
    'totals_from', to_char(v_from, 'YYYY-MM-DD'),
    'totals_to', to_char(v_today - 1, 'YYYY-MM-DD'),
    'events_removed', v_ev,
    'sessions_removed', v_se);
end;
$$;


-- ---------------------------------------------------------------------------
-- LOCK IT DOWN
-- Row level security ON, no policies, and every right taken away from the
-- public roles. Only the website's server (the "service role") can use any of
-- this. (Written so it is safe to re-run.)
-- ---------------------------------------------------------------------------
alter table public.analytics_events          enable row level security;
alter table public.analytics_player_sessions enable row level security;
alter table public.analytics_daily           enable row level security;
alter table public.analytics_meta            enable row level security;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public.analytics_events, public.analytics_player_sessions, public.analytics_daily, public.analytics_meta from %I', r);
      execute format('revoke all on sequence public.analytics_events_id_seq from %I', r);
    end if;
  end loop;
end $$;

revoke all on function
  public.analytics_gst(timestamptz),
  public.analytics_listen_hours(timestamptz, timestamptz),
  public.analytics_track_event(text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean),
  public.analytics_player_beat(text, text, text, integer, integer, integer),
  public.analytics_dashboard(integer),
  public.analytics_maintenance(integer)
from public;

do $$
declare
  r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on function
        public.analytics_gst(timestamptz),
        public.analytics_listen_hours(timestamptz, timestamptz),
        public.analytics_track_event(text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean),
        public.analytics_player_beat(text, text, text, integer, integer, integer),
        public.analytics_dashboard(integer),
        public.analytics_maintenance(integer) from %I', r);
    end if;
  end loop;

  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant all on table public.analytics_events, public.analytics_player_sessions,
                       public.analytics_daily, public.analytics_meta to service_role;
    grant usage, select on sequence public.analytics_events_id_seq to service_role;
    grant execute on function
      public.analytics_gst(timestamptz),
      public.analytics_listen_hours(timestamptz, timestamptz),
      public.analytics_track_event(text, text, text, text, text, text, text, text, text, text, text, text, boolean, boolean, boolean),
      public.analytics_player_beat(text, text, text, integer, integer, integer),
      public.analytics_dashboard(integer),
      public.analytics_maintenance(integer)
    to service_role;
  end if;
end $$;


-- ---------------------------------------------------------------------------
-- THE NIGHTLY CLEANUP JOB
-- The simplest way to prune automatically: a scheduled job INSIDE the database
-- (Supabase's built-in "pg_cron"). It runs every night at 03:10 GST (23:10
-- UTC) and calls analytics_maintenance() above. Nothing on the website or on
-- Vercel is involved, so there is nothing else to set up or to keep running.
--
-- If this notice appears when you run the file:
--     "pg_cron is not available ..."
-- turn it on once (Supabase -> Database -> Extensions -> search "pg_cron" ->
-- switch it on) and run this file again. Until then the Statistics page has a
-- "Clean up now" button that does the same thing by hand.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron;
    perform cron.schedule(
      'numbers-radio-analytics-cleanup',
      '10 23 * * *',
      'select public.analytics_maintenance(120)');
    raise notice 'Nightly cleanup scheduled (03:10 GST).';
  else
    raise notice 'pg_cron is not available on this database. Turn it on under Database -> Extensions, then run this file again. Until then, use the "Clean up now" button on the Statistics page.';
  end if;
exception when others then
  raise notice 'Could not schedule the nightly cleanup automatically (%). Turn on pg_cron under Database -> Extensions and run this file again, or use the "Clean up now" button on the Statistics page.', sqlerrm;
end $$;
