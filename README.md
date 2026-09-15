# Reflex

Delivery coordination for small retailers. A retailer logs a delivery request, a
dispatcher assigns it to a rider, and the rider updates its status — every
change syncs live to everyone who's allowed to see it, and a confirmation
code proves delivery at drop-off.

Three dashboards, one codebase: **retailer staff**, **dispatcher**, **rider**.
Built with a real Postgres database, real authentication, and real
Socket.io-based live sync — not a mock. See `docs/` (or the project's
architecture doc, if you generated one alongside this repo) for the full
design rationale, ERD, and trade-off log.

## Stack

| Layer | Choice |
|---|---|
| Client | React + Vite, plain CSS |
| Server | Node.js + Express |
| Realtime | Socket.io (room-based: each session only receives updates it's allowed to see) |
| Database | PostgreSQL (`pg`, raw SQL — no ORM) |
| Auth | Email/password, bcrypt + JWT |

In production, the Express server serves the built React app itself, so the
whole thing is **one deployable service** with one URL.

---

## Local development

You need Node.js 20+ and either Docker, or a local Postgres install.

### 1. Start a database

**Fastest option — a disposable "dummy" database via Docker (recommended for testing):**

```bash
docker compose up -d
```

This starts a throwaway Postgres 16 container at
`postgresql://postgres:postgres@localhost:5432/reflex` — nothing to install,
nothing to configure. Tear it down any time with `docker compose down -v`
and start clean next time. Use this for local development and for testing
before you touch a real deployment.

**No Docker?** Install Postgres locally and create a database called
`reflex`, then update `DATABASE_URL` in your `.env` to match.

### 2. Configure environment variables

```bash
cp server/.env.example server/.env
```

The defaults already point at the Docker dummy database above. Generate a
real `JWT_SECRET` for anything beyond local testing:

```bash
openssl rand -hex 32
```

### 3. Install, migrate, seed

```bash
npm run install:all
npm run migrate   # creates all tables
npm run seed       # loads demo retailer, staff, dispatcher, and 3 riders
```

The seed script prints the demo login accounts when it finishes. All seeded
accounts use the password `password123`:

| Role | Email |
|---|---|
| Retailer staff | `staff@jaza.demo` |
| Dispatcher | `dispatcher@reflex.demo` |
| Rider | `brian@reflex.demo`, `faith@reflex.demo`, `dennis@reflex.demo` |

### 4. Run it

Two terminals:

```bash
npm run dev:server   # API + Socket.io on :4000
npm run dev:client   # Vite dev server on :5173, proxies /api and /socket.io to :4000
```

Open **http://localhost:5173**. To prove live sync actually works, log in
as the dispatcher in one browser and a rider in a different browser (or an
incognito window) at the same time — a normal tab-refresh doesn't count.

### Testing a production build locally

```bash
npm run build          # builds the client into client/dist
NODE_ENV=production npm start   # one server, serving everything, on :4000
```

Open **http://localhost:4000** — no Vite, no proxy, exactly what Render will run.

---

## Using an external database

The Docker database above is for local testing only — it disappears the
moment you run `docker compose down -v`, and it isn't reachable from the
internet. For anything you'll actually demo or deploy, point `DATABASE_URL`
at a real hosted Postgres instead. You have two good options:

### Option A — Render's own Postgres (simplest)

If you're deploying to Render anyway (see below), the `render.yaml` in this
repo provisions a Render Postgres database automatically and wires its
connection string into the web service for you — no separate setup needed.

**The one thing to know:** Render's **free** Postgres plan expires 30 days
after creation, with a 14-day grace period to upgrade before the data is
deleted. That's plenty of runway for a one-week sprint, but if you want this
project to keep working past that window, either upgrade the database to a
paid plan in the Render dashboard, or use Option B instead.

### Option B — Neon (external, permanent free tier)

[Neon](https://neon.tech) is a hosted Postgres provider with a free tier
that doesn't expire, and it works with Render exactly the same way any
external database does — it's just a `DATABASE_URL`.

1. Create a free account at neon.tech and create a new project.
2. Copy the connection string it gives you (starts with `postgresql://...`,
   already includes `?sslmode=require`).
3. Run the migration and seed against it from your own machine:
   ```bash
   DATABASE_URL="<your neon connection string>" NODE_ENV=production npm run migrate --prefix server
   DATABASE_URL="<your neon connection string>" NODE_ENV=production npm run seed --prefix server
   ```
4. When deploying to Render (below), skip the `databases:` block in
   `render.yaml` (or just don't use the blueprint) and instead set
   `DATABASE_URL` manually as an environment variable on the web service, to
   the Neon connection string.

Either option is a real, network-reachable Postgres database — the app code
doesn't change at all between them, since it only ever talks to whatever
`DATABASE_URL` points at.

---

## Deploying to Render

### Option A — One-click Blueprint deploy

1. Push this repo to your own GitHub account (see below if you haven't yet).
2. Go to the [Render Dashboard](https://dashboard.render.com) → **New** → **Blueprint**.
3. Connect your GitHub repo. Render reads `render.yaml` and shows you what
   it's about to create: one web service and one free Postgres database.
4. Click **Apply**. Render provisions the database, builds the client,
   installs server dependencies, and starts the app — `JWT_SECRET` is
   generated automatically and `DATABASE_URL` is wired to the new database,
   both without you typing anything in.
5. Once it's live, run the migration and seed **once** against the new
   database. Go to the database's page in the Render dashboard → **Connect**
   → copy the **External Database URL** (not the internal one — your
   laptop isn't on Render's private network), then run:
   ```bash
   DATABASE_URL="<external database url>" NODE_ENV=production npm run migrate --prefix server
   DATABASE_URL="<external database url>" NODE_ENV=production npm run seed --prefix server
   ```
6. Open the `.onrender.com` URL Render gives your web service. That's it —
   one URL, real database, real auth, real live sync.

### Option B — Manual setup (useful to understand what the Blueprint does for you)

1. **Database:** Render Dashboard → **New** → **PostgreSQL**. Name it, pick
   the free plan, create it. Copy its **Internal Database URL** once it's
   ready.
2. **Web service:** Render Dashboard → **New** → **Web Service** → connect
   your GitHub repo.
   - Runtime: **Node**
   - Build command: `npm run build`
   - Start command: `npm start`
   - Health check path: `/api/health`
3. Add environment variables on the web service:
   - `DATABASE_URL` → the Internal Database URL from step 1
   - `JWT_SECRET` → any long random string (`openssl rand -hex 32`)
   - `NODE_ENV` → `production`
4. Deploy. Once it's live, run migrate + seed the same way as step 5 in
   Option A, using the database's **External** URL.

### A note on the free plan

Render's free web services spin down after 15 minutes of no traffic and take
30-60 seconds to wake back up on the next request. If you're demoing this
live to a panel, **open the URL a minute or two before you go on** so it's
already warm — a cold start mid-pitch is exactly the kind of thing the
project's own trade-off log would tell you to plan around.

---

## Pushing this repo to your own GitHub

This project is already a git repository with an initial commit. To put it
on GitHub:

```bash
# Create an empty repo on GitHub first (via the website, or `gh repo create`),
# then from this project's root:
git remote add origin https://github.com/<your-username>/<your-repo>.git
git branch -M main
git push -u origin main
```

---

## Project structure

```
reflex-app/
├── render.yaml            # Render Blueprint - one-click deploy
├── docker-compose.yml      # disposable local Postgres for dev/testing
├── server/
│   ├── src/
│   │   ├── index.js        # Express app + Socket.io + serves the built client
│   │   ├── db.js           # Postgres pool + transaction helper
│   │   ├── auth.js         # JWT signing/verification, requireAuth/requireRole middleware
│   │   ├── realtime.js     # Socket.io room membership + broadcast helpers
│   │   ├── routes/         # auth, retailers, riders, requests
│   │   └── util/           # confirmation code generator
│   ├── db/schema.sql       # full Postgres schema
│   └── scripts/            # migrate.js, seed.js
└── client/
    └── src/
        ├── pages/           # Login, Signup, RetailerDashboard, DispatcherDashboard, RiderDashboard
        ├── context/         # AuthContext (session, socket lifecycle)
        ├── components/      # NavBar, StatusBadge, ProtectedRoute, Toast
        └── lib/             # api.js (REST client), socket.js (Socket.io client)
```

## Known limitations

These are documented trade-offs, not oversights — see the project's
trade-off log for the full "what we'd do with more time" version of each:

- Dispatcher assignment is manual — no route optimization.
- Delivery confirmation is a typed code, not a camera QR scan.
- No offline queue — the rider app assumes a live connection.
- Realtime broadcasts are role/room-scoped, but there's no database-level
  Row Level Security here the way there would be on a Supabase-backed
  build — access control lives entirely in the Express route handlers, so
  it's only as correct as those handlers (all of which are covered by the
  test flow this project was verified against).


##PRESENTATION LINK

https://drive.google.com/file/d/155eYVO5vEy5Gj1OYPnw2-cQFInMxYftq/view?usp=sharing

## License

MIT — see `LICENSE`.
