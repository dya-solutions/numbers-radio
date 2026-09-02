# Numbers Radio

A simple, warm website for **Numbers Radio**, a Christian radio station in the
Numbers family ([trynumbers.com](https://trynumbers.com)). Tagline: *Every Soul
Counts.*

## What the site has

| Page | Address | What it does |
| --- | --- | --- |
| **Listen** | `/` | Homepage with a live audio player for the radio stream. |
| **Program Guide** | `/program-guide` | The on-air schedule. Hand-written for now; later it pulls from AzuraCast automatically. |
| **Daily Devotion** | `/daily-devotion` | One short Scripture and reflection that you update by hand. |
| **Feedback & Prayer** | `/feedback` | Two forms - feedback and prayer requests - that save to a Supabase database. |
| **Submissions (staff only)** | `/admin` | A password-protected list of every feedback and prayer request, newest first. |

---

## The things only you can change (no coding needed)

### 1. The daily devotion
Open the file [`content/devotion.ts`](content/devotion.ts). Change the words
inside the quotation marks - the date, title, verse, reflection, and prayer.
Save the file. If you edit it on GitHub.com, click **Commit changes** and the
website updates itself in a minute or two.

### 2. The program guide (until the automatic version is ready)
Open [`content/schedule.ts`](content/schedule.ts) and edit the show times,
names, and descriptions the same way.

### 3. The stream address, station links, and admin password
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
   You should see "Success. No rows returned." This created the table that
   stores feedback and prayer requests.
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
- **Data:** Supabase table `public.submissions`. Server actions in
  [`app/feedback/actions.ts`](app/feedback/actions.ts) insert with the service
  role key; the admin page reads the same way. RLS is on with no public
  policies, so the table is server-only.
- **Admin auth:** HTTP Basic Auth in [`middleware.ts`](middleware.ts) using
  `ADMIN_USERNAME` / `ADMIN_PASSWORD`.
- **Program Guide TODO:** replace [`content/schedule.ts`](content/schedule.ts)
  with a fetch to
  `${NEXT_PUBLIC_AZURACAST_BASE_URL}/api/station/${NEXT_PUBLIC_AZURACAST_STATION_ID}/schedule`.
