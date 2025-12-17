-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Migration 006: ML Schema (Model Registry)
-- ============================================================
-- This migration creates the model registry for storing
-- signed model artifacts with lifecycle states and shadow
-- execution tracking.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS turing_ml;

-- ============================================================
-- TABLE: model
-- Model identity (stable name / namespace)
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_ml.model (
  model_id        text PRIMARY KEY,                -- e.g. "collections.policyopt"
  description     text NULL,
  domain_type     text NOT NULL                    -- CREDIT | COLLECTIONS | FRAUD | PRICING | AML
                  CHECK (domain_type IN ('CREDIT', 'COLLECTIONS', 'FRAUD', 'PRICING', 'AML')),
  owner_team      text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE turing_ml.model IS 
  'Model identity registry. Each model_id represents a stable model namespace.';

-- ============================================================
-- TABLE: model_version
-- Immutable signed model version with artifact provenance
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_ml.model_version (
  model_version_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id              text NOT NULL REFERENCES turing_ml.model(model_id) ON DELETE CASCADE,
  version_label         text NOT NULL,             -- e.g. "2026.02.1"
  
  -- Lifecycle status
  status                text NOT NULL DEFAULT 'REGISTERED'
                        CHECK (status IN ('REGISTERED', 'SHADOW', 'PRODUCTION', 'RETIRED', 'REVOKED')),
  
  -- Artifact location (do NOT store huge blobs in DB)
  artifact_uri          text NOT NULL,             -- object store URI/path
  artifact_hash         bytea NOT NULL,            -- SHA-256 of artifact
  artifact_size_bytes   bigint NULL,
  
  -- Manifest (feature schema, transforms, runtime deps)
  manifest_json         jsonb NOT NULL,
  manifest_hash         bytea NOT NULL,            -- SHA-256 of canonical manifest JSON
  
  -- Provenance
  trainer_code_hash     text NOT NULL,             -- git SHA or container digest
  inference_runtime_hash text NOT NULL,            -- container digest for inference service
  training_data_hash    text NULL,                 -- hash of training dataset (if available)
  
  -- Feature binding
  feature_schema_id     text NOT NULL,
  feature_schema_version text NOT NULL,
  
  -- Evaluation reports
  evaluation_report_uri  text NULL,
  evaluation_report_hash bytea NULL,
  
  -- Signing
  signature             bytea NOT NULL,            -- signature over artifact_hash
  signing_key_id        text NOT NULL REFERENCES turing_security.signing_keys(key_id),
  
  -- Audit
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            text NULL,
  
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  UNIQUE(model_id, version_label)
);

-- For finding active model version
CREATE INDEX IF NOT EXISTS idx_model_version_model_status
  ON turing_ml.model_version(model_id, status, created_at DESC);

COMMENT ON TABLE turing_ml.model_version IS 
  'Immutable signed model versions. Each version is cryptographically bound to its artifact.';

COMMENT ON COLUMN turing_ml.model_version.status IS 
  'Lifecycle: REGISTERED→SHADOW→PRODUCTION→RETIRED. REVOKED for compromised models.';

-- ============================================================
-- TABLE: model_lifecycle_event
-- Audit log of model lifecycle transitions
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_ml.model_lifecycle_event (
  lifecycle_event_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id       uuid NOT NULL REFERENCES turing_ml.model_version(model_version_id) ON DELETE CASCADE,
  
  -- Event details
  event_type             text NOT NULL 
                         CHECK (event_type IN ('REGISTER', 'PROMOTE_TO_SHADOW', 'PROMOTE_TO_PRODUCTION', 
                                               'ROLLBACK', 'DISABLE', 'RETIRE', 'REVOKE')),
  from_status            text NULL,
  to_status              text NULL,
  
  -- Approval
  approved_by            text NULL,
  approval_notes         text NULL,
  
  -- Rollback info (if applicable)
  rollback_to_version_id uuid NULL REFERENCES turing_ml.model_version(model_version_id),
  rollback_reason        text NULL,
  
  occurred_at            timestamptz NOT NULL DEFAULT now(),
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_model_lifecycle_event_version_time
  ON turing_ml.model_lifecycle_event(model_version_id, occurred_at DESC);

COMMENT ON TABLE turing_ml.model_lifecycle_event IS 
  'Audit log of model lifecycle transitions. Required for compliance.';

-- ============================================================
-- TABLE: model_shadow_prediction
-- Shadow execution records for comparison with baseline
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_ml.model_shadow_prediction (
  prediction_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id       uuid NOT NULL REFERENCES turing_ml.model_version(model_version_id) ON DELETE CASCADE,
  
  -- Context
  tenant_id              text NOT NULL,
  environment_id         text NOT NULL,
  decision_id            uuid NOT NULL,            -- links to policy decision
  
  -- Input
  feature_hash           bytea NOT NULL,           -- SHA-256 of input features
  
  -- Prediction
  predicted_at           timestamptz NOT NULL DEFAULT now(),
  prediction_value       jsonb NOT NULL,           -- model output (action, score, etc.)
  prediction_confidence  numeric(5,4) NULL,        -- 0.0000 to 1.0000
  latency_ms             int NOT NULL,
  
  -- Comparison with baseline (if available)
  baseline_version_id    uuid NULL REFERENCES turing_ml.model_version(model_version_id),
  baseline_prediction    jsonb NULL,
  agreement              boolean NULL,             -- did shadow agree with baseline?
  
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_model_shadow_prediction_version_time
  ON turing_ml.model_shadow_prediction(model_version_id, predicted_at DESC);

CREATE INDEX IF NOT EXISTS idx_model_shadow_prediction_decision
  ON turing_ml.model_shadow_prediction(decision_id);

COMMENT ON TABLE turing_ml.model_shadow_prediction IS 
  'Shadow execution records. Used to compare new model against baseline before promotion.';

-- ============================================================
-- TABLE: model_promotion_gate
-- Promotion criteria and gate check results
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_ml.model_promotion_gate (
  gate_check_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id       uuid NOT NULL REFERENCES turing_ml.model_version(model_version_id) ON DELETE CASCADE,
  
  -- Gate check execution
  checked_at             timestamptz NOT NULL DEFAULT now(),
  checked_by             text NULL,
  
  -- Criteria
  required_shadow_days   int NOT NULL,
  actual_shadow_days     int NOT NULL,
  required_predictions   int NOT NULL,
  actual_predictions     int NOT NULL,
  required_agreement_rate numeric(5,4) NOT NULL,   -- e.g. 0.9500
  actual_agreement_rate  numeric(5,4) NOT NULL,
  max_latency_p99_ms     int NOT NULL,
  actual_latency_p99_ms  int NOT NULL,
  max_error_rate         numeric(5,4) NOT NULL,
  actual_error_rate      numeric(5,4) NOT NULL,
  
  -- Approvals
  required_approvals     jsonb NOT NULL,           -- e.g. [{"role": "CRO", "count": 1}]
  actual_approvals       jsonb NOT NULL,           -- e.g. [{"role": "CRO", "user": "john", "at": "..."}]
  
  -- Rollback plan
  rollback_plan_required boolean NOT NULL DEFAULT true,
  rollback_plan_exists   boolean NOT NULL,
  
  -- Result
  all_gates_passed       boolean NOT NULL,
  failed_gates           text[] NOT NULL DEFAULT '{}',
  
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_model_promotion_gate_version
  ON turing_ml.model_promotion_gate(model_version_id, checked_at DESC);

COMMENT ON TABLE turing_ml.model_promotion_gate IS 
  'Promotion gate check results. Documents all criteria evaluated before SHADOW→PRODUCTION.';
