-- merkle.sql
-- Turing Verifiable Governance: Merkle Audit Trail + Policy/Model Registries (PostgreSQL)
--
-- This script is designed to be runnable even if your core events table name differs.
-- It creates:
--   - signing key registry (public keys only)
--   - merkle batch + proof tables
--   - policy registry (signed DSL + bytecode)
--   - model registry (signed model artifacts + lifecycle)
--
-- Optional: if table turing_core.events exists, it will add columns for commit sequencing + hashes.
-- Adjust schema/table names as needed.

BEGIN;

-- ------------------------------------------------------------
-- Extensions
-- ------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ------------------------------------------------------------
-- Domains (SHA-256 hashes, signatures)
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hash32') THEN
    CREATE DOMAIN hash32 AS bytea
      CHECK (octet_length(VALUE) = 32);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sigbytes') THEN
    CREATE DOMAIN sigbytes AS bytea
      CHECK (octet_length(VALUE) >= 32 AND octet_length(VALUE) <= 512);
  END IF;
END $$;

-- ------------------------------------------------------------
-- Key registry (public keys only; private keys live in KMS/HSM)
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS turing_security;

CREATE TABLE IF NOT EXISTS turing_security.signing_keys (
  key_id           text PRIMARY KEY,               -- e.g. "k-merkle-root-2026-01"
  algorithm        text NOT NULL,                  -- "ed25519" recommended
  public_key       bytea NOT NULL,                 -- raw public key bytes
  status           text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','RETIRED','REVOKED')),
  not_before       timestamptz NULL,
  not_after        timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  rotated_at       timestamptz NULL,
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_signing_keys_status
  ON turing_security.signing_keys(status);

-- ------------------------------------------------------------
-- Optional: event store augmentations (only if turing_core.events exists)
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS turing_core;

DO $$
DECLARE
  tbl regclass;
BEGIN
  tbl := to_regclass('turing_core.events');

  IF tbl IS NOT NULL THEN
    -- Create commit sequence if missing
    IF to_regclass('turing_core.events_commit_seq') IS NULL THEN
      EXECUTE 'CREATE SEQUENCE turing_core.events_commit_seq AS bigint';
    END IF;

    -- Add columns (idempotent)
    EXECUTE 'ALTER TABLE turing_core.events
      ADD COLUMN IF NOT EXISTS commit_seq bigint,
      ADD COLUMN IF NOT EXISTS payload_hash hash32,
      ADD COLUMN IF NOT EXISTS meta_hash hash32,
      ADD COLUMN IF NOT EXISTS event_digest hash32,
      ADD COLUMN IF NOT EXISTS leaf_hash hash32';

    -- Create index for batching/proofs
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_tenant_commitseq
      ON turing_core.events(tenant_id, commit_seq)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_events_event_id
      ON turing_core.events(event_id)';

    -- Optional trigger to set commit_seq automatically
    -- You may prefer setting commit_seq in application code instead.
    EXECUTE $trg$
      CREATE OR REPLACE FUNCTION turing_core.set_commit_seq()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.commit_seq IS NULL THEN
          NEW.commit_seq := nextval('turing_core.events_commit_seq');
        END IF;
        RETURN NEW;
      END $$;
    $trg$;

    EXECUTE 'DROP TRIGGER IF EXISTS trg_set_commit_seq ON turing_core.events';
    EXECUTE 'CREATE TRIGGER trg_set_commit_seq
      BEFORE INSERT ON turing_core.events
      FOR EACH ROW EXECUTE FUNCTION turing_core.set_commit_seq()';

  END IF;
END $$;

-- ------------------------------------------------------------
-- Merkle audit trail tables
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS turing_audit;

CREATE TABLE IF NOT EXISTS turing_audit.merkle_batch (
  batch_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          text NOT NULL,
  environment_id     text NOT NULL,                 -- "prod" | "staging"
  algo_version       text NOT NULL,                 -- "TD-MERKLE-v1-SHA256"
  start_commit_seq   bigint NOT NULL,
  end_commit_seq     bigint NOT NULL,
  event_count        bigint NOT NULL CHECK (event_count >= 0),

  root_hash          hash32 NOT NULL,
  prev_root_hash     hash32 NULL,                   -- optional batch chain
  sealed_at          timestamptz NOT NULL DEFAULT now(),

  -- Root signature (KMS/HSM-backed key)
  root_signature     sigbytes NOT NULL,
  signing_key_id     text NOT NULL REFERENCES turing_security.signing_keys(key_id),

  -- Root anchoring (external trust boundary)
  anchor_type        text NULL,                     -- "WORM" | "RFC3161" | "TRANSPARENCY_LOG" | "PUBLIC_CHAIN"
  anchor_ref         text NULL,                     -- object path, TSA token id, txhash, log entry id, etc.
  anchor_payload     bytea NULL,                    -- optional (e.g., RFC3161 token bytes)

  status             text NOT NULL DEFAULT 'SEALED' CHECK (status IN ('OPEN','SEALED','FAILED')),
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT merkle_batch_seq_range CHECK (start_commit_seq <= end_commit_seq)
);

CREATE INDEX IF NOT EXISTS idx_merkle_batch_tenant_env_sealed_at
  ON turing_audit.merkle_batch(tenant_id, environment_id, sealed_at DESC);

CREATE INDEX IF NOT EXISTS idx_merkle_batch_tenant_env_seq
  ON turing_audit.merkle_batch(tenant_id, environment_id, start_commit_seq, end_commit_seq);

-- event_id -> batch + leaf index
CREATE TABLE IF NOT EXISTS turing_audit.merkle_event_index (
  tenant_id        text NOT NULL,
  environment_id   text NOT NULL,
  batch_id         uuid NOT NULL REFERENCES turing_audit.merkle_batch(batch_id) ON DELETE CASCADE,
  event_id         uuid NOT NULL,
  leaf_index       bigint NOT NULL CHECK (leaf_index >= 0),
  leaf_hash        hash32 NOT NULL,

  PRIMARY KEY (batch_id, leaf_index),
  UNIQUE (tenant_id, environment_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_merkle_event_index_event_id
  ON turing_audit.merkle_event_index(event_id);

-- Per-level hashes stored in chunks for proof generation
CREATE TABLE IF NOT EXISTS turing_audit.merkle_level_chunk (
  batch_id       uuid NOT NULL REFERENCES turing_audit.merkle_batch(batch_id) ON DELETE CASCADE,
  level          int NOT NULL CHECK (level >= 0),         -- 0 = leaf level
  chunk_index    int NOT NULL CHECK (chunk_index >= 0),
  hash_count     int NOT NULL CHECK (hash_count > 0),
  hashes_blob    bytea NOT NULL,                          -- concatenated 32-byte hashes; optionally compressed

  PRIMARY KEY (batch_id, level, chunk_index)
);

CREATE INDEX IF NOT EXISTS idx_merkle_level_chunk_level
  ON turing_audit.merkle_level_chunk(batch_id, level);

-- ------------------------------------------------------------
-- Policy registry (Resolve): signed DSL + compiled bytecode
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS turing_resolve;

CREATE TABLE IF NOT EXISTS turing_resolve.policy (
  policy_id        text PRIMARY KEY, -- e.g. "credit.auto.v1"
  description      text NULL,
  owner_team       text NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS turing_resolve.policy_version (
  policy_version_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id             text NOT NULL REFERENCES turing_resolve.policy(policy_id) ON DELETE CASCADE,
  version_label         text NOT NULL,               -- e.g. "2026.01.0"
  valid_from            timestamptz NOT NULL,
  valid_to              timestamptz NULL,            -- NULL = active until replaced
  status                text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SHADOW','ACTIVE','RETIRED','REVOKED')),

  dsl_source            text NOT NULL,
  dsl_hash              hash32 NOT NULL,
  bytecode              bytea NOT NULL,
  bytecode_hash         hash32 NOT NULL,

  compiler_version      text NOT NULL,
  compiler_build_hash   text NOT NULL,               -- git SHA or container digest
  schema_version        text NOT NULL DEFAULT 'TD:POLICYDSL:v0',

  -- Signature over bytecode_hash (v0). v1 may sign metadata hash as well.
  signature             sigbytes NOT NULL,
  signing_key_id        text NOT NULL REFERENCES turing_security.signing_keys(key_id),

  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            text NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE(policy_id, version_label)
);

CREATE INDEX IF NOT EXISTS idx_policy_version_policy_status_time
  ON turing_resolve.policy_version(policy_id, status, valid_from DESC);

CREATE TABLE IF NOT EXISTS turing_resolve.policy_test_run (
  test_run_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id     uuid NOT NULL REFERENCES turing_resolve.policy_version(policy_version_id) ON DELETE CASCADE,
  run_at                timestamptz NOT NULL DEFAULT now(),
  test_suite_hash       hash32 NOT NULL,
  result_status         text NOT NULL CHECK (result_status IN ('PASS','FAIL')),
  report_blob           bytea NULL,                  -- zipped report or JSON
  report_hash           hash32 NULL,
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_policy_test_run_version_time
  ON turing_resolve.policy_test_run(policy_version_id, run_at DESC);

-- ------------------------------------------------------------
-- Model registry: signed artifacts + lifecycle
-- ------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS turing_ml;

CREATE TABLE IF NOT EXISTS turing_ml.model (
  model_id        text PRIMARY KEY,     -- e.g. "collections.policyopt"
  description     text NULL,
  domain_type     text NOT NULL,        -- CREDIT | COLLECTIONS | FRAUD | PRICING ...
  created_at      timestamptz NOT NULL DEFAULT now(),
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS turing_ml.model_version (
  model_version_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id               text NOT NULL REFERENCES turing_ml.model(model_id) ON DELETE CASCADE,
  version_label          text NOT NULL,  -- e.g. "2026.02.1"
  status                 text NOT NULL DEFAULT 'REGISTERED'
                         CHECK (status IN ('REGISTERED','SHADOW','PRODUCTION','RETIRED','REVOKED')),

  artifact_uri           text NOT NULL,         -- object store URI/path
  artifact_hash          hash32 NOT NULL,
  manifest_json          jsonb NOT NULL,        -- feature schema ids, transforms, deps
  manifest_hash          hash32 NOT NULL,

  trainer_code_hash      text NOT NULL,         -- git SHA or container digest
  inference_runtime_hash text NOT NULL,         -- container digest
  feature_schema_id      text NOT NULL,
  feature_schema_version text NOT NULL,

  evaluation_report_uri  text NULL,
  evaluation_report_hash hash32 NULL,

  -- Signature over artifact_hash (v0). v1 may include manifest hash.
  signature              sigbytes NOT NULL,
  signing_key_id         text NOT NULL REFERENCES turing_security.signing_keys(key_id),

  created_at             timestamptz NOT NULL DEFAULT now(),
  created_by             text NULL,
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb,

  UNIQUE(model_id, version_label)
);

CREATE INDEX IF NOT EXISTS idx_model_version_model_status
  ON turing_ml.model_version(model_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS turing_ml.model_lifecycle_event (
  lifecycle_event_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  model_version_id       uuid NOT NULL REFERENCES turing_ml.model_version(model_version_id) ON DELETE CASCADE,
  event_type             text NOT NULL CHECK (event_type IN ('PROMOTE_TO_SHADOW','PROMOTE_TO_PRODUCTION','ROLLBACK','DISABLE','RETIRE')),
  approved_by            text NULL,
  reason                 text NULL,
  occurred_at            timestamptz NOT NULL DEFAULT now(),
  metadata               jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_model_lifecycle_event_version_time
  ON turing_ml.model_lifecycle_event(model_version_id, occurred_at DESC);

COMMIT;
