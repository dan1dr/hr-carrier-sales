     º# Inbound Carrier Sales Automation

Backend API for HappyRobot's inbound carrier sales voice workflow. Carriers call in, get matched to loads, negotiate pricing through a deterministic policy engine, and get transferred to dispatch.

## Architecture

```
HappyRobot Voice Agent (platform)
        │
        │  x-api-key authenticated HTTP
        ▼
   FastAPI Backend
   ├── Load search (scored matching)
   ├── Negotiation engine (deterministic pricing policy)
   ├── Call logging (event store + post-call extraction)
   └── Dashboard metrics API
        │
        ▼
   SQLite (local) / PostgreSQL (prod)
```

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
- Docker (optional, for containerized run)
- Railway CLI (optional, for cloud deployment): `brew install railway`

## Local setup

```bash
# 1. Clone the repo
git clone https://github.com/dan1dr/hr-carrier-sales.git
cd hr-carrier-sales

# 2. Create a virtual environment (recommended)
python -m venv .venv
source .venv/bin/activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up environment variables
cp .env.example .env
# Edit .env if you want to change API_KEY or DATABASE_URL

# 5. Seed the database (30 loads, 4 carriers, 3 negotiation configs)
make seed

# 6. Start the API
make dev
```

The API will be running at:
- **http://localhost:8000** — API base
- **http://localhost:8000/docs** — Swagger UI (interactive testing)
- **http://localhost:8000/health** — Health check

To authenticate in Swagger UI, click **Authorize** and enter the API key (default: `dev-api-key`).

## Local setup with Docker

```bash
# Build and run
make docker-up

# Stop
make docker-down
```

The Docker setup builds the API image, seeds the database at build time, and exposes port 8000.

## Deploy to Railway

Currently deployed at: **https://hr-carrier-sales-production.up.railway.app**

The `railway.toml` at the repo root tells Railway to build from `Dockerfile.api` and use `/health` for health checks. The Dockerfile reads `$PORT` at runtime so Railway can assign its own port.

```bash
# 1. Install CLI and login
brew install railway
railway login

# 2. Create a project and link the service
railway init
railway service    # select the service when prompted

# 3. Set environment variables
railway variables set API_KEY=<your-secure-api-key>
railway variables set DATABASE_URL="sqlite+aiosqlite:///./data/carrier_sales.db"
railway variables set FMCSA_MOCK_MODE=true
railway variables set 'CORS_ORIGINS=["*"]'   # demo-only; restrict to specific origins in production

# 4. Deploy
railway up

# 5. Generate a public HTTPS URL (TLS via Let's Encrypt, managed by Railway)
railway domain
```

To redeploy after changes:
```bash
railway up
```

## Demo MC numbers

| MC Number | Carrier | Status |
|---|---|---|
| MC-1580211 | GREYHOUND TRANSPORTATION INC | Real carrier — matches FMCSA QCMobile docket lookup + local DB tier |
| MC-123456 | FastFreight Logistics LLC | Eligible (verified tier) |
| MC-789012 | Quick Haul Inc | Ineligible — insurance expired |
| MC-345678 | Roadway Express Corp | Ineligible — out of service |
| MC-555555 | Premium Transport Solutions | Eligible (premium tier) |

## Negotiation Pricing Controls

The negotiation system uses a two-stage flow: the HappyRobot platform computes rate targets, and the backend decides accept/counter/reject when the carrier counters.

### Tunable parameters (per carrier tier)

These are stored in the `negotiation_configs` table and can be updated from the dashboard via `PUT /api/v1/dashboard/config`.

| Param | Type | Description | Defaults (new / verified / premium) |
|---|---|---|---|
| `open_pct` | float | Starting offer as a % of loadboard rate. Lower = more aggressive. | 0.85 / 0.90 / 0.93 |
| `ceiling_pct` | float | Max we'll ever pay as a % of loadboard rate. Higher = more flexible. | 1.00 / 1.03 / 1.07 |
| `offered_rate_override` | float or null | Hard dollar override for the offer. Bypasses `open_pct` when set. Set to `null` to use percentage-based calculation. | null / null / null |

### How rates are computed

```
offered_rate  = loadboard_rate × open_pct  (or override if set)
ceiling_rate  = loadboard_rate × ceiling_pct
followup_rate = midpoint of offered and ceiling (auto-computed)
```

Sentiment adjusts the offered_rate by up to ±3%: happy carriers get tighter offers, frustrated carriers get sweetened deals.

### Negotiation decision ladder

The backend (`POST /api/v1/negotiate/evaluate`) takes the platform-computed rates + the carrier's counter and returns a deterministic decision:

| Round | carrier ≤ offered | carrier ≤ followup | carrier ≤ ceiling | carrier > ceiling |
|---|---|---|---|---|
| R0 | accept | accept | counter @ followup | counter @ followup |
| R1 | accept | accept | accept | counter @ ceiling |
| R2 | accept | accept | accept | reject |

### Dashboard usage example

```bash
# Make the "new" tier more aggressive (lower open, tighter ceiling)
curl -X PUT "https://hr-carrier-sales-production.up.railway.app/api/v1/dashboard/config" \
  -H "Content-Type: application/json" \
  -H "x-api-key: hr-carrier-sales-2026-prod" \
  -d '{
    "tier": "new",
    "open_pct": 0.82,
    "ceiling_pct": 0.97,
    "max_rounds": 3,
    "urgency_boost_pct": 0.03,
    "escalation_sensitivity": "high",
    "offered_rate_override": null
  }'
```

Changes take effect on the next call — no redeploy needed.

## Database

SQLite locally (`data/carrier_sales.db`), swap to PostgreSQL by changing `DATABASE_URL` in `.env`:

```
# SQLite (default)
DATABASE_URL=sqlite+aiosqlite:///./data/carrier_sales.db

# PostgreSQL
DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
```

No code changes needed — SQLAlchemy handles both.

Six tables: `loads`, `carriers`, `calls`, `offers`, `events`, `negotiation_configs`.

## Auth

All endpoints require `x-api-key` header. Set `API_KEY` in `.env`. Default for dev: `dev-api-key`.

## Makefile commands

| Command | What it does |
|---|---|
| `make dev` | Start API with hot reload on port 8000 |
| `make seed` | Seed database from `data/*.json` files |
| `make test` | Run unit tests |
| `make docker-up` | Build and start with Docker Compose |
| `make docker-down` | Stop Docker containers |
