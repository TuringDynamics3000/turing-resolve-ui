# Prometheus Queries for Payments RL Shadow

**Version:** 1.0  
**Purpose:** Operational metrics and monitoring for Payments RL Shadow  
**Owner:** TuringCore National Infrastructure Team

---

## Metrics Export Requirements

To use these queries, your services must export the following Prometheus metrics:

### 1. Advisory Metrics

```python
# In policy_gateway_consumer.py or metrics exporter

from prometheus_client import Counter, Histogram, Gauge

# Advisory volume
payments_rl_advisory_metric_total = Counter(
    'payments_rl_advisory_metric_total',
    'Total number of RL advisory metrics emitted',
    ['tenant_id', 'direction']
)

# Advisory direction
payments_rl_advisory_direction_total = Counter(
    'payments_rl_advisory_direction_total',
    'Total number of RL advisories by direction',
    ['tenant_id', 'direction']  # direction: RL_BETTER, RL_WORSE, NEUTRAL
)

# Confidence distribution
payments_rl_confidence = Histogram(
    'payments_rl_confidence',
    'RL confidence score distribution',
    ['tenant_id'],
    buckets=[0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0]
)

# Latency delta
payments_rl_latency_ms_delta = Histogram(
    'payments_rl_latency_ms_delta',
    'Latency delta between RL recommendation and actual outcome (ms)',
    ['tenant_id'],
    buckets=[-5000, -2000, -1000, -500, 0, 500, 1000, 2000, 5000]
)

# Cost delta
payments_rl_cost_cents_delta = Histogram(
    'payments_rl_cost_cents_delta',
    'Cost delta between RL recommendation and actual outcome (cents)',
    ['tenant_id'],
    buckets=[-10, -5, -2, -1, 0, 1, 2, 5, 10]
)
```

### 2. Health Metrics

```python
# Kill-switch status
risk_brain_payments_rl_enabled = Gauge(
    'risk_brain_payments_rl_enabled',
    'RL Shadow enabled status (1=enabled, 0=disabled)'
)

# Harness CI status
payments_rl_harness_ci_pass = Gauge(
    'payments_rl_harness_ci_pass',
    'Harness CI pass status (1=passing, 0=failing)'
)
```

### 3. Enforcement Metrics

```python
# Enforcement violations
enforcement_ai_origin_violations_total = Counter(
    'enforcement_ai_origin_violations_total',
    'Total AI origin violations detected'
)

enforcement_schema_violations_total = Counter(
    'enforcement_schema_violations_total',
    'Total schema version violations detected'
)

enforcement_policy_violations_total = Counter(
    'enforcement_policy_violations_total',
    'Total policy gateway violations detected'
)
```

### 4. Payment Volume Metrics

```python
# Total payments (from core system)
payments_total = Counter(
    'payments_total',
    'Total number of payments processed',
    ['tenant_id', 'rail']
)
```

---

## Prometheus Queries

### Panel 1: RL Advisory Volume Over Time

**Purpose:** Prove RL is alive and observing payment traffic

**Query:**
```promql
sum by (tenant_id) (count_over_time(payments_rl_advisory_metric_total[1h]))
```

**Interpretation:**
- Should show steady volume matching payment traffic
- Drops indicate RL shadow is disabled or failing
- Spikes indicate increased payment volume

---

### Panel 2: RL Win/Loss/Neutral Share

**Purpose:** Prove RL is directionally useful even in shadow mode

**Query:**
```promql
sum by (direction) (increase(payments_rl_advisory_direction_total[7d]))
```

**Interpretation:**
- `RL_BETTER` > 50% = Model is providing value
- `RL_WORSE` > 50% = Model needs retraining
- `NEUTRAL` > 80% = Model is too conservative

**Alert Threshold:**
- `RL_WORSE` > 40% → Model degradation alert

---

### Panel 3: RL Confidence Distribution

**Purpose:** Show model is not random

**Queries:**
```promql
# Median confidence (p50)
histogram_quantile(0.5, sum(rate(payments_rl_confidence_bucket[1d])) by (le))

# 90th percentile confidence (p90)
histogram_quantile(0.9, sum(rate(payments_rl_confidence_bucket[1d])) by (le))
```

**Interpretation:**
- p50 > 0.70 = Model is confident
- p90 > 0.85 = Model has high-confidence recommendations
- p50 < 0.50 = Model is uncertain (needs more training)

**Alert Threshold:**
- p50 < 0.60 → Model quality alert

---

### Panel 4: Latency & Cost Trend

**Purpose:** Quantify potential benefit of RL recommendations

**Queries:**
```promql
# 7-day rolling average latency delta
avg_over_time(payments_rl_latency_ms_delta[7d])

# 7-day rolling average cost delta
avg_over_time(payments_rl_cost_cents_delta[7d])
```

**Interpretation:**
- Negative latency delta = RL would have been faster
- Positive cost delta = RL would have cost more
- Trade-off analysis: latency vs cost

**Example:**
- Avg latency delta: -3820 ms → RL would save 3.8 seconds per payment
- Avg cost delta: +2.7 cents → RL would cost 2.7 cents more per payment

---

### Panel 5: Kill-Switch Status

