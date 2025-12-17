-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Migration 004: Audit Schema (Merkle Audit Trail)
-- ============================================================
-- This migration creates the Merkle audit trail tables for
-- tamper-evident event history.
--
-- Storage expectation: All tree levels are stored, so proof
-- generation is O(log N) reads.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS turing_audit;

-- ============================================================
-- TABLE: merkle_batch
-- Sealed ranges of events with signed Merkle roots
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_audit.merkle_batch (
  batch_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          text NOT NULL,
  environment_id     text NOT NULL,                 -- "prod" | "staging" | "dev"
  algo_version       text NOT NULL,                 -- "TD-MERKLE-v1-SHA256"
  
  -- Event range (inclusive)
  start_commit_seq   bigint NOT NULL,
  end_commit_seq     bigint NOT NULL,
  event_count        bigint NOT NULL CHECK (event_count >= 0),
  
  -- Merkle root
  root_hash          bytea NOT NULL,                -- 32-byte SHA-256
  prev_root_hash     bytea NULL,                    -- optional batch chain (hash of previous batch)
  sealed_at          timestamptz NOT NULL DEFAULT now(),
  
  -- Root signature (HSM/KMS-backed key)
  root_signature     bytea NOT NULL,
  signing_key_id     text NOT NULL REFERENCES turing_security.signing_keys(key_id),
  
  -- Anchoring (external reference proving existence outside DB trust boundary)
  anchor_type        text NULL                      -- "WORM" | "RFC3161" | "TRANSPARENCY_LOG" | "PUBLIC_CHAIN"
                     CHECK (anchor_type IS NULL OR anchor_type IN ('WORM', 'RFC3161', 'TRANSPARENCY_LOG', 'PUBLIC_CHAIN')),
  anchor_ref         text NULL,                     -- object path, TSA token id, txhash, log entry id
  anchor_payload     bytea NULL,                    -- optional (e.g. RFC3161 token bytes)
  anchor_at          timestamptz NULL,              -- when anchoring was completed
  
  -- Status
  status             text NOT NULL DEFAULT 'SEALED'
                     CHECK (status IN ('OPEN', 'SEALED', 'ANCHORED', 'FAILED')),
  
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  CONSTRAINT merkle_batch_seq_range CHECK (start_commit_seq <= end_commit_seq)
);

-- For finding batches by tenant/env and time
CREATE INDEX IF NOT EXISTS idx_merkle_batch_tenant_env_sealed_at
  ON turing_audit.merkle_batch(tenant_id, environment_id, sealed_at DESC);

-- For finding batches by commit_seq range (proof lookup)
CREATE INDEX IF NOT EXISTS idx_merkle_batch_tenant_env_seq
  ON turing_audit.merkle_batch(tenant_id, environment_id, start_commit_seq, end_commit_seq);

-- For finding unanchored batches
CREATE INDEX IF NOT EXISTS idx_merkle_batch_status
  ON turing_audit.merkle_batch(status) WHERE status != 'ANCHORED';

COMMENT ON TABLE turing_audit.merkle_batch IS 
  'Sealed Merkle batches with signed roots and external anchoring.';

-- ============================================================
-- TABLE: merkle_event_index
-- Maps event_id to batch + leaf_index for proof generation
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_audit.merkle_event_index (
  tenant_id        text NOT NULL,
  environment_id   text NOT NULL,
  batch_id         uuid NOT NULL REFERENCES turing_audit.merkle_batch(batch_id) ON DELETE CASCADE,
  event_id         uuid NOT NULL,
  leaf_index       bigint NOT NULL CHECK (leaf_index >= 0),
  leaf_hash        bytea NOT NULL,                  -- 32-byte SHA-256
  
  PRIMARY KEY (batch_id, leaf_index),
  UNIQUE (tenant_id, environment_id, event_id)
);

-- For proof lookup by event_id
CREATE INDEX IF NOT EXISTS idx_merkle_event_index_event_id
  ON turing_audit.merkle_event_index(event_id);

COMMENT ON TABLE turing_audit.merkle_event_index IS 
  'Index mapping events to their Merkle batch and leaf position.';

-- ============================================================
-- TABLE: merkle_level_chunk
-- Stores Merkle tree levels in chunks for efficient proof generation
-- Level 0 = leaves, Level N = root
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_audit.merkle_level_chunk (
  batch_id       uuid NOT NULL REFERENCES turing_audit.merkle_batch(batch_id) ON DELETE CASCADE,
  level          int NOT NULL CHECK (level >= 0),         -- 0 = leaf level
  chunk_index    int NOT NULL CHECK (chunk_index >= 0),   -- for large batches, split into chunks
  hash_count     int NOT NULL CHECK (hash_count > 0),
  hashes_blob    bytea NOT NULL,                          -- concatenated 32-byte hashes
  
  PRIMARY KEY (batch_id, level, chunk_index)
);

-- For reading all chunks at a level
CREATE INDEX IF NOT EXISTS idx_merkle_level_chunk_level
  ON turing_audit.merkle_level_chunk(batch_id, level);

COMMENT ON TABLE turing_audit.merkle_level_chunk IS 
  'Merkle tree levels stored in chunks. Enables O(log N) proof generation.';

COMMENT ON COLUMN turing_audit.merkle_level_chunk.hashes_blob IS 
  'Concatenated 32-byte hashes. For chunk_index=0, starts at position 0 in level.';

-- ============================================================
-- TABLE: merkle_verification_log
-- Audit log of verification attempts (optional but recommended)
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_audit.merkle_verification_log (
  verification_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id           uuid NOT NULL REFERENCES turing_audit.merkle_batch(batch_id),
  event_id           uuid NULL,                     -- NULL if batch-level verification
  verified_at        timestamptz NOT NULL DEFAULT now(),
  verified_by        text NULL,                     -- user/service that performed verification
  result             text NOT NULL CHECK (result IN ('PASS', 'FAIL')),
  error_codes        text[] NULL,                   -- e.g. ['MERKLE_INCLUSION_FAIL', 'ROOT_SIG_INVALID']
  metadata           jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_merkle_verification_log_batch
  ON turing_audit.merkle_verification_log(batch_id, verified_at DESC);

COMMENT ON TABLE turing_audit.merkle_verification_log IS 
  'Audit log of Merkle proof verification attempts.';
