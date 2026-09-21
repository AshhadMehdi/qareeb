# Qareeb — local shops, delivered

A complete hyperlocal commerce platform inspired by *AroundYou* and built to go further: customers discover shops around them on a live map, order from **several shops in one checkout**, and watch their rider move in real time; merchants run their shop, inventory, delivery rings and riders from a dashboard; riders get a dedicated delivery app; admins oversee the whole platform.

Everything ships in this repo: **serverless API + PostgreSQL database + seed data + installable web app** for all four roles.

> Default city is **Abbottabad, Pakistan** with realistic demo shops (karyana, sabzi mandi, meat, dairy, bakery, pharmacy…). Change it in Admin → Settings.

---

> **New deployment:** Vercel only. Start with [START-HERE.md](START-HERE.md). Connect Neon from the Vercel Storage tab; the first visit creates tables and demo shops. Live updates use authenticated five-second polling.

## Feature tour

### Customer app (`/home`)
- **Location-aware discovery** – GPS or a saved address; shops sorted by distance / rating / delivery fee, filtered by category, "open now" and radius. List **and map view** (Leaflet + CARTO tiles) with tap-to-preview cards.
- **Search** across shops *and* products ("milk" finds every shop that sells milk), recent searches, suggestions.
- **Shop page** – hero, rating, ETA, delivery fee for *your* location, out-of-zone warning, opening hours, delivery rings, reviews, grouped products with sticky category chips, live stock.
- **Multi-shop cart** – items grouped per shop, per-shop notes, quantity steppers; guests can browse and fill a cart, sign-in is asked only at checkout.
- **Checkout** – saved addresses with map pin & reverse geocoding, live quote per shop (distance, zone, fee, free-delivery thresholds, minimum order, stock issues), promo codes, rider tips, **payment methods: Cash on delivery, JazzCash, Easypaisa, Card (sandbox) and Qareeb points wallet**, order notes. One order per shop, linked by a group id.
- **Live tracking** – status timeline, rider on the map with smooth motion, ETA, call / WhatsApp / **in-app chat** with the rider and shop, cancel window, receipt, reorder.
- Order history, favourites, saved addresses, loyalty **points wallet**, notification centre, **Web Push** notifications, installable **PWA** (offline shell), **dark mode** (light / dark / follow-system, with dark map tiles).
- Email/password and **Google Sign-In** (optional).

### Merchant dashboard (`/merchant`)
- 3-step **shop setup wizard** (details → map location → hours) with sensible default delivery rings.
- **Overview** – today's sales, pending orders, revenue chart, orders by status, top products, low-stock alerts, one-tap *pause shop*.
- **Orders** – new orders ring a bell in real time; accept / reject with reason, preparing → ready, assign a rider (own team or **auto-assign nearest by distance + workload**), self-deliver fallback, chat with the customer, printable receipt.
- **Products** – photos (upload) or emoji, categories, units, prices & compare-at prices, inline stock +/- and visibility switches, featured items.
- **Shop settings** – details & branding, opening hours per weekday, **ring-based delivery zones** (radius → fee, free-above threshold) with a live map preview.
- **Riders** – build your own team by email, see platform riders nearby, online status and workload.
- **Promo codes** – percent / fixed / free delivery, min order, caps, expiry, usage limits.

### Rider app (`/runner`)
- Online/offline switch, live GPS streaming (throttled) to customers & shops, earnings today / week / month + chart, tips.
- Delivery detail with pickup & drop-off cards, navigation deep-links, call / WhatsApp / chat, cash-to-collect banner, *picked up* → *delivered* flow, decline before pickup.
- Demo mode: **"Simulate ride"** button animates a fake GPS trip so live tracking can be demoed on a laptop.

### Admin console (`/admin`)
- Platform stats (GMV, revenue, users, riders online), 14-day charts, **live map** of shops and moving riders.
- Approve / suspend shops, manage users (roles, wallet points, disable), browse & intervene in any order, platform settings (service fee, commission, loyalty rate, radius cap, cancel window, city), platform-wide promos, **broadcast announcements**.

---

## Tech stack

| Layer | Choice |
|---|---|
| Server | Node 22, **Express 5**, TypeScript (ESM), zod validation, JWT + bcrypt, web-push (VAPID), multer uploads, helmet/cors/rate-limit |
| Database | **PostgreSQL** + **Drizzle ORM**. Vercel Storage (Neon) or any `DATABASE_URL`/`POSTGRES_URL`. Local development uses PGlite. Schema is applied automatically. |
| Client | **Vite 6 + React 19 + TypeScript**, Tailwind CSS v4, React Router 7, TanStack Query, Zustand (persisted cart/auth/location), react-leaflet, framer-motion, recharts, sonner |
| Realtime | Durable, authorized HTTP event polling every 5 seconds (while visible): order events, chat, rider GPS |
| PWA | Web manifest + hand-written service worker (app-shell cache, push, notification click routing) |
| Theming | Tailwind v4 CSS variables remapped under `html.dark` (no per-class `dark:` variants); theme persisted in `localStorage` and applied pre-paint |

### Repo layout
```
api/       Vercel function entry point
server/    Express API, Drizzle PostgreSQL schema, seed data
client/    React app (customer / merchant / rider / admin)
supabase/  Auto-applied schema (optional extra SQL kept for reference)
scripts/   Deployment tests and downloadable source packaging
```

