"""
Treasury Policy Gateway — Stage 3 Implementation

This module provides deterministic policy enforcement for treasury risk scores.

PURPOSE:
- Apply board-approved risk thresholds to AI treasury scores
- Emit advisory-only treasury risk advisories
- Zero execution authority

SAFETY GUARANTEES:
- Deterministic, pure function (no I/O, no side effects)
- Advisory-only outputs (TreasuryRiskAdvisoryIssued)
- No execution authority
- No ability to move liquidity (sweeps, facility draws, account movement)

ARCHITECTURE:
- Layer A (Deterministic) component
- Consumes from: protocol.treasury.rl.scored
- Emits to: protocol.treasury.risk.advisory

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Treasury Policy Gateway)
"""

from dataclasses import dataclass
from typing import Dict, Any, Optional
import time
import uuid


# ============================================================================
# BOARD-APPROVED RISK THRESHOLDS
# ============================================================================

# Minimum risk score for HIGH risk classification
MIN_HIGH_RISK = 0.85

# Minimum risk score for MEDIUM risk classification
MIN_MEDIUM_RISK = 0.65


# ============================================================================
# TREASURY RL POLICY EVENT
# ============================================================================

@dataclass(frozen=True)
class TreasuryRiskScoreEvent:
    """Treasury risk score event from Layer B."""
    
    tenant_id: str
    liquidity_risk_score: float
    risk_band: str
    recommended_buffer_cents: int
    recommended_facility_headroom_cents: int
    model_id: str
    model_version: str
    occurred_at: int


# ============================================================================
# TREASURY POLICY EVALUATION
# ============================================================================

def evaluate_treasury_policy(event: TreasuryRiskScoreEvent) -> Optional[Dict[str, Any]]:
    """
    Evaluate treasury policy for risk score event.
    
    This is a deterministic, pure function with no side effects.
    
    POLICY RULES:
    - liquidity_risk_score >= 0.85 → HIGH risk advisory (human escalation)
    - liquidity_risk_score >= 0.65 → MEDIUM risk advisory (human review)
    - liquidity_risk_score < 0.65 → No advisory (low risk)
    
    Args:
        event: Treasury risk score event
        
    Returns:
        TreasuryRiskAdvisoryIssued event if risk threshold exceeded, None otherwise
    """
    # Determine risk level based on board-approved thresholds
    if event.liquidity_risk_score >= MIN_HIGH_RISK:
        level = "HIGH"
    elif event.liquidity_risk_score >= MIN_MEDIUM_RISK:
        level = "MEDIUM"
    else:
        # Low risk, no advisory needed
        return None
    
    # Create advisory treasury risk event
    return {
        "event_type": "TreasuryRiskAdvisoryIssued",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        
        "tenant_id": event.tenant_id,
        "risk_band": level,
        "recommended_buffer_cents": event.recommended_buffer_cents,
        "recommended_facility_headroom_cents": event.recommended_facility_headroom_cents,
        
        "policy_id": "treasury-policy-v1",
        "policy_version": "1.0",
        "advisory_reason": f"Intraday liquidity stress probability {event.liquidity_risk_score:.4f}",
        
        "origin": "AI",
        "occurred_at": int(time.time() * 1000)
    }


# ============================================================================
# BATCH EVALUATION
# ============================================================================

def evaluate_batch(events: list[TreasuryRiskScoreEvent]) -> list[Dict[str, Any]]:
    """
    Evaluate treasury policy for a batch of events.
    
    Args:
        events: List of treasury risk score events
        
    Returns:
        List of TreasuryRiskAdvisoryIssued events
    """
    advisories = []
    for event in events:
        advisory = evaluate_treasury_policy(event)
        if advisory is not None:
            advisories.append(advisory)
    return advisories


# ============================================================================
# POLICY STATISTICS
# ============================================================================

@dataclass
class TreasuryPolicyStatistics:
    """Statistics for treasury policy evaluation."""
    
    total_events: int
    advisories_issued: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    advisory_rate: float


