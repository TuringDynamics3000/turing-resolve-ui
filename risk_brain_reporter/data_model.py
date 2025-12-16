"""
Risk Brain Reporter — Canonical Data Model v1

This module defines the canonical data model for Risk Brain weekly reports.

PURPOSE:
- Single source of truth for all report outputs
- Version-controlled schema (no ad-hoc logic)
- Deterministic, auditable, immutable

OUTPUTS:
- Weekly Board Risk Brain Pack (PDF)
- On-demand Regulator Replay Annex (PDF)
- Immutable risk governance artefacts

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Risk Brain Reporter)
"""

from dataclasses import dataclass, asdict
from typing import Dict, Any, Optional
from datetime import datetime, timedelta


# ============================================================================
# CANONICAL DATA MODEL (Locked Schema)
# ============================================================================

@dataclass
class DomainHealth:
    """Health status for a single Risk Brain domain."""
    shadow: bool  # Shadow mode enabled
    ci: bool  # CI harness passing
    killswitch: int  # Killswitch activations count


@dataclass
class SafetyMetrics:
    """Safety invariant metrics (must always be 0)."""
    ai_origin_violations: int  # AI attempted execution commands
    schema_violations: int  # Schema version mismatches
    policy_origin_violations: int  # Unapproved policy sources


@dataclass
class PaymentsMetrics:
    """Payments RL Shadow metrics."""
    coverage_pct: float  # % of payments evaluated by RL
    direction_split: Dict[str, int]  # better/worse/neutral counts


@dataclass
class FraudMetrics:
    """Fraud Shadow metrics."""
    high_flags: int  # High-risk fraud flags raised
    confirmed: int  # Confirmed fraud cases
    cleared: int  # Cleared (false positive) cases


@dataclass
class AmlMetrics:
    """AML Shadow metrics."""
    high_flags: int  # High-risk AML flags raised
    medium_flags: int  # Medium-risk AML flags raised
    smrs: int  # SMRs submitted (by humans)


@dataclass
class TreasuryMetrics:
    """Treasury RL Shadow metrics."""
    high_risk_windows: int  # High-risk liquidity windows detected
    avg_buffer_delta: int  # Average buffer delta (cents)


@dataclass
class RiskBrainSnapshot:
    """
    Canonical Risk Brain snapshot for a weekly period.
    
    This is the single data model used for all outputs:
    - Weekly Board Pack (PDF)
    - Regulator Annex (PDF)
    - Immutable artefacts
    
    Schema version: 1.0 (locked, version-controlled)
    """
    week: str  # ISO week (e.g., "2025-W49")
    period_start: str  # ISO date (e.g., "2025-12-01")
    period_end: str  # ISO date (e.g., "2025-12-07")
    tenant_id: str  # "NETWORK" or "cu_123"
    
    health: Dict[str, DomainHealth]  # payments, fraud, aml, treasury
    safety: SafetyMetrics
    payments: PaymentsMetrics
    fraud: FraudMetrics
    aml: AmlMetrics
    treasury: TreasuryMetrics
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "week": self.week,
            "period": {
                "start": self.period_start,
                "end": self.period_end
            },
            "tenant_id": self.tenant_id,
            "health": {
                domain: asdict(health)
                for domain, health in self.health.items()
            },
            "safety": asdict(self.safety),
            "payments": asdict(self.payments),
            "fraud": asdict(self.fraud),
            "aml": asdict(self.aml),
            "treasury": asdict(self.treasury)
        }
    
    def is_safe(self) -> bool:
        """
        Check if all safety invariants are satisfied.
        
        Returns:
            True if all safety metrics are 0, False otherwise
        """
        return (
            self.safety.ai_origin_violations == 0 and
            self.safety.schema_violations == 0 and
            self.safety.policy_origin_violations == 0
        )
    
    def safety_statement(self) -> str:
        """
        Generate mandatory safety statement for board pack.
        
        This statement MUST appear on page 2 of every board pack.
        If this statement cannot be emitted → report fails hard.
        
        Returns:
            Safety statement string
        """
        if self.is_safe():
            return "No AI-origin execution attempts were detected. No AI-controlled financial actions occurred."
        else:
            return "⚠️ CRITICAL SAFETY VIOLATION DETECTED: AI execution attempts were blocked by enforcement layer."


# ============================================================================
# PROMQL QUERY MAP (Deterministic)
# ============================================================================

