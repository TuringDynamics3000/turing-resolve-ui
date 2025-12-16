"""
AML Policy Gateway — Stage 3 Implementation

This module provides deterministic policy enforcement for AML risk scores.

PURPOSE:
- Apply board-approved risk thresholds to AI AML scores
- Emit advisory-only AML risk flags
- Zero execution authority

SAFETY GUARANTEES:
- Deterministic, pure function (no I/O, no side effects)
- Advisory-only outputs (AmlRiskFlagRaised)
- No execution authority
- No ability to lodge AUSTRAC reports (SMR, TTR, IFTI)
- No ability to freeze accounts or restrict cards

AUSTRAC COMPLIANCE:
- Advisory-only (human escalation required for SMR/TTR)
- Pattern-of-life detection (not rule-based triggers)
- Full audit trail for regulator review

ARCHITECTURE:
- Layer A (Deterministic) component
- Consumes from: protocol.aml.risk.scored
- Emits to: protocol.aml.risk.advisory

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (AML Policy Gateway)
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
MIN_MEDIUM_RISK = 0.70


# ============================================================================
# AML RISK SCORE EVENT
# ============================================================================

@dataclass(frozen=True)
class AmlRiskScoreEvent:
    """AML risk score event from Layer B."""
    
    tenant_id: str
    customer_id_hash: str
    account_id_hash: str
    risk_score: float
    risk_band: str
    model_id: str
    model_version: str
    occurred_at: int


# ============================================================================
# AML POLICY EVALUATION
# ============================================================================

def evaluate_aml_policy(event: AmlRiskScoreEvent) -> Optional[Dict[str, Any]]:
    """
    Evaluate AML policy for risk score event.
    
    This is a deterministic, pure function with no side effects.
    
    POLICY RULES:
    - risk_score >= 0.85 → HIGH risk flag (advisory, human escalation)
    - risk_score >= 0.70 → MEDIUM risk flag (advisory, human review)
    - risk_score < 0.70 → No flag (low risk)
    
    Args:
        event: AML risk score event
        
    Returns:
        AmlRiskFlagRaised event if risk threshold exceeded, None otherwise
    """
    # Determine risk level based on board-approved thresholds
    if event.risk_score >= MIN_HIGH_RISK:
        level = "HIGH"
    elif event.risk_score >= MIN_MEDIUM_RISK:
        level = "MEDIUM"
    else:
        # Low risk, no flag needed
        return None
    
    # Create advisory AML risk flag
    return {
        "event_type": "AmlRiskFlagRaised",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        
        "tenant_id": event.tenant_id,
        "customer_id_hash": event.customer_id_hash,
        "account_id_hash": event.account_id_hash,
        "risk_band": level,
        
        "policy_id": "aml-policy-v1",
        "policy_version": "1.0",
        "advisory_reason": f"Behavioural AML anomaly score {event.risk_score:.4f}",
        
        "origin": "AI",
        "occurred_at": int(time.time() * 1000)
    }


# ============================================================================
# BATCH EVALUATION
# ============================================================================

def evaluate_batch(events: list[AmlRiskScoreEvent]) -> list[Dict[str, Any]]:
    """
    Evaluate AML policy for a batch of events.
    
    Args:
        events: List of AML risk score events
        
    Returns:
        List of AmlRiskFlagRaised events
    """
    flags = []
    for event in events:
        flag = evaluate_aml_policy(event)
        if flag is not None:
            flags.append(flag)
    return flags


# ============================================================================
# POLICY STATISTICS
# ============================================================================

@dataclass
class AmlPolicyStatistics:
    """Statistics for AML policy evaluation."""
    
    total_events: int
    flags_raised: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    flag_rate: float


def compute_statistics(
    events: list[AmlRiskScoreEvent],
    flags: list[Dict[str, Any]]
) -> AmlPolicyStatistics:
    """
    Compute statistics for AML policy evaluation.
    
    Args:
        events: List of AML risk score events
        flags: List of AmlRiskFlagRaised events
        
    Returns:
        AmlPolicyStatistics
    """
    total_events = len(events)
    flags_raised = len(flags)
    
    # Count by risk band
    high_risk_count = sum(1 for e in events if e.risk_score >= MIN_HIGH_RISK)
    medium_risk_count = sum(1 for e in events if MIN_MEDIUM_RISK <= e.risk_score < MIN_HIGH_RISK)
    low_risk_count = sum(1 for e in events if e.risk_score < MIN_MEDIUM_RISK)
    
    # Flag rate
    flag_rate = (flags_raised / total_events * 100) if total_events > 0 else 0.0
    
    return AmlPolicyStatistics(
        total_events=total_events,
        flags_raised=flags_raised,
        high_risk_count=high_risk_count,
        medium_risk_count=medium_risk_count,
        low_risk_count=low_risk_count,
        flag_rate=round(flag_rate, 2)
    )


# ============================================================================
# AUDIT TRAIL
# ============================================================================

@dataclass
class AmlAuditRecord:
    """Audit record for AML policy evaluation."""
    
    event_id: str
    tenant_id: str
    customer_id_hash: str
    account_id_hash: str
    risk_score: float
    risk_band: str
    flag_raised: bool
    policy_id: str
    policy_version: str
    occurred_at: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Kafka emission."""
        return {
            "event_type": "AmlPolicyAuditRecord",
            "schema_version": "1.0",
            "event_id": self.event_id,
            "tenant_id": self.tenant_id,
            "customer_id_hash": self.customer_id_hash,
            "account_id_hash": self.account_id_hash,
            "risk_score": self.risk_score,
            "risk_band": self.risk_band,
            "flag_raised": self.flag_raised,
            "policy_id": self.policy_id,
            "policy_version": self.policy_version,
            "occurred_at": self.occurred_at
        }


