# Inbound Carrier Sales Automation

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
| `/api/v1/loads/search` | POST | Find best loads for a carrier's lane/equipment |
| `/api/v1/negotiate/evaluate` | POST | Evaluate carrier's price offer against policy |
| `/api/v1/calls/log` | POST | Log call outcome, sentiment, extraction data |
| `/api/v1/dashboard/metrics` | GET | Aggregated metrics for dashboard |
| `/api/v1/dashboard/config` | GET/PUT | Negotiation policy sliders per carrier tier |
| `/health` | GET | Health check |

## Quick start

```bash
# Install
pip install -r requirements.txt

# Seed database (30 loads, 4 carriers, 3 negotiation configs)
make seed

# Run locally
make dev
# → http://localhost:8000
# → http://localhost:8000/docs (Swagger UI)

# Docker
make docker-up
```

## Demo MC numbers

| MC Number | Carrier | Status |
|---|---|---|
| MC-123456 | FastFreight Logistics LLC | Eligible (verified tier) |
| MC-789012 | Quick Haul Inc | Ineligible — insurance expired |
| MC-345678 | Roadway Express Corp | Ineligible — out of service |
| MC-555555 | Premium Transport Solutions | Eligible (premium tier) |

## Database

SQLite locally (`data/carrier_sales.db`), swap to PostgreSQL by changing `DATABASE_URL` in `.env`. Six tables: `loads`, `carriers`, `calls`, `offers`, `events`, `negotiation_configs`.

## Auth

All endpoints require `x-api-key` header. Set `API_KEY` in `.env`. Default for dev: `dev-api-key`.
