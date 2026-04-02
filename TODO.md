# TODO

## Completed

- [x] Deploy API to cloud — live at `https://hr-carrier-sales-production.up.railway.app`
- [x] API key authentication on all endpoints (`x-api-key` header)
- [x] HTTPS in production (Railway + Let's Encrypt)
- [x] Carrier lookup endpoint (`GET /api/v1/carrier/lookup/{mc_number}`) — DB-based, returns eligibility + tier
- [x] Load search engine with adaptive multi-factor scoring (origin, destination, equipment, dates, weight, miles, urgency)
- [x] Direct load lookup by `load_id`
- [x] Negotiation pricing params endpoint (`POST /api/v1/negotiate/params`) — returns tier-specific `open_pct`, `ceiling_pct`, `offered_rate_override`
- [x] Deterministic negotiation engine (`POST /api/v1/negotiate/evaluate`) — accept / counter / reject based on round + rate bands
- [x] Server-side round tracking per `(mc_number, load_id)` with 3-minute idle TTL
- [x] Call logging with event store (`POST /api/v1/calls/log`) — stores call + `call_completed` event
- [x] Dashboard metrics endpoint (`GET /api/v1/dashboard/metrics`) — funnel, outcomes, sentiment, avg margin, avg rounds
- [x] Dashboard config endpoints (`GET/PUT /api/v1/dashboard/config`) — per-tier negotiation sliders
- [x] Seed data: 30 loads, 4 real carriers (FMCSA-verified MC numbers), 3 tier configs
- [x] Docker + docker-compose setup
- [x] Railway deployment with `railway.toml`
- [x] CORS middleware
- [x] Pydantic schemas with empty-string coercion for HappyRobot compatibility
- [x] Makefile (`dev`, `seed`, `test`, `docker-up`, `docker-down`)

## Critical path

- [ ] Wire HappyRobot voice workflow (system prompt + tool calls pointing at deployed API)
- [ ] Build dashboard frontend (React + Chart.js in `dashboard/`)

## Dashboard sections (when building frontend)

- [ ] Conversion funnel (calls → verified → matched → negotiated → booked)
- [ ] Negotiation waterfall chart (loadboard rate → asks → counters → agreed)
- [ ] Outcome breakdown (booked / no_match / declined / failed_verification / escalated)
- [ ] Sentiment distribution (positive / neutral / negative / frustrated)
- [ ] Negotiation policy sliders (per carrier tier: open %, ceiling %, max rounds)
- [ ] Call log table with drill-down

## Nice to have

- [ ] Azure Blob Storage for call event audit logs
- [ ] Azure Entra ID for dashboard RBAC (admin / viewer roles)
- [ ] PostgreSQL migration (swap SQLite → Azure Database for PostgreSQL)
- [ ] Unit tests for negotiation engine (all policy branches)
- [ ] Unit tests for load search scoring
- [ ] HMAC webhook signature verification

## Docs & deliverables

- [ ] Broker-facing build document (`docs/acme_logistics_solution.md`)
- [ ] Deployment guide (`docs/deployment_guide.md`)
- [ ] Email to prospect
- [ ] 5-minute video walkthrough
