# Inbound Carrier Sales Automation

Backend API + operations dashboard for HappyRobot's inbound carrier sales voice workflow. Carriers call in, get verified, matched to loads, negotiate pricing through a deterministic policy engine, and get transferred to dispatch.

## Architecture

```
HappyRobot Voice Agent (platform)
   ├── FMCSA verification (platform-side, via FMCSA QCMobile API)
   │
   │  x-api-key authenticated HTTP
   ▼
┌─────────────────────────────────────────────┐
│  FastAPI Backend (Railway)                  │
│  ├── Carrier lookup (DB → eligibility/tier) │
│  ├── Load search (multi-factor scoring)     │
│  ├── Negotiation params + engine            │
│  ├── Call logging (event store)             │
│  └── Dashboard metrics + config API         │
│       │              │                      │
│       ▼              ▼                      │
│  PostgreSQL     Azure Blob Storage          │
│  (Railway)      (immutable audit trail)     │
└─────────────────────────────────────────────┘
         │
         │  HTTPS (API)
         ▼
┌──────────────────────┐
│  React Dashboard     │
│  (Vercel)            │
│  ├── KPI metrics     │
│  ├── Conversion funnel│
│  ├── Charts          │
│  └── Policy sliders  │
└──────────────────────┘
```

**Live deployments:**
- **API:** https://hr-carrier-sales-production.up.railway.app
- **Dashboard:** https://dashboard-dan1drs-projects.vercel.app

## Endpoints

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/carrier/lookup/{mc_number}` | GET | Look up carrier eligibility and tier by MC number |
| `/api/v1/loads/search` | POST | Find best loads for a carrier's lane/equipment |
| `/api/v1/negotiate/params` | POST | Get pricing params (open_pct, ceiling_pct, override) for a tier |
| `/api/v1/negotiate/evaluate` | POST | Evaluate carrier's price offer against policy |
| `/api/v1/calls/log` | POST | Log call outcome, sentiment, extraction data |
| `/api/v1/dashboard/metrics` | GET | Aggregated metrics for dashboard |
| `/api/v1/dashboard/config` | GET/PUT | Negotiation policy sliders per carrier tier |
| `/health` | GET | Health check |

## Prerequisites

- Python 3.11+
- pip
- Node.js 18+ and npm (for the dashboard)
- Docker and Docker Compose (for containerized local dev)
- Railway CLI (for cloud deployment): `brew install railway`

## Local setup

### Option 1: Docker Compose (recommended)

Starts PostgreSQL, the API, and the dashboard in one command:

```bash
# 1. Clone the repo
git clone https://github.com/dan1dr/hr-carrier-sales.git
cd hr-carrier-sales

# 2. Start everything (Postgres + API + Dashboard)
make docker-up

# 3. Open
#    API:       http://localhost:8000/docs
#    Dashboard: http://localhost:3000
```

The API auto-seeds the database on first startup (30 loads, 4 carriers, 3 negotiation configs).

### Option 2: Manual (SQLite)

```bash
# 1. Clone and set up
git clone https://github.com/dan1dr/hr-carrier-sales.git
cd hr-carrier-sales

# 2. Create a virtual environment
python -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Default uses SQLite — no Postgres needed

# 5. Start the API (auto-seeds on startup)
make dev
```

To also run the dashboard locally:

```bash
cd dashboard
npm install
cp .env.example .env
# Edit .env: VITE_API_URL=http://localhost:8000, VITE_API_KEY=dev-api-key
npm run dev
# Dashboard at http://localhost:5173
```

The API will be running at:
- **http://localhost:8000** — API base
- **http://localhost:8000/docs** — Swagger UI (interactive testing)
- **http://localhost:8000/health** — Health check

To authenticate in Swagger UI, click **Authorize** and enter the API key (default: `dev-api-key`).

## Deploy to Railway (backend)

Currently deployed at: **https://hr-carrier-sales-production.up.railway.app**

The `railway.toml` tells Railway to build from `Dockerfile.api` and use `/health` for health checks.

```bash
# 1. Install CLI and login
brew install railway
railway login

# 2. Create a project and link the service
railway init
railway service

# 3. Add a PostgreSQL database
#    In the Railway dashboard, click "New" → "Database" → "PostgreSQL"
#    Copy the internal DATABASE_URL (postgresql+asyncpg://...)

# 4. Set environment variables
railway variables set API_KEY=<your-secure-api-key>
railway variables set DATABASE_URL="postgresql+asyncpg://<user>:<pass>@<host>:5432/<db>"
railway variables set 'CORS_ORIGINS=["https://your-dashboard-domain.vercel.app"]'
# Optional: Azure Blob Storage for audit trail
railway variables set AZURE_STORAGE_CONNECTION_STRING="<your-connection-string>"

# 5. Deploy
railway up

# 6. Generate a public HTTPS URL (TLS via Let's Encrypt)
railway domain
```

To redeploy after changes:
```bash
railway up
```

## Deploy to Vercel (dashboard)

Currently deployed at: **https://dashboard-dan1drs-projects.vercel.app**

The dashboard auto-deploys from the `dev` branch. Vercel is configured with root directory `dashboard/`.

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login and link
vercel login
cd dashboard && vercel link

# 3. Set environment variables
vercel env add VITE_API_URL production
# Enter: https://your-railway-app.up.railway.app
vercel env add VITE_API_KEY production
# Enter: your API key

# 4. Deploy
vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard for auto-deploys on push.

## Database

PostgreSQL in production (Railway Postgres plugin), SQLite for local dev. Switch via `DATABASE_URL` in `.env`:

```
# SQLite (default for local dev)
DATABASE_URL=sqlite+aiosqlite:///./data/carrier_sales.db

