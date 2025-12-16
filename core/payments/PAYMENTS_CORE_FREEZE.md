# Payments Core v1 - Surface Freeze Declaration

**Status:** FROZEN  
**Effective Date:** 2024-12-16  
**Version:** 1.0.0

## Executive Summary

Payments Core v1 is a deterministic payment state machine that emits deposit postings. It never mutates balances directly. This is the line between fintech plumbing and banking infrastructure.

## Non-Negotiable Rules (Structurally Enforced)

| Rule | Enforcement |
|------|-------------|
| Payments Core cannot import DB, Kafka, HTTP | Import analysis in CI |
| Payments Core cannot touch Money, Balance, or Hold internals | Type system |
| Payments Core cannot change balances | Architecture (no balance access) |
| All money movement via Deposits Core postings | Handler pattern |
| Payment state ≠ account state | Separate aggregates |

## Dependency Rule

```
core/payments → core/deposits   ✅ ALLOWED
core/deposits → core/payments   ❌ FORBIDDEN
```

One-way dependency only. If this is violated, the architecture has failed.

## Frozen Public Surface

The following exports are the ONLY supported API:

### Aggregate
- `Payment` - Immutable payment entity
- `rebuildPaymentFromFacts()` - Deterministic replay

### State Machine
- `PaymentState` - Type for all states
- `isValidTransition()` - Transition validation
- `isTerminalState()` - Terminal state check
- `getValidNextStates()` - Valid transitions

### Facts
- `PaymentFact` - Union of all fact types
- `PaymentFacts` - Factory functions
- `validatePaymentFactSequence()` - Sequence validation

### Commands
- `PaymentCommand` - Union of all command types
- `PaymentCommands` - Factory functions

### Errors
- `PaymentError` - Domain error type

## Payment Intent → Deposit Posting Mapping

| Payment Intent | Deposit Posting |
|---------------|-----------------|
| Reserve funds | HOLD_PLACED |
| Release funds | HOLD_RELEASED |
| Execute debit | DEBIT |
| Execute credit | CREDIT |
| Refund | CREDIT |
| Cancel | HOLD_RELEASED |

Payments Core never combines these. Each intent maps to exactly one posting type.

## Breaking Change Requirements

Any modification to frozen surface requires:

1. **Migration Plan** - How existing payments will be handled
2. **Replay Validation** - Prove all existing facts still replay correctly
3. **Version Bump** - Increment to v1.1.0 or v2.0.0
4. **Regulatory Review** - If balance-affecting logic changes
5. **PE/Board Notification** - For any state machine changes

## What Payments Core Does NOT Do

- ❌ Fee calculation
- ❌ FX conversion
- ❌ Routing logic
- ❌ Scheme rules (NPP, ACH, SEPA)
- ❌ Fraud decisions
- ❌ Balance projections
- ❌ Timeouts
- ❌ Retries

These live in policies, application layer, or adapters.

## Failure Semantics

### Deposits Core Failure
- Payment stays in current state
- Failure fact emitted
- Nothing half-applied

### External Network Failure
- Payment may be SENT but not SETTLED
- Hold remains
- Deterministic retry possible

This is bank-grade behaviour.

## Strategic Value

With this design, we can truthfully state:

> "Payments cannot corrupt balances"

> "All money movement is provable"

> "We can replay deposits + payments end-to-end"

> "We can safely add cards without rewriting deposits"

---

**Approved By:** Architecture Review Board  
**Next Review:** 2025-06-16
