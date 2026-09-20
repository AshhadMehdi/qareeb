# Deploying Qareeb

Qareeb is **one Node.js process**: the Express API (REST + Socket.io + SQLite) that also serves the
built React client from `client/dist`. That means it must run on a host that can keep a Node server
running — **Render, Railway, Fly.io, a VPS/Docker** — not on a purely static host.

> **Getting "This page doesn't exist" / 404 after deploying?** See [Troubleshooting](#troubleshooting)
> at the bottom — it is almost always one of three things: wrong branch, static-only host, or
> missing build/output settings.

| Option | Best for | Cost | Data persists? |
|---|---|---|---|
| **A. Render** (Blueprint) | Fastest path, zero config | Free tier | Only with a paid disk |
| **B. Railway** (Dockerfile) | Easy + persistent volume | ~$5/mo credit | Yes (volume) |
| **C. Docker / VPS** | Full control, cheapest at scale | VPS price | Yes (volumes) |
| **D. Vercel/Netlify + API elsewhere** | Separate frontend hosting | Free + API host | Depends on API host |

Before any option: **make sure the branch you deploy contains the app** (`client/`, `server/`,
`package.json` at the repo root). Select the branch containing your uploaded files, usually `main`.
For the downloadable source package, follow [START-HERE.md](START-HERE.md) first.

---

## A. Render (recommended — one click)

1. Push/merge the code, then in Render: **New + → Blueprint** → connect the GitHub repo → pick the branch → **Apply**.
   `render.yaml` in the repo root configures everything (Node 22, build, start, health check, a random `JWT_SECRET`).
2. Wait for the first deploy (~3 min). Open the URL Render gives you — the app boots, runs migrations and seeds the
   Abbottabad demo data automatically.

Manual alternative (New + → Web Service):

| Setting | Value |
|---|---|
| Runtime | Node |
| Build command | `npm ci --include=dev && npm run build` |
| Start command | `npm start` |
| Health check path | `/api/health` |
| Environment | `NODE_VERSION=22.14.0`, `NODE_ENV=production`, `JWT_SECRET=<long random string>` |

Notes
- The **free instance sleeps** after 15 min without traffic (first request takes ~30 s) and its disk is
  **ephemeral** — the SQLite DB and uploaded photos reset on every deploy/restart (demo data is re-seeded).
- For real data, use a Starter instance and uncomment the `disk` block + `DATABASE_URL`/`UPLOADS_DIR` in `render.yaml`.

## B. Railway

1. **New Project → Deploy from GitHub repo** → select the repo and branch. Railway detects the `Dockerfile` and builds it.
2. **Variables**: add `JWT_SECRET` (long random string). Railway injects `PORT` automatically.
3. **Settings → Networking → Generate Domain**.
4. Persistence: **Add Volume**, mount path `/app/server/data`, and add the variable
   `UPLOADS_DIR=/app/server/data/uploads` so photos live on the same volume.

## C. Docker on any VPS (Hetzner, DigitalOcean, AWS Lightsail, …)

```bash
git clone <repo> qareeb && cd qareeb
JWT_SECRET=$(openssl rand -hex 32) docker compose up -d --build   # → http://SERVER_IP:4000
```

Put it behind HTTPS with Caddy (automatic Let's Encrypt):

```
# /etc/caddy/Caddyfile
qareeb.example.com {
    reverse_proxy 127.0.0.1:4000
}
```

HTTPS is required for geolocation, push notifications and PWA install. Data lives in the
`qareeb-data` and `qareeb-uploads` volumes. Update with `git pull && docker compose up -d --build`.

## D. Vercel (or Netlify) for the frontend + API on Render/Railway

Vercel and Netlify are static/serverless hosts: they can serve the React app but **cannot run the
Qareeb API** (it needs a long-running Node process for Socket.io realtime, the SQLite file and photo
uploads). So the API goes on Render/Railway and the Vercel site talks to it.

**Step 1 — API on Render (3 min)**
1. [render.com](https://render.com) → **New + → Blueprint** → connect `AshhadMehdi/sklllll` → the branch containing these uploaded files → **Apply**.
2. When it's live, copy its URL, e.g. `https://qareeb.onrender.com`, and open `…/api/health` — you should see `{"ok":true}`.
   (This service also serves the complete app on that URL, so you could stop here.)
3. Optional but recommended, in the Render service → Environment: `PUBLIC_URL=https://qareeb.onrender.com` (absolute URLs for uploaded photos) and `CORS_ORIGINS=https://<your-project>.vercel.app` (lock CORS to your site).

**Step 2 — Frontend on Vercel**
1. Vercel → **Add New… → Project** → import `AshhadMehdi/sklllll`. *Root Directory* can be either `./` (repo root → root `vercel.json` is used) or `client` (→ `client/vercel.json` is used); both build the same site with the SPA rewrite. Don't override Build Command / Output Directory in the dashboard.
2. Before deploying, expand **Environment Variables** and add `VITE_API_URL` = `https://qareeb.onrender.com` (no trailing slash).
3. **Deploy.** Make sure the production branch is the branch containing these uploaded files (usually `main`).
4. Changed `VITE_API_URL` later? It is baked in at build time → **Deployments → ⋯ → Redeploy**.

Netlify is identical: import the repo (`netlify.toml` holds the settings), add `VITE_API_URL`, pick the branch under *Site configuration → Build & deploy → Branches*.

**What you'll see on the Vercel site**
- *"Backend not connected"* → `VITE_API_URL` isn't set (or the deploy predates it). Set it and redeploy.
- *"Waking up the server…"* → the free Render instance was asleep; it takes ~30-60 s and the app continues automatically.

---

## Environment variables

| Variable | Required | Default | Purpose |
|---|---|---|---|
| `JWT_SECRET` | **yes (prod)** | dev secret | Signs login tokens |
| `PORT` | no | `4000` | Set by most hosts automatically |
| `NODE_ENV` | no | `development` | Use `production` |
| `DATABASE_URL` | no | `file:server/data/qareeb.db` | SQLite file path or a Turso/libSQL URL (`libsql://…` + `DATABASE_AUTH_TOKEN`) |
| `UPLOADS_DIR` | no | `server/uploads` | Folder for uploaded photos |
| `AUTO_SEED` | no | `true` | Seed Abbottabad demo data into an empty DB. Set `false` for a real launch |
| `DEMO_PASSWORD` | no | `password123` | Password of the seeded demo accounts |
| `PUBLIC_URL` | split deploys | – | Public origin of the API |
| `CORS_ORIGINS` | split deploys | any | Comma-separated allowed browser origins |
| `GOOGLE_CLIENT_ID` | no | – | Enables Google Sign-In |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | no | auto-generated | Web Push keys. Set them explicitly in production so push subscriptions survive restarts (`npx web-push generate-vapid-keys`) |
| `VITE_API_URL` (client build) | split deploys | same origin | API origin for a frontend hosted elsewhere |

## Going live checklist

- [ ] `JWT_SECRET` set to a long random value
- [ ] HTTPS in front of the app
- [ ] Persistent storage for the DB and uploads (disk/volume, or Turso via `DATABASE_URL`)
- [ ] Fixed VAPID keys so push keeps working across deploys
- [ ] `AUTO_SEED=false` (or wipe the demo data) and change the admin password (`admin@qareeb.app`)
- [ ] `GOOGLE_CLIENT_ID` with your domain added to the OAuth client's authorised origins

## Troubleshooting

**"This page doesn't exist" / 404 right after deploying**

1. **Wrong branch or nested upload.** Select the branch containing these files. `package.json`, `client/`, and `server/` must be at the repository root, not inside an extra `qareeb/` directory.
2. **Static-only host (Vercel, Netlify, GitHub Pages, Cloudflare Pages) with default settings.** They build
   nothing runnable from the repo root, so every URL is a 404. Either use option A/B/C, or use option D
   (the repo's `vercel.json` / `netlify.toml` set the build command, output folder and SPA rewrite).
3. **Vercel shows "Backend not connected" instead of 404** — good, the frontend is deployed; now point it at an API with `VITE_API_URL` (option D).
4. **Deep links 404 but `/` works** — the host lacks an SPA fallback. `vercel.json` and `netlify.toml`
   add it; on Nginx use `try_files $uri /index.html;`. The Node server already handles this itself.

**Vercel build fails with `npm error No workspaces found: --workspace=client`** — the project's *Root Directory* is `client`, so `npm run build -w client` ran inside `client/`. Either set Root Directory to `./` (Settings → General), or make sure `client/vercel.json` exists (it does since this commit) and clear any Build Command override, then redeploy.

**Build fails with "tsc: not found" / "vite: not found"** — `NODE_ENV=production` made npm skip
devDependencies. Use `npm ci --include=dev` as the install/build command (already in `render.yaml`, `Dockerfile`, `vercel.json`, `netlify.toml`).

**Login works but the map is blank** — map tiles are loaded from CARTO by the browser; make sure the
site is served over HTTPS and no content blocker is active.

**Everything resets after a while** — you are on ephemeral storage (Render free tier, Docker without volumes). See persistence notes above.
