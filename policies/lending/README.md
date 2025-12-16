# Lending Policy Layer

**CRITICAL: Policies are pure functions that produce recommendations only.**

## Hard Rules

1. **Policies consume LoanFacts + DepositFacts**
2. **Policies produce recommended LoanFacts**
3. **Policies NEVER apply facts**
4. **Policies NEVER mutate state**

## Policy Modules

### CreditPolicy.v1.ts
- **Purpose:** Credit risk assessment for loan applications
- **Input:** Applicant account, requested principal/term, deposit history, existing loans
- **Output:** APPROVE/REVIEW/DECLINE recommendation with risk score
- **Replaces:** HES "automated underwriting"

### ArrearsPolicy.v1.ts
- **Purpose:** Arrears management and collection workflow
- **Input:** Loan facts, current date
- **Output:** Arrears action recommendation (enter arrears, escalate, offer hardship, write-off review)
- **Replaces:** HES "collection workflows"

### HardshipPolicy.v1.ts
- **Purpose:** Hardship eligibility assessment
- **Input:** Loan facts, borrower financial situation
- **Output:** Hardship eligibility + recommended type (payment pause, reduced payments, interest-only)
- **Replaces:** Manual hardship assessment

### PricingPolicy.v1.ts (TODO)
- **Purpose:** Interest rate and fee pricing
- **Input:** Risk score, market rates, loan terms
- **Output:** Recommended rate and fees

### RepaymentPolicy.v1.ts (TODO)
- **Purpose:** Repayment schedule recommendations
- **Input:** Loan terms, borrower cash flow
- **Output:** Recommended payment frequency and amount

## Architecture

```
┌─────────────────┐
│   Loan Facts    │
│  Deposit Facts  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Policy Layer   │  ← Pure functions
│  (Recommend)    │  ← No side effects
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Operator UI    │  ← Human reviews
│  (Decide)       │  ← Human approves
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Application    │  ← Emits facts
│  Handlers       │  ← Executes decision
└─────────────────┘
```

## Why This Is State-of-the-Art

**vs HES (Automated Underwriting):**
- HES: Black-box decision, no audit trail
- TuringCore: Transparent policy, full audit trail

**vs Manual Processes:**
- Manual: Inconsistent, slow, error-prone
- TuringCore: Consistent, fast, deterministic

**vs Traditional Core Banking:**
- Traditional: Policies embedded in code, hard to change
- TuringCore: Policies as data, versioned, auditable

## Usage Example

```typescript
import { evaluateCreditPolicy } from "./CreditPolicy.v1";

// Policy produces recommendation
const recommendation = evaluateCreditPolicy({
  applicantAccountId: "ACC-001",
  requestedPrincipal: BigInt(100000),
  requestedTermMonths: 360,
  depositFacts: [...],
  existingLoanFacts: [...],
});

// Operator reviews recommendation
console.log(recommendation);
// {
//   decision: "APPROVE",
//   confidence: 0.9,
//   rationale: "Low risk score (25). Strong deposit health...",
//   recommendedPrincipal: 100000n,
//   recommendedRate: 0.055,
//   riskScore: 25
// }

// Operator approves → Application handler emits fact
await offerLoan({
  borrowerAccountId: "ACC-001",
  principal: recommendation.recommendedPrincipal,
  interestRate: recommendation.recommendedRate,
  termMonths: recommendation.recommendedTermMonths,
});
```

## Testing

All policies MUST have property tests:

- **Deterministic:** Same input → same output
- **No side effects:** No state mutation, no I/O
- **Bounded:** Output confidence always 0-1
- **Explainable:** Rationale always provided

## Versioning

Policies are versioned (e.g., `CreditPolicy.v1.ts`, `CreditPolicy.v2.ts`).

**Migration strategy:**
1. Deploy new policy version alongside old
2. Run both in shadow mode
3. Compare outputs
4. Switch traffic to new version
5. Deprecate old version after 90 days

This ensures policy changes are auditable and reversible.
