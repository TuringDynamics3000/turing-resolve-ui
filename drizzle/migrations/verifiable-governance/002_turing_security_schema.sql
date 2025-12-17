-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Migration 002: Security Schema (Key Registry)
-- ============================================================
-- This migration creates the key registry for storing public
-- keys used in signature verification.
--
-- IMPORTANT: Never store private keys in the database.
-- Private keys should be in KMS/HSM with strict IAM.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS turing_security;

-- ============================================================
-- TABLE: signing_keys
-- Public key registry for verification
-- 
-- Key roles (use distinct key_ids for each):
--   - k-merkle-root-*     : Merkle batch root signing
--   - k-policy-bytecode-* : Policy bytecode signing
--   - k-auth-token-*      : Authorization token signing
--   - k-model-artifact-*  : Model artifact signing
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_security.signing_keys (
  key_id           text PRIMARY KEY,               -- e.g. "k-resolve-policy-2026-01"
  algorithm        text NOT NULL,                  -- "ed25519" | "ecdsa_p256" | "rsa2048"
  public_key       bytea NOT NULL,                 -- raw public key bytes
  status           text NOT NULL DEFAULT 'ACTIVE'  -- ACTIVE | RETIRED | REVOKED
                   CHECK (status IN ('ACTIVE', 'RETIRED', 'REVOKED')),
  not_before       timestamptz NULL,               -- key validity start
  not_after        timestamptz NULL,               -- key validity end (NULL = no expiry)
  created_at       timestamptz NOT NULL DEFAULT now(),
  rotated_at       timestamptz NULL,               -- when key was rotated (superseded)
  rotated_to       text NULL,                      -- key_id of successor key
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- Index for finding active keys
CREATE INDEX IF NOT EXISTS idx_signing_keys_status
  ON turing_security.signing_keys(status);

-- Index for finding keys by algorithm
CREATE INDEX IF NOT EXISTS idx_signing_keys_algorithm
  ON turing_security.signing_keys(algorithm, status);

COMMENT ON TABLE turing_security.signing_keys IS 
  'Public key registry for cryptographic verification. Private keys must be stored in KMS/HSM.';

COMMENT ON COLUMN turing_security.signing_keys.key_id IS 
  'Unique key identifier. Convention: k-{purpose}-{date} e.g. k-merkle-root-2026-01';

COMMENT ON COLUMN turing_security.signing_keys.algorithm IS 
  'Signing algorithm. Supported: ed25519, ecdsa_p256, rsa2048';

COMMENT ON COLUMN turing_security.signing_keys.status IS 
  'Key lifecycle status. ACTIVE=in use, RETIRED=superseded but valid for verification, REVOKED=compromised';
