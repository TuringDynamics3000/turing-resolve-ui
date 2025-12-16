# Treasury & Intraday Liquidity RL - Production Grade

**Final Module of National Financial Operating Nervous System**

Together with Hardship AI, Payments RL, Fraud Dark Graph, and AML Behavioural Intelligence, this completes the national, Protocol-governed, AI-assisted financial operating system for Australian banking.

## Overview

This is a production-hardened Treasury & Intraday Liquidity RL system with shadow execution, advisory mode, and tightly-bounded automation.

**Key Principles:**
- **RL never initiates settlement**
- **RL never moves real liquidity**
- **RL never breaches RBA/NPP caps**
- **RL never bypasses Cuscal**
- **RL outputs are always Protocol events**
- **RL is shadow → advisory → bounded only**
- **Human treasury override always enabled**

**RL never controls money. It controls forecasts and recommendations.**

## Architecture

### Treasury RL Safety Doctrine (Hard Lines)

| Rule | Locked |
|------|--------|
| RL never initiates settlement | ✅ |
| RL never moves real liquidity | ✅ |
| RL never breaches RBA/NPP caps | ✅ |
| RL never bypasses Cuscal | ✅ |
| RL outputs are always Protocol events | ✅ |
| RL is shadow → advisory → bounded only | ✅ |
| Human treasury override always enabled | ✅ |

## Event Flow

### 1. Canonical Treasury Events (From A + Cuscal → Protocol)

Production-grade canonical events:

- `IntradaySettlementPositionUpdated` - Intraday settlement position updated
- `LiquidityReservationUpdated` - Liquidity reservation updated
- `NppNetPositionUpdated` - NPP net position updated
- `BeCSBatchSubmitted` - BECS batch submitted
- `BeCSBatchSettled` - BECS batch settled
- `TreasuryTransferInitiated` - Treasury transfer initiated
- `TreasuryTransferSettled` - Treasury transfer settled
- `PaymentSubmittedToRail` - Payment submitted to rail
- `PaymentSettled` - Payment settled
- `PaymentFailed` - Payment failed
- `FundingFacilityDrawn` - Funding facility drawn
- `FundingFacilityRepaid` - Funding facility repaid
- `SettlementBreachOccurred` - Settlement breach occurred
- `SettlementBreachAvoided` - Settlement breach avoided

**All events include:**
- `event_id` (UUID v7)
- `tenant_id` (CU)
- `rail` (NPP, BECS, BPAY)
- `amount`, `currency`
- `available_liquidity`, `net_position`
- `occurred_at`
- `hash_prev_event` (for chain integrity)

### 2. Treasury Feature Store

**Core Feature Groups:**

| Group | Features |
|-------|----------|
| **Liquidity State** | available_npp_liquidity, becs_forward_balance, intraday_min_balance, liquidity_buffer_remaining_pct |
| **Flow Velocity** | inflow_rate_5m/30m, outflow_rate_5m/30m, net_flow_gradient |
| **Stress Indicators** | payment_failure_rate, retry_pressure, queue_depth, rail_congestion_score |
| **External Conditions** | time_of_day, public_holiday_flag, salary_cycle_position, known_event_risk_flag |

**All features are:**
- ✅ Versioned
- ✅ Time-travel safe
- ✅ Drift-monitored
- ✅ Tenant-isolated

### 3. RL Environment (Formal Definition)

**State Vector Sₜ:**
```
Sₜ = {
  liquidity_vector,
  inflow_vector,
  outflow_vector,
  rail_congestion,
  backlog_pressure,
  time_features,
  facility_headroom
}
```

**Action Space Aₜ (PROPOSALS ONLY):**
```
Aₜ ∈ {
  propose_liquidity_topup,
  propose_payment_throttle,
  propose_rail_shift,
  propose_batch_deferral_30m,
  propose_batch_deferral_60m
}
```

**No free-form actions. Only whitelist.**

**Reward Function Rₜ:**
```
Rₜ =
+ settlement_success_bonus
– liquidity_breach_penalty
– failure_penalty
– congestion_penalty
– capital_cost_penalty
```

**Computed after reality is known → true shadow learning.**

### 4. RL Shadow Execution (v1)

