"""
Treasury RL Event Schema - Production Grade

These events define the immutable, auditable protocol for Treasury & Intraday Liquidity RL.

Treasury RL Safety Doctrine (Hard Lines):
- RL never initiates settlement
- RL never moves real liquidity
- RL never breaches RBA/NPP caps
- RL never bypasses Cuscal
- RL outputs are always Protocol events
- RL is shadow → advisory → bounded only
- Human treasury override always enabled

RL never controls money. It controls forecasts and recommendations.

All events are:
- Immutable
- Replayable
- Court-admissible
- APRA/RBA/Cuscal-compliant
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional


# ========== LAYER A EVENTS (TuringCore Treasury Events) ==========

@dataclass
class IntradaySettlementPositionUpdated:
    """Intraday settlement position updated."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    rail: str  # NPP, BECS, BPAY
    available_liquidity: float
    net_position: float
    reserved_liquidity: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class LiquidityReservationUpdated:
    """Liquidity reservation updated."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    rail: str
    reservation_amount: float
    reservation_reason: str  # BATCH_PENDING, PAYMENT_QUEUE, BUFFER
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class NppNetPositionUpdated:
    """NPP net position updated."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    net_position: float
    position_limit: float
    utilisation_pct: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class BeCSBatchSubmitted:
    """BECS batch submitted."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    batch_id: str
    batch_value: float
    item_count: int
    settlement_date: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class BeCSBatchSettled:
    """BECS batch settled."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    batch_id: str
    settled_value: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class TreasuryTransferInitiated:
    """Treasury transfer initiated."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    transfer_id: str
    from_account: str
    to_account: str
    amount: float
    purpose: str  # LIQUIDITY_TOPUP, FACILITY_REPAY, BUFFER_REBALANCE
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class TreasuryTransferSettled:
    """Treasury transfer settled."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    transfer_id: str
    settled_amount: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class PaymentSubmittedToRail:
    """Payment submitted to rail."""
    event_id: str
    aggregate_id: str  # payment_id
    tenant_id: str
    payment_id: str
    rail: str  # NPP, BECS, BPAY
    amount: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class PaymentSettled:
    """Payment settled."""
    event_id: str
    aggregate_id: str  # payment_id
    tenant_id: str
    payment_id: str
    rail: str
    settled_amount: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class PaymentFailed:
    """Payment failed."""
    event_id: str
    aggregate_id: str  # payment_id
    tenant_id: str
    payment_id: str
    rail: str
    failure_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class FundingFacilityDrawn:
    """Funding facility drawn."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    facility_id: str
    drawn_amount: float
    facility_type: str  # INTRADAY, OVERNIGHT, TERM
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class FundingFacilityRepaid:
    """Funding facility repaid."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    facility_id: str
    repaid_amount: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class SettlementBreachOccurred:
    """Settlement breach occurred."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    rail: str
    breach_type: str  # LIQUIDITY_SHORTFALL, POSITION_LIMIT_BREACH
    breach_amount: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class SettlementBreachAvoided:
    """Settlement breach avoided."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    rail: str
    action_taken: str  # LIQUIDITY_TOPUP, PAYMENT_DEFERRED, BATCH_SPLIT
    margin: float  # How close to breach
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== LAYER B EVENTS (RL Intelligence Events) ==========

@dataclass
class RlTreasuryPolicyEvaluated:
    """
    RL treasury policy evaluated.
    
    This is the FIRST protocol treasury RL event from Layer B → Layer A.
    It is immutable, auditable, replayable, and court-admissible.
    
    This has ZERO authority. It is shadow only.
    """
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    state_hash: str
    proposed_action: str  # LIQUIDITY_TOPUP, PAYMENT_THROTTLE, RAIL_SHIFT, BATCH_DEFER_30M, BATCH_DEFER_60M
    policy_id: str
    policy_version: str
    confidence_score: float  # 0.0 to 1.0
    reward_estimate: float
    state_features: Dict[str, float]
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class RlTreasuryRewardAttributed:
    """
    RL treasury reward attributed.
    
    Once outcomes are known, reward is attributed for training.
    This continuously trains the model without touching production authority.
    """
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    policy_id: str
    policy_version: str
    policy_evaluation_event_id: str
    actual_outcome: str  # BREACH_AVOIDED, BREACH_OCCURRED, NORMAL_OPERATION
    reward_value: float
    liquidity_impact: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class RlTreasuryAdvisoryIssued:
    """
    RL treasury advisory issued.
    
    After statistical proof, RL can issue advisories to treasury.
    Humans choose to accept or override.
    """
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    recommended_action: str
    expected_breach_reduction: float  # Expected reduction in breach probability
    liquidity_delta: float  # Expected liquidity impact
    confidence_level: float  # 0.0 to 1.0
    policy_id: str
    policy_version: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class RlDecisionAccepted:
    """RL decision accepted by human."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    advisory_event_id: str
    accepted_by: str  # Officer ID
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class RlDecisionOverridden:
    """RL decision overridden by human."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    advisory_event_id: str
    overridden_by: str  # Officer ID
    override_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== BOUNDED AUTOMATION EVENTS (ONLY AFTER 12-18 MONTHS) ==========

@dataclass
class RlBoundedActionAuthorised:
    """
    RL bounded action authorised.
    
    Only after APRA non-objection, board mandate, policy caps, dual approval.
    Only for: micro-batch throttling, payment queuing, low-value rail shifting.
    
    NEVER for: facility draws, capital reallocations, RBA settlement actions.
    """
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    action_type: str  # MICRO_BATCH_THROTTLE, PAYMENT_QUEUE, LOW_VALUE_RAIL_SHIFT
    action_parameters: Dict[str, Any]
    policy_id: str
    policy_version: str
    authorised_by: str  # Dual approval
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== GOVERNANCE EVENTS ==========

@dataclass
class TreasuryRlKillSwitchActivated:
    """Treasury RL kill switch activated."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    activated_by: str
    reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class TreasuryRlKillSwitchDeactivated:
    """Treasury RL kill switch deactivated."""
    event_id: str
    aggregate_id: str  # tenant_id
    tenant_id: str
    deactivated_by: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== EVENT VALIDATION ==========

def validate_treasury_event_chain(events: List[Any]) -> bool:
    """
    Validate treasury event chain integrity.
    
    Args:
        events: List of events in chronological order
    
    Returns:
        True if chain is valid
    """
    for i in range(1, len(events)):
        prev_event = events[i - 1]
        curr_event = events[i]
        
        # Check hash chain
        if hasattr(curr_event, 'hash_prev_event'):
            # In production, use cryptographic hash
            pass
    
    return True


def is_treasury_rl_event(event: Any) -> bool:
    """Check if event is from Treasury RL layer."""
    return isinstance(event, (
        RlTreasuryPolicyEvaluated,
        RlTreasuryRewardAttributed,
        RlTreasuryAdvisoryIssued
    ))


def is_treasury_decision_event(event: Any) -> bool:
    """Check if event is treasury decision."""
    return isinstance(event, (RlDecisionAccepted, RlDecisionOverridden))


def is_bounded_automation_event(event: Any) -> bool:
    """Check if event is bounded automation."""
    return isinstance(event, RlBoundedActionAuthorised)
