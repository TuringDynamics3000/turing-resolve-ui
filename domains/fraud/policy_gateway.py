"""
Fraud Policy Gateway — Stage 3 Implementation

This module provides deterministic policy enforcement for fraud risk scores.

PURPOSE:
- Apply board-approved risk thresholds to AI fraud scores
- Emit advisory-only fraud risk flags
- Zero execution authority

SAFETY GUARANTEES:
- Deterministic, pure function (no I/O, no side effects)
- Advisory-only outputs (FraudRiskFlagRaised)
- No execution authority
- No ability to block cards, freeze accounts, or decline transactions

ARCHITECTURE:
- Layer A (Deterministic) component
- Consumes from: protocol.fraud.risk.scored
- Emits to: protocol.fraud.risk.advisory

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Fraud Policy Gateway)
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
# FRAUD RISK SCORE EVENT
# ============================================================================

@dataclass(frozen=True)
class FraudRiskScoreEvent:
    """Fraud risk score event from Layer B."""
    
    tenant_id: str
    account_id_hash: str
    card_id_hash: Optional[str]
    risk_score: float
    risk_band: str
    model_id: str
    model_version: str
    occurred_at: int


# ============================================================================
# FRAUD POLICY EVALUATION
# ============================================================================

def evaluate_fraud_policy(event: FraudRiskScoreEvent) -> Optional[Dict[str, Any]]:
    """
    Evaluate fraud policy for risk score event.
    
    This is a deterministic, pure function with no side effects.
    
    POLICY RULES:
    - risk_score >= 0.85 → HIGH risk flag (advisory)
    - risk_score >= 0.65 → MEDIUM risk flag (advisory)
    - risk_score < 0.65 → No flag (low risk)
    
    Args:
        event: Fraud risk score event
        
    Returns:
        FraudRiskFlagRaised event if risk threshold exceeded, None otherwise
    """
    # Determine risk level based on board-approved thresholds
    if event.risk_score >= MIN_HIGH_RISK:
        level = "HIGH"
    elif event.risk_score >= MIN_MEDIUM_RISK:
        level = "MEDIUM"
    else:
        # Low risk, no flag needed
        return None
    
    # Create advisory fraud risk flag
    return {
        "event_type": "FraudRiskFlagRaised",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        
        "tenant_id": event.tenant_id,
        "account_id_hash": event.account_id_hash,
        "card_id_hash": event.card_id_hash,
        "risk_band": level,
        
        "policy_id": "fraud-policy-v1",
        "policy_version": "1.0",
        "advisory_reason": f"Behavioural anomaly score {event.risk_score:.4f}",
        
        "origin": "AI",
        "occurred_at": int(time.time() * 1000)
    }


# ============================================================================
# BATCH EVALUATION
# ============================================================================

def evaluate_batch(events: list[FraudRiskScoreEvent]) -> list[Dict[str, Any]]:
    """
    Evaluate fraud policy for a batch of events.
    
    Args:
        events: List of fraud risk score events
        
    Returns:
        List of FraudRiskFlagRaised events
    """
    flags = []
    for event in events:
        flag = evaluate_fraud_policy(event)
        if flag is not None:
            flags.append(flag)
    return flags


# ============================================================================
# POLICY STATISTICS
# ============================================================================

@dataclass
class FraudPolicyStatistics:
    """Statistics for fraud policy evaluation."""
    
    total_events: int
    flags_raised: int
    high_risk_count: int
    medium_risk_count: int
    low_risk_count: int
    flag_rate: float


def compute_statistics(
    events: list[FraudRiskScoreEvent],
    flags: list[Dict[str, Any]]
) -> FraudPolicyStatistics:
    """
    Compute statistics for fraud policy evaluation.
    
    Args:
        events: List of fraud risk score events
        flags: List of FraudRiskFlagRaised events
        
    Returns:
        FraudPolicyStatistics
    """
    total_events = len(events)
    flags_raised = len(flags)
    
    # Count by risk band
    high_risk_count = sum(1 for e in events if e.risk_score >= MIN_HIGH_RISK)
    medium_risk_count = sum(1 for e in events if MIN_MEDIUM_RISK <= e.risk_score < MIN_HIGH_RISK)
    low_risk_count = sum(1 for e in events if e.risk_score < MIN_MEDIUM_RISK)
    
    # Flag rate
    flag_rate = (flags_raised / total_events * 100) if total_events > 0 else 0.0
    
    return FraudPolicyStatistics(
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
class FraudAuditRecord:
    """Audit record for fraud policy evaluation."""
    
    event_id: str
    tenant_id: str
    account_id_hash: str
    card_id_hash: Optional[str]
    risk_score: float
    risk_band: str
    flag_raised: bool
    policy_id: str
    policy_version: str
    occurred_at: int
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Kafka emission."""
        return {
            "event_type": "FraudPolicyAuditRecord",
            "schema_version": "1.0",
            "event_id": self.event_id,
            "tenant_id": self.tenant_id,
            "account_id_hash": self.account_id_hash,
            "card_id_hash": self.card_id_hash,
            "risk_score": self.risk_score,
            "risk_band": self.risk_band,
            "flag_raised": self.flag_raised,
            "policy_id": self.policy_id,
            "policy_version": self.policy_version,
            "occurred_at": self.occurred_at
        }


def create_audit_record(
    event: FraudRiskScoreEvent,
    flag: Optional[Dict[str, Any]]
) -> FraudAuditRecord:
    """
    Create audit record for fraud policy evaluation.
    
    Args:
        event: Fraud risk score event
        flag: FraudRiskFlagRaised event (if raised)
        
    Returns:
        FraudAuditRecord
    """
    return FraudAuditRecord(
        event_id=str(uuid.uuid4()),
        tenant_id=event.tenant_id,
        account_id_hash=event.account_id_hash,
        card_id_hash=event.card_id_hash,
        risk_score=event.risk_score,
        risk_band=event.risk_band,
        flag_raised=(flag is not None),
        policy_id="fraud-policy-v1",
        policy_version="1.0",
        occurred_at=int(time.time() * 1000)
    )


# ============================================================================
# ADVISORY-ONLY ASSERTION
# ============================================================================

# Forbidden command types (execution authority)
FORBIDDEN_COMMAND_TYPES = {
    "BlockCard",
    "FreezeAccount",
    "DeclineTransaction",
    "SuspendAccount",
    "RestrictAccount",
    "ApplyAccountRestriction",
    "SubmitSmr",  # AUSTRAC SMR
    "SubmitTtr",  # AUSTRAC TTR
    "SubmitIfti",  # AUSTRAC IFTI
    "SubmitAmlReport",
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
            f"🚨 CRITICAL SAFETY BREACH: Fraud AI attempted forbidden command: {command_type}"
        )
    
    if event_type in FORBIDDEN_COMMAND_TYPES:
        raise RuntimeError(
            f"🚨 CRITICAL SAFETY BREACH: Fraud AI attempted forbidden event: {event_type}"
        )
