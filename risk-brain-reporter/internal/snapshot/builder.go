// Risk Brain Reporter — Snapshot Builder
//
// This module builds canonical risk snapshots from Prometheus metrics.
//
// Author: TuringCore National Infrastructure Team
// Version: 1.0

package snapshot

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/TuringDynamics3000/turingcore-cu-digital-twin/risk-brain-reporter/internal/metrics"
)

const SchemaVersion = "1.0"

// ResolveWeek resolves the current week in ISO 8601 format (e.g., "2025-W49").
func ResolveWeek(now time.Time) string {
	year, week := now.ISOWeek()
	return fmt.Sprintf("%d-W%02d", year, week)
}

// LoadTenants loads the list of tenants from environment variable.
func LoadTenants() []string {
	tenantsEnv := os.Getenv("TENANTS")
	if tenantsEnv == "" {
		return []string{"cu_default"}
	}
	return strings.Split(tenantsEnv, ",")
}

// Build builds a canonical risk snapshot for a tenant and week.
func Build(ctx context.Context, client *metrics.Client, tenantID string, week string) (*CanonicalRiskSnapshot, error) {
	// Parse week to get period
	period, err := parsePeriod(week)
	if err != nil {
		return nil, fmt.Errorf("failed to parse week: %w", err)
	}

	return BuildForPeriod(ctx, client, tenantID, period.Start, period.End)
}

// BuildForPeriod builds a canonical risk snapshot for a tenant and period.
func BuildForPeriod(ctx context.Context, client *metrics.Client, tenantID string, start, end time.Time) (*CanonicalRiskSnapshot, error) {
	csr := &CanonicalRiskSnapshot{
		SchemaVersion: SchemaVersion,
		TenantID:      tenantID,
		GeneratedAt:   time.Now(),
		Period: Period{
			Start: start,
			End:   end,
		},
	}

	// Resolve week from period
	year, week := end.ISOWeek()
	csr.Week = fmt.Sprintf("%d-W%02d", year, week)

	// Build health metrics
	health, err := buildHealthMetrics(ctx, client, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to build health metrics: %w", err)
	}
	csr.Health = health

	// Build safety metrics
	safety, err := buildSafetyMetrics(ctx, client, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to build safety metrics: %w", err)
	}
	csr.Safety = safety

	// Build domain metrics
	payments, err := buildPaymentsMetrics(ctx, client, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to build payments metrics: %w", err)
	}
	csr.Payments = payments

	fraud, err := buildFraudMetrics(ctx, client, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to build fraud metrics: %w", err)
	}
	csr.Fraud = fraud

	aml, err := buildAMLMetrics(ctx, client, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to build aml metrics: %w", err)
	}
	csr.AML = aml

	treasury, err := buildTreasuryMetrics(ctx, client, tenantID, start, end)
	if err != nil {
		return nil, fmt.Errorf("failed to build treasury metrics: %w", err)
	}
	csr.Treasury = treasury

	return csr, nil
}

func parsePeriod(week string) (Period, error) {
	// Parse ISO 8601 week format (e.g., "2025-W49")
	var year, weekNum int
	_, err := fmt.Sscanf(week, "%d-W%d", &year, &weekNum)
	if err != nil {
		return Period{}, fmt.Errorf("invalid week format: %s", week)
	}

	// Calculate start and end of week
	jan1 := time.Date(year, time.January, 1, 0, 0, 0, 0, time.UTC)
	daysToMonday := (8 - int(jan1.Weekday())) % 7
	firstMonday := jan1.AddDate(0, 0, daysToMonday)
	start := firstMonday.AddDate(0, 0, (weekNum-1)*7)
	end := start.AddDate(0, 0, 7)

	return Period{Start: start, End: end}, nil
}

