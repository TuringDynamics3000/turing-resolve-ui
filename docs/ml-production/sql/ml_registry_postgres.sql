-- ml_registry_postgres.sql
-- Minimal, production-grade registry schema (Postgres) for models + feature schemas + deployments.
-- Assumes you already have a security schema/table for signing public keys (or add one here).

BEGIN;

CREATE SCHEMA IF NOT EXISTS turing_ml;

-- Feature schema registry (versioned, immutable)
CREATE TABLE IF NOT EXISTS turing_ml.feature_schema (
  feature_schema_id       text NOT NULL,
  feature_schema_version  text NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              text NULL,
  schema_json             jsonb NOT NULL,
  schema_hash             bytea NOT NULL,     -- sha256 32 bytes
  status                  text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','DEPRECATED','REVOKED')),
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (feature_schema_id, feature_schema_version)
);

CREATE INDEX IF NOT EXISTS idx_feature_schema_status
  ON turing_ml.feature_schema(status, created_at DESC);

-- Optional: Feature snapshot log for traceability/replay (store hash and a pointer to where materialized inputs live)
CREATE TABLE IF NOT EXISTS turing_ml.feature_snapshot (
  feature_snapshot_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id               text NOT NULL,
  environment_id          text NOT NULL,
  feature_schema_id       text NOT NULL,
  feature_schema_version  text NOT NULL,
  snapshot_hash           bytea NOT NULL,     -- sha256 32 bytes of canonicalized features payload
  snapshot_uri            text NULL,          -- object store pointer if payload too large
  created_at              timestamptz NOT NULL DEFAULT now(),
  created_by              text NULL,
  metadata                jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_feature_snapshot_tenant_time
  ON turing_ml.feature_snapshot(tenant_id, environment_id, created_at DESC);

-- Model registry
CREATE TABLE IF NOT EXISTS turing_ml.model (
  model_id        text PRIMARY KEY,
  description     text NULL,
  domain_type     text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Model versions (immutable artifacts + signatures)
CREATE TABLE IF NOT EXISTS turing_ml.model_version (
  model_version_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id               text NOT NULL REFERENCES turing_ml.model(model_id) ON DELETE CASCADE,
  version_label          text NOT NULL,
  status                 text NOT NULL DEFAULT 'REGISTERED'
                         CHECK (status IN ('REGISTERED','SHADOW','CANARY','PRODUCTION','RETIRED','REVOKED')),

  artifact_uri           text NOT NULL,
  artifact_hash          bytea NOT NULL,  -- sha256 32 bytes
  manifest_json          jsonb NOT NULL,
  manifest_hash          bytea NOT NULL,  -- sha256 32 bytes

  trainer_code_hash      text NOT NULL,
  inference_runtime_hash text NOT NULL,

  feature_schema_id      text NOT NULL,
  feature_schema_version text NOT NULL,

  dataset_snapshot_id    text NOT NULL,
  dataset_hash           bytea NOT NULL,  -- sha256 32 bytes
  evaluation_report_uri  text NULL,
  evaluation_report_hash bytea NULL,      -- sha256 32 bytes

  signature              bytea NOT NULL,
  signing_key_id         text NOT NULL,   -- FK to your key registry

  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             text NULL,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE(model_id, version_label)
);

CREATE INDEX IF NOT EXISTS idx_model_version_status_time
  ON turing_ml.model_version(model_id, status, created_at DESC);

-- Lifecycle events (approvals, promotions, rollbacks)
CREATE TABLE IF NOT EXISTS turing_ml.model_lifecycle_event (
  lifecycle_event_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id       uuid NOT NULL REFERENCES turing_ml.model_version(model_version_id) ON DELETE CASCADE,
  event_type             text NOT NULL CHECK (event_type IN (
                          'REGISTER','PROMOTE_TO_SHADOW','PROMOTE_TO_CANARY','PROMOTE_TO_PRODUCTION',
                          'ROLLBACK','DISABLE','RETIRE','REVOKE')),
  approved_by            text NULL,
  reason                 text NULL,
  occurred_at            timestamptz NOT NULL DEFAULT now(),
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_model_lifecycle_event_time
  ON turing_ml.model_lifecycle_event(model_version_id, occurred_at DESC);

COMMIT;
