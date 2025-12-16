# Hardship AI Pipeline - Production Grade

**Reference architecture for all AI in TuringCore (fraud, payments RL, AML, etc.)**

## Overview

This is a production-hardened AI pipeline for early hardship detection with strict architectural boundaries, event-driven ML scoring, bank-grade feature store, and mandatory human-in-the-loop controls.

**Key Principles:**
- **No ML bypasses ledger controls**
- **No probabilistic money movement**
- **No AI auto-contacts customers**
- **Full human-in-the-loop compliance**
- **Complete audit trail**

## Architecture

### Hard Architectural Boundaries (Non-Negotiable)

| Layer | Allowed To Do | Forbidden |
|-------|---------------|-----------|
| **A – TuringCore** | Ledger, balances, postings, legal state | ❌ No ML training<br>❌ No GenAI<br>❌ No probabilistic logic |
| **B – Intelligence** | Feature engineering, ML, AI, RL | ❌ No balance updates<br>❌ No settlement<br>❌ No posting |
| **Protocol Bus** | Immutable events, commands, replay | ❌ No ad-hoc DB writes |

**Every AI component is a client of the Turing Protocol — never a shortcut around it.**

## Event Flow

### 1. Layer A Events (TuringCore Financial Events)

Production-grade canonical events emitted by TuringCore:

- `IncomePosted` - Income posted to customer account
- `AccountBalanceUpdated` - Account balance changed
- `LoanRepaymentMade` - Loan repayment successfully made
- `LoanRepaymentMissed` - Loan repayment missed or failed
- `DirectDebitReturned` - Direct debit payment returned/dishonoured
- `CardAuthorisation` - Card transaction authorised
- `CustomerStatusChanged` - Customer status changed

**All events include:**
- `event_id` (UUID v7)
- `aggregate_id` (customer/account)
- `tenant_id` (CU)
- `schema_version`
- `occurred_at`
- `hash_prev_event` (for chain integrity)

**Event storage:**
- Kafka / MSK (immutable event log)
- Backed by RedBelly / audit hash anchoring

### 2. Feature Store (Bank-Grade)

**Core Feature Groups:**

| Group | Features |
|-------|----------|
| **Income** | volatility_30d, volatility_90d, income_drop_rate |
| **Spending** | discretionary_spend_growth, essential_spend_ratio |
| **Liquidity** | min_balance_14d, overdraft_frequency |
| **Credit** | missed_payments_30d, repayment_buffer |
| **Stress** | failed_dd_count, merchant_risk_drift |

**Requirements:**
- ✅ Tenant isolation (per CU)
- ✅ Time-travel features (for replay)
- ✅ Feature versioning
- ✅ Training vs inference parity
- ✅ Full provenance

**All features computed ONLY from Layer A events — never scraped balances.**

### 3. ML Model Service (Production Hardened)

**Model Class:**
- Binary classifier: P(hardship in next 45-90 days)
- Gradient boosting (XGBoost / LightGBM)
- Monotonic constraints for regulatory explainability

**Mandatory Production Controls:**

| Control | Status |
|---------|--------|
| Model registry | ✅ Versioned |
| Training data snapshot immutability | ✅ |
| Feature drift detection | ✅ |
| Prediction drift | ✅ |
| Performance decay alerts | ✅ |
| Bias testing | ✅ |
| Model rollback | ✅ |

### 4. Layer B Event (ML Intelligence)

**MlScoreProduced Event:**

```python
@dataclass
class MlScoreProduced:
    customer_id: str
    tenant_id: str
    score_type: str = "hardship"
    score_value: float  # 0.0 to 1.0
    model_id: str
    model_version: str
    feature_set_version: str
    input_feature_hash: str
    confidence_interval: Dict[str, float]
```

**This is:**
- ✅ Immutable
- ✅ Auditable
- ✅ Replayable
- ✅ Court-admissible

### 5. Deterministic Business Rules (Layer A Only)

**Rule:**
```python
IF score_value >= 0.75
AND customer.status NOT IN {"hardship", "insolvent"}
THEN emit HardshipRiskFlagRaised
```

**This rule is:**
- ✅ Versioned
- ✅ Testable
- ✅ Deterministic
- ✅ NOT ML
- ✅ Board-approved

### 6. GenAI Explainer (Safe Zone Use)

Runs ONLY after a `HardshipRiskFlagRaised` event exists.

**Input:**
- Last 90 days of events
- Feature vector
- Business rule ID
- Score

**Output Event:**
```python
@dataclass
class AiExplanationGenerated:
    subject: str = "Hardship Risk"
    customer_id: str
    source_event_ids: List[str]
    model_id: str
    prompt_hash: str
    output_hash: str
    storage_ref: str  # S3/GCS WORM-locked bucket
```

### 7. Human-in-the-Loop (Mandatory)

**From this point, only humans can act:**
- Collections officer
- Hardship specialist
- Supervisor override

**Every action is a Protocol command:**
- `ProactiveCustomerOutreachInitiated`
- `HardshipArrangementProposed`
- `HardshipArrangementApproved`
- `HardshipArrangementRejected`

**No AI auto-contacts customers. Ever.**

### 8. Ledger Impact (Only After Human Approval)

**Only after `HardshipArrangementEntered` event can the posting engine execute:**
- Interest concessions
- Repayment reschedule
- Fee suppression

**This keeps:**
- ✅ ASIC safe-harbour
- ✅ Customer consent validity
- ✅ Legal enforceability

## Invariants

### 1. ML Score Has Provenance
Every `MlScoreProduced` event has a corresponding feature vector with matching `input_feature_hash`.

### 2. No Ledger Impact Without Human Approval
No `HardshipArrangementEntered` event exists without a corresponding `HardshipArrangementApproved` event.

