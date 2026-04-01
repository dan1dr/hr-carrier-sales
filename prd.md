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
| `/api/v1/carrier/verify` | POST | FMCSA verification via adapter pattern |
| `/api/v1/loads/search` | POST | Scored load matching with reason codes |
| `/api/v1/negotiate/evaluate` | POST | Deterministic policy engine |
| `/api/v1/calls/log` | POST | Event store + post-call extraction |
| `/api/v1/dashboard/metrics` | GET | Aggregated metrics for dashboard |
| `/api/v1/dashboard/config` | GET/PUT | Negotiation policy sliders per carrier tier |
| `/health` | GET | Health check |

Security middleware:
- `x-api-key` header validation on all endpoints
- HMAC signature verification on HappyRobot webhooks
- HTTPS via host platform (Railway/Azure)
- CORS restricted to dashboard origin

### Layer 3: Azure data layer

| Service | Purpose | Why Azure |
|---|---|---|
| **Azure Database for PostgreSQL** (Flexible Server) | Loads, calls, events, offers, carrier cache, negotiation configs | Managed, scalable, RBAC-native |
| **Azure Blob Storage** | Call event logs (JSON), rep handoff briefs (PDF/JSON), archived transcripts | Cheap, immutable audit trail |
| **Azure Entra ID** | RBAC for dashboard access | Enterprise-grade auth, shows security maturity |

This Azure integration is practical, not decorative: PostgreSQL gives us managed migrations and proper indexing. Blob Storage gives us an immutable audit log of every negotiation event. Entra ID means the dashboard isn't just protected by an API key — it has real identity-based access control with roles (admin vs viewer).

### Layer 4: Operations dashboard (React + Chart.js)

- Served from same deployment or separate static host
- Authenticated via Azure Entra ID (MSAL.js)
- Real-time metrics from `/dashboard/metrics`
- Per-carrier negotiation policy configuration via sliders

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

| Parameter | Source | Configurable via dashboard? |
|---|---|---|
| `loadboard_rate` | Load database | No (from data) |
| `floor_rate` | Computed: `loadboard_rate * floor_pct` | Yes — `floor_pct` slider |
| `target_rate` | Computed: `loadboard_rate * target_pct` | Yes — `target_pct` slider |
| `carrier_offer` | From conversation | No (from call) |
| `round_number` | 1, 2, or 3 | Yes — `max_rounds` selector |
| `urgency_flag` | Based on pickup proximity | Auto-computed |
| `carrier_sentiment` | From conversation context | No (from call) |
| `lane_desirability` | From historical demand data | Auto-computed |
| `carrier_tier` | From verification + history | Tier assignment configurable |

### Policy rules

**Round 1:**
- Accept if `carrier_offer >= target_rate`
- Counter with `(target_rate + carrier_offer) / 2` if `carrier_offer >= floor_rate`
- Reject if `carrier_offer < floor_rate`
- Escalate if carrier is frustrated AND offer is close to floor

**Round 2:**
- Accept if `carrier_offer >= target_rate * 0.97`
- Counter with `floor_rate + (target_rate - floor_rate) * 0.3` (more aggressive)
- Reject if below floor
- Escalate if high-value lane or premium carrier

**Round 3:**
- Accept if `carrier_offer >= floor_rate * 1.02`
- Final offer at `floor_rate * 1.02` (2% above floor)
- Reject if below floor
- Escalate if multiple matching loads available

**Always:**
- Never go below `floor_rate`
- Escalate if constraints are unclear
- Log every decision with reason code

### Outputs

```json
{
  "decision": "accept | counter | reject | escalate",
  "counter_rate": 2275,
  "reason_code": "within_target_band | urgency_premium | final_offer | below_floor",
  "explanation_text": "I can come up to $2,275 — that's a competitive rate for this lane and pickup window.",
  "floor_hit": false,
  "round": 2,
  "margin_retained_pct": 12.5
}
```

