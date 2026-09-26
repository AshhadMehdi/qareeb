# Qareeb — local shops and kitchens, delivered

A complete hyperlocal commerce platform for a Pakistani city, built around one loop — **discover → decide → order → track → reorder**: customers discover shops around them on a live map, order from **several shops in one checkout**, and watch their rider move in real time; merchants run their shop, inventory, delivery rings and riders from a dashboard; riders get a dedicated delivery app; admins oversee the whole platform.

Everything ships in this repo: **serverless API + PostgreSQL database + seed data + installable web app** for all four roles.

> Default city is **Abbottabad, Pakistan**: ten neighbourhood shops (karyana, sabzi mandi, meat, dairy, bakery, pharmacy) plus seven kitchens (biryani, karahi, BBQ, chapli kebab, pizza, burgers, cafe). Cuisine names, PKR-first pricing, landmark-aware addresses and cash on delivery are part of the product, not decoration. Change the city in Admin → Settings.

---

> **Deploying:** Vercel only, from the repository root. Connect a Neon/Postgres database from the Vercel **Storage** tab (it sets `POSTGRES_URL`); the first request creates the tables and seeds the demo shops. Live updates use authenticated five-second polling — no socket server to deploy.

## Feature tour

### Customer app (`/home`)
- **Home answers three questions** – *What do I want?* (cuisine quick actions: Biryani, BBQ, Karahi, Chapli Kebab, Pizza, Burgers, Cafe & Chai, Karyana), *Where from?* (Tonight's picks as large photo posters), *What now?* (Popular right now, Ready fastest, Everything nearby).
- **Order again** – a delivered order from any kitchen becomes one tap back into the cart.
- **Discovery list & map** – shops sorted by distance / rating / delivery fee / time, filtered by cuisine, "open now" and radius; Leaflet + CARTO map with tap-to-preview.
- **Search** across shops *and* dishes ("biryani" finds every kitchen that cooks it), deep-linkable via `?q=`, recent searches, suggestions.
- **Shop page** – hero, rating, ETA, delivery fee for *your* location, out-of-zone warning, opening hours, delivery rings, reviews, grouped products with sticky category chips, live stock.
- **Multi-shop cart** – items grouped per shop, per-shop notes, quantity steppers; guests can browse and fill a cart, sign-in is asked only at checkout.
- **Checkout** – saved addresses with map pin & reverse geocoding, live quote per shop (distance, zone, fee, free-delivery thresholds, minimum order, stock issues), promo codes, rider tips, **schedule the delivery** (next four half-hour slots today, or tomorrow 9 am), **payment methods: Cash on delivery, JazzCash, Easypaisa, Card (sandbox) and Qareeb points wallet**, order notes. One order per shop, linked by a group id.
- **Live tracking** – status timeline, rider on the map with smooth motion, ETA, call / WhatsApp / **in-app chat** with the rider and shop, cancel window, receipt, reorder.
- **Refer & earn** – every account gets a shareable invite code (`ALI-XXXX`, also accepted as `?ref=` on signup). Both sides are rewarded in points once the invited friend's **first order is delivered**; *Invite friends* shows invited / converted / earned.
- **Help centre** – open a support ticket from your orders or account, priority + topic, chat it through with the platform team, close it when solved.
- Order history, favourites, saved addresses, loyalty **points wallet**, notification centre, installable **PWA** (offline shell; web-push subscriptions are accepted by the API).
- Email/password sign-in, or browse without an account and sign in at checkout.

### Merchant dashboard (`/merchant`)
- 3-step **shop setup wizard** (details → map location → hours) with sensible default delivery rings.
- **Overview** – today's sales, pending orders, revenue chart, orders by status, top products, low-stock alerts, one-tap *pause shop*.
- **Orders** – new orders ring a bell in real time; accept / reject with reason, preparing → ready, assign a rider (own team or **auto-assign nearest by distance + workload**), self-deliver fallback, chat with the customer, printable receipt.
- **Products** – icon/emoji badge, categories, units, prices & compare-at prices, inline stock +/- and visibility switches, featured items.
- **Shop settings** – details & branding, opening hours per weekday, **ring-based delivery zones** (radius → fee, free-above threshold) with a live map preview.
- **Riders** – build your own team by email, see platform riders nearby, online status and workload.
- **Promo codes** – percent / fixed / free delivery, min order, caps, expiry, usage limits.
- **Payouts** – a running wallet of delivered sales minus platform commission, with JazzCash / Easypaisa / bank withdrawal requests (minimum Rs 500), status history and the admin's note on each settlement.

### Rider app (`/runner`)
- Online/offline switch, live GPS streaming (throttled) to customers & shops, earnings today / week / month + chart, tips.
- Delivery detail with pickup & drop-off cards, navigation deep-links, call / WhatsApp / chat, cash-to-collect banner, *picked up* → *delivered* flow, decline before pickup.
- **Earnings & payouts** – delivery fees + tips minus cash still in hand, with withdrawal requests and settlement history.
- Demo mode: **"Simulate ride"** button animates a fake GPS trip so live tracking can be demoed on a laptop.

### Admin console (`/admin`)
- Platform stats (GMV, revenue, users, riders online), 14-day charts, **live map** of shops and moving riders.
- **Payout desk** – every merchant and rider withdrawal request in one queue with totals, approve → mark paid (or reject with a note); each decision is audited and pushes a notification to the wallet owner.
- **Support inbox** – all customer tickets with priority badges and status counts, reply in the thread or resolve it; ticket activity lands in the audit log.
- Approve / suspend shops, manage users (roles, wallet points, disable), browse & intervene in any order, platform settings (service fee, commission, loyalty rate, radius cap, cancel window, city), platform-wide promos, **broadcast announcements**.

---

## Tech stack

| Layer | Choice |
|---|---|
| Server | Node 22, **Express 5**, TypeScript (ESM), zod validation, JWT + bcrypt, web-push (VAPID), multer uploads, helmet/cors/rate-limit |
| Database | **PostgreSQL** + **Drizzle ORM**. Vercel Storage (Neon) or any `DATABASE_URL`/`POSTGRES_URL`. Local development uses PGlite. Schema is applied automatically. |
| Client | **Vite 7 + React 19 + TypeScript**, Tailwind CSS v4, React Router 7, TanStack Query, Zustand (persisted cart/auth/location), react-leaflet, recharts, sonner |
| Realtime | Durable, authorized HTTP event polling every 5 seconds (while visible): order events, chat, rider GPS |
| PWA | Web manifest + hand-written service worker (app-shell cache, push, notification click routing) |
| Theming | Tailwind v4 `@theme` tokens — cream paper + forest green, Fraunces on the hero greeting only, Plus Jakarta Sans everywhere else |

### Repo layout
```
api/       Vercel function entry point (lazy-imports server/dist/serverless.js)
server/    Express API, Drizzle PostgreSQL schema, applied SQL, seed data
client/    React app (customer / merchant / rider / admin) + PWA assets
client/public/images/   dish and shop photography used across the customer app
scripts/   dev.mjs — starts the API and the web app together
server/sql/schema.sql   generated, idempotent — applied once per boot
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
| Kitchen | `biryani@demo.com` | Biryani Express (also `shinwari@`, `khyber@`, `chapli@`, `pizzapoint@`, `burgerlab@`, `chaikhana@demo.com`) |
| Rider | `rider1@demo.com` … `rider4@demo.com` | rider1 is mid-delivery |
| Admin | `admin@qareeb.app` | |

Promo codes to try: `WELCOME50` (Rs 50 off ≥ Rs 500), `FREESHIP` (≥ Rs 800), `MADINA10`, `SWEET15`.

The seed also leaves a settlement queue and a support inbox to poke at: **Kamran Yousaf** (rider2) has a pending withdrawal request, **Al-Madina** a paid one, two support tickets (one from a customer, one from a merchant) sit in the admin inbox, and **Roshan Bakery** has a delivery scheduled for 9 am tomorrow.

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
| `npm run dev:api` / `npm run dev:web` | run just the API or just the web app |
| `npm run db:generate-schema` | not a script — `cd server && node scripts/sync-schema-sql.mjs` regenerates `server/sql/schema.sql` from the Drizzle schema |

## Configuration
Copy `server/.env.example` → `server/.env` (and optionally `client/.env.example` → `client/.env.local`). Key variables:

- `JWT_SECRET` – optional on Vercel (derived from the database URL when omitted). Set your own 32+ character secret for production.
- `GOOGLE_CLIENT_ID` – enables the Google Sign-In button (client reads it from `/api/config`).
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` – Web Push keys; required for push on Vercel (otherwise disabled). Generated locally during development.
- `DATABASE_URL` or `POSTGRES_URL` – hosted PostgreSQL. Vercel Storage (Neon) sets this automatically. Omit only for local PGlite development.
- `CORS_ORIGINS` – extra origins when the client is hosted separately.

## Production deploy

**Vercel only.** Frontend and API deploy from the repository root. Create a Neon/Postgres database from the Vercel **Storage** tab and connect it to the project. Do not set `VITE_API_URL`. Do not set Root Directory to `client`.

The build output is `client/dist` and the API is the root `api/index.js` function; both live on the same origin, so there is no `VITE_API_URL`. The first request creates the tables and the demo shops automatically.

```sh
npm ci --include=dev
npm run typecheck
npm run build
```

Hosted signup and quota requirements can change; free hosting is not guaranteed for commercial use. Real payment gateways, backups, removal of the demo users and a production security review are required before launching to real customers.

## API overview
All endpoints are under `/api`, JSON in/out, `Authorization: Bearer <jwt>`. Errors are `{ "error": "message" }`.

- `realtime`: authenticated event feed (no WebSocket server)
- `auth`: register, login, google, me, change-password
- `users/me`: profile, addresses, favorites, notifications, push subscriptions, wallet, **referral stats, payout wallet & requests, support tickets**
- `shops`: nearby search (`lat, lng, radius, q, category, sort, openNow`), categories, featured (`limit`), **popular** (round-robin across shops by real 21-day order volume), detail (products, reviews, zones)
- `orders`: quote, checkout (multi-shop), list, detail, cancel, review, messages
- `merchant`: shop, zones, products (+bulk), orders & status, assign runner (`runnerId | "auto"`), runners, promos, analytics
- `runner`: profile, location, deliveries & status, decline, earnings
- `admin`: stats, shops, users, orders, settings, promos, broadcast, **payouts (approve / pay / reject), support tickets (reply / status)**
- `uploads`: multipart image upload → `/api/uploads/:id` (stored in Postgres)
- Event feed: `order:created`, `order:updated`, `notification`, `chat:message`, `runner:location`, `shop:updated`

## Design notes
- **Design system**: warm ivory paper, deep emerald `#063B2D` for brand and primary actions, muted gold `#C8A45D` for ratings and a single badge, charcoal `#191919` text. Green is an accent, not the wallpaper; the food photography carries the visual weight, and one faint jaali motif is the only ornament. Fraunces appears solely in the hero greeting, Plus Jakarta Sans everywhere else.
- **Card hierarchy**: a shop card is photo, name, `⭐ rating · cuisine`, delivery window and fee, plus at most one badge (Popular / Free delivery / No minimum). Product tiles are photo, name, price, one add button.
- **Bottom navigation**: Home, Search, Favourites, Orders, Profile. The cart is contextual — it appears as a bar the moment the cart has something in it.
- **Delivery windows** are prep time + ride time, so a bakery and a karahi house quote honestly different times.
- **Delivery rings**: each shop defines up to 6 concentric rings (`radiusKm → fee, freeAbove`). The first ring that reaches the customer sets the fee; beyond the largest ring the shop is shown but not deliverable.
- **Order lifecycle**: `PENDING → ACCEPTED → PREPARING → READY → ON_THE_WAY → DELIVERED` (+ `CANCELLED`). Transitions are validated per role on the server; customers can cancel while pending or within a configurable window after acceptance; cancellations restock items and refund online/wallet payments.
- **Auto-assign** scores riders by distance to the shop, current load and whether they belong to the shop's team.
- **Money**: merchants are owed delivered subtotals minus commission; riders are owed delivery fees + tips minus the cash they still hold from COD orders. Both wallets are derived from the order ledger, not stored balances, so a payout can never exceed what was actually earned. Withdrawals live as `PENDING → APPROVED → PAID` (or `REJECTED`) requests that only an admin can advance.
- **Scheduled orders** are normal orders with a `scheduledFor` timestamp: they reach the shop immediately, are tagged in the merchant queue and keep their slot through checkout.
- **Payments** other than COD are simulated (marked paid instantly) — swap in a JazzCash/Easypaisa/Stripe gateway inside `placeOrders()`.
- **Loyalty**: 2 points per Rs 100 (configurable) are credited when an order is delivered; 1 point = Rs 1 and points can pay for orders.
- **Simulated where it matters**: JazzCash / Easypaisa / Card are marked paid instantly in sandbox mode, and the rider app has a *Simulate ride* button that streams fake GPS along the delivery route so live tracking can be demoed from a laptop.
