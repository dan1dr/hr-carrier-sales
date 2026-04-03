# Architecture

## System overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                        CARRIER CALLS IN                             │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   HappyRobot Voice Agent                                             │
│                                                                      │
│   Conversational AI that handles the full call:                      │
│   greeting → MC collection → verification → load pitch →            │
│   negotiation → transfer to dispatch                                 │
│                                                                      │
│   ┌─────────────────────────────────────────────────────────────┐    │
│   │  Platform-side services                                     │    │
│   │  • FMCSA QCMobile API (carrier verification)                │    │
│   │  • Rate computation (open_pct × loadboard = offered_rate)   │    │
│   └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       │  HTTPS + x-api-key
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   FastAPI Backend  ·  Railway                                        │
│   https://hr-carrier-sales-production.up.railway.app                 │
│                                                                      │
│   ┌────────────────────────────────────────────────────────────┐     │
│   │  API Endpoints                                             │     │
│   │                                                            │     │
│   │  GET  /carrier/lookup/{mc}  → eligibility + tier           │     │
│   │  POST /loads/search         → scored load matching         │     │
│   │  POST /negotiate/params     → per-tier pricing config      │     │
│   │  POST /negotiate/evaluate   → accept / counter / reject    │     │
│   │  POST /calls/log            → log call outcome + events    │     │
│   │  GET  /calls                → paginated call list          │     │
│   │  GET  /calls/{id}           → call detail + event history  │     │
│   │  GET  /dashboard/metrics    → aggregated KPIs              │     │
│   │  GET  /dashboard/config     → negotiation policy config    │     │
│   │  PUT  /dashboard/config     → update policy per tier       │     │
│   └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│   ┌─────────────────────┐    ┌──────────────────────────────┐       │
│   │  Services           │    │  Negotiation Engine          │       │
│   │                     │    │                              │       │
│   │  • Load search      │    │  Deterministic policy:       │       │
│   │    (multi-factor    │    │  LLM for conversation,      │       │
│   │     scoring)        │    │  math for money.            │       │
│   │                     │    │                              │       │
│   │  • Event logger     │    │  offered → followup →       │       │
│   │    (DB + blob)      │    │  ceiling → walk away        │       │
│   │                     │    │                              │       │
│   │  • Round tracker    │    │  Server-side round state    │       │
│   │    (per mc+load)    │    │  per (mc_number, load_id)   │       │
│   └─────────────────────┘    └──────────────────────────────┘       │
│                                                                      │
│         │                          │                                 │
│         ▼                          ▼                                 │
│   ┌───────────┐          ┌──────────────────┐                       │
│   │ PostgreSQL│          │ Azure Blob       │                       │
│   │ (Railway) │          │ Storage          │                       │
│   │           │          │ (optional)       │                       │
│   │ • loads   │          │                  │                       │
│   │ • carriers│          │ call-logs/       │                       │
│   │ • calls   │          │  └─ {year}/{mo}/ │                       │
│   │ • events  │          │     {call_id}    │                       │
│   │ • configs │          │     .json        │                       │
│   │ • sessions│          │                  │                       │
│   └───────────┘          └──────────────────┘                       │
│                                                                      │
└──────────────────────┬───────────────────────────────────────────────┘
                       │
                       │  HTTPS + x-api-key
                       │
                       ▼
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│   React Dashboard  ·  Vercel                                         │
│   https://dashboard-nu-opal-bki3bk0cut.vercel.app                      │
│                                                                      │
│   ┌──────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────────────┐  │
│   │ Overview │ │  Calls   │ │  Analytics   │ │  Negotiation     │  │
│   │          │ │          │ │              │ │  Policy          │  │
│   │ KPI cards│ │ Filtered │ │ Time-ranged  │ │                  │  │
│   │ Outcome  │ │ log +    │ │ line charts  │ │ Opening offer %  │  │
│   │ Sentiment│ │ detail   │ │ Success rate │ │ Ceiling %        │  │
│   │ Rate     │ │ modal    │ │ Outcome      │ │ Rate override    │  │
│   │ compare  │ │          │ │ split        │ │ (per tier)       │  │
│   └──────────┘ └──────────┘ └──────────────┘ └──────────────────┘  │
│                                                                      │
│   React 18 + Vite + Tailwind CSS + Chart.js                          │
│   Light/dark mode · Collapsible sidebar · Auto-polling metrics       │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## Call flow

```
Carrier calls in
       │
       ▼
   GREETING ─── "Hi, thanks for calling ACME Logistics"
       │
       ▼
   COLLECT MC ─── "Can I get your MC number?"
       │
       ▼
   LOOKUP CARRIER ──── GET /carrier/lookup/{mc}
       │
       ├── not found / ineligible ──► DECLINE ──► LOG CALL
       │
       ▼
   COLLECT PREFERENCES ─── "What lane and equipment?"
       │
       ▼
   SEARCH LOADS ──── POST /loads/search
       │
       ├── no match ──► NO MATCH END ──► LOG CALL
       │
       ▼
   PITCH LOAD ─── "I've got a great match — $2,300, Chicago to Dallas"
       │
       ├── accept ──► TRANSFER ──► LOG CALL
       │
       ▼
   NEGOTIATE ──── POST /negotiate/evaluate (up to 3 rounds)
       │
       ├── accept ──► TRANSFER ──► LOG CALL
       ├── reject ──► CLOSE ──► LOG CALL
       │
       ▼
   LOG CALL ──── POST /calls/log (DB + Azure Blob audit trail)
```

## Negotiation decision zones

```
                    open_pct              ceiling_pct
                       │                      │
  $0 ─────────── offered ──── followup ──── ceiling ─────────── ∞
                    │              │            │                │
                 instant        accept       counter          counter
                 accept        (any rnd)    @ followup       @ followup
                                            (R0 only)        (R0)
                                                             counter
                                                             @ ceiling
                                                              (R1)
                                                              reject
                                                              (R2)
```

## Data flow

```
HappyRobot ──► /carrier/lookup ──► carrier DB ──► eligibility + tier
           ──► /loads/search ──► scoring engine ──► ranked matches
           ──► /negotiate/params ──► config DB ──► open_pct, ceiling_pct
           ──► /negotiate/evaluate ──► policy engine ──► decision + text
           ──► /calls/log ──► call DB + event store + Azure Blob

Dashboard  ──► /dashboard/metrics ──► aggregated from calls table
           ──► /dashboard/config ──► read/write negotiation_configs
           ──► /calls ──► paginated call list
           ──► /calls/{id} ──► single call + events
```

## Tech stack

| Layer | Technology | Hosting |
|---|---|---|
| Voice | HappyRobot AI platform | HappyRobot |
| Backend | Python 3.12, FastAPI, SQLAlchemy (async) | Railway |
| Database | PostgreSQL 16 | Railway plugin |
| Audit trail | Azure Blob Storage | Azure (optional) |
| Frontend | React 18, Vite, Tailwind CSS, Chart.js | Vercel |
| Containers | Docker, Docker Compose | Local dev |
| Auth | x-api-key header on all endpoints | — |
| TLS | Let's Encrypt (auto via Railway + Vercel) | — |
