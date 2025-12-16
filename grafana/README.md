# TuringCore CU Shadow Migration Executive Dashboard

Board-grade Grafana dashboard for real-time shadow migration monitoring and cutover readiness tracking.

## Purpose

Provides live, board-safe visibility into:
- Shadow health status
- Transaction mirroring integrity
- Balance reconciliation accuracy
- GL reconciliation precision
- Product invariant compliance
- Ledger invariant enforcement
- CPS-230 operational resilience
- Cutover readiness scoring

## Audience

- **Board**: High-level cutover readiness
- **CRO/CFO**: Financial integrity assurance
- **CIO/Ops**: Operational health monitoring
- **APRA observers**: Compliance verification (read-only)

## Dashboard Panels

### Row 1: Core Health Metrics
1. **Shadow Health Status**: GREEN/RED overall status
2. **Transaction Delta**: UltraData vs TuringCore transaction count difference
3. **Balance Mismatches**: Number of accounts with balance discrepancies
4. **GL Delta**: General Ledger variance in AUD
5. **Consecutive GREEN Days**: Progress toward 30-day cutover gate

### Row 2: Invariant & Compliance
6. **Product Invariants**: PASS/FAIL status for all 4 product invariants
7. **Ledger Invariants**: PASS/FAIL status for all 3 ledger invariants
8. **CPS-230 Data Integrity**: Compliance status
9. **CPS-230 RTO**: Recovery Time Objective in hours
10. **Interest Delta**: Interest calculation variance in AUD

### Row 3: Cutover Readiness
11. **Cutover Readiness Score**: 0-100 gauge (90+ = ready)
12. **Shadow GL Delta Over Time**: Time series of GL variance

### Row 4: Operational Metrics
13. **Transaction Mirroring Rate**: Transactions per second
14. **Invariant Violations Over Time**: Product + Ledger violations

### Row 5: Cutover Gate Checklist
15. **Cutover Gate Checklist**: Table showing all gate conditions

## Installation

### 1. Import Dashboard into Grafana

**Option A: Via UI**
1. Open Grafana → Dashboards → Import
2. Upload `cu_shadow_executive_dashboard.json`
3. Select Prometheus data source
4. Click Import

**Option B: Via API**
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -d @cu_shadow_executive_dashboard.json \
  http://your-grafana-instance/api/dashboards/db
```

### 2. Configure Prometheus Data Source

Ensure Grafana has a Prometheus data source configured:
- URL: `http://prometheus:9090` (or your Prometheus endpoint)
- Access: Server (default)

### 3. Set Up Metrics Export

Your shadow pipeline must emit metrics to Prometheus. Two options:

**Option A: Prometheus Pushgateway**
```python
from observability.shadow_metrics import ShadowMetrics, ShadowRunResults

results = ShadowRunResults(
    tenant_id="CU_ALPHA_SHADOW",
    date="2025-12-08",
    status="GREEN",
    transaction_delta=0,
    balance_mismatches=0,
    gl_delta=0.0,
    interest_delta=0.0,
    product_invariants_passed=True,
    ledger_invariants_passed=True,
    cps230_integrity=True,
    cps230_rto_hours=2.0,
    consecutive_green_days=15,
    cutover_score=94
)

metrics = ShadowMetrics(pushgateway_url="http://pushgateway:9091")
metrics.record_shadow_run(results)
metrics.export_to_pushgateway()
```

**Option B: Node Exporter Textfile Collector**
```python
metrics = ShadowMetrics()
metrics.record_shadow_run(results)
metrics.export_to_file("/var/lib/node_exporter/textfile_collector/shadow.prom")
```

## Required Prometheus Metrics

The dashboard expects the following metrics:

```prometheus
# Core status
shadow_status{tenant="CU_ALPHA_SHADOW"} 1

# Transaction mirroring
shadow_transaction_delta{tenant="CU_ALPHA_SHADOW"} 0
shadow_transactions_mirrored_total{tenant="CU_ALPHA_SHADOW"} 128442

# Balance reconciliation
shadow_balance_mismatches{tenant="CU_ALPHA_SHADOW"} 0

# GL reconciliation
shadow_gl_delta{tenant="CU_ALPHA_SHADOW"} 0.00

# Interest & fees
shadow_interest_delta{tenant="CU_ALPHA_SHADOW"} 0.00

# Product invariants
shadow_product_invariant_pass{tenant="CU_ALPHA_SHADOW"} 1
shadow_product_invariant_violations{tenant="CU_ALPHA_SHADOW"} 0

# Ledger invariants
shadow_ledger_invariant_pass{tenant="CU_ALPHA_SHADOW"} 1
shadow_ledger_invariant_violations{tenant="CU_ALPHA_SHADOW"} 0

# CPS-230 compliance
shadow_cps230_integrity{tenant="CU_ALPHA_SHADOW"} 1
shadow_cps230_rto_hours{tenant="CU_ALPHA_SHADOW"} 2

# Cutover readiness
shadow_consecutive_green_days{tenant="CU_ALPHA_SHADOW"} 15
shadow_cutover_score{tenant="CU_ALPHA_SHADOW"} 94

# Cutover gate conditions
shadow_cutover_gate_30_days{tenant="CU_ALPHA_SHADOW"} 0
shadow_cutover_gate_gl_zero{tenant="CU_ALPHA_SHADOW"} 1
shadow_cutover_gate_product_zero{tenant="CU_ALPHA_SHADOW"} 1
shadow_cutover_gate_ledger_zero{tenant="CU_ALPHA_SHADOW"} 1
shadow_cutover_gate_change_freeze{tenant="CU_ALPHA_SHADOW"} 0
```

## Cutover Readiness Scoring

The dashboard calculates a 0-100 cutover readiness score:

| Component | Points | Criteria |
|-----------|--------|----------|
| Status GREEN | 20 | Overall status is GREEN |
| Transaction Delta | 15 | Zero transaction count difference |
| Balance Mismatches | 15 | Zero account balance discrepancies |
| GL Delta | 15 | Zero general ledger variance |
| Product Invariants | 10 | All product invariants PASS |
| Ledger Invariants | 10 | All ledger invariants PASS |
| CPS-230 Integrity | 10 | CPS-230 compliance checks PASS |
| Consecutive GREEN Days | 5 | 30+ consecutive GREEN days |

**Cutover Gate Threshold: 90+ points**

## Cutover Gate Conditions

All conditions must be met for production cutover:

1. ✅ **30 Consecutive GREEN Days**: No failures for 30 days
2. ✅ **Zero GL Variance**: All GL lines match exactly
3. ✅ **Zero Product Breaches**: All product invariants PASS
4. ✅ **Zero Ledger Breaches**: All ledger invariants PASS
5. ✅ **Change Freeze Active**: No config changes during final validation

## Integration with Shadow Pipeline

Integrate metrics export into your shadow run orchestrator:

```python
# In twin-orchestrator/src/scenarios/run_shadow_cycle.py

from observability.shadow_metrics import ShadowMetrics, ShadowRunResults

def run_daily_shadow_cycle(tenant_id: str):
    # Run shadow migration
    results = execute_shadow_migration(tenant_id)
    
    # Generate PDF report
    generate_pdf_report(results)
    
    # Export metrics to Prometheus
    metrics = ShadowMetrics()
    metrics.record_shadow_run(results)
    metrics.export_to_pushgateway()
    
    # Update consecutive GREEN days counter
    update_green_days_counter(tenant_id, results.status)
```

## Board Statement Template

> "Every night your UltraData production system is mirrored transaction-for-transaction into a fully isolated TuringCore shadow bank. Every balance, every GL line, every interest run, and every product rule is independently reconciled and verified under invariant control. This dashboard provides real-time visibility into shadow health, and we will not seek cutover authority until 90 consecutive days show zero unreconciled variance."

## AWS Deployment

For Amazon Managed Grafana:

1. Create Amazon Managed Grafana workspace
2. Configure Amazon Managed Prometheus as data source
3. Import dashboard JSON via Grafana UI
4. Set up IAM roles for cross-service access

For self-hosted Grafana on EKS:

```yaml
# grafana-values.yaml
datasources:
  datasources.yaml:
    apiVersion: 1
    datasources:
    - name: Prometheus
      type: prometheus
      url: http://prometheus-server
      access: proxy
      isDefault: true

dashboardProviders:
  dashboardproviders.yaml:
    apiVersion: 1
    providers:
    - name: 'shadow-migration'
      folder: 'Shadow Migration'
      type: file
      options:
        path: /var/lib/grafana/dashboards/shadow

dashboards:
  shadow-migration:
    cu-shadow-exec:
      file: cu_shadow_executive_dashboard.json
```

## Alerting

Configure Grafana alerts for critical conditions:

- **Shadow Status RED**: Alert board immediately
- **GL Delta > $0.00**: Alert CFO/CRO
- **Consecutive GREEN Days Reset**: Alert migration team
- **Cutover Score < 90**: Alert CIO

## Support

For dashboard issues or feature requests, contact TuringDynamics Shadow Ops team.