func buildHealthMetrics(ctx context.Context, client *metrics.Client, tenantID string, start, end time.Time) (DomainHealthSet, error) {
	// Query health metrics from Prometheus
	paymentsEnabled, _ := client.QueryGauge(ctx, "payments_shadow_enabled", tenantID, end)
	fraudEnabled, _ := client.QueryGauge(ctx, "fraud_shadow_enabled", tenantID, end)
	amlEnabled, _ := client.QueryGauge(ctx, "aml_shadow_enabled", tenantID, end)
	treasuryEnabled, _ := client.QueryGauge(ctx, "treasury_shadow_enabled", tenantID, end)

	paymentsCIPass, _ := client.QueryGauge(ctx, "payments_ci_pass", tenantID, end)
	fraudCIPass, _ := client.QueryGauge(ctx, "fraud_ci_pass", tenantID, end)
	amlCIPass, _ := client.QueryGauge(ctx, "aml_ci_pass", tenantID, end)
	treasuryCIPass, _ := client.QueryGauge(ctx, "treasury_ci_pass", tenantID, end)

	return DomainHealthSet{
		PaymentsShadowEnabled: paymentsEnabled > 0,
		FraudShadowEnabled:    fraudEnabled > 0,
		AMLShadowEnabled:      amlEnabled > 0,
		TreasuryShadowEnabled: treasuryEnabled > 0,
		PaymentsCIPass:        paymentsCIPass > 0,
		FraudCIPass:           fraudCIPass > 0,
		AMLCIPass:             amlCIPass > 0,
		TreasuryCIPass:        treasuryCIPass > 0,
	}, nil
}

func buildSafetyMetrics(ctx context.Context, client *metrics.Client, tenantID string, start, end time.Time) (SafetySet, error) {
	// Query safety metrics from Prometheus
	aiOriginViolations, _ := client.QueryCounter(ctx, "risk_brain_ai_origin_violations_total", tenantID, start, end)
	schemaViolations, _ := client.QueryCounter(ctx, "risk_brain_schema_version_violations_total", tenantID, start, end)
	policyOriginViolations, _ := client.QueryCounter(ctx, "risk_brain_policy_origin_violations_total", tenantID, start, end)
	killswitchActivations, _ := client.QueryCounter(ctx, "risk_brain_killswitch_activations_total", tenantID, start, end)

	return SafetySet{
		AIOriginViolations:      int64(aiOriginViolations),
		SchemaVersionViolations: int64(schemaViolations),
		PolicyOriginViolations:  int64(policyOriginViolations),
		KillswitchActivations:   int64(killswitchActivations),
	}, nil
}

func buildPaymentsMetrics(ctx context.Context, client *metrics.Client, tenantID string, start, end time.Time) (PaymentsMetrics, error) {
	// Query payments metrics from Prometheus
	advisoryCount, _ := client.QueryCounter(ctx, "payments_rl_policy_evaluated_total", tenantID, start, end)
	winRate, _ := client.QueryGauge(ctx, "payments_rl_win_rate", tenantID, end)
	lossRate, _ := client.QueryGauge(ctx, "payments_rl_loss_rate", tenantID, end)
	neutralRate, _ := client.QueryGauge(ctx, "payments_rl_neutral_rate", tenantID, end)
	avgConfidence, _ := client.QueryGauge(ctx, "payments_rl_avg_confidence", tenantID, end)
	avgLatencyDelta, _ := client.QueryGauge(ctx, "payments_rl_avg_latency_delta", tenantID, end)
	avgCostDelta, _ := client.QueryGauge(ctx, "payments_rl_avg_cost_delta", tenantID, end)
	modelHealthScore, _ := client.QueryGauge(ctx, "payments_rl_model_health_score", tenantID, end)

	coveragePct := 0.0
	if advisoryCount > 0 {
		coveragePct = 100.0 // Simplified for v1
	}

	return PaymentsMetrics{
		CoveragePct:         coveragePct,
		WinRate:             winRate,
		LossRate:            lossRate,
		NeutralRate:         neutralRate,
		AvgConfidence:       avgConfidence,
		AvgLatencyDelta:     avgLatencyDelta,
		AvgCostDelta:        avgCostDelta,
		AdvisoryCount:       int64(advisoryCount),
		ModelHealthScore:    modelHealthScore,
	}, nil
}