**Purpose:** Board/CRO visibility into RL shadow status

**Query:**
```promql
risk_brain_payments_rl_enabled
```

**Interpretation:**
- 1 = RL Shadow enabled
- 0 = RL Shadow disabled (kill-switch activated)

**Alert Threshold:**
- Unexpected flip (enabled → disabled) → Investigation required

---

### Panel 6: Harness CI Status

**Purpose:** Prove safety invariants are maintained

**Query:**
```promql
payments_rl_harness_ci_pass
```

**Interpretation:**
- 1 = Harness CI passing (safety invariants maintained)
- 0 = Harness CI failing (safety breach detected)

**Alert Threshold:**
- Value = 0 → CRITICAL alert, disable RL immediately

---

### Panel 7: Enforcement Violations

**Purpose:** Detect critical safety breaches

**Query:**
```promql
sum(
  enforcement_ai_origin_violations_total + 
  enforcement_schema_violations_total + 
  enforcement_policy_violations_total
)
```

**Interpretation:**
- Should ALWAYS be 0
- > 0 = CRITICAL breach detected

**Alert Threshold:**
- Value > 0 → CRITICAL alert, notify APRA/AUSTRAC/board immediately

---

### Panel 8: Customer Impact

**Purpose:** Prove RL has no customer impact (advisory only)

**Query:**
```promql
0
```

**Interpretation:**
- Always 0 (no execution authority, advisory only)
- This is a constant to reassure boards/regulators

---

### Panel 9: RL Advisory Rate

**Purpose:** Measure RL shadow coverage

**Query:**
```promql
(sum(rate(payments_rl_advisory_metric_total[1h])) / 
 sum(rate(payments_total[1h]))) * 100
```

**Interpretation:**
- 100% = RL observing all payments
- < 80% = Partial coverage (investigate)

**Alert Threshold:**
- < 50% → Coverage alert

---

### Panel 10: RL Model Health Score

**Purpose:** Single metric for model quality

**Query:**
```promql
(sum(rate(payments_rl_advisory_direction_total{direction="RL_BETTER"}[7d])) / 
 sum(rate(payments_rl_advisory_direction_total[7d]))) * 100
```

**Interpretation:**
- > 60% = Healthy model
- 40-60% = Marginal model (monitor)
- < 40% = Unhealthy model (retrain)

**Alert Threshold:**
- < 40% → Model health alert

---

## Alert Rules

### Critical Alerts

```yaml
groups:
  - name: payments_rl_critical
    interval: 30s
    rules:
      - alert: PaymentsRlEnforcementViolation
        expr: sum(enforcement_ai_origin_violations_total + enforcement_schema_violations_total + enforcement_policy_violations_total) > 0
        for: 0s
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: Enforcement violation detected in Payments RL Shadow"
          description: "Enforcement violations detected. Notify APRA, AUSTRAC, board immediately."
      
      - alert: PaymentsRlHarnessFailing
        expr: payments_rl_harness_ci_pass == 0
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "CRITICAL: Payments RL harness CI failing"
          description: "Safety invariants violated. Disable RL Shadow immediately."
```

### Warning Alerts

```yaml
  - name: payments_rl_warnings
    interval: 5m
    rules:
      - alert: PaymentsRlModelDegradation
        expr: (sum(rate(payments_rl_advisory_direction_total{direction="RL_WORSE"}[7d])) / sum(rate(payments_rl_advisory_direction_total[7d]))) * 100 > 40
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "WARNING: Payments RL model degradation detected"
          description: "RL_WORSE advisories > 40%. Model may need retraining."
      
      - alert: PaymentsRlLowConfidence
        expr: histogram_quantile(0.5, sum(rate(payments_rl_confidence_bucket[1d])) by (le)) < 0.6
        for: 6h
        labels:
          severity: warning
        annotations:
          summary: "WARNING: Payments RL low confidence detected"
          description: "Median confidence < 60%. Model quality issue."
      
      - alert: PaymentsRlLowCoverage
        expr: (sum(rate(payments_rl_advisory_metric_total[1h])) / sum(rate(payments_total[1h]))) * 100 < 50
        for: 1h
        labels:
          severity: warning
        annotations:
          summary: "WARNING: Payments RL low coverage"
          description: "RL observing < 50% of payments. Investigate deployment."
```

---

## Grafana Dashboard Import

To import the Grafana dashboard:

1. Open Grafana
2. Go to Dashboards → Import
3. Upload `grafana_dashboard_payments_rl.json`
4. Select Prometheus data source
5. Click Import

---

## Prometheus Configuration

Add to `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: 'payments-rl-shadow'
    scrape_interval: 30s
    static_configs:
      - targets: ['payments-rl-shadow-consumer:8000']
    
  - job_name: 'payments-policy-gateway'
    scrape_interval: 30s
    static_configs:
      - targets: ['payments-policy-gateway:8000']
    
  - job_name: 'payments-rl-metrics-aggregator'
    scrape_interval: 30s
    static_configs:
      - targets: ['payments-rl-metrics-aggregator:8000']
```

---

**Document Version:** 1.0  
**Last Updated:** 2025-12-08  
**Status:** Production-Ready
