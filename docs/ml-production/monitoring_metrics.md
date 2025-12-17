# Monitoring & Metrics (Required)

## SLO metrics (must be dashboarded)
- inference_latency_ms{p50,p95,p99}
- inference_timeout_rate
- inference_error_rate
- inference_throughput
- shadow_coverage_rate

## Data quality & drift
- feature_missingness_rate{feature}
- feature_schema_mismatch_count
- drift_psi{feature} (daily)
- drift_ks{feature} (daily)
- prediction_distribution_shift (e.g., JS divergence)

## Governance
- provenance_missing_rate
- model_fallback_rate (baseline due to timeout/error)
- model_auto_disable_events
- promotion_events, rollback_events
- constitution_block_rate (model proposals blocked)
- constitution_modify_rate (model proposals modified)

## Outcome metrics (domain-specific; pick at least 2)
Collections: cure_rate, dollars_collected, complaint_rate
Fraud: true_positive_rate, false_positive_rate, customer_friction_rate
Pricing: margin_delta, conversion_rate_delta
