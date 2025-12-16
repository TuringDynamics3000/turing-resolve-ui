# CORE INTEGRATION BLUEPRINT

**Wiring Risk Brain v1 → TuringCore (A) Under the Turing Protocol**

This preserves:
- ✅ **A = deterministic system of record**
- ✅ **B = probabilistic intelligence only**
- ✅ **Protocol = the sole lawful interface**
- ✅ **No AI ever writes balances**
- ✅ **All escalation is policy-gated**
- ✅ **All outcomes are replayable**

---

## 1️⃣ The Only Integration Contract Between A and B

There are exactly two legal directions of flow:

### ✅ A → B (Facts Only, via Events)

A emits immutable domain events to the Protocol bus:

| Domain | Key Events |
|--------|------------|
| **Payments** | PaymentInitiated, PaymentSubmittedToRail, PaymentSettled, PaymentFailed |
| **Cards** | CardAuthorisationRequested, CardAuthorisationApproved, Declined |
| **Ledger** | AccountBalanceUpdated, TransactionPosted |
| **Credit** | LoanRepaymentMade, LoanRepaymentMissed |
| **Hardship** | HardshipArrangementEntered |
| **AML** | CashDepositObserved, IntlTransferInitiated |
| **Treasury** | IntradaySettlementPositionUpdated, LiquidityReservationUpdated |

**These are:**
- ✅ Hashed
- ✅ Versioned
- ✅ RedBelly anchored
- ✅ Tenant-scoped

### ✅ B → A (Intelligence Only, via Proposed Events)

B is only allowed to send these five categories back to A:

| Category | Examples |
|----------|----------|
| **ML Scores** | FraudRiskScoreProduced, AmlRiskScoreProduced, HardshipRiskScoreProduced |
| **RL Evaluations** | RlPolicyEvaluated, RlTreasuryPolicyEvaluated |
| **AI Explanations** | AiExplanationGenerated |
| **Advisories** | FraudAdvisoryIssued, RlRoutingAdvisoryIssued |
| **Governance** | ModelAuthorityLevelChanged |

### ⚠️ B is categorically forbidden from emitting:

- `TransactionPosted`
- `PaymentSubmittedToRail`
- `AccountRestrictionApplied`
- `TreasuryTransferInitiated`

**Those can only originate inside A.**

---

## 2️⃣ Deterministic Policy Gateways Inside A (Critical)

Inside TuringCore, you now implement **Policy Gateways** for each Risk Brain domain.

These are pure functions:

```
Policy(event_from_B, current_state) → Allowed A-domain command OR No-op
```

### A) Fraud Policy Gateway

**INPUT:** `FraudRiskScoreProduced`

**RULE:**
```
IF score ≥ 0.90 AND CU_policy.auto_block_enabled = TRUE
THEN emit AutoBlockAuthorisationIssued
ELSE emit HighFraudRiskFlagRaised
```

**This ensures:**
- ✅ ML does not block
- ✅ Only policy can authorise
- ✅ Humans can still override

### B) AML Policy Gateway

**INPUT:** `AmlRiskScoreProduced`

**RULE:**
```
IF score ≥ 0.85
THEN emit HighAmlRiskFlagRaised
```

**From here:**

Only human investigators can create:
- `SuspiciousMatterReportSubmitted`
- `AccountRestrictionAuthorised`

### C) Hardship Policy Gateway

**INPUT:** `HardshipRiskScoreProduced`

**RULE:**
```
IF score ≥ 0.75
THEN emit HardshipRiskFlagRaised
```

**Only humans can then initiate:**
- `ProactiveCustomerOutreachInitiated`
- `HardshipArrangementEntered`

### D) Payments RL Policy Gateway (Advisory Only)

**INPUT:** `RlPolicyEvaluated`

**RULE:**
```
IF mode = ADVISORY
THEN emit RlRoutingAdvisoryIssued
```

**Never:**
- No auto-routing
- No settlement triggers

### E) Treasury RL Policy Gateway (Advisory Only)

**INPUT:** `RlTreasuryPolicyEvaluated`

**RULE:**
```
IF confidence ≥ CU_policy.min_confidence
THEN emit RlTreasuryAdvisoryIssued
```

**Only humans can trigger:**
- `TreasuryTransferInitiated`

---

## 3️⃣ The "No-AI-Writes-Money" Enforcement Layer

You must add a hard enforcement layer inside TuringCore:

### ✅ AI-Originated Command Blocker

Every incoming command is stamped:

```
origin = HUMAN | SYSTEM | AI
```

**If:**
```
origin = AI
AND command touches:
- Ledger
- Settlement
- Treasury
- Account restrictions
```

**→ Command is rejected at the Protocol boundary.**

**This makes your architecture:**
- ✅ Unbreakable
- ✅ Court-defensible
- ✅ Regulator-proof

---

## 4️⃣ Unified Read Models for Risk Brain in A

A must expose read-only projections that B can subscribe to:

| Read Model | Used By |
|------------|---------|
| **PaymentFlowProjection** | Payments RL |
| **FraudGraphProjection** | Fraud Dark Graph |
| **CustomerStressProjection** | Hardship ML |
| **AmlBehaviourProjection** | AML |
| **IntradayLiquidityProjection** | Treasury RL |

