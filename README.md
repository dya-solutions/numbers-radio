# Numbers Radio

A simple, warm website for **Numbers Radio**, a Christian radio station in the
Numbers family ([trynumbers.com](https://trynumbers.com)). Tagline: *Every Soul
Counts.*

## What the site has

| Page | Address | What it does |
| --- | --- | --- |
| **Listen** | `/` | Homepage with a live audio player for the radio stream. |
| **Program Guide** | `/program-guide` | The on-air schedule. Hand-written for now; later it pulls from AzuraCast automatically. |
| **Daily Devotion** | `/daily-devotion` | An eight-section devotion (date, source line, title, scripture, body, further study, golden nugget, prayer) that you edit from `/admin`. |
| **Listen to today's devotion** | `/daily-devotion` | A button on the devotion page. It plays an AI-voiced MP3 made automatically from the devotion text (or, when that isn't ready, your device's own voice) and pauses the live radio while it plays. |
| **Prayer Points** | `/prayer-points` | A list of prayer points, newest first, each with a "Read more" link to a news story. |
| **Sermons** | `/sermons` | A list of sermons, newest first, each linking to its YouTube video. |
| **Feedback** | `/feedback` | Two forms - feedback and prayer requests - that save to a Supabase database. |
| **Statistics (password-protected)** | `/admin/statistics` | How people use the site and the player: visitors, page views, listening time, when people listen, where from, which devices, and how well the player is working. Anonymous - no cookies, no IP addresses stored. |
| **Privacy** | `/privacy` | A short plain-language note on what is counted (linked from the footer). |
| **Staff area (password-protected)** | `/admin` | Feedback + prayer submissions, editors for the Daily Devotion, Program Guide, Prayer Points, and Sermons, and the Statistics page. |

---

## The things only you can change (no coding needed)

### 1. The daily devotion
Sign in to `/admin` and open **Edit Daily Devotion**. Fill in the eight boxes -
Date, Source line, Devotion title, Scripture, Body, Further study, Golden nugget,
and Prayer - then press **Save**. The public page updates straight away. No code,
no files.

### 2. The program guide
Sign in to `/admin` and open **Edit Program Guide**. Add, change, or remove
shows (Day, Time, Show name, Short description). Type times on the 24-hour clock
(like `09:00` or `18:30`, in Gulf Standard Time - "GST" is added automatically when
the time is shown); each day sorts itself by time. The public page updates
straight away.

### 3. The devotion's spoken audio
Nothing to upload. After you press **Save** in **Edit Daily Devotion**, the page
shows "Generating audio...", then "Audio ready" with a preview player. Use
**Regenerate audio** to make it again and **Download MP3** to get the file (for
example to put on the radio). If you change the text later it says "Audio is out
of date" until you regenerate. Needs the one-time setup in
[Listen-to-the-devotion setup](#listen-to-the-devotion-setup) below.

### 4. Prayer points
Sign in to `/admin` and open **Edit Prayer Points**. Paste a link to a news
story, write a short title or description for it, and press **Add prayer
point**. Edit or remove any entry the same way. The public page updates
straight away, newest first.

### 5. Sermons
Sign in to `/admin` and open **Edit Sermons**. Type the sermon title, paste the
YouTube link, and press **Add sermon**. Edit or remove any entry the same way.
The public page updates straight away, newest first.

### 6. Statistics
Sign in to `/admin` and open **Statistics**. Choose Today, 7, 30 or 90 days. Every
chart has a one-line explanation under its title. All days and hours are Gulf
Standard Time. One-time setup: [Statistics setup](#statistics-setup) below.

### 7. The stream address, station links, and admin password
These live in **environment variables** (see setup below). You never edit code
for these - you change them in one settings screen.

---

## First-time setup (about 30-45 minutes)

You need three free accounts: **GitHub** (you already have this), **Supabase**
(the database), and **Vercel** (this puts the site online). Take them in order.

### Step A - Create the Supabase project (the database)

1. Go to <https://supabase.com> and sign in (you can use your GitHub login).
2. Click **New project**.
   - **Name:** `numbers-radio`
   - **Database password:** click *Generate a password* and save it somewhere
     safe (a password manager). You will rarely need it.
   - **Region:** pick the one closest to most of your listeners.
3. Wait a minute or two while it sets up.
4. In the left menu, open **SQL Editor** -> **New query**.
5. Open the file [`supabase/schema.sql`](supabase/schema.sql) from this project,
   copy everything in it, paste it into the query box, and click **Run**.
   You should see "Success". This creates the five tables the site uses:
   `submissions`, `devotion`, `schedule_entries`, `prayer_points`, and `sermons`.
   - *Already had the site running from before?* Run
     [`supabase/update-devotion-sections.sql`](supabase/update-devotion-sections.sql)
     [`supabase/add-prayer-points.sql`](supabase/add-prayer-points.sql), and
     [`supabase/update-schedule-times-24h.sql`](supabase/update-schedule-times-24h.sql),
     and [`supabase/add-sermons.sql`](supabase/add-sermons.sql) as well - they add the newer pieces and keep your existing text.
6. In the left menu, open **Project Settings** (the gear) -> **API**. Keep this
   tab open - you need two values from it:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **service_role** key under *Project API keys* (click *Reveal*). This is
     secret - treat it like a password, never share it or put it in a public
     place.

### Step B - Put the site online with Vercel

1. Go to <https://vercel.com> and sign in with GitHub.
2. Click **Add New... -> Project**.
3. Find **dya-solutions/numbers-radio** in the list and click **Import**.
4. Before clicking Deploy, open the **Environment Variables** section and add
   each row below (name on the left, value on the right):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_STREAM_URL` | Your AzuraCast listen URL, e.g. `https://your-station.azuracast.com/listen/numbers_radio/radio.mp3` |
   | `NEXT_PUBLIC_AZURACAST_BASE_URL` | `https://your-station.azuracast.com` |
   | `NEXT_PUBLIC_AZURACAST_STATION_ID` | Your station's number in AzuraCast, usually `1` |
   | `NEXT_PUBLIC_SUPABASE_URL` | The **Project URL** from Step A.6 |
   | `SUPABASE_SERVICE_ROLE_KEY` | The **service_role** key from Step A.6 |
   | `ADMIN_USERNAME` | A username you choose for the `/admin` page, e.g. `station` |
   | `ADMIN_PASSWORD` | A strong password you choose for the `/admin` page |

5. Click **Deploy**. After a minute or two you get a live web address.
6. Visit `/feedback` on that address, send a test message, then visit `/admin`.
   Your browser will ask for the username and password you set above. You
   should see your test message.

### Step C - Later: connect a custom domain
In Vercel, open your project -> **Settings -> Domains** and add the address you
want (for example `radio.trynumbers.com`). Vercel shows the exact DNS records
to add with your domain provider.

---

## Listen-to-the-devotion setup

The audio is made with ElevenLabs text-to-speech (model `eleven_multilingual_v2`,
MP3 output).

1. **Supabase:** run [`supabase/add-devotion-audio.sql`](supabase/add-devotion-audio.sql)
   once (SQL Editor -> New query -> Run). It adds two columns and a public
   storage bucket named `devotion-audio`. (`schema.sql` already includes it for fresh setups.)
2. **ElevenLabs key:** in ElevenLabs open your profile -> **API Keys** -> create a
   key (it only needs the *Text to Speech* permission). Add it to Vercel as
   `ELEVENLABS_API_KEY`.
3. **Voice:** in ElevenLabs open **Voices** -> **My Voices**, click the three dots
   next to a voice -> **Copy voice ID**, and add it to Vercel as
   `DEVOTION_VOICE_ID`. (A voice from the public Voice Library must first be
   added to My Voices with its **+** button, and needs a paid ElevenLabs plan to
   be used through the API.) Change it later, then press **Regenerate audio**.
4. Redeploy so the new settings are picked up.

All the ElevenLabs code is in [`lib/tts.ts`](lib/tts.ts), including the model and
the calm-delivery voice settings.

---

## Statistics setup

The site counts its own visitors (no Google Analytics, no cookies, no outside
scripts). It stores **anonymous** counts in your Supabase database.

1. **Supabase:** run [`supabase/add-statistics.sql`](supabase/add-statistics.sql)
   once (SQL Editor -> New query -> paste -> Run). It is safe to run again. If it
   prints a note that `pg_cron` is not available, switch it on under
   **Database -> Extensions** and run the file once more - that is what makes the
   nightly cleanup automatic.
2. **Optional but recommended:** add a private random value as `ANALYTICS_SECRET`
   on Vercel (16+ characters). It is the secret behind the daily-changing
   anonymous visitor code. Without it the site derives one from your Supabase
   service key, which also works.
3. Redeploy, open the site, then look at **Admin -> Statistics**.

**What is counted:** page views (with the referring website), listening sessions
of the radio player (start, seconds listened, reconnects, errors), devotion plays
and whether they finished, sermon and prayer-point link clicks, that a Feedback
or Prayer form was sent (never its content), app installs, whether the site was
used as an app or in a browser, country / region / city (from Vercel's request
headers), and device / browser / operating system.
**What is not:** IP addresses, names, emails, message text, anything on `/admin`,
and robots / crawlers.

**How long:** raw events are kept 120 days; a daily-totals row is kept forever.
A nightly database job (`pg_cron`, 03:10 GST) runs `analytics_maintenance()`,
which first writes the daily totals and then deletes the old raw rows. The
Statistics page shows when it last ran and has a **Clean up now** button.

---

## Finding your AzuraCast stream URL

In your AzuraCast dashboard, open the station, then **Profile**. Under
*Streams / Mount Points* there is a direct listen URL (ending in `.mp3` or
`/radio.mp3`). That is the value for `NEXT_PUBLIC_STREAM_URL`.

---

## Running it on your own computer (optional)

Only needed if you want to preview changes before they go live.

```bash
npm install
cp .env.local.example .env.local   # then edit .env.local with your values
npm run dev
```

Then open <http://localhost:3000>.

---

## For a developer (later work)

- **Framework:** Next.js (App Router), TypeScript, Tailwind CSS v4.
- **Data:** Supabase tables `public.submissions`, `public.devotion` (single row,
  `id = 1`), `public.schedule_entries`, `public.prayer_points`, `public.sermons`. All reads/writes
  go through the service role key on the server
  ([`lib/supabaseServer.ts`](lib/supabaseServer.ts), [`lib/content.ts`](lib/content.ts));
  RLS is on with no public policies, so the tables are server-only.
  `content/devotion.ts` and `content/schedule.ts` remain as read-only fallbacks
  when the database is unreachable (prayer points has no fallback file - an
  empty or unreachable table just shows an empty-state message).
- **Admin editors:** [`app/admin/devotion`](app/admin/devotion),
  [`app/admin/schedule`](app/admin/schedule), and
  [`app/admin/prayer-points`](app/admin/prayer-points), and
  [`app/admin/sermons`](app/admin/sermons) use server actions that
  `revalidatePath` the public pages, which are `force-dynamic`.
- **Prayer point titles:** the editor auto-fills the title from the pasted
  link via [`app/admin/api/fetch-title`](app/admin/api/fetch-title/route.ts)
  (reads `<title>` / `og:title`, 6s timeout, blocks local addresses). It sits
  under `/admin` so the same Basic Auth protects it. Any failure just leaves
  the title for the editor to type - it never blocks the save.
- **Admin auth:** HTTP Basic Auth in [`middleware.ts`](middleware.ts) using
  `ADMIN_USERNAME` / `ADMIN_PASSWORD`; the matcher also covers the server-action
  POSTs and the fetch-title route.
- **Devotion audio:** the admin Save action only saves text. Audio is made by a
  separate request, `POST /admin/api/devotion-audio`
  ([route](app/admin/api/devotion-audio/route.ts)), which is the only code that
  calls ElevenLabs. It is password-protected twice (middleware + `guardAdminApi` in
  [`lib/adminAuth.ts`](lib/adminAuth.ts), which also demands a same-origin request
  with an `X-Requested-With` header). The MP3 is stored under a fresh name in the
  public `devotion-audio` bucket, the previous file is deleted, and
  `devotion.audio_hash` (SHA-256 of the spoken text) decides whether the audio is
  current. The public page plays it only when the hash matches, otherwise it uses
  the browser's speech synthesis.
- **Statistics:** the browser sends tiny one-way notes to `POST /api/track`
  ([route](app/api/track/route.ts)); it never returns data. Pieces:
  [`lib/analytics/validate.ts`](lib/analytics/validate.ts) (strict input checks,
  1 KB limit), [`ua.ts`](lib/analytics/ua.ts) (device/browser/OS + bot filter),
  [`visitor.ts`](lib/analytics/visitor.ts) (visitor code = HMAC of IP + browser
  details with a secret salt that changes every GST day; the IP is never stored),
  [`limit.ts`](lib/analytics/limit.ts) (in-memory rate limit; the database
  repeats a per-visitor limit), [`record.ts`](lib/analytics/record.ts) (calls the
  SQL functions). Client side: [`Analytics.tsx`](app/components/Analytics.tsx)
  (page views, install), [`playerSession.ts`](lib/analytics/playerSession.ts)
  (listening sessions; used by `PlayerProvider`), `TrackedLink` (sermon /
  prayer clicks), `ListenToDevotion` (plays/finishes). Form submissions are
  counted server-side in `app/feedback/actions.ts` (type only). Everything is
  computed in SQL ([`supabase/add-statistics.sql`](supabase/add-statistics.sql):
  `analytics_dashboard`, `analytics_maintenance`), with RLS on, no policies and
  all rights revoked from `anon` / `authenticated`; only the service role can use
  it. The one thing stored on the visitor's device is the date of their first
  visit (`localStorage`, key `nr-first-visit`) to tell new from returning.
  Visitors with a strict ad / tracker blocker may not be counted.
- **SQL:** [`supabase/schema.sql`](supabase/schema.sql) is the full, idempotent
  setup. [`supabase/update-devotion-sections.sql`](supabase/update-devotion-sections.sql)
  migrates an older `devotion` table (renames `reflection` to `body`, adds
  `source_line` / `further_study` / `golden_nugget`).
  [`supabase/add-prayer-points.sql`](supabase/add-prayer-points.sql) adds the
  `prayer_points` table to an existing database.
  [`supabase/add-sermons.sql`](supabase/add-sermons.sql) adds the `sermons` table.
  [`supabase/update-schedule-times-24h.sql`](supabase/update-schedule-times-24h.sql)
  rewrites saved Program Guide times (`6:00 PM` -> `18:00`). Times are stored as
  zero-padded 24-hour `HH:MM`; [`lib/time.ts`](lib/time.ts) normalises input,
  still reads old 12-hour values, and sorts each day by time.
- **Program Guide TODO:** replace the `schedule_entries` read in
  [`lib/content.ts`](lib/content.ts) with a fetch to
  `${NEXT_PUBLIC_AZURACAST_BASE_URL}/api/station/${NEXT_PUBLIC_AZURACAST_STATION_ID}/schedule`.
