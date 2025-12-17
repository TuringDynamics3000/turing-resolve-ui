-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Migration 001: Extensions and Domains
-- ============================================================
-- This migration creates the foundational types used across
-- all verifiable governance schemas.
-- ============================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- DOMAIN: hash32
-- 32-byte hash domain (SHA-256)
-- Used for: payload_hash, meta_hash, event_digest, leaf_hash,
--           root_hash, bytecode_hash, artifact_hash, etc.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'hash32') THEN
    CREATE DOMAIN hash32 AS bytea
      CHECK (octet_length(VALUE) = 32);
  END IF;
END $$;

COMMENT ON DOMAIN hash32 IS 'SHA-256 hash (32 bytes). Used for cryptographic commitments.';

-- ============================================================
-- DOMAIN: sigbytes
-- Generic signature blob
-- Size depends on algorithm:
--   - Ed25519: 64 bytes
--   - ECDSA P-256: 64-72 bytes
--   - RSA-2048: 256 bytes
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'sigbytes') THEN
    CREATE DOMAIN sigbytes AS bytea
      CHECK (octet_length(VALUE) >= 32 AND octet_length(VALUE) <= 512);
  END IF;
END $$;

COMMENT ON DOMAIN sigbytes IS 'Cryptographic signature (32-512 bytes). Supports Ed25519, ECDSA, RSA.';
