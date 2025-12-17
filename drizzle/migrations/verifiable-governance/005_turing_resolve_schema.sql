-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Migration 005: Resolve Schema (Policy Registry)
-- ============================================================
-- This migration creates the policy registry for storing
-- signed policy bytecode with versioning and lifecycle states.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS turing_resolve;

-- ============================================================
-- TABLE: policy
-- Policy identity (stable name / namespace)
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_resolve.policy (
  policy_id        text PRIMARY KEY,               -- e.g. "credit.auto.dti_limit"
  description      text NULL,
  owner_team       text NULL,                      -- e.g. "credit-risk"
  domain_type      text NOT NULL DEFAULT 'GENERAL' -- CREDIT | COLLECTIONS | FRAUD | PRICING | AML | GENERAL
                   CHECK (domain_type IN ('CREDIT', 'COLLECTIONS', 'FRAUD', 'PRICING', 'AML', 'GENERAL')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  metadata         jsonb NOT NULL DEFAULT '{}'::jsonb
);

COMMENT ON TABLE turing_resolve.policy IS 
  'Policy identity registry. Each policy_id represents a stable policy namespace.';

-- ============================================================
-- TABLE: policy_version
-- Immutable compiled/signed policy version
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_resolve.policy_version (
  policy_version_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id             text NOT NULL REFERENCES turing_resolve.policy(policy_id) ON DELETE CASCADE,
  version_label         text NOT NULL,               -- e.g. "2026.01.0" or git tag
  
  -- Validity window
  valid_from            timestamptz NOT NULL,
  valid_to              timestamptz NULL,            -- NULL = active until replaced
  
  -- Lifecycle status
  status                text NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN ('DRAFT', 'SHADOW', 'ACTIVE', 'RETIRED', 'REVOKED')),
  
  -- DSL source (human-readable)
  dsl_source            text NOT NULL,
  dsl_hash              bytea NOT NULL,              -- SHA-256 of DSL source
  
  -- Compiled bytecode (machine-executable)
  bytecode              bytea NOT NULL,
  bytecode_hash         bytea NOT NULL,              -- SHA-256 of bytecode
  
  -- Determinism / toolchain provenance
  compiler_version      text NOT NULL,               -- e.g. "td-policy-compiler:1.0.0"
  compiler_build_hash   text NOT NULL,               -- git SHA or container digest
  schema_version        text NOT NULL DEFAULT 'TD:POLICYDSL:v0',
  
  -- Signing
  signature             bytea NOT NULL,              -- signature over bytecode_hash
  signing_key_id        text NOT NULL REFERENCES turing_security.signing_keys(key_id),
  
  -- Audit
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            text NULL,
  approved_by           text NULL,
  approved_at           timestamptz NULL,
  
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  UNIQUE(policy_id, version_label)
);

-- For finding active policy version at a point in time
CREATE INDEX IF NOT EXISTS idx_policy_version_policy_status_time
  ON turing_resolve.policy_version(policy_id, status, valid_from DESC);

-- For finding all versions of a policy
CREATE INDEX IF NOT EXISTS idx_policy_version_policy_id
  ON turing_resolve.policy_version(policy_id, created_at DESC);

COMMENT ON TABLE turing_resolve.policy_version IS 
  'Immutable signed policy versions. Each version is cryptographically bound to its bytecode.';

COMMENT ON COLUMN turing_resolve.policy_version.status IS 
  'Lifecycle: DRAFT→SHADOW→ACTIVE→RETIRED. REVOKED for compromised policies.';

-- ============================================================
-- TABLE: policy_test_run
-- Unit tests + historical regression simulation results
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_resolve.policy_test_run (
  test_run_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_version_id     uuid NOT NULL REFERENCES turing_resolve.policy_version(policy_version_id) ON DELETE CASCADE,
  
  -- Test execution
  run_at                timestamptz NOT NULL DEFAULT now(),
  run_by                text NULL,
  
  -- Test suite
  test_suite_id         text NOT NULL,               -- e.g. "unit-tests" or "regression-2026-01"
  test_suite_hash       bytea NOT NULL,              -- SHA-256 of test suite
  test_case_count       int NOT NULL CHECK (test_case_count > 0),
  
  -- Results
  result_status         text NOT NULL CHECK (result_status IN ('PASS', 'FAIL')),
  passed_count          int NOT NULL DEFAULT 0,
  failed_count          int NOT NULL DEFAULT 0,
  
  -- Report
  report_blob           bytea NULL,                  -- zipped report or JSON
  report_hash           bytea NULL,
  
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_policy_test_run_version_time
  ON turing_resolve.policy_test_run(policy_version_id, run_at DESC);

COMMENT ON TABLE turing_resolve.policy_test_run IS 
  'Test execution records for policy versions. Required before SHADOW→ACTIVE promotion.';

-- ============================================================
-- TABLE: policy_decision_record
-- Links decisions to policy versions for audit
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_resolve.policy_decision_record (
  decision_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id             text NOT NULL,
  environment_id        text NOT NULL,
  
  -- Policy binding
  policy_version_id     uuid NOT NULL REFERENCES turing_resolve.policy_version(policy_version_id),
  
  -- Input commitment
  facts_hash            bytea NOT NULL,              -- SHA-256 of input facts
  feature_schema_id     text NOT NULL,
  feature_schema_version text NOT NULL,
  
  -- Decision
  decision_time         timestamptz NOT NULL,
  outcome               text NOT NULL CHECK (outcome IN ('PERMIT', 'DENY', 'REFER')),
  action_recommended    text NULL,
  reason_codes          text[] NOT NULL DEFAULT '{}',
  
  -- Trace
  trace_hash            bytea NOT NULL,              -- SHA-256 of evaluation trace
  evaluation_duration_ms int NOT NULL,
  
  -- Authorization token (if issued)
  auth_token_id         uuid NULL,
  auth_token_hash       bytea NULL,
  
  created_at            timestamptz NOT NULL DEFAULT now(),
  metadata              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_policy_decision_tenant_time
  ON turing_resolve.policy_decision_record(tenant_id, decision_time DESC);

CREATE INDEX IF NOT EXISTS idx_policy_decision_policy_version
  ON turing_resolve.policy_decision_record(policy_version_id, decision_time DESC);

COMMENT ON TABLE turing_resolve.policy_decision_record IS 
  'Decision audit trail. Links each decision to policy version and input facts.';
