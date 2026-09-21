# Deployment: Vercel only

For the click-by-click walkthrough, read **[START-HERE.md](START-HERE.md)**.

## Architecture

```
Browser -> Vercel static frontend
        -> /api/* -> api/index.js -> compiled Express API
                                 -> Postgres (Neon from Vercel Storage, or any DATABASE_URL)
                                 -> images stored in Postgres (optional Supabase Storage)
```

No Render service, no Socket.io server, and no required Supabase keys. The first API request installs `supabase/schema.sql` and seeds demo shops if the database is empty.

Vercel Storage → **Neon** injects `POSTGRES_URL` or `DATABASE_URL`. Qareeb also accepts `POSTGRES_PRISMA_URL` and `PGHOST`/`PGUSER`/`PGPASSWORD`. JWT signing uses `JWT_SECRET` when it is at least 32 characters; otherwise a stable secret is derived from the database URL so you can deploy without adding that variable.

Delete **`VITE_API_URL`**. The frontend always calls `/api` on the same Vercel site.

### Live updates

Logged-in clients poll `/api/realtime` every 5 seconds while the tab is visible. Events are stored in Postgres.

### Images

Authenticated uploads (max 3 MB) are stored in Postgres and served at `/api/uploads/:id`. If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, uploads go to Supabase Storage instead. Local development still writes `server/uploads`.

### Build settings

- Root Directory: empty / repository root. **Not `client`.**
- Framework: Other; Node 22.x
- Install: `npm ci --include=dev`
- Build: `npm run build`
- Output: `client/dist`

Clear old dashboard overrides. Redeploy after connecting Storage.

## Local development

```sh
npm ci --include=dev
npm run dev
```

Without a database URL the API uses PGlite. Tests:

```sh
npm run typecheck
npm run build
npm run test:deploy
```

## Launch limitations

- Card/JazzCash/EasyPaisa are simulated.
- Demo logins are for trying the app. Change them before real customers.
- Vercel Hobby is for personal/non-commercial use. Free database signup without a card is not guaranteed.
- This is not a full security audit.
