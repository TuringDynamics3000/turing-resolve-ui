# Payments RL Shadow Consumer — Production Deployment Guide

**Version:** 1.0  
**Status:** Production-Ready (Shadow Mode)  
**Owner:** TuringCore National Infrastructure Team

---

## Executive Summary

The **Payments RL Shadow Consumer** is the first live **Layer B (Risk Brain)** domain in the TuringCore National Infrastructure.

**What It Does:**
- Consumes live payment events from TuringCore (Layer A)
- Evaluates RL policy for payment routing optimization
- Emits **advisory intelligence only** (no execution authority)
- Operates in **shadow mode** (observe only, no impact on live payments)

**What It Cannot Do:**
- ❌ Execute payment commands
- ❌ Initiate settlement
- ❌ Move liquidity
- ❌ Block transactions
- ❌ Modify account balances

**Safety Guarantees:**
- ✅ Triple-layer kill switches (env, governance, panic)
- ✅ Zero execution side-effects
- ✅ Full audit trail via Protocol events
- ✅ Deterministic state building (no external I/O)

---

## Architecture Context

### Layer Separation (A/B Architecture)

```
┌─────────────────────────────────────────────────────────────────┐
│ LAYER A (TuringCore) — Deterministic Banking Core              │
│ - Ledger, balances, postings                                    │
│ - NO ML/AI/probabilistic logic                                  │
│ - Emits payment events to Kafka                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Kafka: protocol.payments.live.shadow
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER B (Risk Brain) — Probabilistic Intelligence              │
│ - Payments RL Shadow Consumer ← YOU ARE HERE                    │
│ - ML, AI, RL evaluation                                         │
│ - NO balance updates, NO settlement, NO posting                 │
│ - Emits intelligence events to Kafka                            │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    Kafka: protocol.payments.rl.evaluated
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ LAYER A (Policy Gateway) — Deterministic Enforcement           │
│ - Applies hard rules to AI outputs                             │
│ - Human approval required for execution                         │
│ - Emits advisory events (RlRoutingAdvisoryIssued)              │
└─────────────────────────────────────────────────────────────────┘
```

### Event Flow

```
PaymentInitiated (A)
  → protocol.payments.live.shadow
  → Payments RL Shadow Consumer (B)
  → RlPolicyEvaluated (B)
  → protocol.payments.rl.evaluated
  → Payments Policy Gateway (A)
  → RlRoutingAdvisoryIssued (A)
  → Ops Dashboard / Metrics
```

---

## Prerequisites

### Infrastructure

- **Kafka Cluster:** MSK, Confluent Cloud, or self-hosted Kafka
- **Python:** 3.11+ (tested with 3.11.0rc1)
- **Topics Created:** See [KAFKA_TOPICS.md](./KAFKA_TOPICS.md)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KAFKA_BOOTSTRAP` | Yes | `localhost:9092` | Kafka bootstrap servers |
| `RISK_BRAIN_PAYMENTS_RL_ENABLED` | Yes | `false` | Enable RL evaluation (kill-switch layer 1) |
| `RISK_BRAIN_GOV_AUTH` | No | `SHADOW_DISABLED` | Governance authority level (kill-switch layer 2) |

**Valid `RISK_BRAIN_GOV_AUTH` values:**
- `SHADOW_DISABLED` — RL evaluation disabled
- `SHADOW_ENABLED` — RL evaluation enabled (shadow mode)
- `ADVISORY_ENABLED` — RL evaluation enabled (advisory mode, future)

### Kafka ACLs / IAM Permissions

See [KAFKA_TOPICS.md](./KAFKA_TOPICS.md) for detailed ACL configuration.

**Required Permissions:**
- **Read:** `protocol.payments.live.shadow` (consumer group: `payments-rl-shadow-consumer`)
- **Write:** `protocol.payments.rl.evaluated`

---

## Installation

### 1. Clone Repository

```bash
git clone https://github.com/TuringDynamics3000/turingcore-cu-digital-twin.git
cd turingcore-cu-digital-twin/services/payments_rl_shadow
```

### 2. Install Dependencies

```bash
# Create virtual environment
python3.11 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
# Create .env file
cat > .env << EOF
KAFKA_BOOTSTRAP=your-kafka-bootstrap-servers:9092
RISK_BRAIN_PAYMENTS_RL_ENABLED=true
RISK_BRAIN_GOV_AUTH=SHADOW_ENABLED
EOF