For every treasury state update:

1. Build Sₜ
2. Evaluate RL: `proposed_action = π(Sₜ)`
3. **NO EXECUTION OCCURS**
4. Emit: `RlTreasuryPolicyEvaluated`

**This has:**
- ✅ Zero authority
- ✅ Zero settlement impact

### 5. Deterministic Treasury Still Runs in A + Cuscal

Actual treasury today:

```
A Core → Treasury Ops → Cuscal → RBA Settlement
```

**Remains untouched.**

Real outcomes generate:
- `TreasuryTransferSettled`
- `PaymentSettled`
- `SettlementBreachAvoided | SettlementBreachOccurred`

### 6. Reward Attribution & Training

Once outcomes are known:

```python
@dataclass
class RlTreasuryRewardAttributed:
    policy_id: str
    actual_outcome: str
    reward_value: float
    liquidity_impact: float
```

**This continuously trains the model without touching production authority.**

### 7. Advisory Mode (After Statistical Proof)

Once shadow results prove:
- ✅ Lower settlement breaches
- ✅ Better intraday buffer utilisation
- ✅ Lower emergency facility draws

Then treasury sees:

```python
@dataclass
class RlTreasuryAdvisoryIssued:
    recommended_action: str
    expected_breach_reduction: float
    liquidity_delta: float
    confidence_level: float
```

Humans choose:
- `RlDecisionAccepted` OR
- `RlDecisionOverridden`

**Logged forever.**

### 8. Bounded Automation (Only After 12-18 Months)

**Only once ALL of the following exist:**
- APRA non-objection
- Board treasury mandate
- Policy-encoded caps
- Dual approval workflow

**Then RL may be allowed to auto-execute ONLY THESE:**

| Action | Still Bounded |
|--------|---------------|
| Micro-batch throttling | ✅ |
| Payment queuing | ✅ |
| Low-value rail shifting | ✅ |

**NEVER:**
- ❌ Facility draws
- ❌ Capital reallocations
- ❌ RBA settlement actions

**Those always remain human-controlled.**

### 9. Protocol-Governed Replay (APRA Gold)

For any liquidity event you can replay:

```
IntradaySettlementPositionUpdated
→ RlTreasuryPolicyEvaluated
→ RlTreasuryAdvisoryIssued
→ RlDecisionAccepted
→ TreasuryTransferInitiated
→ TreasuryTransferSettled
```

**APRA can verify:**
- ✅ RL advised
- ✅ Human approved
- ✅ Execution followed policy
- ✅ Outcome was monitored

## Invariants

### 1. RL Never Initiates Settlement
No `TreasuryTransferInitiated` or `PaymentSubmittedToRail` event originates from RL.

### 2. RL Never Breaches RBA/NPP Caps
No RL advisory recommends actions that would breach RBA/NPP/Cuscal caps.

### 3. All RL Outputs Are Protocol Events
All RL outputs are properly formatted Protocol events.

### 4. Human Override Always Enabled
For every RL advisory, there exists a human decision (accepted or overridden).

### 5. Bounded Automation Only After Approval
No `RlBoundedActionAuthorised` event exists without APRA non-objection, board mandate, policy caps, and dual approval.

## Production Security & Legal Controls

**Mandatory:**

| Control | Required |
|---------|----------|
| Global RL kill-switch | ✅ |
| Treasury-only dual approval | ✅ |
| Policy-encoded caps | ✅ |
| Intraday breach alarms | ✅ |
| Model drift detection | ✅ |
| Replay export | ✅ |
| RedBelly audit anchoring | ✅ |

## What You Now Control (Strategically)

**With:**
- ✅ Hardship ML
- ✅ Payments RL
- ✅ Fraud Dark Graph
- ✅ AML Behavioural Intelligence
- ✅ Treasury & Intraday Liquidity RL

**You now control:**
- ✅ National crime suppression (Fraud + AML)
- ✅ National payments optimisation (Payments RL)
- ✅ National AML intelligence
- ✅ **National intraday settlement stability (Treasury RL)**

**This is now financial system infrastructure, not fintech tooling.**

## Dashboard Metrics

