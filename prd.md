# HappyRobot FDE Technical Challenge — Full Project Plan

---

## 1. Executive thesis

Build a **production-minded proof of concept for inbound carrier sales automation**: HappyRobot voice workflow + FastAPI backend + deterministic negotiation engine + Azure data layer + structured event logging + custom operations dashboard with per-carrier configurable negotiation sliders + Dockerized cloud deployment.


---

## 2. Architecture overview

### Layer 1: Voice (HappyRobot platform)

- Inbound web call workflow
- 8-state conversational flow (see call flow diagram)
- 5 tool calls to backend API
- System prompt with strict guardrails: never invent loads, never improvise pricing, never confirm carrier status without API verification

### Layer 2: Backend API (FastAPI, Dockerized)

| Endpoint | Method | Purpose |
|---|---|---|
| `/api/v1/carrier/lookup/{mc_number}` | GET | Carrier eligibility and tier lookup by MC number |
| `/api/v1/loads/search` | POST | Scored load matching with reason codes |
| `/api/v1/negotiate/params` | POST | Get pricing params (open_pct, ceiling_pct, override) for a tier |
| `/api/v1/negotiate/evaluate` | POST | Deterministic policy engine (server-side round tracking) |
| `/api/v1/calls/log` | POST | Event store + post-call extraction |
| `/api/v1/calls` | GET | Paginated call list with status/outcome filters |
| `/api/v1/calls/{call_id}` | GET | Single call detail with event history |
| `/api/v1/dashboard/metrics` | GET | Aggregated metrics for dashboard |
| `/api/v1/dashboard/config` | GET/PUT | Negotiation policy sliders per carrier tier |
| `/health` | GET | Health check |

