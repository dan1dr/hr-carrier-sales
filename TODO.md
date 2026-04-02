# TODO

## Critical path

- [x] Deploy API to cloud — live at `https://hr-carrier-sales-production.up.railway.app`
- [x] API key authentication on all endpoints (`x-api-key` header)
- [x] HTTPS in production (Railway + Let's Encrypt)
- [ ] Wire HappyRobot voice workflow (system prompt + 3 tool calls pointing at deployed API)
- [ ] Build dashboard frontend (React + Chart.js in `dashboard/`)

## Dashboard sections

- [ ] Conversion funnel (calls → verified → matched → negotiated → booked)
- [ ] Negotiation waterfall chart (loadboard rate → asks → counters → agreed)
- [ ] Outcome breakdown (booked / no_match / declined / failed_verification / escalated)
- [ ] Sentiment distribution (positive / neutral / negative / frustrated)
- [ ] Negotiation policy sliders (per carrier tier: floor %, target %, max rounds)
- [ ] Call log table with drill-down

## Nice to have

- [ ] Azure Blob Storage for call event audit logs
- [ ] Azure Entra ID for dashboard RBAC (admin / viewer roles)
- [ ] PostgreSQL migration (swap SQLite → Azure Database for PostgreSQL)
- [ ] Unit tests for negotiation engine (all policy branches, floor enforcement)
- [ ] Unit tests for load search scoring
- [ ] HMAC webhook signature verification

## Docs & deliverables

- [ ] Broker-facing build document (`docs/acme_logistics_solution.md`)
- [ ] Deployment guide (`docs/deployment_guide.md`)
- [ ] Email
- [ ] 5-minute video walkthrough
