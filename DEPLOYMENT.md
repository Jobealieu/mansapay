# Deploying MansaPay

Step-by-step guide to get MansaPay running publicly on Render's free tier,
with Redis on Upstash. Written for someone who has never deployed
anything before — every field you need to fill in is spelled out, along
with where its value comes from.

## Architecture

Four pieces, none of them on your machine once deployed:

```
Browser
  │
  ├──► Render Static Site (apps/web)  ── the React app, built once, served as static files
  │        │
  │        └──► calls the API over HTTPS (cross-origin - different Render URL)
  │
  └──► Render Web Service (apps/api)  ── the Express server, always running (or asleep - see below)
           │
           ├──► Render PostgreSQL     ── the database
           └──► Upstash Redis (rediss://) ── sessions, rate limits, OTP codes
```

The frontend and API are **different origins** in production (two different
`*.onrender.com` URLs) - that's why CORS configuration (Step 5) exists at
all. In local dev this doesn't come up because the Vite dev server proxies
API calls same-origin.

## Prerequisites

- This repo pushed to a GitHub repository Render can access.
- A free [Render](https://render.com) account.
- A free [Upstash](https://upstash.com) account.
- Node.js 20+ installed locally, just to run two `openssl` commands to
  generate secrets (Step 4).

Nothing else. No Docker, no CI setup - Render builds directly from your
repo.

---

## Step 1: Create the Upstash Redis database

1. Log into Upstash, click **Create Database**.
2. Name it anything (e.g. `mansapay`). Pick a region close to where you'll
   deploy the Render services in Step 5 (less latency between them).
3. Type: **Regional** (not Global - Global is unnecessary here and costs
   more once you're past the free tier).
4. Once created, open the database and find the **Connection** section.
   Copy the URL labeled **`rediss://...`** (note the double "s" - that's
   TLS. Do not use the plain `redis://` one if both are shown).
5. Save this value somewhere - it's your `REDIS_URL` for Step 5.

Upstash's free tier is a shared, low-throughput instance. It's enough for
this app's rate limiting and OTP storage; nothing to configure beyond
grabbing the URL.

---

## Step 2: Create the Render PostgreSQL database

1. In the Render dashboard, click **New +** → **PostgreSQL**.
2. Name it anything (e.g. `mansapay-db`). Pick the **Free** plan.
3. Pick a region - use the **same region** you'll pick for the Web Service
   in Step 3, so they can talk over Render's private network.
4. Click **Create Database**. Wait for it to become "Available" (a minute
   or two).
5. Open the database's page and find **Connections**. Copy the **Internal
   Database URL** (not the External one) - the API service will run in
   the same Render region/network, so the internal URL is faster and
   doesn't count against any external bandwidth limits. Save it as your
   `DATABASE_URL` for Step 3.
   - The **External Database URL** is only useful if you want to connect
     with `psql` from your own machine to inspect the deployed database.
     Keep it handy for troubleshooting but you don't need it for the app
     itself.

**Know this going in:** Render's free PostgreSQL plan is time-limited and
gets deleted automatically after a set period (check the current limit on
Render's pricing page - it changes). If it expires mid-grading, you'll
need to create a new one and update `DATABASE_URL` on the API service
(Step 3) to match. Nothing else needs to change - migrations will run
fresh on the new empty database the next time the API starts (see the
"Migrations" section below).

---

## Step 3: Deploy the API as a Render Web Service

1. In Render, click **New +** → **Web Service**, connect this repo.
2. **Root Directory**: leave blank (repo root). This matters - this repo
   is an npm workspaces monorepo, and the workspace install/symlinking
   only works correctly when run from the root, not from inside `apps/api`.
3. **Runtime**: Node.
4. **Region**: same region as the Postgres database from Step 2.
5. **Branch**: `main` (or whichever branch you deploy from).
6. **Build Command**:
   ```
   npm ci && npm run build --workspace apps/api
   ```
7. **Start Command**:
   ```
   npm run start --workspace apps/api
   ```
8. **Plan**: Free.
9. Scroll to **Health Check Path** and set it to:
   ```
   /health
   ```
   This is Render's own readiness check - it uses this endpoint to decide
   whether a deploy succeeded and whether a restarted instance is actually
   up. It's separate from the uptime-monitor setup later in this doc,
   which is about a *different* problem (free-tier sleep).
10. Add every environment variable below (**Environment** tab). These are
    the only ones the API reads - if you skip a required one, the app
    refuses to start and Render's logs will say exactly which one and why
    (see `apps/api/src/config/env.ts`).

| Variable | Value | Where it comes from |
|---|---|---|
| `NODE_ENV` | `production` | Set this explicitly. Render does not set it for you, and several checks in this app (see `DEMO_MODE` below) key off it. |
| `PORT` | *(leave unset)* | Render injects this automatically. Setting it yourself does nothing useful and risks a mismatch. |
| `DATABASE_URL` | the Internal Database URL | Step 2 |
| `REDIS_URL` | the `rediss://...` URL | Step 1 |
| `JWT_SECRET` | output of `openssl rand -base64 48` | Run that command locally, paste the output |
| `WALLET_ENCRYPTION_KEY` | output of `openssl rand -hex 32` | Run that command locally, paste the output (must be exactly 64 hex characters) |
| `AT_API_KEY` | any non-empty placeholder, e.g. `not-used-demo-mode` | See note below |
| `AT_USERNAME` | any non-empty placeholder, e.g. `not-used-demo-mode` | See note below |
| `SMS_DEV_MODE` | `true` | Recommended for this deployment - see note below |
| `DEMO_MODE` | `true` | Required if `SMS_DEV_MODE=true` and `NODE_ENV=production` - see note below |
| `ALLOWED_ORIGINS` | *(placeholder for now - see Step 5)* | e.g. `https://placeholder.onrender.com` - you'll come back and fix this |

**Note on `SMS_DEV_MODE` / `DEMO_MODE` / `AT_API_KEY` / `AT_USERNAME`:**
This deployment is for public academic grading - a grader needs to be able
to complete phone verification without a working Africa's Talking
account, and AT's sandbox has a track record of outages. Setting
`SMS_DEV_MODE=true` together with `DEMO_MODE=true` makes the API log OTP
codes to its own console instead of sending real SMS (see the earlier
`SMS_DEV_MODE` work) - the code is still generated, hashed, rate-limited,
and expired exactly as normal, it just isn't actually texted anywhere.
Because `AT_API_KEY`/`AT_USERNAME` are never used in this mode, any
non-empty placeholder string satisfies the schema. **If you ever deploy
this for real users, set both flags to `false` and use real Africa's
Talking credentials instead** - the app will refuse to start if
`SMS_DEV_MODE=true` and `NODE_ENV=production` without `DEMO_MODE=true`,
specifically to stop this combination from reaching real users by
accident.

11. Click **Create Web Service**. Watch the deploy log. A successful first
    deploy looks like:
    ```
    ==> Running 'npm run start --workspace apps/api'
    applied 0001_create_users.sql
    applied 0002_create_refresh_tokens.sql
    ... (one line per migration) ...
    ⚠️  SMS_DEV_MODE is ON ...
    MansaPay API listening on 0.0.0.0:<port>
    ```
12. Once it's live, copy the service's URL from the top of the page (looks
    like `https://mansapay-api-xxxx.onrender.com`). You'll need it twice:
    for the frontend's `VITE_API_URL` (Step 4) and to fix `ALLOWED_ORIGINS`
    (Step 5).

---

## Step 4: Deploy the frontend as a Render Static Site

1. **New +** → **Static Site**, connect the same repo.
2. **Root Directory**: leave blank (repo root), same reasoning as Step 3.
3. **Build Command**:
   ```
   npm ci && npm run build --workspace apps/web
   ```
4. **Publish Directory**:
   ```
   apps/web/dist
   ```
5. Add one environment variable:

   | Variable | Value | Where it comes from |
   |---|---|---|
   | `VITE_API_URL` | the API's URL from Step 3, e.g. `https://mansapay-api-xxxx.onrender.com` | Step 3, the URL Render assigned the Web Service |

   This is read **at build time**, not runtime - Vite bakes it into the
   compiled JS. If you change it later, you must trigger a new build for
   it to take effect (changing the env var on a Static Site does trigger
   an automatic rebuild on Render, but if you ever build `apps/web`
   manually, remember to set it in that shell too).
6. Click **Create Static Site**. Watch the build log; if you forgot
   `VITE_API_URL`, `vite.config.ts` prints a warning explicitly telling
   you so (the build still succeeds, it just won't work once deployed).
7. Copy this service's URL too, e.g. `https://mansapay-web-xxxx.onrender.com`.

---

## Step 5: Close the loop - fix `ALLOWED_ORIGINS`

Go back to the **API** service (Step 3) → **Environment**, and set:

```
ALLOWED_ORIGINS=https://mansapay-web-xxxx.onrender.com
```

using the actual Static Site URL from Step 4 (no trailing slash - it must
match the browser's `Origin` header exactly). If you also want to keep
using the deployed API from local dev occasionally, you can add your
local origins too, comma-separated:

```
ALLOWED_ORIGINS=https://mansapay-web-xxxx.onrender.com,http://localhost:5173
```

Saving this env var change triggers an automatic redeploy of the API
service. Wait for it to finish before testing.

---

## Step 6: Verify everything is working

1. **API health**: open `https://<your-api>.onrender.com/health` directly
   in a browser, or:
   ```
   curl https://<your-api>.onrender.com/health
   ```
   Expect `{"status":"ok","db":"ok","cache":"ok"}`. If `db` or `cache`
   says `"error"`, double check `DATABASE_URL`/`REDIS_URL` on the API
   service.

2. **Frontend loads**: open `https://<your-web>.onrender.com/register` in
   a browser. You should see the MansaPay register screen, not a blank
   page or a CORS error in the console.

3. **Full signup flow**: register a real-looking account, log in, and get
   to the "Verify your phone" screen. Open the API service's **Logs** tab
   on Render and look for a line like:
   ```
   [SMS_DEV_MODE] SMS to +2217... not sent (Africa's Talking bypassed): Your MansaPay verification code is 482913. ...
   ```
   Copy that 6-digit code into the OTP screen. You should land on "Phone
   verified."

4. **No CORS errors**: while doing step 3, keep the browser's DevTools
   Network/Console tab open. If `ALLOWED_ORIGINS` is wrong, you'll see a
   CORS error in the console and failed requests in the Network tab -
   recheck Step 5 (exact origin match, no trailing slash).

If all four pass, the deployment is working end to end.

---

## Keeping the API warm (important for grading)

Render's **free** web services spin down after **15 minutes** of no
traffic, and take roughly **30-60 seconds** to wake back up on the next
request. If a grader opens your link cold, the first click could sit on a
loading spinner for a minute - easy to misread as a broken deployment.

Fix: a free external uptime monitor that pings `/health` every few
minutes, keeping the service from ever going to sleep during the grading
window.

**Using [UptimeRobot](https://uptimerobot.com) (free):**

1. Create a free account.
2. **Add New Monitor**.
3. Monitor Type: **HTTP(s)**.
4. Friendly Name: anything, e.g. `MansaPay API`.
5. URL: `https://<your-api>.onrender.com/health`.
6. Monitoring Interval: **5 minutes** (comfortably under Render's 15-minute
   sleep window).
7. Save. UptimeRobot will now hit `/health` every 5 minutes, 24/7, which
   is exactly the signal Render needs to keep the instance awake.

Turn this on *before* sharing the link for grading, and leave it running
for the grading window. There's no cost and nothing else to maintain.

---

## Migrations run on every start - and that's safe

The API's start command is:

```
npm run start --workspace apps/api
  → node dist/db/migrate.js && node dist/index.js
```

This runs on **every single process start** - the first deploy, every
subsequent deploy, and every time Render wakes the service back up from
the 15-minute sleep described above. That's intentional, not a bug: it's
the only way to guarantee the schema is up to date before the server
starts accepting requests, without depending on a separate "pre-deploy"
step that not every Render plan even has.

This is safe to run repeatedly because the migration runner
(`apps/api/src/db/migrate.ts`) is idempotent: it keeps a
`schema_migrations` table recording which migration files have already
been applied, and skips anything already in that table. A run against an
up-to-date database does nothing and exits immediately (verified locally
while building this: running `npm start` twice in a row against the same
database prints migration output only on the first run - the second
prints nothing and goes straight to "MansaPay API listening").

The `&&` matters as much as the idempotency: if a migration ever fails
(bad SQL, lost connection, whatever), `node dist/db/migrate.js` exits
non-zero, `&&` short-circuits, and `node dist/index.js` never runs. Render
will show the deploy as failed / the instance as crashed - loudly, in the
logs - instead of quietly serving a server bolted onto a half-migrated
schema.

---

## Full environment variable reference

### API (Render Web Service)

| Variable | Required | Notes |
|---|---|---|
| `NODE_ENV` | yes | Set to `production` |
| `PORT` | no | Injected by Render - don't set it |
| `DATABASE_URL` | yes | Render Postgres Internal URL |
| `REDIS_URL` | yes | Upstash `rediss://` URL |
| `JWT_SECRET` | yes | `openssl rand -base64 48` |
| `WALLET_ENCRYPTION_KEY` | yes | `openssl rand -hex 32` (64 hex chars) |
| `AT_API_KEY` | yes | Real Africa's Talking key, or any placeholder if `SMS_DEV_MODE=true` |
| `AT_USERNAME` | yes | Real Africa's Talking username, or any placeholder if `SMS_DEV_MODE=true` |
| `SMS_DEV_MODE` | no (default `false`) | `true` recommended for this demo deployment |
| `DEMO_MODE` | no (default `false`) | Must be `true` if `SMS_DEV_MODE=true` and `NODE_ENV=production` |
| `ALLOWED_ORIGINS` | yes | Comma-separated origins, e.g. the Static Site's URL |

### Web (Render Static Site)

| Variable | Required | Notes |
|---|---|---|
| `VITE_API_URL` | yes for a working deploy | Build-time only. The deployed API's full URL |

---

## Troubleshooting

- **CORS error in the browser console** ("has been blocked by CORS
  policy"): `ALLOWED_ORIGINS` on the API doesn't exactly match the
  frontend's origin. Check for a trailing slash, `http` vs `https`, or a
  stale URL from before a redeploy changed it.
- **Page loads but every API call fails / Network tab shows requests to
  the wrong host**: `VITE_API_URL` wasn't set when the Static Site was
  built (check the build log for the warning), or it's pointing at the
  wrong service. Fix the env var and trigger a rebuild.
- **First request after a while is very slow, or times out once and
  works on retry**: this is the free-tier cold start described above. Set
  up the UptimeRobot monitor.
- **Deploy fails with a migration error**: check the API service's logs
  for the actual SQL/connection error. Most often this is `DATABASE_URL`
  being wrong or the Postgres database not being "Available" yet.
- **App refuses to start with a `SMS_DEV_MODE` / `DEMO_MODE` error**:
  you have `SMS_DEV_MODE=true` and `NODE_ENV=production` without
  `DEMO_MODE=true`. Either add `DEMO_MODE=true` (fine for this academic
  deployment) or set `SMS_DEV_MODE=false` and use real AT credentials.
- **`/health` returns `"db":"error"` or `"cache":"error"`**: double-check
  `DATABASE_URL`/`REDIS_URL` are exactly the values from Steps 1-2, and
  that the Postgres database hasn't expired (see Step 2's note).
- **Postgres free database is gone / connection refused**: it expired.
  Create a new one (Step 2), update `DATABASE_URL`, redeploy - migrations
  will run fresh against the empty database automatically.

---

## Local development is unaffected

Everything above only concerns the deployed environment. Local dev still
works exactly as documented in `apps/web/README.md`'s "Demo setup" section
and the root `DEMO.md`: `docker compose up`, `npm run migrate`,
`npm run dev` in `apps/api` and `apps/web`. None of the Render/Upstash
configuration above is read or required locally.