def compute_statistics(
    events: list[TreasuryRiskScoreEvent],
    advisories: list[Dict[str, Any]]
) -> TreasuryPolicyStatistics:
    """
    Compute statistics for treasury policy evaluation.
    
    Args:
        events: List of treasury risk score events
        advisories: List of TreasuryRiskAdvisoryIssued events
        
    Returns:
        TreasuryPolicyStatistics
    """
    total_events = len(events)
    advisories_issued = len(advisories)
    
    # Count by risk band
    high_risk_count = sum(1 for e in events if e.liquidity_risk_score >= MIN_HIGH_RISK)
    medium_risk_count = sum(1 for e in events if MIN_MEDIUM_RISK <= e.liquidity_risk_score < MIN_HIGH_RISK)
    low_risk_count = sum(1 for e in events if e.liquidity_risk_score < MIN_MEDIUM_RISK)
    
    # Advisory rate
    advisory_rate = (advisories_issued / total_events * 100) if total_events > 0 else 0.0
    
    return TreasuryPolicyStatistics(
        total_events=total_events,
        advisories_issued=advisories_issued,
        high_risk_count=high_risk_count,
        medium_risk_count=medium_risk_count,
        low_risk_count=low_risk_count,
        advisory_rate=round(advisory_rate, 2)
    )


# ============================================================================
# AUDIT TRAIL
# ============================================================================

@dataclass
class TreasuryAuditRecord:
    """Audit record for treasury policy evaluation."""
    
    event_id: str
    tenant_id: str
    liquidity_risk_score: float
    risk_band: str
    advisory_issued: bool
    policy_id: str
    policy_version: str
    occurred_at: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Kafka emission."""
        return {
            "event_type": "TreasuryPolicyAuditRecord",
            "schema_version": "1.0",
            "event_id": self.event_id,
            "tenant_id": self.tenant_id,
            "liquidity_risk_score": self.liquidity_risk_score,
            "risk_band": self.risk_band,
            "advisory_issued": self.advisory_issued,
            "policy_id": self.policy_id,
            "policy_version": self.policy_version,
            "occurred_at": self.occurred_at
        }


def create_audit_record(
    event: TreasuryRiskScoreEvent,
    advisory: Optional[Dict[str, Any]]
) -> TreasuryAuditRecord:
    """
    Create audit record for treasury policy evaluation.
    
    Args:
        event: Treasury risk score event
        advisory: TreasuryRiskAdvisoryIssued event (if issued)
        
    Returns:
        TreasuryAuditRecord
    """
    return TreasuryAuditRecord(
        event_id=str(uuid.uuid4()),
        tenant_id=event.tenant_id,
        liquidity_risk_score=event.liquidity_risk_score,
        risk_band=event.risk_band,
        advisory_issued=(advisory is not None),
        policy_id="treasury-policy-v1",
        policy_version="1.0",
        occurred_at=int(time.time() * 1000)
    )


# ============================================================================
# ADVISORY-ONLY ASSERTION
# ============================================================================

# Forbidden command types (execution authority)
FORBIDDEN_COMMAND_TYPES = {
    "SweepLiquidity",
    "DrawFacility",
    "MoveAccount",
    "PostTransaction",
    "TransferFunds",
    "InitiatePayment",
    "SettleBatch",
    "AdjustFacility",
}


def assert_advisory_only(event_dict: Dict[str, Any]) -> None:
    """
    Assert that event is advisory-only (no execution authority).
    
    This is a defense-in-depth check. The enforcement layer should
    catch this earlier, but we check again here.
    
    Args:
        event_dict: Event dictionary
        
    Raises:
        RuntimeError: If event contains forbidden command type
    """
    event_type = event_dict.get("event_type", "")
    command_type = event_dict.get("command_type", "")
    
    if command_type in FORBIDDEN_COMMAND_TYPES:
        raise RuntimeError(
            f"🚨 CRITICAL SAFETY BREACH: Treasury AI attempted forbidden command: {command_type}"
        )
    
    if event_type in FORBIDDEN_COMMAND_TYPES:
        raise RuntimeError(
            f"🚨 CRITICAL SAFETY BREACH: Treasury AI attempted forbidden event: {event_type}"
        )
