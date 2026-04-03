# TODO

## Completed

- [x] Deploy API to cloud — live at `https://hr-carrier-sales-production.up.railway.app`
- [x] API key authentication on all endpoints (`x-api-key` header)
- [x] HTTPS in production (Railway + Let's Encrypt)
- [x] Carrier lookup endpoint (`GET /api/v1/carrier/lookup/{mc_number}`)
- [x] Load search engine with adaptive multi-factor scoring
- [x] Direct load lookup by `load_id`
- [x] Negotiation pricing params endpoint (`POST /api/v1/negotiate/params`)
- [x] Deterministic negotiation engine (`POST /api/v1/negotiate/evaluate`)
- [x] Server-side round tracking per `(mc_number, load_id)` with 3-minute idle TTL
- [x] Call logging with event store (`POST /api/v1/calls/log`)
- [x] Dashboard metrics endpoint (`GET /api/v1/dashboard/metrics`)
- [x] Dashboard config endpoints (`GET/PUT /api/v1/dashboard/config`)
- [x] Seed data: 30 loads, 4 real carriers (FMCSA-verified MC numbers), 3 tier configs
- [x] Docker + docker-compose setup
- [x] Railway deployment with `railway.toml`
- [x] CORS middleware
- [x] Pydantic schemas with empty-string coercion for HappyRobot compatibility
- [x] Makefile (`dev`, `seed`, `test`, `docker-up`, `docker-down`)
- [x] Azure Blob Storage — immutable audit trail for call events
- [x] PostgreSQL migration (Railway Postgres plugin + `asyncpg`)
- [x] Dashboard frontend (React + Vite + Tailwind CSS + Chart.js)
- [x] Dashboard deployment on Vercel (auto-deploys from `dev` branch)
- [x] Conversion funnel (calls → verified → matched → negotiated → booked)
- [x] Outcome breakdown chart
- [x] Sentiment distribution chart
- [x] Negotiation policy sliders (per carrier tier)
- [x] Calls page with duration metrics
- [x] Sidebar navigation (Overview, Calls, Policy)

## In progress

- [ ] Wire HappyRobot voice workflow (system prompt + tool calls pointing at deployed API)

## Nice to have

- [ ] Call log table with drill-down (needs `GET /api/v1/calls` endpoint)
- [ ] Latency metrics per conversation
- [ ] Dashboard date-range filtering

## Docs & deliverables

- [ ] Broker-facing build document (`docs/acme_logistics_solution.md`)
- [ ] Deployment guide (`docs/deployment_guide.md`)
- [ ] Email to prospect
- [ ] 5-minute video walkthrough