---

## Quick start

```bash
npm install                # installs both workspaces
npm run dev                # API on :4000  +  web app on :5173 (proxying /api)
```
Open <http://localhost:5173>. On first boot the server creates the local PostgreSQL/PGlite database, runs migrations and seeds demo data (disable with `AUTO_SEED=false`).

### Demo accounts

Password for local and hosted demo accounts: `password123` (also shown on the login screen). Change it before real customers.
| Role | Email | Notes |
|---|---|---|
| Customer | `ali@demo.com` | has live orders, addresses, points |
| Customer | `sara@demo.com`, `hassan@demo.com` | |
| Merchant | `madina@demo.com` | Al-Madina Karyana Store (also `sabzi@`, `kakul@`, `mart@`, `roshan@`, `sehat@`, `doodh@`, `fruit@`, `shahzad@`, `amc@demo.com`) |
| Rider | `rider1@demo.com` … `rider4@demo.com` | rider1 is mid-delivery |
| Admin | `admin@qareeb.app` | |

Promo codes to try: `WELCOME50` (Rs 50 off ≥ Rs 500), `FREESHIP` (≥ Rs 800), `MADINA10`, `SWEET15`.

### Try the full flow in 2 minutes
1. Sign in as **Ali**, open a shop, add items, checkout with JazzCash + a tip.
2. In another browser profile or private window sign in as that shop's merchant → **Orders** → Accept → Preparing → Ready → *Assign rider → Auto-assign*.
3. Sign in as the assigned rider → open the delivery → *Simulate ride* → "I've picked it up" → "Mark as delivered".
4. Back as Ali: watch the rider move live, chat, then leave a review and see points land in the wallet.

---

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | API + web app with hot reload |
| `npm run build` | type-checks and builds both apps (`client/dist`, `server/dist`) |
| `npm start` | production server – serves the API **and** the built web app on one port |
| `npm run typecheck` | `tsc --noEmit` for both workspaces |
| `npm run db:seed` / `npm run db:reset` | seed demo data / wipe and reseed |
| `npm run db:push` | push the Drizzle schema without migrations (dev only) |

## Configuration
Copy `server/.env.example` → `server/.env` (and optionally `client/.env.example` → `client/.env.local`). Key variables:

- `JWT_SECRET` – optional on Vercel (derived from the database URL when omitted). Set your own 32+ character secret for production.
- `GOOGLE_CLIENT_ID` – enables the Google Sign-In button (client reads it from `/api/config`).
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` – Web Push keys; required for push on Vercel (otherwise disabled). Generated locally during development.
- `DATABASE_URL` or `POSTGRES_URL` – hosted PostgreSQL. Vercel Storage (Neon) sets this automatically. Omit only for local PGlite development.
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` – optional image storage; images otherwise live in Postgres.
- `CORS_ORIGINS` – extra origins when the client is hosted separately.

## Production deploy

**Vercel only.** Frontend and API deploy from the repository root. Create a Neon/Postgres database from the Vercel **Storage** tab and connect it to the project. Do not set `VITE_API_URL`. Do not set Root Directory to `client`.

Read **[START-HERE.md](START-HERE.md)**. The first request creates tables and demo shops automatically.

```sh
npm ci --include=dev
npm run typecheck
npm run build
npm run test:deploy
```

Hosted signup and quota requirements can change; free hosting is not guaranteed for commercial use. Real payments, backups, removal of demo users and a production security review are required before launching to real customers.

## API overview
All endpoints are under `/api`, JSON in/out, `Authorization: Bearer <jwt>`. Errors are `{ "error": "message" }`.

- `realtime`: authenticated event feed (no WebSocket server)
- `auth`: register, login, google, me, change-password
- `users/me`: profile, addresses, favorites, notifications, push subscriptions, wallet
- `shops`: nearby search (`lat, lng, radius, q, category, sort, openNow`), categories, featured, detail (products, reviews, zones)
- `orders`: quote, checkout (multi-shop), list, detail, cancel, review, messages
- `merchant`: shop, zones, products (+bulk), orders & status, assign runner (`runnerId | "auto"`), runners, promos, analytics
- `runner`: profile, location, deliveries & status, decline, earnings
- `admin`: stats, shops, users, orders, settings, promos, broadcast
- `uploads`: multipart image upload → `/api/uploads/:id` (Postgres) or optional Supabase Storage; local `/uploads/...` during development
- Event feed: `order:created`, `order:updated`, `notification`, `chat:message`, `runner:location`, `shop:updated`

## Design notes
- **Delivery rings**: each shop defines up to 6 concentric rings (`radiusKm → fee, freeAbove`). The first ring that reaches the customer sets the fee; beyond the largest ring the shop is shown but not deliverable.
- **Order lifecycle**: `PENDING → ACCEPTED → PREPARING → READY → ON_THE_WAY → DELIVERED` (+ `CANCELLED`). Transitions are validated per role on the server; customers can cancel while pending or within a configurable window after acceptance; cancellations restock items and refund online/wallet payments.
- **Auto-assign** scores riders by distance to the shop, current load and whether they belong to the shop's team.
- **Payments** other than COD are simulated (marked paid instantly) — swap in a JazzCash/Easypaisa/Stripe gateway inside `placeOrders()`.
- **Loyalty**: a configurable % of the subtotal is credited as points when an order is delivered; points can pay for orders.
