# National Fraud Dark Graph - Production Grade

**B's Second Pillar After Payments RL**

Together they form your National Risk Brain v1.

## Overview

This is a production-hardened fraud detection system with cross-CU entity graph, ML fraud models, guardrailed automation, and full Protocol governance.

**Key Principles:**
- **ML never directly blocks transactions in v1**
- **All fraud outputs are Protocol events**
- **All blocks (later) are rule-based, not free ML**
- **All decisions are replayable & explainable**
- **No opaque "black box declines"**
- **CU retains final authority in advisory mode**

ML detects. The Protocol decides what ML is allowed to trigger.

## Architecture

### Fraud Safety Doctrine (Hard Rules)

| Rule | Status |
|------|--------|
| ML never directly blocks transactions in v1 | ✅ |
| All fraud outputs are Protocol events | ✅ |
| All blocks (later) are rule-based, not free ML | ✅ |
| All decisions are replayable & explainable | ✅ |
| No opaque "black box declines" | ✅ |
| CU retains final authority in advisory mode | ✅ |

## Event Flow

### 1. Layer A Events (TuringCore Financial Events)

Canonical fraud events emitted by TuringCore:

- `CardAuthorisationRequested` - Card authorisation requested
- `CardAuthorisationApproved` - Card authorisation approved
- `CardAuthorisationDeclined` - Card authorisation declined
- `PaymentInitiated` - Payment initiated
- `PaymentSettled` - Payment settled
- `PaymentFailed` - Payment failed
- `DeviceFingerprintObserved` - Device fingerprint observed
- `MerchantObserved` - Merchant observed in transaction
- `CounterpartyObserved` - Counterparty observed in payment
- `AccountLoginSucceeded` - Account login succeeded
- `AccountLoginFailed` - Account login failed

**All events include:**
- `event_id` (UUID v7)
- `aggregate_id` (card/account/device/merchant)
- `tenant_id` (CU)
- `schema_version`
- `occurred_at`
- `hash_prev_event` (for chain integrity)

**Event storage:**
- Kafka / MSK (immutable event log)
- Backed by RedBelly / audit hash anchoring

### 2. National Fraud Entity Graph (The Dark Graph)

**Core Asset: Cross-CU entity graph**

| Node Type | Meaning |
|-----------|---------|
| Account | Bank account |
| Card | Tokenised card |
| Device | Fingerprint or mobile |
| Merchant | Acceptor |
| Counterparty | Payee |
| IP Cluster | Network behaviour |
| CU | Tenant boundary |

| Edge Type | Meaning |
|-----------|---------|
| Account → Card | Issued to |
| Card → Merchant | Used at |
| Card → Device | Used on |
| Device → IP | Seen on |
| Account → Counterparty | Pays |
| CU → Account | Ownership |

**This graph is:**
- ✅ Cross-CU
- ✅ Anonymised
- ✅ Continuously evolving
- ✅ Time-stamped
- ✅ Replayable

**This is your national fraud moat.**

### 3. Fraud Feature Store (From Protocol Only)

**Feature Groups v1:**

| Group | Features |
|-------|----------|
| **Velocity** | tx_count_1m, tx_count_5m, geo_jump_rate |
| **Graph Risk** | shared_device_count, shared_merchant_count, counterparty_reuse_score, mule_cluster_degree |
| **Behavioural Drift** | merchant_category_drift, time_of_day_drift, amount_zscore |
| **Governance** | previous_fraud_flags, manual_review_rate |

**All features are:**
- ✅ Versioned
- ✅ Drift-monitored
- ✅ Tenant-scoped views
- ✅ Immutable at inference time

### 4. ML Fraud Models (Production Safe)

**Multiple models, not one:**

| Model | Purpose |
|-------|---------|
| Velocity anomaly | Fast theft bursts |
| Graph clustering | Mule rings |
| Behavioural drift | Account takeover |
| Merchant drift | Compromised terminals |

**Ensemble output:**
```
P(fraud | payment)
```

**Mandatory Model Governance:**

| Control | Required |
|---------|----------|
| Model registry | ✅ |
| Feature version pinning | ✅ |
| Bias testing | ✅ |
| Performance decay alerts | ✅ |
| Drift detection | ✅ |
| Kill-switch | ✅ |
| Rollback | ✅ |

### 5. First ML Output → Protocol Event

For every scored transaction:

```python
@dataclass
class FraudRiskScoreProduced:
    tenant_id: str
    payment_id: str
    customer_id: str
    score_value: float  # 0.0 to 1.0
    model_id: str
    model_version: str
    feature_set_version: str
    confidence_interval: Dict[str, float]
    input_feature_hash: str
```

