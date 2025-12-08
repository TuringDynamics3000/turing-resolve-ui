// Risk Brain Reporter — Snapshot Validator
//
// This module validates canonical risk snapshots.
//
// Author: TuringCore National Infrastructure Team
// Version: 1.0

package snapshot

import (
	"fmt"
)

// Validate validates a canonical risk snapshot.
func Validate(csr *CanonicalRiskSnapshot) error {
	// Validate schema version
	if csr.SchemaVersion != SchemaVersion {
		return fmt.Errorf("invalid schema version: expected %s, got %s", SchemaVersion, csr.SchemaVersion)
	}

	// Validate tenant ID
	if csr.TenantID == "" {
		return fmt.Errorf("tenant_id is required")
	}

	// Validate week
	if csr.Week == "" {
		return fmt.Errorf("week is required")
	}

	// Validate period
	if csr.Period.Start.IsZero() || csr.Period.End.IsZero() {
		return fmt.Errorf("period start and end are required")
	}

	if csr.Period.Start.After(csr.Period.End) {
		return fmt.Errorf("period start must be before period end")
	}

	// Validate safety metrics (MUST be 0)
	if csr.Safety.AIOriginViolations < 0 {
		return fmt.Errorf("ai_origin_violations must be >= 0")
	}

	if csr.Safety.SchemaVersionViolations < 0 {
		return fmt.Errorf("schema_version_violations must be >= 0")
	}

	if csr.Safety.PolicyOriginViolations < 0 {
		return fmt.Errorf("policy_origin_violations must be >= 0")
	}

	// Validate payments metrics
	if csr.Payments.CoveragePct < 0 || csr.Payments.CoveragePct > 100 {
		return fmt.Errorf("payments coverage_pct must be between 0 and 100")
	}

	if csr.Payments.WinRate < 0 || csr.Payments.WinRate > 1 {
		return fmt.Errorf("payments win_rate must be between 0 and 1")
	}

	if csr.Payments.LossRate < 0 || csr.Payments.LossRate > 1 {
		return fmt.Errorf("payments loss_rate must be between 0 and 1")
	}

	if csr.Payments.NeutralRate < 0 || csr.Payments.NeutralRate > 1 {
		return fmt.Errorf("payments neutral_rate must be between 0 and 1")
	}

	// Validate fraud metrics
	if csr.Fraud.HighRiskFlagsCount < 0 {
		return fmt.Errorf("fraud high_risk_flags_count must be >= 0")
	}

	if csr.Fraud.MediumRiskFlagsCount < 0 {
		return fmt.Errorf("fraud medium_risk_flags_count must be >= 0")
	}

	if csr.Fraud.LowRiskFlagsCount < 0 {
		return fmt.Errorf("fraud low_risk_flags_count must be >= 0")
	}

	// Validate AML metrics
	if csr.AML.HighRiskFlagsCount < 0 {
		return fmt.Errorf("aml high_risk_flags_count must be >= 0")
	}

	if csr.AML.MediumRiskFlagsCount < 0 {
		return fmt.Errorf("aml medium_risk_flags_count must be >= 0")
	}

	if csr.AML.LowRiskFlagsCount < 0 {
		return fmt.Errorf("aml low_risk_flags_count must be >= 0")
	}

	// Validate treasury metrics
	if csr.Treasury.HighStressCount < 0 {
		return fmt.Errorf("treasury high_stress_count must be >= 0")
	}

	if csr.Treasury.MediumStressCount < 0 {
		return fmt.Errorf("treasury medium_stress_count must be >= 0")
	}

	if csr.Treasury.LowStressCount < 0 {
		return fmt.Errorf("treasury low_stress_count must be >= 0")
	}

	return nil
}
