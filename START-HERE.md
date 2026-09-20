# Qareeb — start here after downloading

This is the complete source project: React frontend, Node API, database migrations, demo data, images, and deployment configuration. No rewrite is needed to fix the Vercel workspace error.

## 1. Upload the files correctly

Extract `qareeb-ready.zip`. Upload the **contents of the qareeb folder** to the root of your GitHub repository, replacing files with the same names. Include hidden configuration files if your file picker hides them. Do not upload the ZIP itself to GitHub as the application.

Your repository should look like this (no extra enclosing folder):

```
package.json
package-lock.json
vercel.json
render.yaml
Dockerfile
client/
  package.json
  vercel.json
  src/
  public/
server/
  package.json
  src/
  drizzle/
scripts/
START-HERE.md
```

The archive deliberately excludes dependencies, compiled builds, secrets, database files, user uploads, Git history, and the unrelated original video files. Hosts install dependencies and build the app from source. Existing local files have not been deleted.

## 2. Recommended: run the whole app on one host

This is simpler than splitting it between Vercel and Render:

1. Upload the project to GitHub as described above.
2. Render → **New → Blueprint** → select the repository and the branch you uploaded to → apply `render.yaml`.
3. Wait for deployment. Visit the generated URL. It serves both the website and API.
4. Check `<render-url>/api/health` returns JSON containing `"ok": true`.

The included Render configuration is for a **demo**. Free hosting can sleep and its local database/uploads are ephemeral. For real orders, configure persistent storage as described in `DEPLOY.md`. Do not use default demo passwords for a public launch.

## 3. If you want the frontend on Vercel

Keep the Render service from step 2 running — Vercel alone cannot run this project's long-running Socket.io server and local SQLite/upload storage.

Use these Vercel project settings:

| Setting | Recommended value |
| --- | --- |
| Root Directory | Empty / repository root |
| Framework Preset | Other |
| Node.js Version | 22.x |
| Install Command | From `vercel.json`: `npm ci --include=dev` |
| Build Command | From `vercel.json`: `npm --prefix client run build` |
| Output Directory | From `vercel.json`: `client/dist` |
| Environment variable | `VITE_API_URL=https://YOUR-ACTUAL-RENDER-URL` |

- **Clear old dashboard overrides**, particularly `npm run build -w client`. Configuration files cannot reliably correct conflicting project overrides for you.
- Set `VITE_API_URL` for Production and, if needed, Preview. Use the API origin only, not `/api`, and not `localhost`.
- Redeploy after changing environment variables; Vite embeds them at build time.
- Use the branch containing your newly uploaded files as the Production Branch.
- Existing deployments are not changed by a new upload until you deploy that upload.

### Alternative: Vercel Root Directory = client

This is also supported through `client/vercel.json`. Keep the **whole project** in your repository, enable **Include source files outside of the Root Directory in the Build Step** in Vercel, and clear dashboard build/install/output overrides.

The nested configuration runs `cd .. && npm ci --include=dev`, then `npm run build` inside `client`, and publishes `dist`. Do not upload only the client directory: the lockfile and workspace manifests live above it.

### Images and CORS

On Render, set `PUBLIC_URL` to its public HTTPS origin. New uploads also resolve against `VITE_API_URL` in the frontend when the API returns a relative path.

Optionally set `CORS_ORIGINS` to the exact frontend origins, separated by commas. Include any Vercel preview domains you intend to use; otherwise those previews will be blocked. Leaving it unset permits cross-origin requests broadly, suitable for the demo but not a restrictive production configuration.

## 4. Test the app

Demo accounts (password `password123`, unless you changed `DEMO_PASSWORD`):

| Role | Email |
| --- | --- |
| Customer | `ali@demo.com` |
| Merchant | `madina@demo.com` |
| Rider | `rider1@demo.com` |
| Admin | `admin@qareeb.app` |

From a terminal in the project root, using Node 22.13 or newer:

```sh
npm ci --include=dev
npm run typecheck
npm run build
npm run test:deploy
npm run dev
```

`test:deploy` creates and deletes its own temporary database. It tests health/CORS, SPA links, all four roles, authorization, catalog data, uploads, and Socket.io. It never resets your application's database.

To serve the compiled app locally, stop the development API first, then run `npm start`; the full app is served on port 4000. Public production hosts must set `NODE_ENV=production` and a strong `JWT_SECRET`.

## What this download fixes

- Vercel build configuration for both repository-root and `client` root choices.
- Backend warm-up retry loop no longer restarts when its status changes.
- Correct image URLs with a separately hosted API.
- Updated Drizzle ORM and Google authentication dependencies; `npm audit --omit=dev` reports zero production vulnerabilities at packaging time.
- Four moderate audit entries remain in the development-only drizzle-kit/esbuild dependency chain. Do not run `npm audit fix --force`: npm proposes a breaking downgrade. These tools are pruned from the Docker runtime image.

## Limits to know before launching

- This download fixes and tests the deployment path; it is not a complete security audit or a claim that every application edge case is bug-free.
- Card/JazzCash/EasyPaisa payments are simulated, not connected to real payment processors.
- Google Sign-In requires your Google OAuth client configuration; real Google login is not covered by the local deployment tests.
- Push notifications need HTTPS, permission, and persistent VAPID keys for stable production use.
- Persistent database and image storage, non-demo credentials, backups, and real payment integration are required before taking real customer orders.

See `DEPLOY.md` for Docker, Railway, storage, environment variables, and troubleshooting.
