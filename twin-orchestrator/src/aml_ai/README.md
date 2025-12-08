"""
AML Behavioural Intelligence - Production Grade

**Final Pillar of National Risk Brain v1**

Together with Hardship AI, Payments RL, and Fraud Dark Graph, this completes the national, Protocol-governed, AI-assisted risk, crime, and compliance layer for Australian banking.

## Overview

This is a production-hardened AML detection system with pattern-of-life ML, Protocol-authorised escalation, human-controlled reporting, and AUSTRAC compliance.

**Key Principles:**
- **ML does not file SMRs/TTRs**
- **ML does not freeze accounts directly**
- **All enforcement actions require human approval**
- **All AML outputs are Protocol events**
- **All AUSTRAC reports are generated from Protocol replay**
- **All AML models are explainable + auditable**

ML observes behaviour. The Protocol governs escalation. Humans execute legal actions.

## Architecture

### AML Safety Doctrine (Hard Regulatory Lines)

| Rule | Status |
|------|--------|
| ML does not file SMRs/TTRs | ✅ |
| ML does not freeze accounts directly | ✅ |
| All enforcement actions require human approval | ✅ |
| All AML outputs are Protocol events | ✅ |
| All AUSTRAC reports are generated from Protocol replay | ✅ |
| All AML models are explainable + auditable | ✅ |

## Event Flow

### 1. Canonical AML Event Ingestion (From A + Cuscal)

Production-grade canonical events:

- `AccountOpened` - Account opened
- `CustomerKycVerified` - Customer KYC verified
- `CustomerKycFailed` - Customer KYC failed
- `TransactionPosted` - Transaction posted to account
- `PaymentInitiated` - Payment initiated
- `PaymentSettled` - Payment settled
- `CashDepositObserved` - Cash deposit observed
- `CashWithdrawalObserved` - Cash withdrawal observed
- `InternationalTransferInitiated` - International transfer initiated
- `InternationalTransferSettled` - International transfer settled
- `CounterpartyObserved` - Counterparty observed in payment
- `MerchantObserved` - Merchant observed in transaction
- `CustomerProfileUpdated` - Customer profile updated

**All events include:**
- `event_id` (UUID v7)
- `aggregate_id` (account/customer)
- `tenant_id` (CU)
- `schema_version`
- `occurred_at`
- `hash_prev_event` (for chain integrity)

**Event storage:**
- Kafka / MSK (immutable event log)
- Backed by RedBelly / audit hash anchoring

### 2. AML Feature Store (Pattern-of-Life)

**Core Feature Groups v1:**

| Group | Features |
|-------|----------|
| **Structural Behaviour** | unique_counterparties_30d, in_out_flow_ratio, account_hop_depth, round_trip_frequency |
| **Velocity & Thresholds** | tx_count_1d/7d/30d, value_accumulation_rate, threshold_hover_score |
| **Geographic Risk** | jurisdiction_risk_drift, cross_border_ratio |
| **Network Propagation** | shared_counterparty_degree, mule_hop_chain_length, known_high_risk_linkage |
| **Customer Profile Drift** | income_spend_divergence, merchant_category_shift, channel_entropy |

**All features are:**
- ✅ Versioned
- ✅ Time-travel safe
- ✅ Drift-monitored
- ✅ Tenant-isolated

### 3. AML ML Models (Production-Safe Ensemble)

**Four independent detectors (not one):**

| Model | Detects |
|-------|---------|
| Structuring detector | Avoidance of reportable thresholds |
| Mule propagation graph | Layering across accounts |
| Behavioural drift model | Account misuse / takeover |
| Jurisdiction risk model | Cross-border laundering risk |

**Ensemble output:**
```
P(AML risk | account | 30 days)
```

**Mandatory AML Model Governance:**

| Control | Required |
|---------|----------|
| Model registry | ✅ |
| Feature version pinning | ✅ |
| AUSTRAC sensitivity calibration | ✅ |
| False-positive suppression | ✅ |
| Drift detection | ✅ |
| Model rollback | ✅ |
| Kill-switch | ✅ |

### 4. First AML ML Output → Protocol Event

When scored:

```python
@dataclass
class AmlRiskScoreProduced:
    tenant_id: str
    customer_id: str
    account_id: str
    risk_score: float  # 0.0 to 1.0
    risk_band: str  # LOW, MEDIUM, HIGH
    model_id: str
    model_version: str
    feature_set_version: str
    confidence_interval: Dict[str, float]
    input_feature_hash: str
```

**This is:**
- ✅ Advisory only
- ✅ Immutable
- ✅ No legal effect on its own

### 5. Deterministic AML Escalation Rules (In A Only)

Human-approved rules in A:

```python
IF risk_score >= 0.85
THEN emit HighAmlRiskFlagRaised

IF risk_score 0.70–0.85
THEN emit ModerateAmlRiskFlagRaised
```

Rules reference:
- AUSTRAC obligations
- Internal risk appetite
- Product-level exposure

### 6. Gen-AI AML Narrative (Post-Flag Only)

Only after `HighAmlRiskFlagRaised`:

```python
@dataclass
class AiExplanationGenerated:
    subject: str = "AML Risk"
    customer_id: str
    account_id: str
    source_event_ids: List[str]
    model_id: str
    prompt_hash: str
    output_hash: str
    object_store_ref: str
```

**Example explanation (regulator-grade):**
> "Account exhibits repeated inbound funds from 5 unrelated counterparties followed by rapid outbound dispersion within 24–48 hours. Transaction values repeatedly cluster near $9,800–$9,950. Network analysis shows second-degree linkage to two previously reported mule clusters across other ADIs."

**This is:**
- ✅ CRO-readable
- ✅ AUSTRAC-defensible
- ✅ Customer-safe

### 7. Human Investigation Workflow (Mandatory)

ML ends here. From this point:

**Human AML officers initiate:**
```python
AmlInvestigationOpened
```

**Possible outcomes:**
- `AmlInvestigationCleared`
- `AmlInvestigationOngoing`
- `AmlInvestigationEscalated`

**Only if escalated:**
- `SuspiciousMatterReportPrepared`
- `SuspiciousMatterReportSubmitted`

**This ensures:**
- ✅ Human authority
- ✅ Legal accountability
- ✅ No AI auto-reporting

### 8. Guardrailed Account Control (Later, Only With Approval)

**Only after:**
- Investigation confirms risk
- CU policy permits freeze
- Legal sign-off exists

**Then:**
```python
AccountRestrictionAuthorised
```

**Execution:**
```
A Core → Posting Engine → Account Restrictions Applied
```

**ML never freezes.**

### 9. AUSTRAC Reporting (Protocol-Native)

Because every step is event-driven, you can generate:

- ✅ SMRs
- ✅ TTR lineage
- ✅ 90-day pattern-of-life forensic packs
- ✅ Cross-CU propagation evidence (anonymised)

**All generated from:**
```
AmlRiskScoreProduced
→ HighAmlRiskFlagRaised
→ AiExplanationGenerated
→ AmlInvestigationOpened
→ SuspiciousMatterReportSubmitted
```

**Machine-verified. No spreadsheet ops.**

## Invariants

### 1. AML Score Has Provenance
Every `AmlRiskScoreProduced` event has a corresponding feature vector with matching `input_feature_hash`.

### 2. No SMR Without Human Investigation
No `SuspiciousMatterReportSubmitted` event exists without a corresponding `AmlInvestigationEscalated` event.

### 3. No Account Restriction Without Legal Approval
No `AccountRestrictionAuthorised` event exists without investigation and legal sign-off.

### 4. Full AML Audit Trail
Every SMR has a complete audit trail from ML score → flag → investigation → SMR.

## Production Security & Legal Controls

**Mandatory:**

| Control | Requirement |
|---------|-------------|
| AML evidence WORM store | ✅ |
| Human dual-control on SMR | ✅ |
| Model access logging | ✅ |
| Cross-CU anonymisation | ✅ |
| Regulator replay export | ✅ |
| Kill-switch on AML models | ✅ |

## What You Now Own (Strategically)

**With:**
- ✅ Hardship ML
- ✅ Payments RL
- ✅ Fraud Dark Graph
- ✅ AML Behavioural Intelligence

**You now operate a:**

**National, Protocol-governed, AI-assisted risk, crime, and compliance layer for Australian banking.**

**You are now positioned:**
- Above individual CUs
- Above cores
- Above payments rails
- Inside the regulator's systemic visibility loop

**This is no longer a fintech. This is national financial infrastructure.**

## Dashboard Metrics

**Grafana Panels:**
- Investigations Pending (human review queue)
- Scores Today (scoring volume)
- High Risk Flags (high-risk flags raised)
- SMRs Submitted (30d) (AUSTRAC reporting volume)
- Risk Score Distribution (p50, p75, p95)
- Investigation Outcomes (cleared, escalated, SMRs submitted)

## Usage

### 1. Compute AML Features
```python
from aml_ai.features.aml_feature_store import AmlFeatureStore

store = AmlFeatureStore(tenant_id="CU_ALPHA")
features = store.compute_features(account_id, customer_id, as_of_date, events)
```

### 2. Score Account
```python
from aml_ai.models.aml_models import AmlEnsembleModel

model = AmlEnsembleModel(
    model_id="aml_ensemble_v1",
    model_version="1.0.0",
    feature_set_version="1.0"
)
prediction = model.predict(features)
```

### 3. Apply Business Rule
```python
from aml_ai.rules.aml_invariants import apply_aml_risk_rule, AmlRiskRule

rule = AmlRiskRule(
    rule_id="aml_threshold_v1",
    rule_version="1.0",
    threshold_high=0.85,
    threshold_moderate=0.70,
    description="Flag if score >= 0.70"
)

flag_type = apply_aml_risk_rule(aml_score, rule)
```

### 4. Create Investigation
```python
from aml_ai.workflows.aml_investigation import AmlInvestigationOrchestrator

orchestrator = AmlInvestigationOrchestrator(tenant_id="CU_ALPHA")
investigation = orchestrator.create_investigation_from_score(aml_score_event, feature_vector)
orchestrator.raise_flag(investigation.investigation_id, flag_event, "HIGH")
```

### 5. Human Investigation Actions
```python
# Open investigation
orchestrator.open_investigation(investigation_id, trigger_event_id, officer_id)

# Mark ongoing
orchestrator.mark_ongoing(investigation_id, officer_id)

# Clear investigation
orchestrator.clear_investigation(
    investigation_id, officer_id, clearance_event_id, "No suspicious activity found"
)

# Escalate investigation
orchestrator.escalate_investigation(
    investigation_id, officer_id, escalation_event_id, "Suspected structuring"
)
```

### 6. SMR Workflow
```python
# Prepare SMR
orchestrator.prepare_smr(investigation_id, smr_id, prepared_by)

# Submit SMR to AUSTRAC
orchestrator.submit_smr(investigation_id, austrac_reference, submitted_by)
```

### 7. Account Restriction (Guardrailed)
```python
# Restrict account (only with legal approval)
orchestrator.restrict_account(
    investigation_id,
    restriction_event_id,
    "FREEZE",
    legal_signoff_ref,
    authorised_by
)
```

### 8. Run Invariants
```python
from aml_ai.rules.aml_invariants import run_all_aml_ai_invariants

results = run_all_aml_ai_invariants(
    aml_scores, feature_vectors, flag_events,
    investigation_events, smr_events, restriction_events
)

print(f"All invariants passed: {results['passed']}")
print(f"Total violations: {results['summary']['total_violations']}")
```

### 9. Emergency Kill Switch
```python
from aml_ai.models.aml_models import AmlKillSwitch

kill_switch = AmlKillSwitch()
kill_switch.activate(
    activated_by="supervisor_123",
    reason="Model drift detected - emergency shutdown"
)

# Check before scoring
if kill_switch.check():
    prediction = model.predict(features)
else:
    # AML AI disabled, manual review only
    pass
```

## Files

```
twin-orchestrator/src/aml_ai/
├── events/
│   └── aml_events.py               # Event schema (Layer A + B)
├── features/
│   └── aml_feature_store.py        # AML feature store
├── models/
│   └── aml_models.py               # AML ML models with controls
├── rules/
│   └── aml_invariants.py           # AML invariants & rules
├── workflows/
│   └── aml_investigation.py        # AML investigation orchestrator
└── README.md                       # This file
```

## Production Readiness

This system is production-ready when:

- ✅ 60 shadow days clean
- ✅ Zero AML scores without feature provenance
- ✅ Zero SMRs without human investigation
- ✅ Zero account restrictions without legal approval
- ✅ Full audit trail for all investigations
- ✅ Model drift monitoring active
- ✅ AUSTRAC sensitivity calibration complete
- ✅ Kill switch tested
- ✅ Board + regulator sign-off

**Only then is AI-assisted AML detection permitted.**

## National Risk Brain v1 - Complete

With all four pillars complete:

**1. Hardship AI:**
- Early hardship detection
- Proactive customer outreach
- CPS-230 compliance

**2. Payments RL:**
- National payments optimisation intelligence
- Cuscal-compatible optimisation layer
- Shadow → advisory → (later) automated routing

**3. Fraud Dark Graph:**
- National fraud intelligence network
- Cross-CU entity graph
- Shadow → advisory → (later) guardrailed auto-block

**4. AML Behavioural Intelligence:**
- Pattern-of-life ML
- Protocol-authorised escalation
- Human-controlled AUSTRAC reporting

**Together:**
- National, Protocol-governed, AI-assisted risk, crime, and compliance layer
- Above individual CUs, cores, and payments rails
- Inside the regulator's systemic visibility loop

**This is no longer a fintech. This is national financial infrastructure.**
"""