# Load environment
export $(cat .env | xargs)
```

---

## Running the Service

### Local Development

```bash
# Activate virtual environment
source venv/bin/activate

# Run consumer
python consumer.py
```

**Expected Output:**

```
================================================================================
Payments RL Shadow Consumer v1.0
================================================================================
Kafka Bootstrap: localhost:9092
RL Enabled: True
Governance Auth: SHADOW_ENABLED
================================================================================
🚀 Payments RL Shadow Consumer started (policy=payments-rl-stub-v1)
Waiting for payment events...
✅ RlPolicyEvaluated: PAY-123456 → ROUTE_NPP (confidence=0.85)
✅ RlPolicyEvaluated: PAY-123457 → ROUTE_BECS (confidence=0.80)
...
```

### Docker Deployment

```dockerfile
# Dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY consumer.py .

CMD ["python", "consumer.py"]
```

```bash
# Build image
docker build -t turingcore/payments-rl-shadow:1.0 .

# Run container
docker run -d \
  --name payments-rl-shadow \
  -e KAFKA_BOOTSTRAP=your-kafka:9092 \
  -e RISK_BRAIN_PAYMENTS_RL_ENABLED=true \
  -e RISK_BRAIN_GOV_AUTH=SHADOW_ENABLED \
  turingcore/payments-rl-shadow:1.0
```

### Kubernetes Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: payments-rl-shadow
  namespace: turingcore-risk-brain
spec:
  replicas: 2
  selector:
    matchLabels:
      app: payments-rl-shadow
  template:
    metadata:
      labels:
        app: payments-rl-shadow
    spec:
      containers:
      - name: consumer
        image: turingcore/payments-rl-shadow:1.0
        env:
        - name: KAFKA_BOOTSTRAP
          valueFrom:
            configMapKeyRef:
              name: kafka-config
              key: bootstrap-servers
        - name: RISK_BRAIN_PAYMENTS_RL_ENABLED
          value: "true"
        - name: RISK_BRAIN_GOV_AUTH
          value: "SHADOW_ENABLED"
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
```

---

## Testing

### Unit Tests

```bash
# Run unit tests (future implementation)
pytest tests/test_consumer.py -v
```

### Integration Tests

#### 1. Produce Test Payment Event

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

#### 2. Verify RL Evaluation Output

```bash
# Consume from output topic
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.evaluated \
  --from-beginning
```

**Expected Output:**

```json
{
  "event_type": "RlPolicyEvaluated",
  "schema_version": "1.0",
  "event_id": "...",
  "occurred_at": 1734022335456,
  "origin": "AI",
  "tenant_id": "CU-TEST",
  "payment_id": "PAY-TEST-001",
  "state_hash": "...",
  "proposed_action": "ROUTE_NPP",
  "confidence_score": 0.85,
  "reward_estimate": 0.012,
  "policy_id": "payments-rl-stub-v1",
  "policy_version": "1.0"
}
```

#### 3. Verify No Execution Commands

```bash
# Search for forbidden commands (should return empty)
kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.evaluated \
  --from-beginning | grep -E "(PaymentCommand|SettlementCommand|PostingCommand)"

# Exit code 1 = no matches = PASS
```

---

## Kill-Switch Testing

### Layer 1: Environment Variable

```bash
# Disable RL evaluation
export RISK_BRAIN_PAYMENTS_RL_ENABLED=false

# Restart service
python consumer.py

# Verify: No RlPolicyEvaluated events should be emitted
# Payments continue normally in Layer A
```

### Layer 2: Governance Authority