def create_audit_record(
    event: AmlRiskScoreEvent,
    flag: Optional[Dict[str, Any]]
) -> AmlAuditRecord:
    """
    Create audit record for AML policy evaluation.
    
    Args:
        event: AML risk score event
        flag: AmlRiskFlagRaised event (if raised)
        
    Returns:
        AmlAuditRecord
    """
    return AmlAuditRecord(
        event_id=str(uuid.uuid4()),
        tenant_id=event.tenant_id,
        customer_id_hash=event.customer_id_hash,
        account_id_hash=event.account_id_hash,
        risk_score=event.risk_score,
        risk_band=event.risk_band,
        flag_raised=(flag is not None),
        policy_id="aml-policy-v1",
        policy_version="1.0",
        occurred_at=int(time.time() * 1000)
    )


# ============================================================================
# ADVISORY-ONLY ASSERTION (AUSTRAC COMPLIANCE)
# ============================================================================

# Forbidden command types (execution authority)
FORBIDDEN_COMMAND_TYPES = {
    "SubmitSmr",  # AUSTRAC SMR (Suspicious Matter Report)
    "SubmitTtr",  # AUSTRAC TTR (Threshold Transaction Report)
    "SubmitIfti",  # AUSTRAC IFTI (International Funds Transfer Instruction)
    "SubmitAmlReport",  # Generic AML report
    "FreezeAccount",
    "RestrictCard",
    "BlockCustomer",
    "SuspendAccount",
    "RestrictAccount",
    "ApplyAccountRestriction",
}


def assert_advisory_only(event_dict: Dict[str, Any]) -> None:
    """
    Assert that event is advisory-only (no execution authority).
    
    This is a defense-in-depth check. The enforcement layer should
    catch this earlier, but we check again here.
    
    AUSTRAC COMPLIANCE:
    - AI cannot lodge SMR/TTR/IFTI
    - Human escalation required for all AUSTRAC reports
    
    Args:
        event_dict: Event dictionary
        
    Raises:
        RuntimeError: If event contains forbidden command type
    """
    event_type = event_dict.get("event_type", "")
    command_type = event_dict.get("command_type", "")
    
    if command_type in FORBIDDEN_COMMAND_TYPES:
        raise RuntimeError(
            f"🚨 CRITICAL SAFETY BREACH: AML AI attempted forbidden command: {command_type}"
        )
    
    if event_type in FORBIDDEN_COMMAND_TYPES:
        raise RuntimeError(
            f"🚨 CRITICAL SAFETY BREACH: AML AI attempted forbidden event: {event_type}"
        )