Security middleware:
- `x-api-key` header validation on all endpoints
- HTTPS via host platform (Railway for API, Vercel for dashboard — both use Let's Encrypt)
- CORS restricted to dashboard origin

### Layer 3: Data layer

| Service | Purpose |
|---|---|
| **PostgreSQL** (Railway plugin) | Loads, carriers, calls, events, negotiation configs and sessions |
| **Azure Blob Storage** (optional) | Call event logs (JSON) — immutable audit trail |

PostgreSQL gives us managed backups and proper indexing. Azure Blob Storage provides an immutable audit log of every call event. If `AZURE_STORAGE_CONNECTION_STRING` is not set, blob uploads are silently skipped and calls are still logged to the database.

### Layer 4: Operations dashboard (React + Vite + Chart.js + Tailwind)

- Deployed on Vercel (auto-deploys from `dev` branch)
- Authenticated via `x-api-key` header
- Real-time metrics from `/dashboard/metrics`
- Four pages: Overview (KPIs, outcome/sentiment charts, rate comparison), Calls (filterable log with drill-down), Analytics (time-filtered line charts), Negotiation Policy (per-tier sliders with inline docs)
- Dark/light mode toggle, collapsible sidebar

---

## 3. Call flow — detailed state machine

```
GREETING → COLLECT_MC → VERIFY_CARRIER → [eligible?]
  ├─ No  → DECLINE_END
  └─ Yes → COLLECT_PREFERENCES → SEARCH_LOADS → [match?]
              ├─ No  → NO_MATCH_END
              └─ Yes → PITCH_LOAD → [accept?]
                          ├─ Accept → MOCK_TRANSFER → LOG_EVENT
                          ├─ Counter → NEGOTIATE (max 3 rounds) → [agreed?]
                          │              ├─ Accept → MOCK_TRANSFER → LOG_EVENT
                          │              ├─ Reject → CLOSE_PROFESSIONALLY
                          │              └─ Escalate → HANDOFF_BRIEF → LOG_EVENT
                          └─ Reject → CLOSE_PROFESSIONALLY
```

### Agent persona and guardrails

**Tone**: Friendly, professional broker rep. Concise. Confirms numbers by reading them back. Proactive but not pushy.

**Hard guardrails** (in system prompt):
1. Never invent or fabricate load details
2. Never quote a rate not returned by the policy engine
3. Never confirm carrier eligibility without verification API response
4. After 3 negotiation rounds, either present final offer or escalate
5. If confidence on load match is low, offer to bring in a specialist
6. Never disclose floor rate or internal margin targets

---

## 4. Negotiation policy engine — detailed design

This is the intellectual centerpiece. The principle: **LLM for conversation, deterministic policy for money.**

### Inputs

The platform calls `POST /api/v1/negotiate/params` to get per-tier pricing params, then computes three rate targets from the loadboard rate:

| Parameter | Source | Configurable via dashboard? |
|---|---|---|
| `loadboard_rate` | Load database | No (from data) |
| `offered_rate` | Computed: `loadboard_rate × open_pct` (or `offered_rate_override`) | Yes — Opening Offer slider |
| `followup_rate` | Computed by platform: midpoint between offered and ceiling | No (derived) |
| `ceiling_rate` | Computed: `loadboard_rate × ceiling_pct` | Yes — Ceiling slider |
| `carrier_offer` | From conversation | No (from call) |
| `round_number` | Server-side: tracked per (mc_number, load_id) session | No (auto) |
| `carrier_tier` | From verification + carrier database | Tier assignment in DB |

### Policy rules (deterministic decision ladder)

The engine uses a three-zone model based on where the carrier's ask falls:

```
$0 ── offered ── followup ── ceiling ──── ∞
      instant     R0 counter   best&final  WALK AWAY
      accept      (concede)    (last try)
```

**Round 0:**
- carrier ≤ offered → accept
- carrier ≤ followup → accept
- carrier ≤ ceiling → counter at followup
- carrier > ceiling → counter at followup

**Round 1:**
- carrier ≤ followup → accept
- carrier ≤ ceiling → accept
- carrier > ceiling → counter at ceiling (best & final)

**Round 2:**
- carrier ≤ ceiling → accept
- carrier > ceiling → reject

**No carrier price provided:** lead with followup rate as the opening counter.

Round is tracked server-side per (mc_number, load_id) pair. Each `counter` advances the round (capped at 2). `accept` or `reject` clears the session. 3-minute idle TTL resets round to 0.

### Outputs

```json
{
  "decision": "accept | counter | reject",
  "counter_rate": 2275,
  "explanation_text": "I can come up to $2,275 — that's a competitive rate for this lane and pickup window.",
  "round_number": 1
}
```

The `explanation_text` is what the agent says verbatim. The LLM wraps it conversationally but never changes the numbers.

### Dashboard negotiation controls (per carrier tier)

The dashboard exposes three configurable parameters, grouped by carrier tier (New, Verified, Premium):

| Control | Type | Range | Default (new / verified / premium) | What it controls |
|---|---|---|---|---|
| Opening Offer | Slider | 75%–100% | 85% / 90% / 93% | First rate quoted as % of loadboard |
| Ceiling | Slider | 90%–115% | 100% / 103% / 107% | Max rate before walking away |
| Rate Override | Toggle + input | Dollar amount or null | null / null / null | Hard override bypassing % formula |

Each control includes inline documentation explaining its effect. The spread between Opening Offer and Ceiling defines the negotiation range.

---

## 5. Load search engine — detailed design

### Data model

```sql
CREATE TABLE loads (
    load_id         TEXT PRIMARY KEY,
    origin_city     TEXT NOT NULL,
    origin_state    TEXT NOT NULL,
    origin_lat      REAL,
    origin_lng      REAL,
    dest_city       TEXT NOT NULL,
    dest_state      TEXT NOT NULL,
    dest_lat        REAL,
    dest_lng        REAL,
    pickup_datetime TIMESTAMP NOT NULL,
    delivery_datetime TIMESTAMP NOT NULL,
    equipment_type  TEXT NOT NULL,       -- dry_van, reefer, flatbed
    loadboard_rate  REAL NOT NULL,
    notes           TEXT,
    weight          REAL,
    commodity_type  TEXT,
    num_of_pieces   INTEGER,
    miles           REAL,
    dimensions      TEXT,
    status          TEXT DEFAULT 'available'  -- available, reserved, booked
);
```

### Seed data

25–40 realistic loads across common US lanes:
- Chicago → Dallas (dry_van, 920 mi, $2,100–$2,400)
- LA → Phoenix (reefer, 370 mi, $1,200–$1,500)
- Atlanta → Miami (dry_van, 660 mi, $1,800–$2,000)
- Dallas → Memphis (flatbed, 450 mi, $1,400–$1,600)
- New York → Charlotte (dry_van, 635 mi, $1,700–$1,900)
- Seattle → Portland (reefer, 175 mi, $800–$1,000)
- And 20+ more with variety in equipment, timing, and rates

### Search and scoring logic

```
Score = (lane_match * 40) + (date_match * 25) + (equipment_match * 20) + (urgency * 15)
```

| Factor | Scoring |
|---|---|
| `lane_match` | Exact city = 1.0, same state = 0.6, within 75mi (haversine) = 0.4 |
| `date_match` | Within 24h = 1.0, within 48h = 0.7, within 72h = 0.4 |
| `equipment_match` | Exact = 1.0, compatible = 0.5, incompatible = 0.0 |
| `urgency` | Pickup < 12h = 1.0, < 24h = 0.7, > 24h = 0.3 |

### API response

```json
{
  "matches": [
    {
      "load_id": "LD-2024-0847",
      "origin": "Chicago, IL",
      "destination": "Dallas, TX",
      "pickup_datetime": "2025-04-02T08:00:00Z",
      "delivery_datetime": "2025-04-03T16:00:00Z",
      "equipment_type": "dry_van",
      "loadboard_rate": 2300,
      "miles": 920,
      "weight": 38000,
      "commodity_type": "consumer electronics",
      "score": 87.5,
      "reason_codes": ["exact_lane_match", "pickup_within_24h", "equipment_compatible"]
    }
  ],
  "recommended": "LD-2024-0847",
  "total_matches": 3
}
```

The agent uses `reason_codes` to build an intelligent pitch: "I've got a great match for you — exact lane, Chicago to Dallas, picking up tomorrow morning. Dry van, 920 miles, 38,000 pounds of consumer electronics. Rate is $2,300."

---

## 6. FMCSA carrier verification — detailed design

### Adapter pattern

```
CarrierVerificationService
  ├── LiveFMCSAProvider  (calls FMCSA SAFER API)
  ├── MockProvider       (seeded cache for demo MC numbers)
  └── CachedProvider     (wraps Live with TTL cache)
```

**Live endpoint**: `https://mobile.fmcsa.dot.gov/qc/services/carriers/{mc_number}?webKey={key}`

**Normalized response** (same shape from any provider):

```json
{
  "mc_number": "MC-123456",
  "legal_name": "FastFreight Logistics LLC",
  "dot_number": "1234567",
  "carrier_status": "AUTHORIZED",
  "insurance_status": "ACTIVE",
  "authority_status": "ACTIVE",
  "safety_rating": "SATISFACTORY",
  "out_of_service": false,
  "days_since_last_inspection": 45,
  "eligible_to_book": true,
  "denial_reason": null
}
```

**Eligibility logic**: `eligible_to_book = carrier_status == "AUTHORIZED" AND insurance_status == "ACTIVE" AND out_of_service == false`

**Demo MC numbers** (seeded in database):
- 1580211 → GREYHOUND TRANSPORTATION INC, verified tier, eligible
- 260313 → WANNEMACHER ENTERPRISES INC, new tier, eligible
- 115554 → HEARTLAND EXPRESS INC OF IOWA, premium tier, eligible
- 138328 → WERNER ENTERPRISES INC, verified tier, eligible

Any MC number not in the database returns `found: false` with tier `new` and `eligible_to_book: false`. FMCSA verification is handled platform-side by HappyRobot via the QCMobile API; the backend stores carrier data from seed for demo purposes.

---

## 7. Event sourcing and post-call extraction

### Event model

Every major state transition is logged as a discrete event:

```sql
CREATE TABLE events (
    event_id    TEXT PRIMARY KEY,
    call_id     TEXT NOT NULL,
    event_type  TEXT NOT NULL,
    timestamp   TIMESTAMP DEFAULT NOW(),
    payload     JSONB
);
```

Event types:
- `call_started`
- `mc_collected`
- `verification_passed` / `verification_failed`
- `loads_searched` (with query params)
- `load_pitched` (with load_id)
- `offer_received` (with amount)
- `counter_offered` (with amount + reason_code)
- `agreement_reached` (with final_rate)
- `transfer_mocked`
- `call_completed`
- `escalated`

### Post-call extraction payload

```json
{
  "call_id": "uuid",
  "caller_name": "John Smith",
  "mc_number": "123456",
  "verified": true,
  "carrier_tier": "verified",
  "requested_origin": "Chicago, IL",
  "requested_destination": "Dallas, TX",
  "equipment_type": "dry_van",
  "recommended_load_id": "LD-2024-0847",
  "loadboard_rate": 2300,
  "initial_carrier_ask": 2500,
  "final_rate": 2275,
  "negotiation_rounds": 2,
  "outcome": "booked",
  "sentiment_score": 1,
  "sentiment_reasoning": "Cooperative and professional throughout the call.",
  "outcome_reasoning": "Carrier agreed at $2,275 after 2 rounds.",
  "handoff_required": true,
  "duration": 185,
  "timedate": "Friday, April 3, 2026 7:02:54 AM EDT"
}
```

The schema handles HappyRobot webhook quirks: empty strings are coerced to `null`, `carrier_name` is aliased to `caller_name`, `duration` maps to `call_duration_seconds`, and `sentiment_score` (integer -2 to 2) is mapped to a label (`frustrated` / `negative` / `neutral` / `positive`).

### Call classification taxonomy

**Outcome**: `booked` | `no_match` | `declined_by_carrier` | `failed_verification` | `escalated` | `dropped` | `unknown`

**Sentiment** (derived from `sentiment_score`): `positive` (1, 2) | `neutral` (0) | `negative` (-1) | `frustrated` (-2)

### Audit trail

On every `POST /api/v1/calls/log`, the full call payload is uploaded to Azure Blob Storage as `call-logs/{year}/{month}/{day}/{call_id}.json`. This provides an immutable record for compliance and dispute resolution. If Azure is not configured, calls are still persisted to the database.

---

## 8. Azure Blob Storage integration

### Container structure

```
carrier-sales-events/
  └── call-logs/
      └── 2026/04/03/{call_id}.json          # Full event payload per call
```

Every call logged via `POST /api/v1/calls/log` is also uploaded to Azure Blob Storage as an immutable JSON file. This provides a compliance-ready audit trail — if a carrier disputes a negotiation, the brokerage has the complete event with timestamps and extraction data.

Set `AZURE_STORAGE_CONNECTION_STRING` in `.env`. If empty, blob uploads are silently skipped — calls are still logged to the database.

### Authentication

All endpoints (both HappyRobot platform and dashboard) use `x-api-key` header authentication. Set via `API_KEY` environment variable.

---

## 9. Dashboard — detailed design

React 18 + Vite + Tailwind CSS + Chart.js (`react-chartjs-2`). Single-page app with client-side navigation. Light/cream theme with full dark mode. Collapsible sidebar with ACME Logistics branding.

### Page 1: Overview

- **KPI metric cards**: Total calls, Verified carriers, Matched loads, Entered negotiation, Booked, Avg margin %
- **Outcome breakdown**: Doughnut chart (booked/failed/declined/no match/escalated) with transparent fills and darker borders
- **Caller sentiment**: Horizontal stacked bar (positive/neutral/negative/frustrated) with cohesive color palette
- **Rate comparison chart**: Line chart showing agreed rate vs loadboard rate over time, with gradient fill, inline stats (avg agreed, total agreed, avg margin), and "Total saved vs loadboard" metric. Time range filter (24h/7d/30d/All).

### Page 2: Calls

- **Summary stats**: Total calls, Completed, Failed, Avg duration
- **Filterable table**: Timestamp, Caller, MC, Outcome, Sentiment, Duration, Rate
- **Call detail modal**: Click any row to expand full event timeline, extraction data, negotiation details

### Page 3: Analytics

- **Summary cards**: Total calls, Completed, Unsuccessful, Average duration (uniform text color)
- **Calls over time**: Line chart with smooth curves — green dashed (completed) and red dashed (failed), gradient fills
- **Time range filter** (24h/7d/30d/All): dynamically updates all metrics and chart x-axis labels
- **Mini-cards**: Overall success rate, Outcome split

### Page 4: Negotiation Policy

- **Tier tabs**: New / Verified / Premium
- **Opening Offer slider**: 75%–100%, with "Aggressive ↔ Conservative" axis labels
- **Ceiling slider**: 90%–115%, with "Strict ↔ Flexible" axis labels
- **Rate Override**: Toggle + dollar input (disabled state when off)
- **Inline descriptions** under each control explaining its effect
- **Save button** per tier

### Footer

Decorative footer with background image, "Powered by HappyRobot AI" text, and "About HappyRobot" link. Appears on scroll only.

---

## 10. Database schema

SQLAlchemy ORM models (async, supports both SQLite and PostgreSQL via `DATABASE_URL`):

```sql
CREATE TABLE loads (
    load_id TEXT PRIMARY KEY,
    origin TEXT NOT NULL,
    origin_state TEXT NOT NULL,
    origin_lat REAL,
    origin_lng REAL,
    destination TEXT NOT NULL,
    destination_state TEXT NOT NULL,
    destination_lat REAL,
    destination_lng REAL,
    pickup_datetime TIMESTAMP NOT NULL,
    delivery_datetime TIMESTAMP NOT NULL,
    equipment_type TEXT NOT NULL,
    loadboard_rate REAL NOT NULL,
    notes TEXT,
    weight REAL,
    commodity_type TEXT,
    num_of_pieces INTEGER,
    miles REAL,
    dimensions TEXT,
    status TEXT DEFAULT 'available'
);

CREATE TABLE carriers (
    mc_number TEXT PRIMARY KEY,
    dot_number TEXT,
    legal_name TEXT,
    carrier_status TEXT,
    insurance_status TEXT,
    safety_rating TEXT,
    out_of_service BOOLEAN DEFAULT FALSE,
    eligible_to_book BOOLEAN DEFAULT FALSE,
    tier TEXT DEFAULT 'new',
    cached_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE calls (
    call_id TEXT PRIMARY KEY,
    mc_number TEXT,
    caller_name TEXT,
    requested_origin TEXT,
    requested_destination TEXT,
    equipment_type TEXT,
    recommended_load_id TEXT,
    loadboard_rate REAL,
    initial_carrier_ask REAL,
    final_rate REAL,
    negotiation_rounds INTEGER DEFAULT 0,
    margin_retained_pct REAL,
    outcome TEXT NOT NULL,
    sentiment TEXT,
    handoff_required BOOLEAN DEFAULT FALSE,
    call_duration_seconds INTEGER,
    summary TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE events (
    event_id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSON,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE negotiation_configs (
    tier TEXT PRIMARY KEY,
    open_pct REAL DEFAULT 0.85,
    ceiling_pct REAL DEFAULT 1.00,
    offered_rate_override REAL,
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE negotiation_sessions (
    mc_number TEXT NOT NULL,
    load_id TEXT NOT NULL,
    current_round INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (mc_number, load_id)
);
```

Note: `calls` table has no foreign keys on `mc_number` or `recommended_load_id` to allow logging calls for carriers/loads not in the seed data (e.g. new callers from HappyRobot).

---

## 11. Repository structure

```
hr-carrier-sales/
├── README.md                          # Architecture, setup, deployment instructions
├── docker-compose.yml                 # Postgres + API + Dashboard (local)
├── Dockerfile.api                     # FastAPI container
├── .env.example                       # Required env vars documented
├── Makefile                           # make dev, make seed, make test, make docker-up/down
├── railway.toml                       # Railway deployment config
├── requirements.txt                   # Python dependencies
│
├── api/
│   ├── main.py                        # FastAPI app, CORS, lifespan, seed on startup
│   ├── config.py                      # Settings from env (DATABASE_URL, API_KEY, etc.)
│   ├── auth.py                        # x-api-key header validation
│   ├── database.py                    # SQLAlchemy async models + engine
│   ├── seed.py                        # Database seeding from JSON files
│   ├── models/
│   │   └── schemas.py                 # All Pydantic request/response schemas
│   ├── routers/
│   │   ├── carrier.py                 # GET /carrier/lookup/{mc_number}
│   │   ├── loads.py                   # POST /loads/search
│   │   ├── negotiate.py               # POST /negotiate/params, POST /negotiate/evaluate
│   │   ├── calls.py                   # POST /calls/log, GET /calls, GET /calls/{id}
│   │   └── dashboard.py               # GET /dashboard/metrics, GET/PUT /dashboard/config
│   ├── services/
│   │   ├── load_search.py             # Multi-factor scoring engine
│   │   ├── negotiation_engine.py      # Deterministic policy engine
│   │   ├── negotiation_session.py     # Server-side round tracking per carrier+load
│   │   ├── event_logger.py            # Event store + call logging
│   │   └── blob_store.py              # Azure Blob Storage upload (optional)
│   └── tests/
│
├── dashboard/
│   ├── package.json
│   ├── Dockerfile                     # Multi-stage: Node build → Nginx serve
│   ├── nginx.conf                     # SPA routing config
│   ├── vercel.json                    # Vercel deployment config
│   ├── vite.config.js
│   ├── .env.example
│   ├── public/
│   │   ├── logo.png                   # ACME Logistics sidebar icon
│   │   ├── favicon.png                # HappyRobot favicon
│   │   └── footer-port.png            # Footer background image
│   └── src/
│       ├── App.jsx                    # Main app, routing, state management
│       ├── api.js                     # API client (fetch wrappers)
│       ├── index.css                  # Tailwind + CSS custom properties (light/dark)
│       ├── main.jsx                   # Entry point
│       ├── components/
│       │   ├── Sidebar.jsx            # Navigation, dark mode toggle, collapse
│       │   ├── Footer.jsx             # Decorative footer with HappyRobot branding
│       │   ├── OverviewPage.jsx       # KPI cards + charts layout
│       │   ├── CallsPage.jsx          # Call log table + detail modal
│       │   ├── AnalyticsPage.jsx      # Time-filtered analytics with line charts
│       │   ├── PolicyPage.jsx         # Negotiation policy wrapper
│       │   ├── PolicySliders.jsx      # Per-tier sliders with inline docs
│       │   ├── MetricCards.jsx        # KPI metric card grid
│       │   ├── PerformanceCards.jsx   # Commercial performance cards
│       │   ├── OutcomeChart.jsx       # Outcome doughnut chart
│       │   ├── SentimentChart.jsx     # Sentiment horizontal stacked bar
│       │   └── RateChart.jsx          # Rate comparison line chart
│       └── hooks/
│           ├── useMetrics.js          # Dashboard metrics polling
│           └── useConfig.js           # Negotiation config polling
│
└── data/
    ├── seed_loads.json                # 30 realistic US freight loads
    ├── seed_carriers.json             # 4 demo carriers
    └── seed_negotiation_configs.json  # Default tier configs (3 tiers)
```

---

## 12. Deployment plan

### Local development

```bash
git clone https://github.com/dan1dr/hr-carrier-sales.git
cd hr-carrier-sales

# Option A: Docker Compose (recommended) — starts Postgres + API + Dashboard
make docker-up
# API: http://localhost:8000/docs  |  Dashboard: http://localhost:3000

# Option B: Manual with SQLite
cp .env.example .env
pip install -r requirements.txt
make dev   # API at http://localhost:8000
cd dashboard && npm install && npm run dev  # Dashboard at http://localhost:5173
```

The API auto-seeds the database on first startup (30 loads, 4 carriers, 3 negotiation configs).

### Cloud deployment

**API: Railway**
- Builds from `Dockerfile.api` (configured in `railway.toml`)
- Railway-managed PostgreSQL plugin
- Auto HTTPS via Let's Encrypt
- Health checks at `/health`
- Live at: https://hr-carrier-sales-production.up.railway.app

**Dashboard: Vercel**
- Auto-deploys from `dev` branch, root directory `dashboard/`
- Auto HTTPS via Let's Encrypt
- Live at: https://dashboard-nu-opal-bki3bk0cut.vercel.app

### Environment variables

```
# Backend (Railway)
API_KEY=<your-secure-api-key>
DATABASE_URL=postgresql+asyncpg://<user>:<pass>@<host>:5432/<db>
CORS_ORIGINS=["https://dashboard-nu-opal-bki3bk0cut.vercel.app"]
AZURE_STORAGE_CONNECTION_STRING=<optional — for audit trail>
AZURE_STORAGE_CONTAINER=carrier-sales-events

# Frontend (Vercel)
VITE_API_URL=https://hr-carrier-sales-production.up.railway.app
VITE_API_KEY=<your-api-key>
```

---

## 13. HappyRobot workflow design

### Tool definitions for the platform

```yaml
tools:
  - name: lookup_carrier
    description: "Look up a motor carrier's eligibility and tier using their MC number"
    endpoint: GET https://hr-carrier-sales-production.up.railway.app/api/v1/carrier/lookup/{mc_number}
    headers:
      x-api-key: ${API_KEY}
    parameters:
      mc_number: string (required, path param)

  - name: search_loads
    description: "Search available loads matching carrier's preferences"
    endpoint: POST https://hr-carrier-sales-production.up.railway.app/api/v1/loads/search
    headers:
      x-api-key: ${API_KEY}
    parameters:
      origin: string (required)
      destination: string (optional)
      equipment_type: string (optional)
      pickup_date: string (optional, ISO format)

  - name: get_pricing_params
    description: "Get negotiation pricing parameters for a carrier tier"
    endpoint: POST https://hr-carrier-sales-production.up.railway.app/api/v1/negotiate/params
    headers:
      x-api-key: ${API_KEY}
    parameters:
      tier: string (required — "new", "verified", or "premium")

  - name: evaluate_offer
    description: "Evaluate a carrier's price offer against policy (round tracked server-side)"
    endpoint: POST https://hr-carrier-sales-production.up.railway.app/api/v1/negotiate/evaluate
    headers:
      x-api-key: ${API_KEY}
    parameters:
      carrier_offer: number (required)
      offered_rate: number (required — from pricing params)
      followup_rate: number (required — computed by platform)
      ceiling_rate: number (required — from pricing params)
      mc_number: string (required — for round tracking)
      load_id: string (required — for round tracking)

  - name: log_call_result
    description: "Log the final call result after conversation ends"
    endpoint: POST https://hr-carrier-sales-production.up.railway.app/api/v1/calls/log
    headers:
      x-api-key: ${API_KEY}
    parameters:
      # Full extraction schema (see section 7)
```

### System prompt structure (abbreviated)

```
You are Alex, a carrier sales representative at Acme Logistics.
You help carriers find and book available loads.

PERSONALITY:
- Professional, friendly, efficient
- Confirm numbers by reading them back
- Be transparent about the process

FLOW:
1. Greet and ask for their MC number
2. Call verify_carrier. If ineligible, explain why and end politely.
3. Ask what lane and equipment they need
4. Call search_loads. If no match, say so and offer to note their preference.
5. Pitch the recommended load with all key details
6. If they want it at listed rate, confirm and mock transfer
7. If they counter, call evaluate_offer
8. Use the explanation_text from the response — do NOT change numbers
9. After 3 rounds, present final offer or explain you need a specialist
10. On agreement, confirm details and say "I'm transferring you to our dispatch team now. Transfer was successful."
11. Call log_call_result with all extracted data

GUARDRAILS:
- NEVER invent loads or quote rates not returned by tools
- NEVER confirm eligibility without verify_carrier response
- NEVER go below the floor — if evaluate_offer says reject, respect it
- NEVER disclose internal pricing targets or floor rates
- If unsure, say "Let me bring in a specialist"
```

---

## 14. Deliverables execution plan

### Deliverable 1: Email to Carlos Becker

**Tone**: Professional, concise, 5-6 sentences max.
**Content**: What's working, what's deployed, links, and what you'll show live.
**Key links**: Dashboard URL, repo, HappyRobot workflow.

### Deliverable 2: Broker-facing build document

Write as if submitting to "Acme Logistics" — their new AI carrier sales system.
**Sections**:
1. Business problem: manual carrier calls are slow, inconsistent pricing
2. Solution overview: AI agent that verifies, matches, negotiates, and hands off
3. Call flow walkthrough with example
4. Safeguards: floor pricing, verification gating, escalation paths
5. Dashboard and reporting capabilities
6. Security and compliance (HTTPS, RBAC, audit trail in Blob Storage)
7. Deployment details
8. Recommended production roadmap: CRM integration, TMS webhook, real phone numbers, multi-language

### Deliverable 3: Dashboard access

URL + test credentials for each role (admin, viewer).

### Deliverable 4: Code repository

Clean README with architecture diagram, setup instructions, sample MC numbers, demo scenarios.

### Deliverable 5: HappyRobot workflow link

Direct link to the workflow on the platform.

### Deliverable 6: 5-minute video walkthrough

**Script**:

| Time | Segment | Content |
|---|---|---|
| 0:00–0:30 | Business problem | "Carrier calls are high-volume, repetitive, and pricing inconsistency costs margin." |
| 0:30–1:30 | Architecture | Show architecture diagram. Explain: voice layer, API, policy engine, Azure data, dashboard. One sentence per component. |
| 1:30–3:00 | Live demo | Make a web call. Walk through: MC verification, load search, pitch, negotiation (2 rounds), agreement, mock transfer. |
| 3:00–4:00 | Dashboard | Show the call appearing in metrics. Walk through funnel, waterfall, sentiment. Show negotiation sliders. |
| 4:00–4:45 | Design choices | "LLM for conversation, deterministic policy for money." "Event sourcing for auditability." "Provider abstraction for reliability." |
| 4:45–5:00 | Close | "Production roadmap: CRM hooks, TMS integration, multi-language. Happy to discuss." |

---

## 15. Testing strategy

### Unit tests (must-have)

- Negotiation engine: all policy branches, floor enforcement, escalation triggers
- Load search: scoring math, edge cases (no matches, exact vs fuzzy)
- Carrier verification: eligible/ineligible logic, mock provider responses

### Integration tests (nice-to-have)

- Full API flow: verify → search → negotiate → log
- Dashboard metrics consistency after N logged calls

### Demo test scenarios

| Scenario | MC | Expected flow |
|---|---|---|
| Happy path | 1580211 | Lookup → match → negotiate 2 rounds → book |
| Unknown carrier | 9999999 | Lookup → not found → decline |
| No matching load | 115554 | Lookup → search (unusual lane) → no match → close |
| Carrier rejects | 260313 | Lookup → match → carrier too low → 2 rounds → reject |
| Successful premium | 115554 | Lookup → match → accepts near ceiling → book |

---

## 16. Build order (implementation sequence)

1. **Seed data** — `seed_loads.json`, `seed_carriers.json`, `seed_negotiation_configs.json`
2. **Database setup** — SQLite for local, migration scripts
3. **Models** — Pydantic schemas for all entities
4. **Carrier verification service** — Mock + Live adapter
5. **Load search engine** — Scoring logic + API endpoint
6. **Negotiation policy engine** — Core logic + unit tests
7. **Call logging** — Event store + extraction schema
8. **FastAPI wiring** — All routers, middleware, CORS
9. **Docker setup** — Dockerfile + docker-compose
10. **Dashboard** — React app with Chart.js, metric cards, sliders
11. **Azure integration** — Blob Storage for call event audit trail (optional)
12. **HappyRobot workflow** — Agent prompt, tool bindings, testing
13. **Deployment** — Railway + Azure hybrid
14. **Documentation** — README, broker doc, deployment guide
15. **Video** — Record after everything is polished

---

## 17. What not to do

- Giant multi-service architecture with no polish
- Pure LLM negotiation with no floor rules
- Dashboard with only vanity metrics
- Transcript-only output with no structured extraction
- Fake production claims
- Overdesigned UI while backend is shaky
- Using Streamlit when the role is product engineering

This take-home is won by **taste and clarity**, not by sheer size.