```bash
# Disable via governance
export RISK_BRAIN_GOV_AUTH=SHADOW_DISABLED

# Restart service
python consumer.py

# Verify: No RlPolicyEvaluated events should be emitted
```

### Layer 3: Panic Signal

```bash
# Send SIGTERM to running process
kill -TERM <pid>

# Verify: Service stops immediately with "PANIC STOP" message
# Payments continue normally in Layer A
```

**Expected Output:**

```
🚨 PANIC STOP: Payments RL Shadow halted immediately
```

---

## Monitoring & Observability

### Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Consumer Lag | Delay in processing payment events | > 1000 messages |
| Evaluation Rate | RL evaluations per second | < 90% of input rate |
| Error Rate | Failed evaluations per second | > 1% of input rate |
| Confidence Distribution | Distribution of confidence scores | < 0.5 avg confidence |

### Grafana Dashboard

See [../../grafana/payments_rl_shadow_dashboard.json](../../grafana/payments_rl_shadow_dashboard.json) for pre-built dashboard.

**Key Panels:**
- Consumer lag (time series)
- Evaluation throughput (rate)
- Confidence score distribution (histogram)
- Proposed action distribution (pie chart)
- Error rate (time series)

### Prometheus Queries

```promql
# Consumer lag
kafka_consumer_lag{topic="protocol.payments.live.shadow", group="payments-rl-shadow-consumer"}

# Evaluation rate
rate(kafka_topic_partition_current_offset{topic="protocol.payments.rl.evaluated"}[5m])

# Error rate (requires custom metric export)
rate(payments_rl_shadow_errors_total[5m])
```

---

## Troubleshooting

### Consumer Not Starting

**Symptom:** Service exits immediately after start.

**Possible Causes:**
1. Kafka connection failure
2. Missing environment variables
3. Topic does not exist

**Resolution:**

```bash
# Check Kafka connectivity
telnet your-kafka-bootstrap 9092

# Verify environment variables
echo $KAFKA_BOOTSTRAP
echo $RISK_BRAIN_PAYMENTS_RL_ENABLED

# Verify topic exists
kafka-topics.sh --list --bootstrap-server localhost:9092 | grep protocol.payments.live.shadow
```

### No Events Consumed

**Symptom:** Consumer starts but no events are processed.

**Possible Causes:**
1. Kill-switch disabled
2. No payment events in topic
3. Consumer group offset at end of topic

**Resolution:**

```bash
# Check kill-switches
echo $RISK_BRAIN_PAYMENTS_RL_ENABLED  # Should be "true"
echo $RISK_BRAIN_GOV_AUTH             # Should be "SHADOW_ENABLED"

# Check topic has data
kafka-run-class.sh kafka.tools.GetOffsetShell \
  --broker-list localhost:9092 \
  --topic protocol.payments.live.shadow

# Reset consumer group offset (CAUTION: reprocesses all events)
kafka-consumer-groups.sh --reset-offsets \
  --bootstrap-server localhost:9092 \
  --group payments-rl-shadow-consumer \
  --topic protocol.payments.live.shadow \
  --to-earliest \
  --execute
```

### No Output Events Produced

**Symptom:** Consumer processes events but no output in `protocol.payments.rl.evaluated`.

**Possible Causes:**
1. Kill-switch disabled
2. Kafka producer failure
3. Exception in RL evaluation

**Resolution:**

```bash
# Check consumer logs for exceptions
docker logs payments-rl-shadow

# Verify Kafka producer connectivity
# (should see "✅ RlPolicyEvaluated" in logs)

# Check output topic permissions
kafka-acls.sh --list \
  --bootstrap-server localhost:9092 \
  --topic protocol.payments.rl.evaluated
```

---

## Production Checklist

Before deploying to production, verify:

- [ ] Kafka topics created with correct retention and replication
- [ ] ACLs / IAM permissions configured
- [ ] Environment variables set correctly
- [ ] Kill-switches tested (all three layers)
- [ ] Integration test passed (test event → RL evaluation)
- [ ] No execution commands emitted (grep test passed)
- [ ] Grafana dashboard deployed
- [ ] Alerts configured (consumer lag, error rate)
- [ ] Runbook documented (incident response)
- [ ] Regulator disclosure completed (APRA, AUSTRAC)

