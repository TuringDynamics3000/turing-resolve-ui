# Kafka Topic Configuration — Payments RL Shadow

**Version:** 1.0  
**Status:** Production-Ready  
**Owner:** TuringCore National Infrastructure Team

---

## Overview

This document defines the Kafka topics required for the **Payments RL Shadow Consumer** service to operate in production.

**Architecture Context:**
- **Layer A (TuringCore)** emits payment events to Kafka
- **Layer B (Risk Brain)** consumes events, evaluates RL policy, emits intelligence
- **Protocol Bus** ensures immutable, auditable event flow

---

## Required Topics

### 1. `protocol.payments.live.shadow`

**Purpose:** Live payment events from TuringCore (Layer A) for shadow mode observation.

**Producer:** TuringCore Payments Domain (Layer A)  
**Consumer:** Payments RL Shadow Consumer (Layer B)

**Event Types:**
- `PaymentInitiated`
- `PaymentSubmittedToRail`
- `PaymentSettled`
- `PaymentFailed`

**Retention:** 7 days (configurable based on regulatory requirements)  
**Partitions:** 12 (scale based on payment volume)  
**Replication Factor:** 3 (production standard)

**Sample Event Schema:**

```json
{
  "event_type": "PaymentInitiated",
  "event_id": "evt_7d8f9a0b1c2d3e4f",
  "tenant_id": "CU-001",
  "payment_id": "PAY-123456",
  "account_id": "ACCT-789",
  "amount_cents": 45000,
  "currency": "AUD",
  "channel": "API",
  "rail_used": "NPP",
  "attempt": 1,
  "origin": "CORE",
  "occurred_at": 1734022335123,
  "schema_version": "1.0"
}
```

**Mandatory Fields:**
- `event_type` (string): Event type identifier
- `event_id` (string): Unique event identifier (UUID)
- `tenant_id` (string): Credit union identifier (e.g., "CU-001")
- `payment_id` (string): Unique payment identifier
- `account_id` (string): Account identifier
- `amount_cents` (integer): Payment amount in cents
- `currency` (string): Currency code (ISO 4217)
- `channel` (string): Origination channel ("API", "BATCH", "BRANCH")
- `rail_used` (string): Payment rail ("NPP", "BECS", "BPAY")
- `attempt` (integer): Retry attempt number (1-indexed)
- `origin` (string): Event origin ("CORE" for Layer A)
- `occurred_at` (integer): Unix timestamp in milliseconds
- `schema_version` (string): Schema version for compatibility

---

### 2. `protocol.payments.rl.evaluated`

**Purpose:** RL policy evaluation intelligence events (ADVISORY ONLY).

**Producer:** Payments RL Shadow Consumer (Layer B)  
**Consumer:** Payments Policy Gateway, Metrics Aggregation, Audit Trail

**Event Types:**
- `RlPolicyEvaluated`

**Retention:** 30 days (regulatory audit trail)  
**Partitions:** 12 (match input topic)  
**Replication Factor:** 3 (production standard)

**Sample Event Schema:**

```json
{
  "event_type": "RlPolicyEvaluated",
  "schema_version": "1.0",
  "event_id": "evt_a1b2c3d4e5f6g7h8",
  "occurred_at": 1734022335456,
  "origin": "AI",
  
  "tenant_id": "CU-001",
  "payment_id": "PAY-123456",
  "state_hash": "a7f3b8c9d2e1f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9",
  
  "proposed_action": "ROUTE_NPP",
  "confidence_score": 0.88,
  "reward_estimate": 0.012,
  
  "policy_id": "payments-rl-stub-v1",
  "policy_version": "1.0"
}
```

**Mandatory Fields:**
- `event_type` (string): "RlPolicyEvaluated"
- `schema_version` (string): Schema version
- `event_id` (string): Unique event identifier (UUID)
- `occurred_at` (integer): Unix timestamp in milliseconds
- `origin` (string): "AI" (Layer B origin marker)
- `tenant_id` (string): Credit union identifier
- `payment_id` (string): Payment identifier (links to original payment)
- `state_hash` (string): SHA-256 hash of payment state (audit trail)
- `proposed_action` (string): RL recommendation ("ROUTE_NPP", "ROUTE_BECS", etc.)
- `confidence_score` (float): Confidence in recommendation (0.0 to 1.0)
- `reward_estimate` (float): Expected reward (normalized)
- `policy_id` (string): RL policy identifier
- `policy_version` (string): RL policy version

**HARD INVARIANT:**
This topic contains **ADVISORY INTELLIGENCE ONLY**. No execution commands are permitted.

---

### 3. `protocol.payments.rl.advisory.metrics` (Future)

**Purpose:** Shadow mode performance metrics for ops dashboard.

**Producer:** Metrics Aggregation Service (Layer B)  
**Consumer:** Grafana, Ops Dashboard

**Status:** Not yet implemented (Stage 4 of shipping plan)

**Planned Schema:**

```json
{
  "payment_id": "PAY-123456",
  "actual_rail": "BECS",
  "actual_latency_ms": 4200,
  "actual_cost_cents": 3.1,
  "rl_recommended_rail": "NPP",
  "rl_expected_latency_ms": 380,
  "rl_expected_cost_cents": 5.8,
  "confidence": 0.88,
  "occurred_at": 1734022339123
}
```

---

## Topic Creation Commands

### Using Kafka CLI

```bash
# Create input topic (Layer A → Layer B)
kafka-topics.sh --create \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.live.shadow \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=604800000

# Create output topic (Layer B intelligence)
kafka-topics.sh --create \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.evaluated \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=2592000000
```

### Using Terraform (AWS MSK)

