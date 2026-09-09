# Deploying EduManage as a public web app

EduManage ships two deployment targets from one codebase:

1. **Desktop (Electron)** — the offline-first installer described in `README.md`.
2. **Web/server** (`server.cjs`) — the exact same `electron/services/*.cjs`
   business logic and SQLite schema, served over plain HTTP by Express, so
   it opens in any browser at a real URL. This is what this guide covers.

Nothing about the app's functionality changes between the two — same
database schema, same permission enforcement, same fee/exam/attendance
logic. What differs is only the transport (Electron IPC vs. HTTP+cookies)
and how native dialogs are replaced (see `src/lib/api.ts`: backups download/
upload as files, "print" opens the browser's own print dialog).

## The one thing that matters more than anything else: persistent storage

Your school's entire database is a single SQLite file. If you deploy to a
host that doesn't give you a **persistent disk/volume**, every redeploy or
container restart wipes all data. Confirm your host mounts a real volume at
`DATA_DIR` before you rely on this for real student/fee records.

## Option A — Render.com (one click, via the included Blueprint)

The repo includes `render.yaml`, a Render Blueprint, so you don't have to
type any settings into Render's dashboard by hand:

**[Deploy to Render](https://render.com/deploy?repo=https://github.com/sanaullahkhanofficial/ShopManager/tree/claude/edumanage-school-erp-ojctql)**

1. Click the button above, sign in (GitHub login is easiest), and approve
   Render's access to this repo when it asks.
2. Render reads `render.yaml` and pre-fills everything — build command,
   start command, and a `SESSION_SECRET` it generates for you. Just click
   **Apply**/**Create Web Service**.
3. Wait for the build to finish (a few minutes the first time), then open
   the `https://<your-service>.onrender.com` URL it gives you.

**Important tradeoff on the free plan:** Render's free web services have no
persistent disk — every redeploy, and every wake-up after ~15 minutes of
inactivity (the free tier sleeps), wipes the SQLite database back to empty.
That's fine for kicking the tires (which is what you asked for), but not for
real student/fee records. When you're ready for that, open the service in
Render, upgrade it to the **Starter** plan (~$7/mo at time of writing), add
a **Disk** mounted at `/opt/render/project/src/data`, and uncomment the
`disk:` block in `render.yaml` (or just add the disk from the dashboard —
either works). Redeploy once after that and your data will persist.

### If you'd rather not use the Blueprint button

1. Push this repo (or your fork) to GitHub — already done, this is
   [PR #1](../../pull/1)'s branch.
2. On [render.com](https://render.com), **New → Web Service**, connect the repo.
3. Settings:
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build:web`
   - **Start Command:** `node server.cjs`
   - **Environment variables:**
     - `SESSION_SECRET=` (generate one — see `.env.example`)
     - `NODE_ENV=production`
   - (Optional, for persistence) **Add a Disk:** mount path
     `/opt/render/project/src/data`, size 1GB+, and set
     `DATA_DIR=/opt/render/project/src/data`
4. Deploy. Render gives you a `https://<your-service>.onrender.com` URL —
   that's your public link. First visit shows the Setup Wizard.

## Option B — Railway.app (persistent volumes built in, no card for the trial)

Railway lets you start without a credit card (a one-time trial credit, then
a small monthly free credit that isn't enough for an always-on service —
check their current pricing page before relying on this long-term).

1. **New Project → Deploy from GitHub repo**, pick this repo/branch.
2. Add a **Volume**, mount it at `/app/data`.
3. Set environment variables: `DATA_DIR=/app/data`, `SESSION_SECRET=<random>`,
   `NODE_ENV=production`.
4. Railway auto-detects Node; set the **Build Command** to
   `npm install && npm run build:web` and **Start Command** to `node server.cjs`
   (or just use the included `Dockerfile` — Railway supports it natively).
5. Deploy, then open the generated `*.up.railway.app` URL.

## Option C — Fly.io or any Docker host

The included `Dockerfile` builds the frontend and runs `server.cjs` with only
production dependencies (no Electron/electron-builder in the final image).

```bash
docker build -t edumanage .
docker run -d -p 3000:3000 \
  -e SESSION_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))") \
  -v edumanage-data:/app/data \
  edumanage
```

For Fly.io specifically: `fly launch` (it detects the Dockerfile), then
`fly volumes create edumanage_data --size 1` and mount it at `/app/data` in
the generated `fly.toml`, then `fly deploy`.

## Option D — Your own VPS (no platform lock-in)

```bash
git clone <your-fork-url> && cd ShopManager
npm install
npm run build:web
DATA_DIR=/var/lib/edumanage SESSION_SECRET=<random> NODE_ENV=production PORT=3000 \
  node server.cjs
```

Put this behind Nginx/Caddy for TLS and a real domain, and run it under
`systemd` or `pm2` so it restarts automatically.

## Testing locally before you deploy anywhere

```bash
npm install
npm run build:web
DATA_DIR=./data node server.cjs
# open http://localhost:3000 in any browser — no Electron involved
```

## What differs from the desktop app in web mode

- **Backups**: "Create Backup" downloads the `.db` file to your browser's
  Downloads folder instead of a native save dialog. "Restore" uploads a file
  you pick and signs everyone out afterward (instead of relaunching the app).
- **Printing/PDF export**: opens the document in a new tab and triggers your
  browser's own print dialog — choose "Save as PDF" there for a PDF file.
- **Photo/document uploads** in a couple of forms are marked desktop-only for
  now (no screen in this release actually surfaces that button yet).
- Sessions are cookie-based and support multiple concurrent users/browsers,
  unlike the desktop app's single always-signed-in-user model.