---

## Operational Runbook

### Incident: High Consumer Lag

**Detection:** Alert fires when consumer lag > 1000 messages.

**Impact:** RL evaluations delayed, but no impact on live payments (shadow mode).

**Response:**
1. Check consumer health: `kubectl logs -f deployment/payments-rl-shadow`
2. Check Kafka cluster health
3. Scale consumer replicas if needed: `kubectl scale deployment/payments-rl-shadow --replicas=4`
4. If persistent, disable RL via kill-switch: `kubectl set env deployment/payments-rl-shadow RISK_BRAIN_PAYMENTS_RL_ENABLED=false`

### Incident: High Error Rate

**Detection:** Alert fires when error rate > 1% of input rate.

**Impact:** RL evaluations failing, but no impact on live payments (shadow mode).

**Response:**
1. Check consumer logs for exception patterns
2. Verify payment event schema compatibility
3. If schema mismatch, deploy hotfix or disable RL
4. Escalate to Risk Brain team if unknown error

### Incident: Execution Command Detected

**Detection:** CI/CD pipeline fails, or manual audit detects forbidden command.

**Impact:** **CRITICAL** — Potential breach of A/B separation.

**Response:**
1. **IMMEDIATE:** Trigger panic kill-switch: `kubectl delete deployment/payments-rl-shadow`
2. Isolate affected code version
3. Audit all output events for execution commands
4. Notify APRA, AUSTRAC, board (if production)
5. Root cause analysis and post-mortem
6. Do not redeploy until fix validated in CI

---

## Compliance & Audit

### Regulatory Disclosure

This service is disclosed to regulators in:
- [APRA Pilot Disclosure Pack](../../docs/APRA_PILOT_DISCLOSURE_PACK.md)
- [Regulator Pre-Engagement Briefing Pack](../../docs/REGULATOR_PRE_ENGAGEMENT_BRIEFING_PACK.md)

### Audit Trail

All RL evaluations are recorded with:
- ✅ Payment identifier (links to original payment)
- ✅ State hash (deterministic, reproducible)
- ✅ Policy version (provenance)
- ✅ Timestamp (millisecond precision)
- ✅ Confidence score (model uncertainty)

**Retention:** 30 days in Kafka, 7 years in S3 (APRA CPS 231).

### Shadow Mode Validation

To prove shadow mode operation:
1. No execution commands emitted (grep test)
2. No impact on payment settlement (A/B separation)
3. No customer-facing changes (observe only)
4. Full kill-switch functionality (tested weekly)

---

## Next Steps

### Stage 2 Complete ✅

You have now completed **Stage 2** of the Payments RL Shadow shipping plan:

> **Stage 2:** B → Payments RL Consumer (Shadow Only)

**What's Next:**

1. **Stage 3:** B → A via Protocol (Policy Gateway + Enforcement)
   - Implement `payments.policy_gateway.py`
   - Emit `RlRoutingAdvisoryIssued` events
   - Assert no execution commands

2. **Stage 4:** Ops Metrics Stream
   - Implement metrics aggregation
   - Create Grafana dashboard
   - Track latency delta, retry avoided %, cost delta

3. **Stage 5:** Kill Switch (Live Tested)
   - Automated weekly kill-switch drills
   - CI/CD integration

4. **Stage 6:** Harness → CI (Red/Green Gate)
   - Synthetic payment replay
   - Assert no forbidden commands
   - Fail build on violation

5. **Stage 7:** Board & Regulator Proof Pack
   - Auto-derived weekly metrics
   - Kill-switch drill logs
   - Harness pass logs

---

## Support & Contact

**Owner:** TuringCore National Infrastructure Team  
**Repository:** https://github.com/TuringDynamics3000/turingcore-cu-digital-twin  
**Documentation:** `/docs` directory  
**Issues:** GitHub Issues

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-08  
**Status:** Production-Ready (Shadow Mode)