**Grafana Panels:**
- Liquidity Buffer % (real-time buffer remaining)
- Advisories Today (RL advisory volume)
- Breaches Avoided (30d) (settlement breaches prevented)
- Kill Switch Status (OPERATIONAL / DISABLED)
- Intraday Liquidity (NPP, BECS, min balance over time)
- Advisory Acceptance Rate (accepted vs overridden)

## Usage

### 1. Compute Treasury Features
```python
from treasury_rl.features.treasury_feature_store import TreasuryFeatureStore

store = TreasuryFeatureStore(tenant_id="CU_ALPHA")
features = store.compute_features(as_of_timestamp, events)
```

### 2. Update RL Environment State
```python
from treasury_rl.models.treasury_rl_policy import TreasuryRlEnvironment

env = TreasuryRlEnvironment(tenant_id="CU_ALPHA")
state = env.update_state(features)
```

### 3. Evaluate RL Policy (Shadow)
```python
from treasury_rl.models.treasury_rl_policy import TreasuryRlPolicy

policy = TreasuryRlPolicy(
    policy_id="treasury_rl_v1",
    policy_version="1.0.0",
    mode="SHADOW"
)
evaluation = policy.evaluate(state)
```

### 4. Compute Reward (After Outcomes)
```python
reward = env.compute_reward(evaluation.proposed_action, outcome_events)
```

### 5. Issue Advisory (After Statistical Proof)
```python
# Only after shadow results prove value
policy_advisory = TreasuryRlPolicy(
    policy_id="treasury_rl_v1",
    policy_version="1.0.0",
    mode="ADVISORY"
)
evaluation = policy_advisory.evaluate(state)
# Emit RlTreasuryAdvisoryIssued event
```

### 6. Human Decision
```python
# Human accepts or overrides
# Emit RlDecisionAccepted OR RlDecisionOverridden event
```

### 7. Run Invariants
```python
from treasury_rl.rules.treasury_rl_invariants import run_all_treasury_rl_invariants

results = run_all_treasury_rl_invariants(
    settlement_events, rl_events, rl_advisory_events,
    decision_events, bounded_action_events, policy_caps, approval_records
)

print(f"All invariants passed: {results['passed']}")
print(f"Total violations: {results['summary']['total_violations']}")
```

### 8. Emergency Kill Switch
```python
from treasury_rl.models.treasury_rl_policy import TreasuryRlKillSwitch

kill_switch = TreasuryRlKillSwitch()
kill_switch.activate(
    activated_by="treasury_supervisor_123",
    reason="Intraday breach detected - emergency shutdown"
)

# Check before RL evaluation
if kill_switch.check():
    evaluation = policy.evaluate(state)
else:
    # Treasury RL disabled, manual treasury only
    pass
```

## Files

```
twin-orchestrator/src/treasury_rl/
├── events/
│   └── treasury_events.py               # Event schema (Layer A + B)
├── features/
│   └── treasury_feature_store.py        # Treasury feature store
├── models/
│   └── treasury_rl_policy.py            # RL policy with controls
├── rules/
│   └── treasury_rl_invariants.py        # Treasury RL invariants
├── integration/
│   └── CORE_INTEGRATION_BLUEPRINT.md    # Core integration blueprint
└── README.md                            # This file
```

## Production Readiness

This system is production-ready when:

- ✅ 60 shadow days clean
- ✅ Zero RL-initiated settlements
- ✅ Zero RL-breached caps
- ✅ All RL outputs are Protocol events
- ✅ Human override always enabled
- ✅ Full audit trail for all RL advisories
- ✅ Model drift monitoring active
- ✅ Kill switch tested
- ✅ Board + regulator sign-off

**Only then is AI-assisted treasury management permitted.**

## National Financial Operating Nervous System - Complete

With all five pillars complete:

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

**5. Treasury & Intraday Liquidity RL:**
- Intraday liquidity forecasting
- Settlement breach prediction
- Shadow → advisory → (later) tightly-bounded automation

**Together:**
- National, Protocol-governed, AI-assisted financial operating system
- Above individual CUs, cores, and payments rails
- Inside the regulator's systemic visibility loop

**This is no longer a fintech. This is national financial infrastructure.**