func buildFraudMetrics(ctx context.Context, client *metrics.Client, tenantID string, start, end time.Time) (FraudMetrics, error) {
	// Query fraud metrics from Prometheus
	highRiskFlags, _ := client.QueryCounter(ctx, "fraud_risk_flag_raised_total{risk_band=\"HIGH\"}", tenantID, start, end)
	mediumRiskFlags, _ := client.QueryCounter(ctx, "fraud_risk_flag_raised_total{risk_band=\"MEDIUM\"}", tenantID, start, end)
	lowRiskFlags, _ := client.QueryCounter(ctx, "fraud_risk_flag_raised_total{risk_band=\"LOW\"}", tenantID, start, end)
	avgRiskScore, _ := client.QueryGauge(ctx, "fraud_avg_risk_score", tenantID, end)
	falsePositiveRate, _ := client.QueryGauge(ctx, "fraud_false_positive_rate", tenantID, end)
	modelHealthScore, _ := client.QueryGauge(ctx, "fraud_model_health_score", tenantID, end)

	return FraudMetrics{
		HighRiskFlagsCount:   int64(highRiskFlags),
		MediumRiskFlagsCount: int64(mediumRiskFlags),
		LowRiskFlagsCount:    int64(lowRiskFlags),
		AvgRiskScore:         avgRiskScore,
		FalsePositiveRate:    falsePositiveRate,
		ModelHealthScore:     modelHealthScore,
	}, nil
}

func buildAMLMetrics(ctx context.Context, client *metrics.Client, tenantID string, start, end time.Time) (AMLMetrics, error) {
	// Query AML metrics from Prometheus
	highRiskFlags, _ := client.QueryCounter(ctx, "aml_risk_flag_raised_total{risk_band=\"HIGH\"}", tenantID, start, end)
	mediumRiskFlags, _ := client.QueryCounter(ctx, "aml_risk_flag_raised_total{risk_band=\"MEDIUM\"}", tenantID, start, end)
	lowRiskFlags, _ := client.QueryCounter(ctx, "aml_risk_flag_raised_total{risk_band=\"LOW\"}", tenantID, start, end)
	avgRiskScore, _ := client.QueryGauge(ctx, "aml_avg_risk_score", tenantID, end)
	behaviouralDrift, _ := client.QueryGauge(ctx, "aml_behavioural_drift", tenantID, end)
	modelHealthScore, _ := client.QueryGauge(ctx, "aml_model_health_score", tenantID, end)

	return AMLMetrics{
		HighRiskFlagsCount:   int64(highRiskFlags),
		MediumRiskFlagsCount: int64(mediumRiskFlags),
		LowRiskFlagsCount:    int64(lowRiskFlags),
		AvgRiskScore:         avgRiskScore,
		BehaviouralDrift:     behaviouralDrift,
		ModelHealthScore:     modelHealthScore,
	}, nil
}

func buildTreasuryMetrics(ctx context.Context, client *metrics.Client, tenantID string, start, end time.Time) (TreasuryMetrics, error) {
	// Query treasury metrics from Prometheus
	highStress, _ := client.QueryCounter(ctx, "treasury_risk_advisory_issued_total{stress_level=\"HIGH\"}", tenantID, start, end)
	mediumStress, _ := client.QueryCounter(ctx, "treasury_risk_advisory_issued_total{stress_level=\"MEDIUM\"}", tenantID, start, end)
	lowStress, _ := client.QueryCounter(ctx, "treasury_risk_advisory_issued_total{stress_level=\"LOW\"}", tenantID, start, end)
	avgStressScore, _ := client.QueryGauge(ctx, "treasury_avg_stress_score", tenantID, end)
	modelHealthScore, _ := client.QueryGauge(ctx, "treasury_model_health_score", tenantID, end)

	// Determine liquidity posture
	liquidityPosture := "NEUTRAL"
	if avgStressScore > 0.7 {
		liquidityPosture = "STRESSED"
	} else if avgStressScore < 0.3 {
		liquidityPosture = "COMFORTABLE"
	}

	return TreasuryMetrics{
		HighStressCount:      int64(highStress),
		MediumStressCount:    int64(mediumStress),
		LowStressCount:       int64(lowStress),
		AvgStressScore:       avgStressScore,
		LiquidityPosture:     liquidityPosture,
		ModelHealthScore:     modelHealthScore,
	}, nil
}
