# Production Grade Gate — Sign-off Checklist

A model may be marked PRODUCTION only if all items are satisfied.

## A) Provenance
- [ ] Every inference emits an InferenceFact with required fields and hashes.
- [ ] model_artifact_hash is signed and verified against key registry.
- [ ] feature_schema_id/version present; feature_snapshot_hash present.

## B) Reproducibility
- [ ] dataset_snapshot_id + dataset_hash recorded and immutable.
- [ ] trainer_code_hash and inference_runtime_hash recorded.
- [ ] evaluation_report_hash recorded and stored immutably.

## C) Safety
- [ ] strict timeout enforced; baseline fallback tested.
- [ ] kill switch exists and has been tested.
- [ ] auto-disable triggers configured (latency/timeout/drift).

## D) Rollout
- [ ] shadow window completed; promotion packet exists.
- [ ] canary scope defined (tenants/segments/%); guardrails documented.
- [ ] rollback tested and verified < 5 minutes.

## E) Monitoring
- [ ] dashboards exist; alerts configured; on-call owner assigned.
- [ ] drift reports generated daily; severe drift alerts wired.
- [ ] incident runbooks exist (shadow ops + rollback).

## F) Approvals (maker/checker)
- [ ] engineering approval captured (who/when)
- [ ] risk/compliance approval captured (who/when)
- [ ] approvals logged as lifecycle events

Decision: [ ] APPROVE  [ ] REJECT  [ ] DEFER
