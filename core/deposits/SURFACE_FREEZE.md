# Deposits Core v1 - Surface Freeze Declaration

## Status: 🟢 FROZEN

**Effective Date:** 2024-12-16
**Version:** v1.0.0
**Authority:** Platform Engineering

---

## Declaration

As of the effective date, the Deposits Core v1 surface is **FROZEN**.

This means:

1. **No new public exports** without formal review
2. **No changes to existing exports** without breaking change process
3. **No modifications to invariants** without compliance approval
4. **No edits to released policy versions** - create new versions instead

---

## Frozen Surface

The following are part of the frozen public API:

### Aggregates
- `DepositAccount`
- `Balance`
- `Hold`

### Ledger Primitives
- `Money`
- `Posting` (and all variants)
- `Postings` factory

### Events
- `DepositFact` (and all variants)
- `Facts` factory
- `rebuildFromFacts`
- `validateFactSequence`

### Invariants
- `applyPosting`
- `applyPostings`
- `validateAccountState`
- `canApplyPosting`

### Errors
- All error classes
- `ErrorCodes`

---

## What This Enables

With this freeze in place:

### You CAN:
- ✅ Add new **policies** (versioned, in `/policies/`)
- ✅ Add new **handlers** (in `/application/`)
- ✅ Add new **adapters** (in `/adapters/`)
- ✅ Add new **tests** (always welcome)
- ✅ Fix **documentation**

### You CANNOT:
- ❌ Modify core invariants
- ❌ Add new posting types
- ❌ Change serialization format
- ❌ Add side effects to core
- ❌ Import external dependencies into core

---

## Enforcement

### CI Gates
- All tests must pass
- No imports from outside `/core/deposits/`
- No side effects detected
- CODEOWNERS approval required

### Code Review
- All PRs touching `/core/deposits/` require:
  - @deposits-core-maintainers approval
  - @platform-leads approval (for invariant changes)
  - @compliance approval (for balance-affecting changes)

### Monitoring
- Any balance discrepancy triggers alert
- Shadow mode comparison runs continuously
- Replay proof runs on every deployment

---

## Exception Process

If a change to the frozen surface is absolutely necessary:

1. Create RFC document explaining:
   - Why the change is necessary
   - Why it cannot be done in policy/application layer
   - Impact assessment
   - Rollback plan

2. Get approvals from:
   - Platform Lead
   - Compliance (if balance-affecting)
   - Legal (if regulatory implications)

3. Schedule change window with:
   - On-call team notified
   - Rollback ready
   - Monitoring enhanced

---

## Governance Guarantee

> "If it changes balances and doesn't go through Deposits Core v1, it's a bug."

This guarantee is enforced by:
- Architecture (core has no external dependencies)
- Testing (44+ tests, replay proof)
- Process (CODEOWNERS, breaking change checklist)
- Monitoring (shadow mode, balance reconciliation)

---

## Signatures

| Role | Name | Date |
|------|------|------|
| Platform Lead | _________________ | 2024-12-16 |
| Compliance | _________________ | 2024-12-16 |
| Engineering | _________________ | 2024-12-16 |

---

## Revision History

| Version | Date | Change |
|---------|------|--------|
| 1.0.0 | 2024-12-16 | Initial freeze |
