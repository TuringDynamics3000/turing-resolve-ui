# ADR-0001: Lending Core Architectural Freeze

**Status:** Accepted  
**Date:** 2024-12-16  
**Deciders:** TuringDynamics Engineering Team  
**Tags:** lending, architecture, governance

---

## Context

Lending Core v1 has reached production-readiness with fact-based architecture, deterministic replay, and immutable aggregates. The core module handles loan lifecycle (origination, activation, repayment, hardship, closure) with strict invariants enforced at the aggregate boundary.

As the system scales to multiple CUs and regulatory scrutiny increases, we need to prevent architectural drift that could compromise:

- **Deterministic replay** (ability to rebuild loan state from facts)
- **Audit trail integrity** (cryptographic evidence packs)
- **Cash movement safety** (all cash flows via Deposits Core)
- **AI advisory separation** (AI recommends, humans decide)

Without guardrails, developers might introduce anti-patterns such as:

- Storing derived state (balances, schedules) in the core
- Direct database access from core modules
- Cross-core imports (Lending → Deposits/Payments)
- AI execution (AI emitting facts instead of recommendations)
- Cron-based state mutations (non-deterministic timing)

## Decision

We freeze the Lending Core architecture and enforce it via composite CI workflow.

**Frozen Principles:**

1. **No stored balances or schedules** - All derived from facts
2. **No database imports in core** - Use application layer
3. **No cross-core imports** - Use application layer for orchestration
4. **No cron/schedulers in core** - External triggers emit facts
5. **AI is advisory-only** - Never emits LoanFacts
6. **Cash movement via Deposits Core only** - No direct ledger postings
7. **ADR required for core changes** - Document all architectural decisions

**Implementation:**

- CI workflow (`.github/workflows/lending-composite.yml`) runs on all PRs touching `core/lending/`
- Workflow blocks merge if:
  * Forbidden patterns detected (DB, schedules, balances, cron)
  * Core boundaries violated (cross-core imports, UI imports)
  * ADR missing for core changes
  * Required tests missing or failing
  * AI execution detected

## Consequences

### Positive

- **Architectural integrity preserved** - Anti-patterns blocked at CI
- **Replay determinism guaranteed** - No stored state, no timing dependencies
- **Audit trail immutable** - Facts are the source of truth
- **Cash movement safety** - All flows via Deposits Core
- **AI advisory separation** - AI cannot execute actions
- **Documentation enforced** - ADRs required for core changes
- **Regulatory confidence** - Frozen architecture easier to audit

### Negative

- **Slower feature velocity** - ADR overhead for core changes
- **Learning curve** - New developers must understand frozen principles
- **Refactoring friction** - Core changes require ADR justification

### Neutral

- **Application layer flexibility** - Freeze only applies to core
- **Derivation layer freedom** - Schedule calculators can evolve
- **UI layer independence** - Operator UI can change freely

## Alternatives Considered

### Option A: No freeze, rely on code review
- **Pros:** Faster development, less overhead
- **Cons:** Architectural drift inevitable, no automated enforcement
- **Why rejected:** Code review is insufficient for architectural governance at scale

### Option B: Freeze entire lending module (core + application + UI)
- **Pros:** Maximum stability
- **Cons:** Stifles innovation, blocks UI improvements
- **Why rejected:** Too restrictive, application/UI layers should remain flexible

### Option C: Manual ADR process without CI enforcement
- **Pros:** Lightweight, no CI overhead
- **Cons:** ADRs easily forgotten, no automated verification
- **Why rejected:** Unenforceable, defeats the purpose

## References

- [Lending Core v1 README](/core/lending/README.md)
- [Lending Policy Layer](/policies/lending/README.md)
- [Lending Operator UI](/client/src/pages/operator/lending/)
- [CI Workflow](/.github/workflows/lending-composite.yml)

---

## Notes

- This ADR establishes the freeze; future core changes require new ADRs
- Application layer (`application/lending/`) is NOT frozen
- Derivation layer (`core/lending/derivation/`) can evolve (schedules are derived, not stored)
- UI layer (`client/src/pages/operator/lending/`) can evolve freely
- Policy layer (`policies/lending/`) can evolve (policies are pure functions)
- Intelligence layer (`intelligence/lending/`) can evolve (AI advisors are recommendations)
