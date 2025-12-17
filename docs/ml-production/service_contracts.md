# Service Contracts (Production-Grade ML)

This document specifies the minimum APIs and behaviors required to ship production-grade ML
inside the TuringCore/TuringResolve architecture.

## 1) Model Registry API (authoritative)

### Create model
- POST /ml/models
  - body: { model_id, domain_type, description, metadata }
  - behavior: idempotent (409 if exists unless identical)

### Register model version (immutable)
- POST /ml/models/{model_id}/versions
  - body: ModelManifest (see schemas/model_manifest.schema.json)
  - behavior:
    - verify signature against key registry
    - validate schema/dataset hashes present
    - status set to REGISTERED
    - reject if artifact_hash/version_label already exists with different manifest_hash

### Promote / Demote
- POST /ml/models/{model_id}/versions/{version}/promote
  - body: { target_status: SHADOW|CANARY|PRODUCTION, promotion_packet_ref }
  - behavior:
    - enforce allowed transitions only
    - require maker/checker approvals (captured as lifecycle events)
    - require promotion packet (shadow metrics, evaluation report, runbooks)

- POST /ml/models/{model_id}/versions/{version}/rollback
  - body: { reason, restore_to_version }
  - behavior:
    - atomic routing update + lifecycle event emission
    - <5 minute RTO expected for full rollback

## 2) Inference API (advisor/optimizer)

### Score endpoint (shadow-safe)
- POST /ml/infer
  - body: { decision_id, tenant_id, env_id, feature_schema_id, feature_schema_version, features_or_snapshot_ref, context }
  - response: { status, prediction, confidence, action_distribution, model_id, model_version, model_artifact_hash, latency_ms }

Hard requirements:
- strict timeout
- no side effects (pure function)
- emits InferenceFact to the event stream or audit store

## 3) Shadow Router
- Core execution path:
  - executes baseline/constitution-approved action
  - invokes ML inference asynchronously
  - logs comparison record for offline evaluation

## 4) Evidence Packs (for ML decisions)
- GET /evidence/decision/{decision_id}
  - returns evidence pack binding:
    - model hashes + signatures
    - feature snapshot hash + schema version
    - policy bytecode hash + signature
    - trace hash
    - core events (and proofs if enabled)