```hcl
resource "aws_msk_topic" "payments_live_shadow" {
  cluster_arn = aws_msk_cluster.turingcore.arn
  name        = "protocol.payments.live.shadow"
  partitions  = 12
  replication_factor = 3
  
  config = {
    "retention.ms" = "604800000"  # 7 days
    "compression.type" = "snappy"
  }
}

resource "aws_msk_topic" "payments_rl_evaluated" {
  cluster_arn = aws_msk_cluster.turingcore.arn
  name        = "protocol.payments.rl.evaluated"
  partitions  = 12
  replication_factor = 3
  
  config = {
    "retention.ms" = "2592000000"  # 30 days
    "compression.type" = "snappy"
  }
}
```

---

## Monitoring & Observability

### Key Metrics to Track

**Input Topic (`protocol.payments.live.shadow`):**
- Messages per second (throughput)
- Consumer lag (should be < 1 second in shadow mode)
- Event type distribution (PaymentInitiated vs PaymentSettled)

**Output Topic (`protocol.payments.rl.evaluated`):**
- Messages per second (should match input rate when RL enabled)
- Confidence score distribution
- Proposed action distribution (ROUTE_NPP vs ROUTE_BECS)

### Grafana Queries

```promql
# Consumer lag (critical metric)
kafka_consumer_lag{topic="protocol.payments.live.shadow", group="payments-rl-shadow-consumer"}

# Throughput
rate(kafka_topic_partition_current_offset{topic="protocol.payments.live.shadow"}[5m])

# RL evaluation rate
rate(kafka_topic_partition_current_offset{topic="protocol.payments.rl.evaluated"}[5m])
```

---

## Security & Access Control

### ACLs (Kafka Authorization)

```bash
# Layer A producer (TuringCore Payments)
kafka-acls.sh --add \
  --allow-principal User:turingcore-payments \
  --operation Write \
  --topic protocol.payments.live.shadow

# Layer B consumer (Payments RL Shadow)
kafka-acls.sh --add \
  --allow-principal User:payments-rl-shadow \
  --operation Read \
  --topic protocol.payments.live.shadow \
  --group payments-rl-shadow-consumer

# Layer B producer (Payments RL Shadow)
kafka-acls.sh --add \
  --allow-principal User:payments-rl-shadow \
  --operation Write \
  --topic protocol.payments.rl.evaluated
```

### AWS MSK IAM Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kafka-cluster:Connect",
        "kafka-cluster:DescribeTopic",
        "kafka-cluster:ReadData"
      ],
      "Resource": [
        "arn:aws:kafka:ap-southeast-2:*:topic/*/protocol.payments.live.shadow"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "kafka-cluster:Connect",
        "kafka-cluster:DescribeTopic",
        "kafka-cluster:WriteData"
      ],
      "Resource": [
        "arn:aws:kafka:ap-southeast-2:*:topic/*/protocol.payments.rl.evaluated"
      ]
    }
  ]
}
```

---

## Testing & Validation

### Verify Topic Creation

```bash
# List topics
kafka-topics.sh --list --bootstrap-server localhost:9092

# Describe topic configuration
kafka-topics.sh --describe \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.live.shadow
```

### Produce Test Event

```bash
# Produce sample PaymentInitiated event
echo '{
  "event_type": "PaymentInitiated",
  "event_id": "test-001",
  "tenant_id": "CU-TEST",
  "payment_id": "PAY-TEST-001",
  "account_id": "ACCT-TEST",
  "amount_cents": 5000,
  "currency": "AUD",
  "channel": "API",
  "rail_used": "NPP",
  "attempt": 1,
  "origin": "CORE",
  "occurred_at": '$(date +%s000)',
  "schema_version": "1.0"
}' | kafka-console-producer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.live.shadow
```

### Consume Test Event

```bash
# Consume from input topic
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.live.shadow \
  --from-beginning

# Consume from output topic (after RL consumer runs)
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.evaluated \
  --from-beginning
```

---

## Troubleshooting

### Consumer Not Receiving Events

1. Check consumer group lag:
   ```bash
   kafka-consumer-groups.sh --describe \
     --bootstrap-server localhost:9092 \
     --group payments-rl-shadow-consumer
   ```

2. Verify topic exists and has data:
   ```bash
   kafka-run-class.sh kafka.tools.GetOffsetShell \
     --broker-list localhost:9092 \
     --topic protocol.payments.live.shadow
   ```

3. Check ACLs/IAM permissions

### No Output Events Produced

1. Check kill-switch environment variables:
   ```bash
   echo $RISK_BRAIN_PAYMENTS_RL_ENABLED  # Should be "true"
   echo $RISK_BRAIN_GOV_AUTH             # Should be "SHADOW_ENABLED"
   ```

2. Check consumer logs for exceptions

3. Verify Kafka producer connectivity

---

## Compliance & Audit

### Data Retention Policy

- **Input topic:** 7 days (operational requirement)
- **Output topic:** 30 days (regulatory audit trail)
- **Long-term archive:** S3 backup for 7 years (APRA CPS 231)

### Event Immutability

All events in Protocol topics are **immutable**. No updates or deletes are permitted.

**Audit Trail Properties:**
- ✅ Every RL evaluation is recorded with state hash
- ✅ Full event lineage (payment_id links input → output)
- ✅ Policy version provenance (policy_id, policy_version)
- ✅ Timestamp precision (millisecond accuracy)

---

## Next Steps

1. **Create topics** in your Kafka cluster (dev, staging, production)
2. **Configure ACLs** for Layer A and Layer B services
3. **Deploy consumer service** with correct environment variables
4. **Verify event flow** using console consumer
5. **Monitor consumer lag** in Grafana
6. **Validate shadow mode** operation (no execution commands)

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-08  
**Next Review:** After Stage 4 (Metrics) implementation
