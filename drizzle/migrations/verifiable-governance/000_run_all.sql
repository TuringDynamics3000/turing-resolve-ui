-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Master Migration: Run All
-- ============================================================
-- Execute this file to run all migrations in order.
-- Alternatively, run each numbered file individually.
--
-- Order:
--   001_extensions_and_domains.sql  - pgcrypto, hash32, sigbytes
--   002_turing_security_schema.sql  - Key registry
--   003_event_store_columns.sql     - Event store additions
--   004_turing_audit_schema.sql     - Merkle audit trail
--   005_turing_resolve_schema.sql   - Policy registry
--   006_turing_ml_schema.sql        - Model registry
-- ============================================================

-- Run migrations in order
\i 001_extensions_and_domains.sql
\i 002_turing_security_schema.sql
\i 003_event_store_columns.sql
\i 004_turing_audit_schema.sql
\i 005_turing_resolve_schema.sql
\i 006_turing_ml_schema.sql

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
