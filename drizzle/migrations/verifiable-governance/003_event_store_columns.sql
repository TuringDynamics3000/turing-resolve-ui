-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Migration 003: Event Store Column Additions
-- ============================================================
-- This migration adds cryptographic columns to the event store
-- for Merkle audit trail support.
--
-- IMPORTANT: Your application MUST compute these hashes
-- deterministically at write time (same transaction).
-- ============================================================

-- Create turing_core schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS turing_core;

-- ============================================================
-- SEQUENCE: events_commit_seq
-- Monotonic sequence for commit ordering within tenant
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'events_commit_seq') THEN
    CREATE SEQUENCE turing_core.events_commit_seq AS bigint;
  END IF;
END $$;

-- ============================================================
-- TABLE: events (create if not exists, or alter existing)
-- Core event store with cryptographic columns
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_core.events (
  event_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        text NOT NULL,
  environment_id   text NOT NULL DEFAULT 'prod',
  stream_id        text NOT NULL,                  -- aggregate/entity identifier
  stream_type      text NOT NULL,                  -- e.g. "deposit", "payment", "loan"
  event_type       text NOT NULL,                  -- e.g. "DepositCreated", "PaymentExecuted"
  event_version    int NOT NULL DEFAULT 1,
  
  -- Payload (the actual event data)
  payload          jsonb NOT NULL,
  
  -- Metadata (correlation, causation, actor, etc.)
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamps
  occurred_at      timestamptz NOT NULL DEFAULT now(),
  recorded_at      timestamptz NOT NULL DEFAULT now(),
  
  -- Cryptographic columns for Merkle audit trail
  commit_seq       bigint,                         -- monotonic ordering for batching
  payload_hash     bytea,                          -- SHA-256 of canonical payload JSON
  meta_hash        bytea,                          -- SHA-256 of canonical metadata JSON
  event_digest     bytea,                          -- SHA-256(event_id || payload_hash || meta_hash || occurred_at)
  leaf_hash        bytea                           -- SHA-256(0x00 || event_digest) - Merkle leaf
);

-- If table already exists, add columns
DO $$
BEGIN
  -- Add commit_seq if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'turing_core' 
                 AND table_name = 'events' 
                 AND column_name = 'commit_seq') THEN
    ALTER TABLE turing_core.events ADD COLUMN commit_seq bigint;
  END IF;
  
  -- Add payload_hash if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'turing_core' 
                 AND table_name = 'events' 
                 AND column_name = 'payload_hash') THEN
    ALTER TABLE turing_core.events ADD COLUMN payload_hash bytea;
  END IF;
  
  -- Add meta_hash if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'turing_core' 
                 AND table_name = 'events' 
                 AND column_name = 'meta_hash') THEN
    ALTER TABLE turing_core.events ADD COLUMN meta_hash bytea;
  END IF;
  
  -- Add event_digest if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'turing_core' 
                 AND table_name = 'events' 
                 AND column_name = 'event_digest') THEN
    ALTER TABLE turing_core.events ADD COLUMN event_digest bytea;
  END IF;
  
  -- Add leaf_hash if missing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_schema = 'turing_core' 
                 AND table_name = 'events' 
                 AND column_name = 'leaf_hash') THEN
    ALTER TABLE turing_core.events ADD COLUMN leaf_hash bytea;
  END IF;
END $$;

-- ============================================================
-- TRIGGER: Auto-assign commit_seq on insert
-- Optional: Many teams prefer app-side assignment for control
-- ============================================================
CREATE OR REPLACE FUNCTION turing_core.set_commit_seq()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.commit_seq IS NULL THEN
    NEW.commit_seq := nextval('turing_core.events_commit_seq');
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_set_commit_seq ON turing_core.events;
CREATE TRIGGER trg_set_commit_seq
BEFORE INSERT ON turing_core.events
FOR EACH ROW EXECUTE FUNCTION turing_core.set_commit_seq();

-- ============================================================
-- INDEXES: Critical for batching and proof generation
-- ============================================================

-- For batch sealing: find events by tenant + commit_seq range
CREATE INDEX IF NOT EXISTS idx_events_tenant_commitseq
  ON turing_core.events(tenant_id, commit_seq);

-- For proof lookup: find event by ID
CREATE INDEX IF NOT EXISTS idx_events_event_id
  ON turing_core.events(event_id);

-- For stream replay: find events by stream
CREATE INDEX IF NOT EXISTS idx_events_stream
  ON turing_core.events(tenant_id, stream_type, stream_id, event_version);

-- For time-based queries
CREATE INDEX IF NOT EXISTS idx_events_occurred_at
  ON turing_core.events(tenant_id, occurred_at DESC);

COMMENT ON TABLE turing_core.events IS 
  'Immutable event store with cryptographic columns for Merkle audit trail.';

COMMENT ON COLUMN turing_core.events.commit_seq IS 
  'Monotonic sequence number for batch ordering. Assigned by trigger or application.';

COMMENT ON COLUMN turing_core.events.payload_hash IS 
  'SHA-256 hash of canonical JSON payload. Computed at write time.';

COMMENT ON COLUMN turing_core.events.leaf_hash IS 
  'Merkle leaf hash: SHA-256(0x00 || event_digest). Used in inclusion proofs.';
