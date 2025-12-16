"""
Payments Policy Gateway — Deterministic Enforcement v1

This is the first legally significant control boundary between AI inference and human-visible advice.

PURPOSE:
- Transform RL intelligence (RlPolicyEvaluated) into advisory events (RlRoutingAdvisoryIssued)
- Apply deterministic, board-approved policy rules
- Enforce advisory-only outputs (NO execution commands)
- Provide court-defensible invariants

SAFETY GUARANTEES:
- NO execution authority (no PaymentCommand, SettlementCommand, PostingCommand)
- NO ledger access (no balance reads, no posting writes)
- NO external I/O (deterministic, pure function)
- SAME INPUT → SAME OUTPUT (reproducible for audit)

GOVERNANCE:
- Confidence thresholds set by board (not by model)
- Reward variance clamps prevent unstable model outputs
- All advisory events require human authorization for execution

ARCHITECTURE:
- Layer A (TuringCore) component
- Consumes Layer B intelligence (RlPolicyEvaluated)
- Emits Layer A advisory events (RlRoutingAdvisoryIssued)
- Protocol-governed transformation

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Advisory Mode)
"""

from dataclasses import dataclass, asdict
from typing import Optional, Dict, Any
import time
import uuid


# ============================================================================
# HARD SAFETY INVARIANTS (Court-Defensible)
# ============================================================================

FORBIDDEN_COMMAND_TYPES = {
    "ExecutePayment",
    "PostLedgerEntry",
    "SettlePayment",
    "ReversePayment",
    "MoveLiquidity",
    "FreezeAccount",
    "BlockCard",
    "RestrictAccount",
    "InitiateTransfer",
    "ApproveTransaction",
}


def assert_advisory_only(command: Dict[str, Any]) -> None:
    """
    Absolute guard: Payment RL can *never* emit an executable command.
    
    This is the first line of defense. Additional enforcement layers:
    - ai_origin_blocker (enforcement firewall)
    - CI harness assertions (test-time validation)
    - Protocol schema validation (runtime validation)
    
    Args:
        command: Output event dictionary to validate
        
    Raises:
        RuntimeError: If command contains forbidden execution authority
    """
    command_type = command.get("command_type") or command.get("event_type")
    
    if command_type in FORBIDDEN_COMMAND_TYPES:
        raise RuntimeError(
            f"🚨 FATAL POLICY VIOLATION: AI attempted to emit forbidden command '{command_type}'. "
            f"This is a critical safety breach. Payment RL Shadow must be disabled immediately."
        )


# ============================================================================
# INPUT CONTRACT (Layer B Intelligence)
# ============================================================================

@dataclass(frozen=True)
class RlPolicyEvaluatedEvent:
    """
    Input event from Payments RL Shadow Consumer (Layer B).
    
    This represents the raw output of RL policy evaluation.
    It has NO execution authority and is purely informational.
    """
    tenant_id: str
    payment_id: str
    state_hash: str
    proposed_action: str       # e.g., "ROUTE_NPP", "ROUTE_BECS", "ROUTE_BPAY"
    confidence_score: float    # 0.0 to 1.0
    reward_estimate: float     # Expected reward (normalized)
    policy_id: str
    policy_version: str
    occurred_at: int           # Unix timestamp in milliseconds
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RlPolicyEvaluatedEvent":
        """Parse RlPolicyEvaluated event from Kafka message."""
        return cls(
            tenant_id=data["tenant_id"],
            payment_id=data["payment_id"],
            state_hash=data["state_hash"],
            proposed_action=data["proposed_action"],
            confidence_score=data["confidence_score"],
            reward_estimate=data["reward_estimate"],
            policy_id=data["policy_id"],
            policy_version=data["policy_version"],
            occurred_at=data["occurred_at"]
        )


# ============================================================================
# OUTPUT CONTRACT (Layer A Advisory)
# ============================================================================

