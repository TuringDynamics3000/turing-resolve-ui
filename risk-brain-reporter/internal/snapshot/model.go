// Risk Brain Reporter — Canonical Snapshot Model (v1)
//
// This is the canonical data model for Risk Brain snapshots.
// Any attempt to add fields must break validation tests.
//
// HARD LOCK: Schema version 1.0
// DO NOT MODIFY without incrementing schema version and updating all consumers.
//
// Author: TuringCore National Infrastructure Team
// Version: 1.0

package snapshot

import "time"

// CanonicalRiskSnapshot is the canonical data model for Risk Brain snapshots.
type CanonicalRiskSnapshot struct {
	// Metadata
	SchemaVersion string    `json:"schema_version"`
	Week          string    `json:"week"`
	TenantID      string    `json:"tenant_id"`
	GeneratedAt   time.Time `json:"generated_at"`

	// Period
	Period Period `json:"period"`

	// Domain Health
	Health DomainHealthSet `json:"health"`

	// Safety Metrics
	Safety SafetySet `json:"safety"`

	// Domain Metrics
	Payments PaymentsMetrics `json:"payments"`
	Fraud    FraudMetrics    `json:"fraud"`
	AML      AMLMetrics      `json:"aml"`
	Treasury TreasuryMetrics `json:"treasury"`
}

// Period represents the time period for the snapshot.
type Period struct {
	Start time.Time `json:"start"`
	End   time.Time `json:"end"`
}

// DomainHealthSet represents the health status of all Risk Brain domains.
type DomainHealthSet struct {
	PaymentsShadowEnabled bool `json:"payments_shadow_enabled"`
	FraudShadowEnabled    bool `json:"fraud_shadow_enabled"`
	AMLShadowEnabled      bool `json:"aml_shadow_enabled"`
	TreasuryShadowEnabled bool `json:"treasury_shadow_enabled"`

	PaymentsCIPass bool `json:"payments_ci_pass"`
	FraudCIPass    bool `json:"fraud_ci_pass"`
	AMLCIPass      bool `json:"aml_ci_pass"`
	TreasuryCIPass bool `json:"treasury_ci_pass"`
}

// SafetySet represents safety metrics (MUST be 0).
type SafetySet struct {
	AIOriginViolations      int64 `json:"ai_origin_violations"`
	SchemaVersionViolations int64 `json:"schema_version_violations"`
	PolicyOriginViolations  int64 `json:"policy_origin_violations"`
	KillswitchActivations   int64 `json:"killswitch_activations"`
}

// PaymentsMetrics represents Payments RL Shadow metrics.
type PaymentsMetrics struct {
	CoveragePct         float64 `json:"coverage_pct"`
	WinRate             float64 `json:"win_rate"`
	LossRate            float64 `json:"loss_rate"`
	NeutralRate         float64 `json:"neutral_rate"`
	AvgConfidence       float64 `json:"avg_confidence"`
	AvgLatencyDelta     float64 `json:"avg_latency_delta"`
	AvgCostDelta        float64 `json:"avg_cost_delta"`
	AdvisoryCount       int64   `json:"advisory_count"`
	ModelHealthScore    float64 `json:"model_health_score"`
}

// FraudMetrics represents Fraud Shadow metrics.
type FraudMetrics struct {
	HighRiskFlagsCount   int64   `json:"high_risk_flags_count"`
	MediumRiskFlagsCount int64   `json:"medium_risk_flags_count"`
	LowRiskFlagsCount    int64   `json:"low_risk_flags_count"`
	AvgRiskScore         float64 `json:"avg_risk_score"`
	FalsePositiveRate    float64 `json:"false_positive_rate"`
	ModelHealthScore     float64 `json:"model_health_score"`
}

// AMLMetrics represents AML Shadow metrics.
type AMLMetrics struct {
	HighRiskFlagsCount   int64   `json:"high_risk_flags_count"`
	MediumRiskFlagsCount int64   `json:"medium_risk_flags_count"`
	LowRiskFlagsCount    int64   `json:"low_risk_flags_count"`
	AvgRiskScore         float64 `json:"avg_risk_score"`
	BehaviouralDrift     float64 `json:"behavioural_drift"`
	ModelHealthScore     float64 `json:"model_health_score"`
}

// TreasuryMetrics represents Treasury RL Shadow metrics.
type TreasuryMetrics struct {
	HighStressCount      int64   `json:"high_stress_count"`
	MediumStressCount    int64   `json:"medium_stress_count"`
	LowStressCount       int64   `json:"low_stress_count"`
	AvgStressScore       float64 `json:"avg_stress_score"`
	LiquidityPosture     string  `json:"liquidity_posture"`
	ModelHealthScore     float64 `json:"model_health_score"`
}