The `explanation_text` is what the agent says verbatim. The LLM wraps it conversationally but never changes the numbers.

### Dashboard negotiation sliders (per carrier tier)

The dashboard will expose these configurable parameters via sliders:

| Slider | Range | Default | What it controls |
|---|---|---|---|
| Floor rate % | 75%–95% | 85% | Absolute minimum acceptable (% of loadboard) |
| Target rate % | 90%–100% | 97% | Ideal acceptance threshold |
| Max rounds | 1–3 | 3 | Negotiation patience |
| Urgency boost % | 0%–15% | 5% | How much to raise floor for urgent pickups |
| Escalation sensitivity | Low/Med/High | Medium | How quickly to hand off to human |

These are grouped by **carrier tier** (New, Verified, Premium) so the brokerage can be more generous with proven carriers and tighter with unknowns.

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

**Demo MC numbers** (seeded in MockProvider):
- MC-123456 → Valid, authorized, satisfactory rating
- MC-789012 → Valid but insurance expired → ineligible
- MC-345678 → Out of service → ineligible
- MC-000001 → Not found → ineligible

**Cache**: Redis or in-memory with 24h TTL. FMCSA API can be flaky; caching prevents demo failures.

In the meeting, say: *"I implemented the verification layer behind a provider abstraction so the workflow doesn't depend on a single external service during demos, but the agent behavior is identical."*

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
  "carrier_name": "John Smith",
  "mc_number": "MC-123456",
  "legal_name": "FastFreight Logistics LLC",
  "verified": true,
  "carrier_tier": "verified",
  "requested_origin": "Chicago, IL",
  "requested_destination": "Dallas, TX",
  "equipment_type": "dry_van",
  "recommended_load_id": "LD-2024-0847",
  "loadboard_rate": 2300,
  "initial_carrier_ask": 2500,
  "counter_offers": [2350, 2300],
  "final_rate": 2275,
  "negotiation_rounds": 2,
  "margin_retained_pct": 12.5,
  "outcome": "booked",
  "sentiment": "positive",
  "handoff_required": true,
  "call_duration_seconds": 185,
  "summary": "Verified carrier FastFreight called requesting Chicago to Dallas dry van. Matched to LD-2024-0847. After 2 rounds of negotiation, agreed at $2,275. Transferred to sales rep."
}
```

### Call classification taxonomy

**Outcome**: `booked` | `no_match` | `declined_by_carrier` | `failed_verification` | `escalated` | `dropped`

**Sentiment**: `positive` | `neutral` | `negative` | `frustrated`

### Rep handoff brief

On successful booking or escalation, generate a structured brief and store to Azure Blob:

```json
{
  "brief_type": "booking_handoff",
  "carrier": "FastFreight Logistics LLC",
  "mc_status": "Authorized, satisfactory safety rating",
  "lane": "Chicago, IL → Dallas, TX",
  "load_id": "LD-2024-0847",
  "agreed_rate": 2275,
  "carrier_sentiment": "positive",
  "negotiation_summary": "Carrier opened at $2,500, we countered at $2,350, carrier came to $2,275, accepted.",
  "recommended_next_step": "Confirm dispatch details and send rate confirmation",
  "call_timestamp": "2025-04-01T14:30:00Z"
}
```

---

## 8. Azure integration — detailed design

### Azure Database for PostgreSQL (Flexible Server)

**Why not just Railway Postgres?** Three reasons:
1. RBAC via Entra ID — we can grant read-only access to dashboard and write access to the API using managed identities
2. Connection via `DefaultAzureCredential` — no password in env vars
3. Backup/restore, monitoring, and scaling are built in

**Tables**: `loads`, `carriers`, `calls`, `offers`, `events`, `negotiation_configs`

**Connection**: `asyncpg` with `DefaultAzureCredential` token-based auth (no password stored)

### Azure Blob Storage

**Container structure**:
```
carrier-sales-events/
  ├── call-logs/
  │   └── 2025/04/01/{call_id}.json          # Full event log per call
  ├── handoff-briefs/
  │   └── 2025/04/01/{call_id}-brief.json     # Rep handoff documents
  └── negotiation-audits/
      └── 2025/04/01/{call_id}-negotiation.json  # Full negotiation trace
