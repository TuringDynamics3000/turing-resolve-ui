# Lending Core v1 — Immutable Loan Primitive

## Purpose

This module defines the **authoritative, immutable core for loans** in TuringCore.

It models:
- loan lifecycle
- loan obligations
- loan state transitions

It does **not**:
- store balances
- store schedules
- move money
- calculate repayments imperatively

All loan state is **derived by replaying immutable facts**.

---

## Non-Negotiable Rules

1. Loans do **not** store balances
2. Loans do **not** store amortisation schedules
3. Loans do **not** mutate state directly
4. All loan changes occur via `apply(fact)`
5. Replay must be deterministic
6. Interest, fees, penalties are facts
7. Cash movement happens only via Deposits Core
8. Hardship and restructure are explicit facts
9. No cron jobs mutate loans
10. No side effects, no persistence, no policies

Violation of any rule invalidates this module.

---

## Authoritative Model

### Loan State

```ts
type LoanState =
  | "OFFERED"
  | "ACTIVE"
  | "IN_ARREARS"
  | "HARDSHIP"
  | "DEFAULT"
  | "CLOSED"
  | "WRITTEN_OFF"
```

State transitions are explicit and fact-driven.

### Loan Aggregate

```ts
class Loan {
  readonly loanId: string
  readonly borrowerAccountId: string
  readonly principal: bigint
  readonly state: LoanState

  apply(fact: LoanFact): Loan
}
```

The only way to change loan state is:

```ts
loan = loan.apply(fact)
```

No mutation is permitted.

---

## Loan Facts (Authoritative)

All lifecycle changes are represented as facts.

Required fact types:

- `LOAN_OFFERED`
- `LOAN_ACCEPTED`
- `LOAN_ACTIVATED`
- `LOAN_PAYMENT_APPLIED`
- `INTEREST_ACCRUED`
- `FEE_APPLIED`
- `LOAN_IN_ARREARS`
- `HARDSHIP_ENTERED`
- `HARDSHIP_EXITED`
- `LOAN_RESTRUCTURED`
- `LOAN_DEFAULTED`
- `LOAN_CLOSED`
- `LOAN_WRITTEN_OFF`

Nothing is inferred.
Nothing is implicit.

---

## Cash Movement Rule (Critical)

**Lending never moves money directly.**

All cash movement occurs via Deposits Core.

| Lending Event | Deposit Interaction |
|---------------|---------------------|
| Loan disbursement | CREDIT borrower deposit |
| Repayment | DEBIT borrower deposit |
| Interest accrual | No cash movement |
| Fees / penalties | No cash movement |
| Write-off | No cash movement |

Lending records obligations only.

---

## Schedules Are Derived

Amortisation schedules are:

- derived
- deterministic
- replayable
- disposable

They are never stored.

```ts
deriveSchedule(facts, terms, asOfDate)
```

Derived schedules:

- must not mutate state
- must not emit facts
- must be reproducible from facts alone

---

## Invariants

All invariants live in one place.

Examples:

- Principal never negative
- Illegal state transitions throw
- Cannot apply repayment before activation
- Cannot exit hardship without entering it
- Cannot write off an active loan

Invariant breach must throw.

---

## Replay

Loan state must be reconstructible using:

```ts
rebuildFromFacts(facts: LoanFact[]): Loan
```

Replay guarantees:

- same facts → same loan state
- invariant enforcement
- order-dependent correctness

---

## Forbidden

This module must never contain:

- ❌ DB access
- ❌ HTTP
- ❌ Kafka
- ❌ Schedulers
- ❌ Interest calculators
- ❌ Amortisation tables
- ❌ Cron jobs
- ❌ Balance fields
- ❌ Policy logic

---

## Governance

This module is frozen by default.

Any change requires:

- ADR
- replay test update
- invariant review
- owner approval

---

## Summary

Lending Core v1 defines loan truth, not convenience.

If this module becomes mutable, implicit, or schedule-centric,
it will become the weakest link in the system.

That is not acceptable.
