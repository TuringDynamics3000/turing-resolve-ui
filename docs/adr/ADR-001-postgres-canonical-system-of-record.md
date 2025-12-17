# ADR-001: Postgres as Canonical System of Record

**Status:** Accepted  
**Date:** 2024-12-18  
**Decision Makers:** TuringDynamics Architecture Team

---

## Context

TuringDynamics requires a database that supports the cryptographic and audit requirements of verifiable governance:

- Custom domains for type safety (hash32, sigbytes)
- Triggers for deterministic sequence assignment
- Complex constraints and check expressions
- JSONB with proper indexing
- Transactional guarantees for event sourcing

The project previously considered TiDB for certain workloads. This ADR clarifies the canonical database choice.

---

## Decision

**Postgres is the canonical system of record for TuringDynamics.**

### What This Means

1. **The Postgres DDL is final.** The migrations in `drizzle/migrations/verifiable-governance/` are the authoritative schema definition.

2. **The Merkle audit trail schema is correct and appropriate.** No modifications needed for:
   - `turing_security.signing_keys`
   - `turing_audit.merkle_batch`
   - `turing_audit.merkle_event_index`
   - `turing_audit.merkle_level_chunk`
   - `turing_resolve.policy_version`
   - `turing_ml.model_version`

3. **No dual schema maintenance.** We will not maintain parallel DDL for other databases.

4. **TiDB is removed from critical-path discussions.** DB portability must not distract from:
   - Merkle sealing
   - Policy bytecode execution
   - Evidence pack verification
   - Constitutional model governance

---

## If TiDB Ever Re-enters

If TiDB is needed in the future:

- **Treat it as a derived storage or projection**
- **Never as the authority of truth**
- Sync from Postgres via CDC or event replay
- Do not store cryptographic proofs or signed artifacts in TiDB

---

## Consequences

### Positive

- Single source of truth for schema
- Full use of Postgres features (domains, triggers, JSONB, constraints)
- Simpler development and testing
- Cryptographic operations have proper type safety

### Negative

- Cannot use TiDB-specific scaling features
- Must provision Postgres for production

### Neutral

- Development environment may use different DB for convenience (non-authoritative)

---

## Compliance

This decision supports:

- **Invariant A (Authority Separation):** Postgres holds the authoritative event store
- **Invariant B (Determinism):** Triggers ensure deterministic commit_seq assignment
- **Invariant C (Proof Chaining):** Custom domains enforce hash/signature integrity

---

## References

- `drizzle/migrations/verifiable-governance/001_extensions_and_domains.sql`
- `drizzle/migrations/verifiable-governance/004_turing_audit_schema.sql`
- `docs/VERIFIABLE_GOVERNANCE_IMPLEMENTATION.md`
