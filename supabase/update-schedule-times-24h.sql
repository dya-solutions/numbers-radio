-- ===========================================================================
-- Numbers Radio - convert Program Guide times to 24-hour format
--
-- Run this ONCE in Supabase. It rewrites the times already saved in the
-- Program Guide from "6:00 AM" / "3:30 PM" style to 24-hour "06:00" / "15:30"
-- so the schedule sorts correctly. Nothing else is changed.
--
-- HOW TO RUN:
--   1. Open https://supabase.com/dashboard  ->  your project
--   2. Left menu: "SQL Editor"  ->  "New query"
--   3. Paste everything in this file  ->  click "Run"
--
-- Running it more than once is safe. The last line lists any entry whose
-- time still is not in "HH:MM" form (for example one typed as "Noon") - fix
-- those in /admin -> Edit Program Guide.
-- ===========================================================================

-- 1) 12-hour times with AM/PM  ->  24-hour  ("6:00 PM" -> "18:00", "12 AM" -> "00:00")
with parsed as (
  select
    id,
    regexp_match(time_label, '^\s*(\d{1,2})(?:[:.](\d{2}))?\s*([AaPp])\.?\s*[Mm]\.?\s*$') as m
  from public.schedule_entries
)
update public.schedule_entries s
set time_label =
  lpad(
    (((p.m)[1]::int % 12) + case when upper((p.m)[3]) = 'P' then 12 else 0 end)::text,
    2, '0'
  ) || ':' || coalesce((p.m)[2], '00')
from parsed p
where s.id = p.id
  and p.m is not null
  and (p.m)[1]::int between 1 and 12
  and coalesce((p.m)[2], '00')::int < 60;

-- 2) 24-hour times missing the leading zero  ("9:00" -> "09:00", "18.30" -> "18:30")
update public.schedule_entries
set time_label = lpad(substring(time_label from '^\s*(\d{1,2})[:.]\d{2}\s*$'), 2, '0')
                 || ':' || substring(time_label from '[:.](\d{2})\s*$')
where time_label ~ '^\s*\d{1,2}[:.]\d{2}\s*$'
  and substring(time_label from '^\s*(\d{1,2})[:.]')::int <= 23
  and substring(time_label from '[:.](\d{2})\s*$')::int <= 59
  and time_label !~ '^([01]\d|2[0-3]):[0-5]\d$';

-- 3) Anything still not in HH:MM form (should be empty)
select id, day, time_label, show_name
from public.schedule_entries
where time_label !~ '^([01]\d|2[0-3]):[0-5]\d$';