# PostgreSQL (production)
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
```

No code changes needed — SQLAlchemy handles both via async drivers.

**Tables:**

| Table | Purpose |
|---|---|
| `loads` | Available freight loads (origin, destination, rate, equipment) |
| `carriers` | Carrier profiles (MC number, tier, eligibility, FMCSA data) |
| `calls` | Call log (outcome, sentiment, rates, duration, timestamps) |
| `events` | Event store (call_completed events with full payload) |
| `negotiation_configs` | Per-tier pricing policy (open_pct, ceiling_pct, offered_rate_override) |
| `negotiation_sessions` | Active negotiation state per carrier+load pair |

## Azure Blob Storage (audit trail)

Every call logged via `POST /api/v1/calls/log` is also uploaded to Azure Blob Storage as an immutable JSON file.

```
carrier-sales-events/
  └── call-logs/
      └── 2026/04/02/{call_id}.json
```

Set `AZURE_STORAGE_CONNECTION_STRING` in `.env`. If empty, blob uploads are silently skipped — calls are still logged to the database.

## Demo MC numbers

| MC Number | Carrier | Tier | Status |
|---|---|---|---|
| 1580211 | GREYHOUND TRANSPORTATION INC | verified | Eligible |
| 260313 | WANNEMACHER ENTERPRISES INC | new | Eligible |
| 115554 | HEARTLAND EXPRESS INC OF IOWA | premium | Eligible |
| 138328 | WERNER ENTERPRISES INC | verified | Eligible |

Any MC number not in the database returns `found: false` with tier `new` and `eligible_to_book: false`.

## Negotiation Pricing Controls

The negotiation system uses a two-stage flow: the HappyRobot platform computes rate targets, and the backend decides accept/counter/reject when the carrier counters.

### Tunable parameters (per carrier tier)

Stored in `negotiation_configs` table, editable from the dashboard via `PUT /api/v1/dashboard/config`.

| Param | Type | Description | Defaults (new / verified / premium) |
|---|---|---|---|
| `open_pct` | float | Starting offer as % of loadboard rate | 0.85 / 0.90 / 0.93 |
| `ceiling_pct` | float | Max rate as % of loadboard rate | 1.00 / 1.03 / 1.07 |
| `offered_rate_override` | float or null | Hard dollar override (null = use %) | null / null / null |

### How each parameter works

**Opening Offer % (`open_pct`)**

The first rate the platform quotes to a carrier. It is computed as a percentage of the loadboard rate:

```
offered_rate = loadboard_rate × open_pct
```

A lower `open_pct` means a more aggressive opening offer (further below loadboard), leaving more room for margin. For example, with a loadboard rate of $2,000:
- `open_pct = 0.85` → offered rate = $1,700 (15% below loadboard)
- `open_pct = 0.93` → offered rate = $1,860 (7% below loadboard)

Premium carriers get a higher `open_pct` because they expect better rates upfront.

**Ceiling % (`ceiling_pct`)**

The absolute maximum rate the engine will accept before walking away. Also computed as a percentage of loadboard:

```
ceiling_rate = loadboard_rate × ceiling_pct
```

If the carrier's ask exceeds the ceiling after all negotiation rounds, the engine rejects the deal. Values above 1.0 mean the engine is willing to pay above the loadboard rate for that tier. For example, with a loadboard rate of $2,000:
- `ceiling_pct = 1.00` → ceiling = $2,000 (never exceed loadboard)
- `ceiling_pct = 1.07` → ceiling = $2,140 (up to 7% above loadboard for premium carriers)

The gap between `open_pct` and `ceiling_pct` defines the total negotiation range.

**Rate Override (`offered_rate_override`)**

When set, this replaces the percentage-based calculation with a hard dollar amount. The platform uses this value directly as the offered rate instead of computing `loadboard_rate × open_pct`. Useful for:
- Fixed-rate lanes where pricing shouldn't float with the loadboard
- Temporary overrides during market disruptions
- Testing a specific price point without changing the percentage policy

When `null` (the default), the percentage-based formula is used.

### Negotiation decision ladder

| Round | carrier ≤ offered | carrier ≤ followup | carrier ≤ ceiling | carrier > ceiling |
|---|---|---|---|---|
| R0 | accept | accept | counter @ followup | counter @ followup |
| R1 | accept | accept | accept | counter @ ceiling |
| R2 | accept | accept | accept | reject |

### Server-side round tracking

Send `mc_number` and `load_id` with every `/negotiate/evaluate` call — round is tracked server-side:
- Each `counter` advances the round (capped at 2)
- `accept` or `reject` clears the session
- 3-minute idle TTL resets round to 0

## Auth

All endpoints require `x-api-key` header. Set `API_KEY` in `.env`. Default for local dev: `dev-api-key`.

## Makefile commands

| Command | What it does |
|---|---|
| `make dev` | Start API with hot reload on port 8000 |
| `make seed` | Seed database from `data/*.json` files |
| `make test` | Run unit tests |
| `make docker-up` | Build and start with Docker Compose |
| `make docker-down` | Stop Docker containers |
