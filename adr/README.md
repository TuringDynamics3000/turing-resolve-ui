# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records for TuringDynamics Core.

## What is an ADR?

An ADR is a document that captures an important architectural decision made along with its context and consequences.

## When to write an ADR?

Write an ADR when making decisions that:

- Affect the core architecture (especially `core/lending/`, `core/deposits/`, `core/payments/`)
- Introduce new patterns or principles
- Change existing frozen architectures
- Have long-term implications
- Are difficult to reverse

## ADR Format

Use the template in `0000-template.md`. Each ADR should include:

1. **Context** - What forces are at play?
2. **Decision** - What did we decide?
3. **Consequences** - What are the trade-offs?
4. **Alternatives** - What else did we consider?

## Naming Convention

```
NNNN-brief-title.md
```

Examples:
- `0001-lending-core-freeze.md`
- `0042-add-loan-product-types.md`
- `0103-switch-to-kafka-for-fact-streaming.md`

## ADR Lifecycle

1. **Proposed** - Under discussion
2. **Accepted** - Approved and implemented
3. **Deprecated** - No longer recommended
4. **Superseded** - Replaced by a newer ADR

## Frozen Modules Requiring ADRs

The following modules are frozen and require an ADR for any changes:

- **Lending Core** (`core/lending/`) - Frozen by ADR-0001
- **Deposits Core** (`core/deposits/`) - Frozen (TBD)
- **Payments Core** (`core/payments/`) - Frozen (TBD)

Changes to application, UI, policy, or intelligence layers do **not** require ADRs.

## CI Enforcement

The composite CI workflow (`.github/workflows/lending-composite.yml`) enforces ADR requirements:

- PRs touching `core/lending/` must include a new ADR
- CI fails if ADR is missing
- ADRs are immutable once accepted

## References

- [ADR Template](0000-template.md)
- [ADR-0001: Lending Core Freeze](0001-lending-core-freeze.md)
- [Lending Core README](/core/lending/README.md)
