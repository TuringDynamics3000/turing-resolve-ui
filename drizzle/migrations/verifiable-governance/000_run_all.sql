-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Master Migration: Run All
-- ============================================================
-- 
-- Two options for running migrations:
--
-- OPTION A: Use consolidated single-file migration (RECOMMENDED)
--   psql "$DATABASE_URL" -f merkle.sql
--
-- OPTION B: Use numbered migrations (for incremental upgrades)
--   \i 001_extensions_and_domains.sql
--   \i 002_turing_security_schema.sql
--   \i 003_event_store_columns.sql
--   \i 004_turing_audit_schema.sql
--   \i 005_turing_resolve_schema.sql
--   \i 006_turing_ml_schema.sql
--
-- The consolidated merkle.sql is functionally equivalent to
-- running all numbered migrations in sequence.
-- ============================================================

-- Run consolidated migration
\i merkle.sql

-- Verify schemas created
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name IN ('turing_security', 'turing_core', 'turing_audit', 'turing_resolve', 'turing_ml')
ORDER BY schema_name;

-- Verify tables created
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_schema IN ('turing_security', 'turing_core', 'turing_audit', 'turing_resolve', 'turing_ml')
ORDER BY table_schema, table_name;