**This is:**
- ✅ Advisory
- ✅ Immutable
- ✅ Court-admissible
- ✅ No execution authority

### 6. Deterministic Rules (Still in A Only)

Layer A applies human-approved policy rules:

```python
IF fraud_score > 0.90
THEN emit HighFraudRiskFlagRaised

IF fraud_score 0.75–0.90
THEN emit ModerateFraudRiskFlagRaised
```

These map to review or advisory, not blocks yet.

### 7. Gen-AI Fraud Explanation (Post-Flag Only)

Triggered only after a flag:

```python
@dataclass
class AiExplanationGenerated:
    subject: str = "Fraud Risk"
    payment_id: str
    customer_id: str
    source_event_ids: List[str]
    model_id: str
    prompt_hash: str
    output_hash: str
    object_store_ref: str
```

**Typical explanation:**
> "This transaction used a device previously seen on 6 other cards across 3 CUs in the last 48 hours. Merchant category differs from the customer's normal spending profile with a 4.2σ amount deviation."

**This is:**
- ✅ CRO-readable
- ✅ Regulator-defensible
- ✅ Customer-safe

### 8. Advisory Mode (Human in Control)

Ops receives:

```python
@dataclass
class FraudAdvisoryIssued:
    payment_id: str
    recommended_action: str  # "contact customer", "block card", "review manual"
    confidence: float
    expected_loss_avoidance: float
```

**Humans choose:**
- `FraudAdvisoryAccepted`
- `FraudAdvisoryOverridden`

Logged as Protocol events.

### 9. Guardrailed Auto-Block (Later, Known Patterns Only)

**Only when:**
- Pattern is proven nationally
- Zero false-positive tolerance
- Board + APRA approved

**Protocol rule example:**
```python
IF FraudClusterDetected
AND attack_signature = "known_mule_ring_v3"
AND CU_policy.allow_autoblock = TRUE
THEN emit AutoBlockAuthorisationIssued
```

**Execution still happens only via:**
```
A Core → Cuscal → Scheme Decline
```

**ML never directly sends declines.**

### 10. What Regulators Can Replay

For any block, you can replay:

```
CardAuthorisationRequested
→ FraudRiskScoreProduced
→ HighFraudRiskFlagRaised
→ AiExplanationGenerated
→ AutoBlockAuthorisationIssued
→ CardAuthorisationDeclined
```

**You can prove:**
- ✅ ML detected
- ✅ Rule authorised
- ✅ Human could override
- ✅ Execution was deterministic

**This is exactly what APRA + ASIC want.**

## Invariants

### 1. Fraud Score Has Provenance
Every `FraudRiskScoreProduced` event has a corresponding feature vector with matching `input_feature_hash`.

### 2. No Auto-Block Without Proven Pattern
No `AutoBlockAuthorisationIssued` event exists without a corresponding `FraudClusterDetected` event with a proven attack signature.

### 3. Full Fraud Audit Trail
Every fraud decision has a complete audit trail from ML score → flag → advisory/auto-block → outcome.

### 4. No Opaque Black Box Declines
Every fraud-related decline has a corresponding `AiExplanationGenerated` event for transparency and customer service.

## Production Security & Controls

**Mandatory:**

| Control | Requirement |
|---------|-------------|
| Graph encryption at rest | ✅ |
| Tenant isolation | ✅ |
| Cross-CU anonymisation | ✅ |
| ML access logging | ✅ |
| Auto-block dual-control | ✅ |
| Replay export | ✅ |
| RedBelly audit anchoring | ✅ |

## What You Now Own Strategically

With Payments RL + Fraud Dark Graph, B now controls:

- ✅ National payments optimisation intelligence
- ✅ National fraud intelligence network
- ✅ National risk telemetry layer

**You now sit:**
- Above individual CUs
- Above cores
- Above Cuscal
- Inside APRA's systemic risk visibility perimeter

**This is infrastructure-grade positioning.**

## Dashboard Metrics

**Grafana Panels:**
- Cases Pending (human review queue)
- Scores Today (scoring volume)
- High Risk Flags (high-risk flags raised)
- Advisory Acceptance % (human acceptance rate)
- Score Distribution (p50, p75, p95)
- Cluster Detections (mule rings, compromised terminals, account takeovers)

## Usage

### 1. Build Fraud Graph
```python
from fraud_ai.graph.fraud_graph import NationalFraudGraph, NodeType, EdgeType

graph = NationalFraudGraph()

# Add nodes
graph.add_node("card_123", NodeType.CARD, tenant_id="CU_ALPHA")
graph.add_node("merchant_456", NodeType.MERCHANT)

# Add edges
graph.add_edge("card_123", "merchant_456", EdgeType.USED_AT)
```

