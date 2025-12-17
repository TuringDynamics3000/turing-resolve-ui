# Promotion Packet Template (Model → CANARY/PRODUCTION)

## 1) Identifiers
- Model ID:
- Model Version:
- Artifact URI:
- Artifact Hash (sha256 hex):
- Manifest Hash (sha256 hex):
- Signing Key ID:
- Inference Runtime Hash (container digest):
- Trainer Code Hash (git SHA / digest):
- Feature Schema ID / Version:
- Dataset Snapshot ID / Hash:

## 2) Shadow results (required)
- Shadow window:
- Coverage (% of eligible decisions):
- Latency p50/p95/p99:
- Timeout rate:
- Error rate:
- Agreement vs baseline:
- Estimated uplift (domain-specific):
- Constitution violation rate (model proposal vs gated outcome):

## 3) Evaluation report (required)
- Primary metric(s) and confidence intervals:
- Baseline comparison:
- Off-policy evaluation method (if applicable):
- Stress tests / scenario tests:
- Calibration checks (if probabilities used):

## 4) Fairness / harm checks (if applicable)
- Protected attribute policy (what is measured and why):
- Disparate impact metrics:
- Complaint/appeal risk:
- Human review sample results:

## 5) Operational readiness
- Dashboards links:
- Alerts configured:
- On-call owner:
- Runbook links:
- Rollback plan:
- Kill switch tested (Y/N):

## 6) Approvals (maker/checker)
- Maker:
- Checker (Risk/Compliance):
- Checker (Engineering):
- Date/time approvals recorded:
- Linked audit event IDs:

## 7) Decision
- Promote to CANARY / PRODUCTION:
- Canary scope (tenants/segments/% traffic):
- Guardrails (hard limits):
- Auto-rollback triggers:
