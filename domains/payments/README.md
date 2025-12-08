# Payments Policy Gateway — Stage 3 Implementation

**Version:** 1.0  
**Status:** Production-Ready (Advisory Mode)  
**Owner:** TuringCore National Infrastructure Team

---

## Executive Summary

The **Payments Policy Gateway** is the deterministic control boundary between **Layer B (AI intelligence)** and **Layer A (advisory outputs)**.

**What It Does:**
- Consumes `RlPolicyEvaluated` events from Payments RL Shadow Consumer
- Applies deterministic, board-approved policy rules
- Emits `RlRoutingAdvisoryIssued` events (ADVISORY ONLY)
- Maintains full audit trail for regulatory compliance

**What It Cannot Do:**
- ❌ Execute payment commands
- ❌ Initiate settlement
- ❌ Move liquidity
- ❌ Modify ledger state
- ❌ Block transactions

**Safety Guarantees:**
- ✅ Advisory-only outputs (enforced by `assert_advisory_only`)
- ✅ Deterministic, pure function (same input → same output)
- ✅ Board-set confidence thresholds (not model-set)
- ✅ Reward variance clamps (prevents unstable model outputs)
- ✅ No external I/O (no database, no API calls)

---

## Architecture Context

### Stage 3 in the Shipping Plan

```
STAGE 1: A → Kafka (Live Event Emission)
  PaymentInitiated → protocol.payments.live.shadow

STAGE 2: B → Payments RL Consumer (Shadow Only) ✅ COMPLETE
  protocol.payments.live.shadow → Payments RL Shadow Consumer
  → RlPolicyEvaluated → protocol.payments.rl.evaluated

STAGE 3: B → A via Protocol (Policy + Enforcement) ← YOU ARE HERE
  protocol.payments.rl.evaluated → Payments Policy Gateway
  → RlRoutingAdvisoryIssued → protocol.payments.rl.advisory

STAGE 4: Ops Metrics Stream (Future)
STAGE 5: Kill Switch (Live Tested) (Future)
STAGE 6: Harness → CI (Red/Green Gate) (Future)
STAGE 7: Board & Regulator Proof Pack (Future)
```

### Event Flow

```
PaymentInitiated (A)
  ↓ Kafka: protocol.payments.live.shadow
Payments RL Shadow Consumer (B)
  ↓ Evaluate RL policy
RlPolicyEvaluated (B intelligence)
  ↓ Kafka: protocol.payments.rl.evaluated
Payments Policy Gateway (A) ← YOU ARE HERE
  ↓ Apply deterministic rules
RlRoutingAdvisoryIssued (A advisory)
  ↓ Kafka: protocol.payments.rl.advisory
Ops Dashboard / Metrics
```

---

## Components

### 1. `policy_gateway.py` (Core Logic)

**Purpose:** Deterministic transformation from RL intelligence → Advisory events

**Key Functions:**

- `evaluate_payments_rl_policy(event)` — Main policy evaluation function
  - Input: `RlPolicyEvaluatedEvent`
  - Output: `RlRoutingAdvisoryIssued` or `None`
  - Guarantees: Pure function, no I/O, deterministic

- `assert_advisory_only(command)` — Safety guard
  - Raises `RuntimeError` if forbidden command detected
  - First line of defense against execution authority

- `evaluate_batch(events)` — Batch processing
  - For consumer services that process events in batches

- `compute_statistics(events, advisories)` — Monitoring
  - Tracks advisory rate, rejection reasons

**Policy Rules (Board-Approved):**

1. **Confidence Gate:** Only emit advisory if confidence ≥ 70%
2. **Reward Stability:** Ignore if reward variance > 20%
3. **Rail Validation:** Only recognize NPP, BECS, BPAY
4. **Advisory-Only:** Never emit execution commands

**Forbidden Commands:**

```python
FORBIDDEN_COMMAND_TYPES = {
    "ExecutePayment",
    "PostLedgerEntry",
    "SettlePayment",
    "ReversePayment",
    "MoveLiquidity",
    "FreezeAccount",
    "BlockCard",
    "RestrictAccount",
    "InitiateTransfer",
    "ApproveTransaction",
}
```

---

### 2. `policy_gateway_consumer.py` (Service)

**Purpose:** Kafka consumer service that applies policy gateway rules

**Key Features:**

- Consumes from: `protocol.payments.rl.evaluated`
- Emits to: `protocol.payments.rl.advisory`
- Emits audit records to: `protocol.payments.rl.audit`
- Emits statistics to: `protocol.payments.rl.metrics`

**Kill-Switch:**

- Environment variable: `RISK_BRAIN_POLICY_GATEWAY_ENABLED`
- Default: `false` (safe by default)
- Panic signal: SIGTERM/SIGINT

**Safety Features:**

- Double-checks advisory-only invariant (defense in depth)
- Catches and logs all exceptions (no crash on bad data)
- Disables itself if forbidden command detected
- Full audit trail for every decision

---

## Installation

### Prerequisites

- Python 3.11+
- Kafka cluster
- Topics created (see below)

### Dependencies

```bash
pip install kafka-python==2.0.2
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_BOOTSTRAP` | Yes | `localhost:9092` | Kafka bootstrap servers |
| `RISK_BRAIN_POLICY_GATEWAY_ENABLED` | Yes | `false` | Enable policy gateway (kill-switch) |

---

## Kafka Topics

### Input Topic: `protocol.payments.rl.evaluated`

**Producer:** Payments RL Shadow Consumer (Layer B)  
**Consumer:** Payments Policy Gateway (Layer A)

**Schema:**

```json
{
  "event_type": "RlPolicyEvaluated",
  "schema_version": "1.0",
  "event_id": "...",
  "occurred_at": 1734022335456,
  "origin": "AI",
  
  "tenant_id": "CU-001",
  "payment_id": "PAY-123456",
  "state_hash": "...",
  
  "proposed_action": "ROUTE_NPP",
  "confidence_score": 0.88,
  "reward_estimate": 0.012,
  
  "policy_id": "payments-rl-stub-v1",
  "policy_version": "1.0"
}
```

---

### Output Topic: `protocol.payments.rl.advisory`

**Producer:** Payments Policy Gateway (Layer A)  
**Consumer:** Ops Dashboard, Metrics Aggregation

**Schema:**

```json
{
  "event_type": "RlRoutingAdvisoryIssued",
  "schema_version": "1.0",
  "event_id": "...",
  "occurred_at": 1734022335789,
  "origin": "AI",
  
  "tenant_id": "CU-001",
  "payment_id": "PAY-123456",
  "recommended_rail": "NPP",
  
  "confidence_score": 0.88,
  "reward_estimate": 0.012,
  
  "policy_id": "payments-rl-stub-v1",
  "policy_version": "1.0",
  
  "advisory_reason": "RL policy payments-rl-stub-v1 v1.0 recommends NPP based on latency/cost optimization. Confidence: 88.00%. Expected reward: 0.0120."
}
```

**HARD INVARIANT:** This topic contains **ADVISORY EVENTS ONLY**. No execution commands are permitted.

---

### Audit Topic: `protocol.payments.rl.audit`

**Purpose:** Full audit trail for regulatory compliance

**Schema:**

```json
{
  "timestamp": 1734022335789,
  "tenant_id": "CU-001",
  "payment_id": "PAY-123456",
  "rl_recommendation": "ROUTE_NPP",
  "confidence_score": 0.88,
  "reward_estimate": 0.012,
  "policy_decision": "APPROVED",
  "advisory_issued": true
}
```

**Policy Decisions:**
- `APPROVED` — Advisory issued
- `REJECTED_LOW_CONFIDENCE` — Confidence < 70%
- `REJECTED_HIGH_VARIANCE` — Reward variance > 20%
- `REJECTED_INVALID_RAIL` — Unknown payment rail

---

### Metrics Topic: `protocol.payments.rl.metrics`

**Purpose:** Policy gateway statistics for monitoring

**Schema:**

```json
{
  "timestamp": 1734022335789,
  "total_events": 1000,
  "advisories_issued": 650,
  "rejected_low_confidence": 250,
  "rejected_high_variance": 50,
  "rejected_invalid_rail": 50,
  "advisory_rate": 65.0,
  "rejection_rate": 35.0
}
```

---

## Running the Service

### Local Development

```bash
# Set environment variables
export KAFKA_BOOTSTRAP=localhost:9092
export RISK_BRAIN_POLICY_GATEWAY_ENABLED=true

# Run consumer
python policy_gateway_consumer.py
```

**Expected Output:**

```
================================================================================
Payments Policy Gateway Consumer v1.0
================================================================================
Kafka Bootstrap: localhost:9092
Policy Gateway Enabled: True
================================================================================
🚀 Payments Policy Gateway Consumer started
Waiting for RL evaluation events...
✅ RlRoutingAdvisoryIssued: PAY-123456 → NPP (confidence=0.88)
📊 Policy Gateway Stats: 650/1000 advisories issued (65.0%)
...
```

---

## Testing

### Unit Tests

```python
# test_policy_gateway.py

from policy_gateway import (
    evaluate_payments_rl_policy,
    RlPolicyEvaluatedEvent,
    assert_advisory_only,
    FORBIDDEN_COMMAND_TYPES
)
import pytest


def test_high_confidence_advisory():
    """Test that high-confidence RL evaluation produces advisory."""
    event = RlPolicyEvaluatedEvent(
        tenant_id="CU-TEST",
        payment_id="PAY-TEST-001",
        state_hash="abc123",
        proposed_action="ROUTE_NPP",
        confidence_score=0.88,
        reward_estimate=0.012,
        policy_id="test-policy",
        policy_version="1.0",
        occurred_at=1734022335456
    )
    
    advisory = evaluate_payments_rl_policy(event)
    
    assert advisory is not None
    assert advisory.recommended_rail == "NPP"
    assert advisory.confidence_score == 0.88
    assert advisory.event_type == "RlRoutingAdvisoryIssued"


def test_low_confidence_rejected():
    """Test that low-confidence RL evaluation is rejected."""
    event = RlPolicyEvaluatedEvent(
        tenant_id="CU-TEST",
        payment_id="PAY-TEST-002",
        state_hash="def456",
        proposed_action="ROUTE_NPP",
        confidence_score=0.65,  # Below 0.70 threshold
        reward_estimate=0.012,
        policy_id="test-policy",
        policy_version="1.0",
        occurred_at=1734022335456
    )
    
    advisory = evaluate_payments_rl_policy(event)
    
    assert advisory is None  # Rejected due to low confidence


def test_high_variance_rejected():
    """Test that high reward variance is rejected."""
    event = RlPolicyEvaluatedEvent(
        tenant_id="CU-TEST",
        payment_id="PAY-TEST-003",
        state_hash="ghi789",
        proposed_action="ROUTE_NPP",
        confidence_score=0.88,
        reward_estimate=0.25,  # Above 0.20 variance threshold
        policy_id="test-policy",
        policy_version="1.0",
        occurred_at=1734022335456
    )
    
    advisory = evaluate_payments_rl_policy(event)
    
    assert advisory is None  # Rejected due to high variance


def test_invalid_rail_rejected():
    """Test that invalid payment rail is rejected."""
    event = RlPolicyEvaluatedEvent(
        tenant_id="CU-TEST",
        payment_id="PAY-TEST-004",
        state_hash="jkl012",
        proposed_action="ROUTE_SWIFT",  # Invalid rail
        confidence_score=0.88,
        reward_estimate=0.012,
        policy_id="test-policy",
        policy_version="1.0",
        occurred_at=1734022335456
    )
    
    advisory = evaluate_payments_rl_policy(event)
    
    assert advisory is None  # Rejected due to invalid rail


def test_forbidden_command_detection():
    """Test that forbidden commands are detected and rejected."""
    for forbidden_cmd in FORBIDDEN_COMMAND_TYPES:
        with pytest.raises(RuntimeError, match="FATAL POLICY VIOLATION"):
            assert_advisory_only({"command_type": forbidden_cmd})


def test_advisory_only_invariant():
    """Test that advisory events pass the advisory-only check."""
    advisory_dict = {
        "event_type": "RlRoutingAdvisoryIssued",
        "payment_id": "PAY-TEST-005",
        "recommended_rail": "NPP"
    }
    
    # Should not raise exception
    assert_advisory_only(advisory_dict)


def test_deterministic_output():
    """Test that same input produces same output (deterministic)."""
    event = RlPolicyEvaluatedEvent(
        tenant_id="CU-TEST",
        payment_id="PAY-TEST-006",
        state_hash="mno345",
        proposed_action="ROUTE_BECS",
        confidence_score=0.75,
        reward_estimate=0.008,
        policy_id="test-policy",
        policy_version="1.0",
        occurred_at=1734022335456
    )
    
    advisory1 = evaluate_payments_rl_policy(event)
    advisory2 = evaluate_payments_rl_policy(event)
    
    # Same input → same output (excluding event_id and occurred_at)
    assert advisory1.recommended_rail == advisory2.recommended_rail
    assert advisory1.confidence_score == advisory2.confidence_score
    assert advisory1.reward_estimate == advisory2.reward_estimate
```

**Run Tests:**

```bash
pytest test_policy_gateway.py -v
```

---

### Integration Tests

#### 1. Produce Test RL Evaluation Event

```bash
echo '{
  "event_type": "RlPolicyEvaluated",
  "schema_version": "1.0",
  "event_id": "test-001",
  "occurred_at": '$(date +%s000)',
  "origin": "AI",
  "tenant_id": "CU-TEST",
  "payment_id": "PAY-TEST-001",
  "state_hash": "abc123",
  "proposed_action": "ROUTE_NPP",
  "confidence_score": 0.88,
  "reward_estimate": 0.012,
  "policy_id": "test-policy",
  "policy_version": "1.0"
}' | kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.evaluated
```

#### 2. Verify Advisory Output

```bash
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.advisory \
  --from-beginning
```

**Expected Output:**

```json
{
  "event_type": "RlRoutingAdvisoryIssued",
  "payment_id": "PAY-TEST-001",
  "recommended_rail": "NPP",
  "confidence_score": 0.88,
  ...
}
```

#### 3. Verify No Execution Commands

```bash
# Search for forbidden commands (should return empty)
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.advisory \
  --from-beginning | grep -E "(ExecutePayment|SettlePayment|PostLedgerEntry)"

# Exit code 1 = no matches = PASS
```

---

## Monitoring

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Advisory Rate | % of RL evaluations that produce advisories | < 50% (model quality issue) |
| Rejection Rate | % of RL evaluations rejected | > 50% (model quality issue) |
| Low Confidence Rejections | Count of rejections due to low confidence | Trending up (model degradation) |
| High Variance Rejections | Count of rejections due to high variance | > 10% (model instability) |
| Forbidden Command Attempts | Count of forbidden command attempts | > 0 (CRITICAL BREACH) |

### Prometheus Queries

```promql
# Advisory rate
rate(payments_policy_gateway_advisories_issued_total[5m]) / 
rate(payments_policy_gateway_events_total[5m])

# Rejection rate by reason
rate(payments_policy_gateway_rejections_total{reason="low_confidence"}[5m])
rate(payments_policy_gateway_rejections_total{reason="high_variance"}[5m])
rate(payments_policy_gateway_rejections_total{reason="invalid_rail"}[5m])

# Forbidden command attempts (should always be 0)
payments_policy_gateway_forbidden_commands_total
```

---

## Production Checklist

Before deploying to production, verify:

- [ ] Kafka topics created with correct retention and replication
- [ ] ACLs / IAM permissions configured
- [ ] Environment variables set correctly
- [ ] Kill-switch tested (env variable)
- [ ] Unit tests passed (all 7 tests)
- [ ] Integration test passed (test event → advisory)
- [ ] No execution commands emitted (grep test passed)
- [ ] Audit trail verified (all decisions logged)
- [ ] Statistics verified (advisory rate, rejection rate)
- [ ] Monitoring configured (Prometheus, Grafana)
- [ ] Alerts configured (forbidden commands, rejection rate)

---

## Operational Runbook

### Incident: High Rejection Rate

**Detection:** Alert fires when rejection rate > 50%.

**Impact:** RL model quality issue, but no impact on payments (advisory mode).

**Response:**
1. Check rejection reasons in metrics topic
2. If low confidence: Model retraining required
3. If high variance: Model instability, disable RL via kill-switch
4. Escalate to Risk Brain team

### Incident: Forbidden Command Detected

**Detection:** Alert fires when `forbidden_commands_total` > 0.

**Impact:** **CRITICAL** — Potential breach of advisory-only invariant.

**Response:**
1. **IMMEDIATE:** Disable policy gateway: `kubectl set env deployment/payments-policy-gateway RISK_BRAIN_POLICY_GATEWAY_ENABLED=false`
2. Isolate affected code version
3. Audit all output events for execution commands
4. Notify APRA, AUSTRAC, board (if production)
5. Root cause analysis and post-mortem
6. Do not redeploy until fix validated in CI

---

## Next Steps

### Stage 3 Complete ✅

You have now completed **Stage 3** of the Payments RL Shadow shipping plan:

> **Stage 3:** B → A via Protocol (Policy + Enforcement)

**What's Next:**

1. **Stage 4:** Ops Metrics Stream
   - Join actual payment outcomes with RL recommendations
   - Create Grafana dashboard
   - Track latency delta, retry avoided %, cost delta

2. **Stage 5:** Kill Switch (Live Tested)
   - Test kill-switches in production
   - Weekly automated kill-switch drills

3. **Stage 6:** Harness → CI (Red/Green Gate)
   - Extend synthetic replay harness
   - Assert no forbidden commands in CI

4. **Stage 7:** Board & Regulator Proof Pack
   - Auto-generate weekly metrics
   - Operational evidence for regulators

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-08  
**Status:** Production-Ready (Advisory Mode)