### 2. Detect Fraud Clusters
```python
# Detect mule rings
mule_rings = graph.detect_mule_ring(min_cluster_size=5, min_velocity=10)

# Detect compromised terminals
terminals = graph.detect_compromised_terminal(min_card_count=10)
```

### 3. Compute Features
```python
from fraud_ai.features.fraud_feature_store import FraudFeatureStore

store = FraudFeatureStore(tenant_id="CU_ALPHA")
features = store.compute_features(entity_id, as_of_date, events, graph)
```

### 4. Score Transaction
```python
from fraud_ai.models.fraud_models import FraudEnsembleModel

model = FraudEnsembleModel(
    model_id="fraud_ensemble_v1",
    model_version="1.0.0",
    feature_set_version="1.0"
)
prediction = model.predict(features)
```

### 5. Apply Business Rule
```python
from fraud_ai.rules.fraud_invariants import apply_fraud_risk_rule, FraudRiskRule

rule = FraudRiskRule(
    rule_id="fraud_threshold_v1",
    rule_version="1.0",
    threshold_high=0.90,
    threshold_moderate=0.75,
    description="Flag if score >= 0.75"
)

flag_type = apply_fraud_risk_rule(fraud_score, rule)
```

### 6. Create Fraud Case
```python
from fraud_ai.workflows.fraud_advisory import FraudAdvisoryOrchestrator

orchestrator = FraudAdvisoryOrchestrator(tenant_id="CU_ALPHA")
case = orchestrator.create_case_from_score(fraud_score_event, feature_vector)
orchestrator.raise_flag(case.case_id, flag_event, "HIGH")
```

### 7. Human Actions
```python
# Issue advisory
orchestrator.issue_advisory(
    case_id, advisory_event_id, "CONTACT_CUSTOMER", 5000.0
)

# Assign to analyst
orchestrator.assign_to_analyst(case_id, analyst_id)

# Accept advisory
orchestrator.accept_advisory(case_id, officer_id, acceptance_event_id)

# Override advisory
orchestrator.override_advisory(
    case_id, officer_id, override_event_id, "Customer verified transaction"
)
```

### 8. Run Invariants
```python
from fraud_ai.rules.fraud_invariants import run_all_fraud_ai_invariants

results = run_all_fraud_ai_invariants(
    fraud_scores, feature_vectors, flag_events,
    advisory_events, auto_block_events, cluster_events,
    decline_events, explanation_events
)

print(f"All invariants passed: {results['passed']}")
print(f"Total violations: {results['summary']['total_violations']}")
```

### 9. Emergency Kill Switch
```python
from fraud_ai.models.fraud_models import FraudKillSwitch

kill_switch = FraudKillSwitch()
kill_switch.activate(
    activated_by="supervisor_123",
    reason="Model drift detected - emergency shutdown"
)

# Check before scoring
if kill_switch.check():
    prediction = model.predict(features)
else:
    # Fraud AI disabled, manual review only
    pass
```

## Files

```
twin-orchestrator/src/fraud_ai/
├── events/
│   └── fraud_events.py             # Event schema (Layer A + B)
├── graph/
│   └── fraud_graph.py              # National fraud entity graph
├── features/
│   └── fraud_feature_store.py      # Fraud feature store
├── models/
│   └── fraud_models.py             # ML fraud models with controls
├── rules/
│   └── fraud_invariants.py         # Fraud invariants & rules
├── workflows/
│   └── fraud_advisory.py           # Fraud advisory orchestrator
└── README.md                       # This file
```

## Production Readiness

This system is production-ready when:

- ✅ 60 shadow days clean
- ✅ Zero fraud scores without feature provenance
- ✅ Zero auto-blocks without proven patterns
- ✅ Full audit trail for all cases
- ✅ Model drift monitoring active
- ✅ Bias testing passed
- ✅ Kill switch tested
- ✅ Board + regulator sign-off

**Only then is AI-assisted fraud detection permitted.**

## National Risk Brain v1

With Payments RL + Fraud Dark Graph, you now have:

**Payments RL:**
- National payments optimisation intelligence
- Cuscal-compatible optimisation layer
- Shadow → advisory → (later) automated routing

**Fraud Dark Graph:**
- National fraud intelligence network
- Cross-CU entity graph
- Shadow → advisory → (later) guardrailed auto-block

**Together:**
- National risk telemetry layer
- Infrastructure-grade positioning
- Above individual CUs, cores, and Cuscal
- Inside APRA's systemic risk visibility perimeter

**This is significantly stronger than most Tier-1 banks presently operate.**