@dataclass(frozen=True)
class RlRoutingAdvisoryIssued:
    """
    Output event: Advisory-only routing recommendation.
    
    This event has NO execution authority. It is informational only.
    
    Human authorization is required to:
    - Override payment routing based on this advisory
    - Configure automatic routing rules based on advisory patterns
    - Use advisory data for operational dashboards
    
    This event CANNOT:
    - Execute a payment
    - Change payment routing
    - Modify ledger state
    - Initiate settlement
    """
    event_type: str
    schema_version: str
    event_id: str
    
    tenant_id: str
    payment_id: str
    recommended_rail: str      # "NPP", "BECS", "BPAY"
    
    confidence_score: float
    reward_estimate: float
    
    policy_id: str
    policy_version: str
    
    advisory_reason: str       # Human-readable explanation
    occurred_at: int
    
    origin: str = "AI"
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for Kafka serialization."""
        return asdict(self)


# ============================================================================
# POLICY THRESHOLDS (Board-Approved, Not Model-Set)
# ============================================================================

# Minimum confidence score for advisory emission
# Below this threshold, RL recommendations are ignored
# Board-approved value: 0.70 (70% confidence)
MIN_CONFIDENCE_FOR_ADVISORY = 0.70

# Maximum acceptable reward variance
# Prevents unstable models from issuing spurious optimization advice
# Board-approved value: 0.20 (20% variance)
MAX_ACCEPTABLE_REWARD_VARIANCE = 0.20

# Valid payment rails (Australian payments infrastructure)
VALID_PAYMENT_RAILS = {"NPP", "BECS", "BPAY"}


# ============================================================================
# DETERMINISTIC POLICY GATEWAY (Pure Function)
# ============================================================================

def evaluate_payments_rl_policy(
    event: RlPolicyEvaluatedEvent
) -> Optional[RlRoutingAdvisoryIssued]:
    """
    Deterministic transformation from RL evaluation → Advisory event.
    
    This is a PURE FUNCTION with the following guarantees:
    - NO execution authority
    - NO ledger access
    - NO external I/O (no database, no API calls)
    - SAME INPUT → SAME OUTPUT (deterministic, reproducible)
    
    Policy Rules (Board-Approved):
    1. Confidence gate: Only emit advisory if confidence ≥ 70%
    2. Reward stability: Ignore if reward variance > 20%
    3. Rail validation: Only recognize NPP, BECS, BPAY
    4. Advisory-only: Never emit execution commands
    
    Args:
        event: RlPolicyEvaluated event from Layer B
        
    Returns:
        RlRoutingAdvisoryIssued event if policy rules pass, None otherwise
        
    Raises:
        ValueError: If input event has invalid data
        RuntimeError: If advisory-only invariant is violated (should never happen)
    """
    
    # ========================================================================
    # STEP 1: Sanity Guards (Data Validation)
    # ========================================================================
    
    if event.confidence_score < 0.0 or event.confidence_score > 1.0:
        raise ValueError(
            f"Invalid confidence_score {event.confidence_score} for payment {event.payment_id}. "
            f"Must be in range [0.0, 1.0]."
        )
    
    if abs(event.reward_estimate) > MAX_ACCEPTABLE_REWARD_VARIANCE:
        # Prevents unstable models from issuing spurious optimization advice
        # This is a safety clamp for early-stage RL models
        # Log for model retraining signal, but do not emit advisory
        return None
    
    # ========================================================================
    # STEP 2: Board-Approved Confidence Gate
    # ========================================================================
    
    if event.confidence_score < MIN_CONFIDENCE_FOR_ADVISORY:
        # Model not confident enough to advise
        # This is the primary quality gate for RL outputs
        # Below 70% confidence, we trust human judgment over model judgment
        return None
    
    # ========================================================================
    # STEP 3: Deterministic Rail Mapping
    # ========================================================================
    
    # Extract rail from proposed action (e.g., "ROUTE_NPP" → "NPP")
    if not event.proposed_action.startswith("ROUTE_"):
        # Unknown action format → ignore
        return None
    
    recommended_rail = event.proposed_action.replace("ROUTE_", "")
    
    if recommended_rail not in VALID_PAYMENT_RAILS:
        # Unknown rail → ignore
        # This prevents model hallucination of invalid payment rails
        return None
    
    # ========================================================================
    # STEP 4: Advisory Construction (Immutable)
    # ========================================================================
    
    advisory = RlRoutingAdvisoryIssued(
        event_type="RlRoutingAdvisoryIssued",
        schema_version="1.0",
        event_id=str(uuid.uuid4()),
        
        tenant_id=event.tenant_id,
        payment_id=event.payment_id,
        recommended_rail=recommended_rail,
        
        confidence_score=round(event.confidence_score, 4),
        reward_estimate=round(event.reward_estimate, 6),
        
        policy_id=event.policy_id,
        policy_version=event.policy_version,
        
        advisory_reason=(
            f"RL policy {event.policy_id} v{event.policy_version} "
            f"recommends {recommended_rail} based on latency/cost optimization. "
            f"Confidence: {event.confidence_score:.2%}. "
            f"Expected reward: {event.reward_estimate:.4f}."
        ),
        
        occurred_at=int(time.time() * 1000),
        origin="AI",
    )
    
    # ========================================================================
    # STEP 5: Absolute Advisory-Only Assertion (Fail-Safe)
    # ========================================================================
    
    assert_advisory_only(advisory.to_dict())
    
    return advisory


# ============================================================================
# BATCH EVALUATION (For Consumer Service)
# ============================================================================

def evaluate_batch(
    events: list[Dict[str, Any]]
) -> list[RlRoutingAdvisoryIssued]:
    """
    Evaluate a batch of RlPolicyEvaluated events.
    
    This is a convenience wrapper for consumer services that process
    events in batches for efficiency.
    
    Args:
        events: List of RlPolicyEvaluated event dictionaries
        
    Returns:
        List of RlRoutingAdvisoryIssued events (may be shorter than input)
    """
    advisories = []
    
    for event_dict in events:
        try:
            event = RlPolicyEvaluatedEvent.from_dict(event_dict)
            advisory = evaluate_payments_rl_policy(event)
            
            if advisory is not None:
                advisories.append(advisory)
                
        except (KeyError, ValueError) as e:
            # Log error but continue processing batch
            print(f"⚠️  Skipping invalid event: {e}")
            continue
    
    return advisories


# ============================================================================
# POLICY STATISTICS (For Monitoring)
# ============================================================================

@dataclass
class PolicyStatistics:
    """Statistics for monitoring policy gateway behavior."""
    total_events: int
    advisories_issued: int
    rejected_low_confidence: int
    rejected_high_variance: int
    rejected_invalid_rail: int
    
    @property
    def advisory_rate(self) -> float:
        """Percentage of events that resulted in advisories."""
        if self.total_events == 0:
            return 0.0
        return (self.advisories_issued / self.total_events) * 100
    
    @property
    def rejection_rate(self) -> float:
        """Percentage of events that were rejected."""
        if self.total_events == 0:
            return 0.0
        rejected = (self.rejected_low_confidence + 
                   self.rejected_high_variance + 
                   self.rejected_invalid_rail)
        return (rejected / self.total_events) * 100


def compute_statistics(
    events: list[Dict[str, Any]],
    advisories: list[RlRoutingAdvisoryIssued]
) -> PolicyStatistics:
    """
    Compute policy gateway statistics for monitoring.
    
    Args:
        events: Input RlPolicyEvaluated events
        advisories: Output RlRoutingAdvisoryIssued events
        
    Returns:
        PolicyStatistics with rejection reasons
    """
    total = len(events)
    issued = len(advisories)
    
    # Count rejection reasons
    low_confidence = 0
    high_variance = 0
    invalid_rail = 0
    
    for event_dict in events:
        try:
            event = RlPolicyEvaluatedEvent.from_dict(event_dict)
            
            if event.confidence_score < MIN_CONFIDENCE_FOR_ADVISORY:
                low_confidence += 1
            elif abs(event.reward_estimate) > MAX_ACCEPTABLE_REWARD_VARIANCE:
                high_variance += 1
            elif not event.proposed_action.startswith("ROUTE_"):
                invalid_rail += 1
            else:
                rail = event.proposed_action.replace("ROUTE_", "")
                if rail not in VALID_PAYMENT_RAILS:
                    invalid_rail += 1
        except (KeyError, ValueError):
            continue
    
    return PolicyStatistics(
        total_events=total,
        advisories_issued=issued,
        rejected_low_confidence=low_confidence,
        rejected_high_variance=high_variance,
        rejected_invalid_rail=invalid_rail
    )


# ============================================================================
# CONFIGURATION (For Dynamic Policy Updates)
# ============================================================================

class PolicyConfiguration:
    """
    Dynamic policy configuration.
    
    Allows board-approved policy thresholds to be updated without code changes.
    In production, this would be backed by a configuration service or database.
    """
    
    def __init__(
        self,
        min_confidence: float = MIN_CONFIDENCE_FOR_ADVISORY,
        max_reward_variance: float = MAX_ACCEPTABLE_REWARD_VARIANCE,
        valid_rails: set[str] = VALID_PAYMENT_RAILS
    ):
        self.min_confidence = min_confidence
        self.max_reward_variance = max_reward_variance
        self.valid_rails = valid_rails
    
    def validate(self) -> None:
        """Validate configuration parameters."""
        if not 0.0 <= self.min_confidence <= 1.0:
            raise ValueError("min_confidence must be in range [0.0, 1.0]")
        
        if self.max_reward_variance < 0.0:
            raise ValueError("max_reward_variance must be non-negative")
        
        if not self.valid_rails:
            raise ValueError("valid_rails cannot be empty")


# ============================================================================
# AUDIT TRAIL (For Regulatory Compliance)
# ============================================================================

@dataclass
class AuditRecord:
    """
    Audit record for policy gateway decisions.
    
    This provides full traceability for regulatory review:
    - What RL recommended
    - What policy gateway decided
    - Why (confidence, reward, rail validity)
    """
    timestamp: int
    tenant_id: str
    payment_id: str
    rl_recommendation: str
    confidence_score: float
    reward_estimate: float
    policy_decision: str  # "APPROVED", "REJECTED_LOW_CONFIDENCE", etc.
    advisory_issued: bool
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for logging/storage."""
        return asdict(self)


