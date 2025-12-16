# Member Loans — Read-Only Truth Surface

This UI renders loan information derived exclusively from immutable LoanFacts.

## Invariants (Enforced by CI)

1. **Member UI is read-only** - No write endpoints, no mutations
2. **No balance/schedule computation in UI** - All state from replay
3. **All state rendered from replay of immutable facts** - No local computation
4. **Derived schedules are labelled "derived"** - Clear disclaimer
5. **Pending ≠ Failed ≠ Settled** - Explicit copy for each state

## What This UI Cannot Do

- Initiate payments
- Change loan state
- Request hardship
- Restructure loans
- Trigger collections

## What This UI Shows

All values shown are either:
- **Replayed state** - Derived from immutable facts
- **Explicitly labelled derived outputs** - Schedules, estimates

## Mandatory Member Copy

Use these strings verbatim:

- **Pending**: "Funds have not moved yet."
- **In Arrears**: "This reflects missed obligations. No additional fees are applied unless confirmed."
- **Hardship**: "Your loan is under an approved hardship arrangement."
- **Restructured**: "Your future obligations were updated. Past payments remain unchanged."

## CI Guards

The following checks enforce read-only invariants:

```bash
# Member loan UI must not call write endpoints
grep -R "POST\\|PUT\\|PATCH\\|DELETE" client/src/pages/member/loans && exit 1

# Member loan UI must not import core
grep -R "core/lending" client/src/pages/member/loans && exit 1

# Member loan UI must not compute balances
grep -R "calculate\\|compute\\|reduce" client/src/pages/member/loans && exit 1
```

## Components

- **LoansOverview.tsx** - List all member loans
- **LoanDetail.tsx** - Single loan view with facts timeline
- **DerivedSchedule.tsx** - Estimated repayment schedule (labelled "derived")
- **banners/MemberLoanTruthBanner.tsx** - Truth surface disclaimer

## Acceptance Criteria

Member Loan UI is complete only if:

1. Loans are visible without action buttons
2. Loan state matches replay output exactly
3. Derived schedule is clearly labelled
4. Removing projections does not change output
5. CI blocks any write or computation attempt

## Final State

With this in place, you now have:

- Member truth surfaces (accounts, payments, loans)
- Operator control & governance
- Immutable, replayable lending
- Regulator-grade evidence exports
- CI-enforced safety across all domains
