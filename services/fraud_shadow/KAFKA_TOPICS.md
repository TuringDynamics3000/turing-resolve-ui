# Fraud Shadow — Kafka Topics and Event Schemas

**Version:** 1.0  
**Purpose:** Kafka topic configuration for Fraud Shadow v1  
**Owner:** TuringCore National Infrastructure Team

---

## Topic Overview

| Topic | Purpose | Producer | Consumer |
|-------|---------|----------|----------|
| `protocol.fraud.live.shadow` | Fraud-relevant live events | Core Banking | Fraud Shadow Consumer |
| `protocol.fraud.risk.scored` | Fraud risk scores (Layer B) | Fraud Shadow Consumer | Fraud Policy Gateway |
| `protocol.fraud.risk.advisory` | Fraud risk flags (Layer A) | Fraud Policy Gateway | Ops Dashboard |
| `protocol.fraud.shadow.metrics` | Fraud metrics (board KPIs) | Fraud Metrics Aggregator | Board Reporting |

---

## Event Schemas

### 1. CardAuthorisationRequested

**Topic:** `protocol.fraud.live.shadow`

**Purpose:** Card authorization request event (fraud-relevant)

```json
{
  "event_type": "CardAuthorisationRequested",
  "schema_version": "1.0",
  "event_id": "uuid",
  
  "tenant_id": "CU-001",
  "card_id_hash": "card_xxx",
  "account_id_hash": "acct_xxx",
  "merchant_id_hash": "m_xxx",
  "amount_cents": 12500,
  "currency": "AUD",
  "geo_bucket": "AU-NSW",
  "device_id_hash": "dev_xxx",
  "ip_cluster": "asn123-au",
  "channel": "POS | ECOMM",
  
  "origin": "CORE",
  "occurred_at": 1734022335123
}
```

---

### 2. FraudRiskScoreProduced

**Topic:** `protocol.fraud.risk.scored`

**Purpose:** Fraud risk score from Layer B (AI intelligence)

```json
{
  "event_type": "FraudRiskScoreProduced",
  "schema_version": "1.0",
  "event_id": "uuid",
  
  "tenant_id": "CU-001",
  "account_id_hash": "acct_xxx",
  "card_id_hash": "card_xxx",
  "risk_score": 0.91,
  "risk_band": "HIGH | MEDIUM | LOW",
  
  "model_id": "fraud-behaviour-v1",
  "model_version": "1.0",
  "feature_set_version": "1.0",
  "confidence_interval": [0.86, 0.96],
  
  "origin": "AI",
  "occurred_at": 1734022335789
}
```

---

### 3. FraudRiskFlagRaised

**Topic:** `protocol.fraud.risk.advisory`

**Purpose:** Fraud risk flag from Layer A (deterministic policy)

```json
{
  "event_type": "FraudRiskFlagRaised",
  "schema_version": "1.0",
  "event_id": "uuid",
  
  "tenant_id": "CU-001",
  "account_id_hash": "acct_xxx",
  "card_id_hash": "card_xxx",
  "risk_band": "HIGH | MEDIUM",
  
  "policy_id": "fraud-policy-v1",
  "policy_version": "1.0",
  "advisory_reason": "Behavioural anomaly score 0.9100",
  
  "origin": "AI",
  "occurred_at": 1734022336012
}
```

---

### 4. FraudShadowMetric

**Topic:** `protocol.fraud.shadow.metrics`

**Purpose:** Fraud metrics for board KPIs

```json
{
  "event_type": "FraudShadowMetric",
  "schema_version": "1.0",
  "event_id": "uuid",
  
  "tenant_id": "CU-001",
  "account_id_hash": "acct_xxx",
  "card_id_hash": "card_xxx",
  
  "risk_band": "HIGH | MEDIUM",
  "risk_score": 0.91,
  
  "follow_up_action": "NONE | MANUAL_REVIEW",
  "confirmed_fraud": false,
  
  "occurred_at": 1734022999123
}
```

**Board KPIs Derived:**
- High-risk flags / day
- % escalated to human review
- False positive proxy (cleared vs confirmed)

---

## Kafka Configuration

### Topic Creation

```bash
# Create fraud shadow topics
kafka-topics --create --topic protocol.fraud.live.shadow \
  --bootstrap-server localhost:9092 \
  --partitions 10 \
  --replication-factor 3 \
  --config retention.ms=604800000

kafka-topics --create --topic protocol.fraud.risk.scored \
  --bootstrap-server localhost:9092 \
  --partitions 10 \
  --replication-factor 3 \
  --config retention.ms=604800000

kafka-topics --create --topic protocol.fraud.risk.advisory \
  --bootstrap-server localhost:9092 \
  --partitions 10 \
  --replication-factor 3 \
  --config retention.ms=604800000

kafka-topics --create --topic protocol.fraud.shadow.metrics \
  --bootstrap-server localhost:9092 \
  --partitions 10 \
  --replication-factor 3 \
  --config retention.ms=2592000000
```

### ACL Configuration

```bash
# Fraud Shadow Consumer (read fraud events, write risk scores)
kafka-acls --add --allow-principal User:fraud-shadow-consumer \
  --operation Read --topic protocol.fraud.live.shadow \
  --bootstrap-server localhost:9092

kafka-acls --add --allow-principal User:fraud-shadow-consumer \
  --operation Write --topic protocol.fraud.risk.scored \
  --bootstrap-server localhost:9092

# Fraud Policy Gateway (read risk scores, write advisories)
kafka-acls --add --allow-principal User:fraud-policy-gateway \
  --operation Read --topic protocol.fraud.risk.scored \
  --bootstrap-server localhost:9092

kafka-acls --add --allow-principal User:fraud-policy-gateway \
  --operation Write --topic protocol.fraud.risk.advisory \
  --bootstrap-server localhost:9092

# Fraud Metrics Aggregator (read advisories, write metrics)
kafka-acls --add --allow-principal User:fraud-metrics-aggregator \
  --operation Read --topic protocol.fraud.risk.advisory \
  --bootstrap-server localhost:9092

kafka-acls --add --allow-principal User:fraud-metrics-aggregator \
  --operation Write --topic protocol.fraud.shadow.metrics \
  --bootstrap-server localhost:9092
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-08  
**Status:** Production-Ready