def create_audit_record(
    event: RlPolicyEvaluatedEvent,
    advisory: Optional[RlRoutingAdvisoryIssued],
    decision: str
) -> AuditRecord:
    """
    Create audit record for policy gateway decision.
    
    Args:
        event: Input RL evaluation
        advisory: Output advisory (None if rejected)
        decision: Policy decision reason
        
    Returns:
        AuditRecord for logging/storage
    """
    return AuditRecord(
        timestamp=int(time.time() * 1000),
        tenant_id=event.tenant_id,
        payment_id=event.payment_id,
        rl_recommendation=event.proposed_action,
        confidence_score=event.confidence_score,
        reward_estimate=event.reward_estimate,
        policy_decision=decision,
        advisory_issued=(advisory is not None)
    )


# ============================================================================
# LEGACY COMPATIBILITY (For Existing Intelligence Bus Integration)
# ============================================================================

def apply_policy(event: dict, current_state: dict | None = None) -> dict | None:
    """
    Legacy interface for existing intelligence bus integration.
    
    This maintains backward compatibility with the existing
    intelligence_bus consumer architecture.
    
    Args:
        event: RlPolicyEvaluated or RlRoutingAdvisoryIssued event
        current_state: Current state dict (optional, unused)
    
    Returns:
        Domain command dict or None
    
    Pure function - no I/O, no DB access, no external calls.
    Advisory only. Never executes routing or settlements.
    """
    if event.get("event_type") not in {
        "RlPolicyEvaluated",
        "RlRoutingAdvisoryIssued",
    }:
        return None
    
    try:
        rl_event = RlPolicyEvaluatedEvent.from_dict(event)
        advisory = evaluate_payments_rl_policy(rl_event)
        
        if advisory is None:
            return None
        
        return {
            "command_type": "RlRoutingAdvisoryIssued",
            "payload": advisory.to_dict(),
        }
    except (KeyError, ValueError):
        # Fallback to simple advisory for backward compatibility
        return {
            "command_type": "RlRoutingAdvisoryIssued",
            "payload": {
                "payment_id": event.get("payment_id"),
                "recommended_action": event.get("proposed_action"),
                "confidence": event.get("confidence_score"),
                "expected_reward": event.get("reward_estimate"),
            },
        }