class PromQLQueries:
    """
    PromQL queries for Risk Brain metrics.
    
    These queries are deterministic and version-controlled.
    No ad-hoc queries are permitted outside this class.
    """
    
    # Safety metrics (must always be 0)
    AI_ORIGIN_VIOLATIONS = 'sum(increase(risk_brain_ai_origin_block_violations_total[7d]))'
    SCHEMA_VIOLATIONS = 'sum(increase(risk_brain_schema_version_violations_total[7d]))'
    POLICY_ORIGIN_VIOLATIONS = 'sum(increase(risk_brain_policy_origin_violations_total[7d]))'
    
    # Health metrics
    SHADOW_ENABLED = 'risk_brain_shadow_enabled{{domain="{domain}", tenant_id="{tenant_id}"}}'
    CI_PASS = 'risk_brain_harness_ci_pass{{domain="{domain}"}}'
    KILLSWITCH_ACTIVATIONS = 'sum(increase(risk_brain_killswitch_activations_total{{domain="{domain}"}}[7d]))'
    
    # Payments RL metrics
    PAYMENTS_COVERAGE_NUMERATOR = 'increase(payments_rl_policy_evaluated_total{{tenant_id="{tenant_id}"}}[7d])'
    PAYMENTS_COVERAGE_DENOMINATOR = 'increase(core_payments_total{{tenant_id="{tenant_id}"}}[7d])'
    PAYMENTS_DIRECTION_SPLIT = 'sum by (direction)(increase(payments_rl_advisory_direction_total{{tenant_id="{tenant_id}"}}[7d]))'
    
    # Fraud metrics
    FRAUD_HIGH_FLAGS = 'sum(increase(fraud_risk_flag_raised_total{{risk_band="HIGH", tenant_id="{tenant_id}"}}[7d]))'
    FRAUD_CONFIRMED = 'sum(increase(fraud_flags_total{{outcome="CONFIRMED", tenant_id="{tenant_id}"}}[7d]))'
    FRAUD_CLEARED = 'sum(increase(fraud_flags_total{{outcome="CLEARED", tenant_id="{tenant_id}"}}[7d]))'
    
    # AML metrics
    AML_HIGH_FLAGS = 'sum(increase(aml_risk_flag_raised_total{{risk_band="HIGH", tenant_id="{tenant_id}"}}[7d]))'
    AML_MEDIUM_FLAGS = 'sum(increase(aml_risk_flag_raised_total{{risk_band="MEDIUM", tenant_id="{tenant_id}"}}[7d]))'
    AML_SMRS = 'sum(increase(aml_flags_total{{outcome="SMR", tenant_id="{tenant_id}"}}[7d]))'
    
    # Treasury metrics
    TREASURY_HIGH_RISK_WINDOWS = 'sum(increase(treasury_risk_advisories_total{{risk_band="HIGH", tenant_id="{tenant_id}"}}[7d]))'
    TREASURY_AVG_BUFFER_DELTA = 'avg_over_time(treasury_recommended_buffer_delta_cents{{tenant_id="{tenant_id}"}}[7d])'


# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

def get_iso_week(date: datetime) -> str:
    """
    Get ISO week string (e.g., "2025-W49").
    
    Args:
        date: Date to get week for
        
    Returns:
        ISO week string
    """
    return date.strftime("%Y-W%V")


def get_week_range(date: datetime) -> tuple[str, str]:
    """
    Get week start and end dates (ISO format).
    
    Args:
        date: Date within the week
        
    Returns:
        Tuple of (start_date, end_date) as ISO strings
    """
    # Get Monday of the week
    start = date - timedelta(days=date.weekday())
    # Get Sunday of the week
    end = start + timedelta(days=6)
    
    return (start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d"))


def create_empty_snapshot(tenant_id: str, date: Optional[datetime] = None) -> RiskBrainSnapshot:
    """
    Create an empty Risk Brain snapshot with default values.
    
    Args:
        tenant_id: Tenant ID ("NETWORK" or "cu_123")
        date: Date for the snapshot (defaults to today)
        
    Returns:
        RiskBrainSnapshot with default values
    """
    if date is None:
        date = datetime.now()
    
    week = get_iso_week(date)
    period_start, period_end = get_week_range(date)
    
    return RiskBrainSnapshot(
        week=week,
        period_start=period_start,
        period_end=period_end,
        tenant_id=tenant_id,
        health={
            "payments": DomainHealth(shadow=False, ci=False, killswitch=0),
            "fraud": DomainHealth(shadow=False, ci=False, killswitch=0),
            "aml": DomainHealth(shadow=False, ci=False, killswitch=0),
            "treasury": DomainHealth(shadow=False, ci=False, killswitch=0)
        },
        safety=SafetyMetrics(
            ai_origin_violations=0,
            schema_violations=0,
            policy_origin_violations=0
        ),
        payments=PaymentsMetrics(
            coverage_pct=0.0,
            direction_split={"better": 0, "worse": 0, "neutral": 0}
        ),
        fraud=FraudMetrics(
            high_flags=0,
            confirmed=0,
            cleared=0
        ),
        aml=AmlMetrics(
            high_flags=0,
            medium_flags=0,
            smrs=0
        ),
        treasury=TreasuryMetrics(
            high_risk_windows=0,
            avg_buffer_delta=0
        )
    )
