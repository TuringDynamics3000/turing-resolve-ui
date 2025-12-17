# Runbook: Model Rollback / Disable

## Trigger conditions
- Latency p99 above SLO for > 15 minutes
- Timeout rate > 0.5% over 10 minutes
- Error rate > 0.2% over 10 minutes
- Severe drift: PSI > 0.25 on any critical feature
- Fairness guardrail breach (where applicable)
- Security incident or key compromise
- Customer harm signal (complaints spike)

## Actions (order)
1) Disable model influence (route baseline only; keep shadow logging if safe)
2) Roll back registry state to previous PRODUCTION model version
3) Verify baseline service health and end-to-end decision flow
4) Create incident record with:
   - model version
   - timeframe
   - metrics at trigger
   - impacted tenants/segments
5) Preserve evidence packs and inference facts for the period
6) Postmortem required for production rollbacks

## Verification
- Confirm routing is baseline-only
- Confirm model service is no longer called on execution path
- Confirm provenance logging continues