```

**Why Blob?** Immutable audit trail. If a carrier disputes a negotiation, the brokerage has the complete event sequence with timestamps, reason codes, and policy parameters used. This is a real compliance need in freight.

### Azure Entra ID (RBAC)

**Dashboard roles**:

| Role | Permissions |
|---|---|
| `admin` | Full access: view metrics, configure negotiation sliders, manage loads |
| `ops_manager` | View metrics, configure sliders |
| `viewer` | View metrics only, no configuration |

**Implementation**: MSAL.js in the React dashboard. The FastAPI backend validates the JWT token from Entra ID on dashboard endpoints. API tool endpoints (called by HappyRobot) use API key auth instead.

This creates two auth paths:
- HappyRobot → API: API key (simple, reliable for M2M)
- Dashboard → API: Entra ID JWT (enterprise-grade for humans)

---

## 9. Dashboard — detailed design

### Section 1: Conversion funnel

Horizontal funnel chart:
- Inbound calls → Verified carriers → Matched to load → Entered negotiation → Booked → Transferred
- Show count and conversion % at each stage

### Section 2: Negotiation waterfall (star chart)

For each call or aggregated:
```
Loadboard rate     ████████████████████  $2,300
Carrier first ask  ██████████████████████████  $2,500
Agent counter      ████████████████████  $2,350
Carrier counter    ██████████████████  $2,275
Final agreed       ██████████████████  $2,275
Floor rate         █████████████████  $1,955
```

This is the single most compelling visualization — it tells the story of the agent's value in one glance.

### Section 3: Commercial performance

- Average initial ask vs final rate (line chart, over time)
- Negotiation win rate (% where agreed rate > floor)
- Average margin retained (gauge chart)
- Bookings by lane (horizontal bar)
- Bookings by equipment type (donut)

### Section 4: Operational quality

- Failed verification rate
- No-match rate
- Average negotiation rounds to close
- Average call duration
- Transfer-ready rate

### Section 5: Carrier sentiment

- Sentiment distribution (donut: positive/neutral/negative/frustrated)
- Frustration rate by outcome (shows if failed negotiations correlate with bad experience)

### Section 6: Demand intelligence

**Unmet demand heatmap**: lanes carriers are requesting that have no matching loads. This is the "product vision wow" — it tells the brokerage where to source loads.

### Section 7: Negotiation policy configuration

**Per-carrier-tier sliders**:
- Dropdown: Select tier (New / Verified / Premium)
- Slider: Floor rate % (75–95%)
- Slider: Target rate % (90–100%)
- Selector: Max rounds (1/2/3)
- Slider: Urgency boost %
- Toggle: Auto-escalation sensitivity (Low/Med/High)
- Save button → `PUT /api/v1/dashboard/config`
- Preview panel showing how current settings would affect last 10 calls

### Section 8: Call log drill-down

Filterable, sortable table:
| Timestamp | Carrier | MC | Lane | Load | Rate path | Outcome | Sentiment |
|---|---|---|---|---|---|---|---|
| 2025-04-01 14:30 | FastFreight | MC-123456 | CHI→DAL | LD-0847 | $2,500→$2,275 | Booked | Positive |

Click to expand: full event timeline, negotiation detail, rep brief link.

---

## 10. Database schema

```sql
-- Core tables
CREATE TABLE loads (
    load_id TEXT PRIMARY KEY,
    origin_city TEXT NOT NULL,
    origin_state TEXT NOT NULL,
    origin_lat REAL,
    origin_lng REAL,
    dest_city TEXT NOT NULL,
    dest_state TEXT NOT NULL,
    dest_lat REAL,
    dest_lng REAL,
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
    mc_number TEXT REFERENCES carriers(mc_number),
    carrier_name TEXT,
    requested_origin TEXT,
    requested_destination TEXT,
    equipment_type TEXT,
    recommended_load_id TEXT REFERENCES loads(load_id),
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

CREATE TABLE offers (
    offer_id TEXT PRIMARY KEY,
    call_id TEXT REFERENCES calls(call_id),
    round_number INTEGER NOT NULL,
    carrier_offer REAL NOT NULL,
    agent_counter REAL,
    decision TEXT NOT NULL,
    reason_code TEXT,
    floor_rate REAL,
    target_rate REAL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE events (
    event_id TEXT PRIMARY KEY,
    call_id TEXT NOT NULL,
    event_type TEXT NOT NULL,
    payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE negotiation_configs (
    tier TEXT PRIMARY KEY,
    floor_pct REAL DEFAULT 0.85,
    target_pct REAL DEFAULT 0.97,
    max_rounds INTEGER DEFAULT 3,
    urgency_boost_pct REAL DEFAULT 0.05,
    escalation_sensitivity TEXT DEFAULT 'medium',
    updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 11. Repository structure

```
happyrobot-carrier-sales/
├── README.md                          # Architecture, setup, demo instructions
├── docker-compose.yml                 # API + Dashboard + DB (local)
├── Dockerfile.api                     # FastAPI container
├── Dockerfile.dashboard               # React dashboard container
├── .env.example                       # Required env vars documented
├── Makefile                           # make dev, make demo-up, make test, make seed
│
├── api/
│   ├── main.py                        # FastAPI app, CORS, lifespan
│   ├── config.py                      # Settings from env
│   ├── auth.py                        # API key + HMAC + Entra JWT middleware
│   ├── database.py                    # Async DB connection + migrations
│   ├── models/
│   │   ├── load.py                    # Pydantic schemas
│   │   ├── carrier.py
│   │   ├── call.py
│   │   ├── offer.py
│   │   └── event.py
│   ├── routers/
│   │   ├── carrier.py                 # POST /verify-carrier
│   │   ├── loads.py                   # POST /search-loads
│   │   ├── negotiate.py               # POST /evaluate-offer
│   │   ├── calls.py                   # POST /log-call
│   │   └── dashboard.py               # GET /metrics, GET/PUT /config
│   ├── services/
│   │   ├── carrier_verification.py    # Adapter: Live + Mock + Cached
│   │   ├── load_search.py             # Scoring engine
│   │   ├── negotiation_engine.py      # Policy engine
│   │   ├── event_logger.py            # Event store + Blob upload
│   │   └── handoff_brief.py           # Rep brief generator
│   └── tests/
│       ├── test_negotiation.py        # Policy engine unit tests
│       ├── test_load_search.py        # Scoring tests
│       └── test_carrier.py            # Verification tests
│
├── dashboard/
│   ├── package.json
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Funnel.jsx
│   │   │   ├── NegotiationWaterfall.jsx
│   │   │   ├── SentimentChart.jsx
│   │   │   ├── DemandHeatmap.jsx
│   │   │   ├── PolicySliders.jsx
│   │   │   ├── CallLogTable.jsx
│   │   │   └── MetricCard.jsx
│   │   ├── hooks/
│   │   │   └── useMetrics.js
│   │   └── auth/
│   │       └── msalConfig.js          # Entra ID MSAL setup
│   └── Dockerfile
│
├── data/
│   ├── seed_loads.json                # 30+ realistic loads
│   ├── seed_carriers.json             # Demo MC numbers
│   └── seed_negotiation_configs.json  # Default tier configs
│
├── docs/
│   ├── acme_logistics_solution.md     # Broker-facing build description
│   ├── deployment_guide.md            # How to access and reproduce
│   ├── demo_script.md                 # 5-minute video script
│   └── architecture.png              # Exported diagram
│
└── infra/
    ├── azure/
    │   ├── setup.sh                   # Azure resource provisioning
    │   └── rbac_roles.json            # Entra ID role definitions
    └── railway.toml                   # Railway deployment config
```

---

## 12. Deployment plan

### Local development

```bash
git clone <repo>
cp .env.example .env
# Fill in: FMCSA_API_KEY, API_KEY, AZURE_STORAGE_CONNECTION_STRING, DB_URL
make dev  # docker-compose up --build
# API: http://localhost:8000
# Dashboard: http://localhost:3000
# DB: localhost:5432
make seed  # Loads seed data
```

### Cloud deployment

**Option A: Railway (simple, fast)**
- Single service: API + static dashboard
- Railway-managed PostgreSQL
- Auto HTTPS
- `railway up` one-command deploy

**Option B: Azure (full integration, demonstrates Azure skills)**
- Azure Container Apps for API + Dashboard
- Azure Database for PostgreSQL Flexible Server
- Azure Blob Storage
- Azure Entra ID for RBAC
- Provisioned via `infra/azure/setup.sh`

**Recommended for demo**: Deploy API on Railway (speed) but use Azure for data layer (PostgreSQL + Blob + Entra ID). This shows Azure integration without the overhead of full Azure Container Apps setup.

### Environment variables

```
# Core
API_KEY=<random-uuid>
WEBHOOK_SECRET=<hmac-secret>
DATABASE_URL=postgresql+asyncpg://...

# FMCSA
FMCSA_API_KEY=<from-fmcsa-registration>
FMCSA_MOCK_MODE=false

# Azure
AZURE_STORAGE_CONNECTION_STRING=...
AZURE_STORAGE_CONTAINER=carrier-sales-events
AZURE_TENANT_ID=...
AZURE_CLIENT_ID=...

# Dashboard
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_AZURE_CLIENT_ID=...
REACT_APP_AZURE_TENANT_ID=...
```

---

## 13. HappyRobot workflow design

### Tool definitions for the platform

```yaml
tools:
  - name: verify_carrier
    description: "Verify a motor carrier's eligibility using their MC number"
    endpoint: POST https://api.your-domain.com/api/v1/carrier/verify
    headers:
      x-api-key: ${API_KEY}
    parameters:
      mc_number: string (required)

  - name: search_loads
    description: "Search available loads matching carrier's preferences"
    endpoint: POST https://api.your-domain.com/api/v1/loads/search
    headers:
      x-api-key: ${API_KEY}
    parameters:
      origin: string (required)
      destination: string (required)
      equipment_type: string (optional)
      pickup_date: string (optional, ISO format)

  - name: evaluate_offer
    description: "Evaluate a carrier's price offer against policy"
    endpoint: POST https://api.your-domain.com/api/v1/negotiate/evaluate
    headers:
      x-api-key: ${API_KEY}
    parameters:
      call_id: string (required)
      load_id: string (required)
      carrier_offer: number (required)
      round_number: integer (required)
      carrier_sentiment: string (optional)
      carrier_tier: string (optional)

  - name: log_call_result
    description: "Log the final call result after conversation ends"
    endpoint: POST https://api.your-domain.com/api/v1/calls/log
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
| Happy path | MC-123456 | Verify → match → negotiate 2 rounds → book |
| Failed verification | MC-789012 | Verify → insurance expired → decline |
| No matching load | MC-123456 | Verify → search → no match → close |
| Carrier rejects | MC-123456 | Verify → match → carrier too low → 3 rounds → reject |
| Escalation | MC-123456 | Verify → match → ambiguous → escalate to specialist |

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
11. **Azure integration** — Blob Storage for events, Entra ID for dashboard RBAC
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