### 3. No ML Direct Ledger Impact
`MlScoreProduced` events never directly trigger ledger impacts. They must go through deterministic business rules and human approval.

### 4. Full Audit Trail
Every AI-influenced decision has a complete audit trail from ML score → flag → human action → outcome.

## Production Security & Resilience Controls

| Control | Status |
|---------|--------|
| Zero-trust service mesh | ✅ |
| mTLS on Protocol bus | ✅ |
| Tenant-scoped keys | ✅ |
| Dual control for ML deploy | ✅ |
| Feature store encryption | ✅ |
| Event tamper proofing | ✅ |
| Model access logging | ✅ |
| Model explainability API | ✅ |
| Kill-switch on all AI | ✅ |

## CI/CD & Release Governance

**Separate release pipelines:**

| Pipeline | Who Approves |
|----------|--------------|
| A (core + ledger) | Banking change board |
| B (ML models) | Model risk committee |
| AI Explainer | Compliance + Legal |
| Protocol schema changes | Architecture board |

**No shared fast lane.**

## Regulator Evidence Fabric

Because this is Protocol-native, you can now generate automatically:

- ✅ CPS-230 hardship preparedness metrics
- ✅ ASIC RG-271 customer treatment audit trails
- ✅ CDR customer outcome replay
- ✅ Model governance audit packs

**All machine-generated. No consultants.**

## Dashboard Metrics

**Grafana Panels:**
- Cases Pending (human review queue)
- ML Scores Today (scoring volume)
- Flags Raised (risk flags)
- Kill Switch Status (emergency control)
- ML Score Distribution (p50, p75, p95)
- Human Actions (outreach, propose, approve, reject rates)

## What This Enables

This pipeline becomes:

- ✅ Legally admissible
- ✅ Regulator replayable
- ✅ Model-governed
- ✅ Bias monitored
- ✅ Drift monitored
- ✅ Overrideable
- ✅ Kill-switch protected
- ✅ Zero probabilistic money movement

**This is significantly stronger than most Tier-1 banks presently operate.**

## Reference Architecture

This hardship AI pipeline serves as the reference architecture for all AI in TuringCore:

- ✅ Fraud detection
- ✅ Payments reinforcement learning
- ✅ Treasury optimization
- ✅ AML transaction monitoring
- ✅ CDR write enforcement

**All without ever violating A/B separation.**

## Usage

### 1. Compute Features
```python
from hardship_ai.features.feature_store import FeatureStore

store = FeatureStore(tenant_id="CU_ALPHA")
features = store.compute_features(customer_id, as_of_date, events)
```

### 2. Score Customer
```python
from hardship_ai.models.hardship_model import HardshipModel

model = HardshipModel(
    model_id="hardship_v1",
    model_version="1.0.0",
    feature_set_version="1.0"
)
prediction = model.predict(features)
```

### 3. Apply Business Rule
```python
from hardship_ai.invariants.hardship_invariants import apply_hardship_risk_rule, HardshipRiskRule

rule = HardshipRiskRule(
    rule_id="hardship_threshold_v1",
    rule_version="1.0",
    threshold=0.75,
    description="Flag if score >= 0.75 and not in hardship"
)

should_flag = apply_hardship_risk_rule(ml_score, customer_status, rule)
```

### 4. Create Human Case
```python
from hardship_ai.workflows.human_in_loop import HumanInLoopOrchestrator

orchestrator = HumanInLoopOrchestrator(tenant_id="CU_ALPHA")
case = orchestrator.create_case_from_flag(ml_score_event, flag_event, features)
orchestrator.assign_to_officer(case.case_id, officer_id)
```

### 5. Human Actions
```python
# Initiate outreach
orchestrator.initiate_outreach(case_id, officer_id, "EMAIL", outreach_event_id)

# Propose arrangement
orchestrator.propose_arrangement(
    case_id, specialist_id, "INTEREST_CONCESSION",
    {"interest_rate": 0.0, "duration_months": 6},
    arrangement_event_id
)

# Approve arrangement
orchestrator.approve_arrangement(case_id, supervisor_id, approval_event_id)
```

### 6. Run Invariants
```python
from hardship_ai.invariants.hardship_invariants import run_all_hardship_ai_invariants

results = run_all_hardship_ai_invariants(
    ml_scores, feature_vectors, flag_events,
    outreach_events, arrangement_events,
    ledger_events, approval_events
)

print(f"All invariants passed: {results['passed']}")
print(f"Total violations: {results['summary']['total_violations']}")
```

### 7. Emergency Kill Switch
```python
from hardship_ai.workflows.human_in_loop import AIKillSwitch

kill_switch = AIKillSwitch()
kill_switch.activate(
    activated_by="supervisor_123",
    reason="Model drift detected - emergency shutdown"
)

# Check before scoring
if kill_switch.check():
    prediction = model.predict(features)
else:
    # AI disabled, human-only workflow
    pass
```

## Files

```
twin-orchestrator/src/hardship_ai/
├── events/
│   └── hardship_events.py          # Event schema (Layer A + B)
├── features/
│   └── feature_store.py            # Bank-grade feature store
├── models/
│   └── hardship_model.py           # ML model service with controls
├── invariants/
│   └── hardship_invariants.py      # Production invariants
├── workflows/
│   └── human_in_loop.py            # Human-in-the-loop orchestrator
└── README.md                       # This file
```

## Production Readiness

This pipeline is production-ready when:

- ✅ 60 shadow days clean
- ✅ Zero ML scores without feature provenance
- ✅ Zero ledger impacts without human approval
- ✅ Full audit trail for all cases
- ✅ Model drift monitoring active
- ✅ Bias testing passed
- ✅ Kill switch tested
- ✅ Board + regulator sign-off

**Only then is AI-assisted hardship detection permitted.**