**These projections are:**
- ✅ Built from Protocol events only
- ✅ Never updated by ML
- ✅ Time-travel safe

---

## 5️⃣ Protocol Schema Additions You Must Now Lock

These become core canonical schema in TuringCore:

### ML Events
- `FraudRiskScoreProduced`
- `AmlRiskScoreProduced`
- `HardshipRiskScoreProduced`

### RL Events
- `RlPolicyEvaluated`
- `RlTreasuryPolicyEvaluated`
- `RlRewardAttributed`

### AI Events
- `AiExplanationGenerated`

### Governance Events
- `ModelAuthorityLevelChanged`
- `ModelDeployed`
- `ModelRolledBack`

**These live in:**
```
/turing_protocol/schemas/intelligence/
```

**And are versioned exactly like payments and postings.**

---

## 6️⃣ Posting Engine Remains the Only Money Writer

You must explicitly codify:

> **All financial state changes must originate from the Posting Engine.**

**There is no exception for:**
- Fraud
- AML
- Hardship
- Treasury
- Payments RL

**Even treasury actions must create:**
```
TreasuryTransferInitiated → PostingEngine → TreasuryTransferSettled
```

---

## 7️⃣ Audit, Replay, and Legal Defensibility

With this integration, you can now replay any incident fully:

### Example: Fraud Block Replay

```
CardAuthorisationRequested
→ FraudRiskScoreProduced (from B)
→ HighFraudRiskFlagRaised (A policy)
→ HumanOverrideApproved
→ AutoBlockAuthorisationIssued
→ CardAuthorisationDeclined
```

**You can prove:**
- ✅ ML detected
- ✅ Policy authorised
- ✅ Human approved
- ✅ Core executed
- ✅ Scheme declined

**That's admissible under:**
- ASIC
- AUSTRAC
- Civil litigation

---

## 8️⃣ What You Have Now Achieved Technically

By wiring Risk Brain v1 into A this way, you have built:

- ✅ **A bank core that is AI-aware but not AI-controlled**
- ✅ **A national intelligence layer that is powerful but legally contained**
- ✅ **A Protocol that governs humans, systems, and machines equally**
- ✅ **A future-proof separation that Tier-1 banks do not yet have**

**This is the architecture that lets you:**
- Sell A as a safer replacement core
- Sell B as a high-margin national overlay
- Survive regulatory scrutiny at scale

---

## Implementation Checklist

### Phase 1: Protocol Schema Lock
- [ ] Add ML/RL/AI event schemas to `/turing_protocol/schemas/intelligence/`
- [ ] Version all intelligence events
- [ ] Add RedBelly audit anchoring for intelligence events

### Phase 2: Policy Gateways
- [ ] Implement Fraud Policy Gateway in TuringCore
- [ ] Implement AML Policy Gateway in TuringCore
- [ ] Implement Hardship Policy Gateway in TuringCore
- [ ] Implement Payments RL Policy Gateway in TuringCore
- [ ] Implement Treasury RL Policy Gateway in TuringCore

### Phase 3: AI-Originated Command Blocker
- [ ] Add `origin` field to all commands
- [ ] Implement command blocker at Protocol boundary
- [ ] Test blocker with AI-originated ledger commands
- [ ] Test blocker with AI-originated settlement commands

### Phase 4: Read Model Projections
- [ ] Build PaymentFlowProjection for Payments RL
- [ ] Build FraudGraphProjection for Fraud Dark Graph
- [ ] Build CustomerStressProjection for Hardship ML
- [ ] Build AmlBehaviourProjection for AML
- [ ] Build IntradayLiquidityProjection for Treasury RL

### Phase 5: Posting Engine Enforcement
- [ ] Codify "Posting Engine is the only money writer" rule
- [ ] Add enforcement checks in ledger module
- [ ] Add enforcement checks in settlement module
- [ ] Add enforcement checks in treasury module

### Phase 6: Audit & Replay
- [ ] Implement full event replay for fraud incidents
- [ ] Implement full event replay for AML investigations
- [ ] Implement full event replay for hardship cases
- [ ] Implement full event replay for treasury actions
- [ ] Generate regulator-ready audit packs

### Phase 7: Production Readiness
- [ ] 60 shadow days clean for all Risk Brain modules
- [ ] Zero AI-originated ledger writes
- [ ] Zero AI-originated settlement actions
- [ ] Full audit trail for all ML/RL/AI outputs
- [ ] Board + regulator sign-off

---

## Success Criteria

**You have successfully integrated Risk Brain v1 into TuringCore when:**

1. ✅ All Risk Brain outputs are Protocol events
2. ✅ No AI ever writes balances
3. ✅ All escalation is policy-gated
4. ✅ All outcomes are replayable
5. ✅ Posting Engine is the only money writer
6. ✅ AI-originated commands are blocked at Protocol boundary
7. ✅ Full audit trail exists for all ML/RL/AI decisions
8. ✅ Regulator can replay any incident end-to-end

**This is the architecture that makes TuringCore + Risk Brain v1 the most advanced, legally defensible, AI-aware banking platform in the world.**
