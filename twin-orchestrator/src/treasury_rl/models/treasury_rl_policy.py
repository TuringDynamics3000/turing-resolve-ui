"""
Treasury RL Environment and Policy Models - Production Safe

RL Environment (Formal Definition):
- State Vector Sₜ: liquidity_vector, inflow_vector, outflow_vector, rail_congestion, backlog_pressure, time_features, facility_headroom
- Action Space Aₜ (PROPOSALS ONLY): propose_liquidity_topup, propose_payment_throttle, propose_rail_shift, propose_batch_deferral_30m, propose_batch_deferral_60m
- Reward Function Rₜ: settlement_success_bonus - liquidity_breach_penalty - failure_penalty - congestion_penalty - capital_cost_penalty

RL Shadow Execution (v1):
- Build Sₜ
- Evaluate RL: proposed_action = π(Sₜ)
- NO EXECUTION OCCURS
- Emit: RlTreasuryPolicyEvaluated
- Zero authority, zero settlement impact

Advisory Mode (After Statistical Proof):
- Once shadow results prove: lower settlement breaches, better buffer utilisation, lower emergency facility draws
- Then treasury sees: RlTreasuryAdvisoryIssued
- Humans choose: RlDecisionAccepted OR RlDecisionOverridden

Bounded Automation (Only After 12-18 Months):
- Only once: APRA non-objection, board mandate, policy caps, dual approval
- Then RL may auto-execute ONLY: micro-batch throttling, payment queuing, low-value rail shifting
- NEVER: facility draws, capital reallocations, RBA settlement actions
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Any, Optional
from enum import Enum
import json


class TreasuryRlAction(Enum):
    """Treasury RL action space (proposals only)."""
    PROPOSE_LIQUIDITY_TOPUP = "propose_liquidity_topup"
    PROPOSE_PAYMENT_THROTTLE = "propose_payment_throttle"
    PROPOSE_RAIL_SHIFT = "propose_rail_shift"
    PROPOSE_BATCH_DEFERRAL_30M = "propose_batch_deferral_30m"
    PROPOSE_BATCH_DEFERRAL_60M = "propose_batch_deferral_60m"
    NO_ACTION = "no_action"


@dataclass
class TreasuryRlState:
    """Treasury RL state vector."""
    tenant_id: str
    timestamp: str
    
    # Liquidity vector
    available_npp_liquidity: float
    available_becs_liquidity: float
    liquidity_buffer_remaining_pct: float
    
    # Inflow vector
    inflow_rate_30m: float
    inflow_rate_1h: float
    
    # Outflow vector
    outflow_rate_30m: float
    outflow_rate_1h: float
    
    # Rail congestion
    rail_congestion_score: float
    
    # Backlog pressure
    queue_depth: int
    retry_pressure: int
    
    # Time features
    time_of_day: float
    public_holiday_flag: bool
    
    # Facility headroom
    facility_utilisation_pct: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dict for RL model."""
        return {
            "available_npp_liquidity": self.available_npp_liquidity,
            "available_becs_liquidity": self.available_becs_liquidity,
            "liquidity_buffer_remaining_pct": self.liquidity_buffer_remaining_pct,
            "inflow_rate_30m": self.inflow_rate_30m,
            "outflow_rate_30m": self.outflow_rate_30m,
            "rail_congestion_score": self.rail_congestion_score,
            "queue_depth": float(self.queue_depth),
            "time_of_day": self.time_of_day,
            "facility_utilisation_pct": self.facility_utilisation_pct,
        }
    
    def to_hash(self) -> str:
        """Generate hash for provenance."""
        import hashlib
        content = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


@dataclass
class TreasuryRlReward:
    """Treasury RL reward components."""
    settlement_success_bonus: float = 0.0
    liquidity_breach_penalty: float = 0.0
    failure_penalty: float = 0.0
    congestion_penalty: float = 0.0
    capital_cost_penalty: float = 0.0
    
    def total(self) -> float:
        """Calculate total reward."""
        return (
            self.settlement_success_bonus
            - self.liquidity_breach_penalty
            - self.failure_penalty
            - self.congestion_penalty
            - self.capital_cost_penalty
        )


@dataclass
class TreasuryRlPolicyEvaluation:
    """Treasury RL policy evaluation result."""
    tenant_id: str
    state_hash: str
    proposed_action: TreasuryRlAction
    policy_id: str
    policy_version: str
    confidence_score: float  # 0.0 to 1.0
    reward_estimate: float
    state_features: Dict[str, float]
    evaluated_at: str


class TreasuryRlPolicy:
    """
    Treasury RL policy.
    
    This is a placeholder for actual RL policy (e.g., PPO, DQN, SAC).
    In production, replace with trained RL model.
    """
    
    def __init__(
        self,
        policy_id: str,
        policy_version: str,
        mode: str = "SHADOW"  # SHADOW, ADVISORY, BOUNDED
    ):
        """
        Initialize Treasury RL policy.
        
        Args:
            policy_id: Policy ID
            policy_version: Policy version
            mode: Operating mode (SHADOW, ADVISORY, BOUNDED)
        """
        self.policy_id = policy_id
        self.policy_version = policy_version
        self.mode = mode
    
    def evaluate(
        self,
        state: TreasuryRlState
    ) -> TreasuryRlPolicyEvaluation:
        """
        Evaluate policy on state.
        
        Args:
            state: Treasury RL state
        
        Returns:
            Policy evaluation with proposed action
        """
        # Placeholder logic - replace with actual RL policy
        proposed_action = self._select_action(state)
        confidence_score = self._compute_confidence(state)
        reward_estimate = self._estimate_reward(state, proposed_action)
        
        return TreasuryRlPolicyEvaluation(
            tenant_id=state.tenant_id,
            state_hash=state.to_hash(),
            proposed_action=proposed_action,
            policy_id=self.policy_id,
            policy_version=self.policy_version,
            confidence_score=confidence_score,
            reward_estimate=reward_estimate,
            state_features=state.to_dict(),
            evaluated_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _select_action(self, state: TreasuryRlState) -> TreasuryRlAction:
        """Select action based on state (placeholder logic)."""
        # Liquidity breach risk
        if state.liquidity_buffer_remaining_pct < 0.20:
            return TreasuryRlAction.PROPOSE_LIQUIDITY_TOPUP
        
        # High congestion
        if state.rail_congestion_score > 0.70:
            return TreasuryRlAction.PROPOSE_PAYMENT_THROTTLE
        
        # High queue depth
        if state.queue_depth > 100:
            return TreasuryRlAction.PROPOSE_RAIL_SHIFT
        
        # Moderate congestion with forward visibility
        if state.rail_congestion_score > 0.50 and state.queue_depth > 50:
            return TreasuryRlAction.PROPOSE_BATCH_DEFERRAL_30M
        
        return TreasuryRlAction.NO_ACTION
    
    def _compute_confidence(self, state: TreasuryRlState) -> float:
        """Compute confidence score (placeholder logic)."""
        # Higher confidence when state is clear
        if state.liquidity_buffer_remaining_pct < 0.15:
            return 0.95  # Very confident about liquidity topup
        
        if state.rail_congestion_score > 0.80:
            return 0.90  # Very confident about throttling
        
        return 0.60  # Moderate confidence
    
    def _estimate_reward(
        self,
        state: TreasuryRlState,
        action: TreasuryRlAction
    ) -> float:
        """Estimate reward for action (placeholder logic)."""
        # Placeholder reward estimation
        if action == TreasuryRlAction.PROPOSE_LIQUIDITY_TOPUP:
            return 100.0  # High reward for avoiding breach
        
        if action == TreasuryRlAction.PROPOSE_PAYMENT_THROTTLE:
            return 50.0  # Moderate reward for reducing congestion
        
        if action == TreasuryRlAction.PROPOSE_RAIL_SHIFT:
            return 30.0  # Lower reward for rail optimization
        
        return 0.0


class TreasuryRlEnvironment:
    """
    Treasury RL environment.
    
    Manages state transitions and reward computation.
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize Treasury RL environment.
        
        Args:
            tenant_id: Tenant ID
        """
        self.tenant_id = tenant_id
        self.current_state: Optional[TreasuryRlState] = None
    
    def update_state(self, feature_vector: Any) -> TreasuryRlState:
        """
        Update environment state from feature vector.
        
        Args:
            feature_vector: TreasuryFeatureVector
        
        Returns:
            Updated state
        """
        features = feature_vector.to_dict()
        
        self.current_state = TreasuryRlState(
            tenant_id=self.tenant_id,
            timestamp=feature_vector.as_of_timestamp,
            available_npp_liquidity=features["available_npp_liquidity"],
            available_becs_liquidity=features["available_becs_liquidity"],
            liquidity_buffer_remaining_pct=features["liquidity_buffer_remaining_pct"],
            inflow_rate_30m=features["inflow_rate_30m"],
            inflow_rate_1h=features.get("inflow_rate_1h", 0.0),
            outflow_rate_30m=features["outflow_rate_30m"],
            outflow_rate_1h=features.get("outflow_rate_1h", 0.0),
            rail_congestion_score=features["rail_congestion_score"],
            queue_depth=int(features["queue_depth"]),
            retry_pressure=features.get("retry_pressure", 0),
            time_of_day=features["time_of_day"],
            public_holiday_flag=features["public_holiday_flag"] > 0.5,
            facility_utilisation_pct=features.get("facility_utilisation_pct", 0.0),
        )
        
        return self.current_state
    
    def compute_reward(
        self,
        action: TreasuryRlAction,
        outcome_events: List[Any]
    ) -> TreasuryRlReward:
        """
        Compute reward based on action and outcome.
        
        Args:
            action: Action taken
            outcome_events: Outcome events (settlement, breach, etc.)
        
        Returns:
            Reward components
        """
        reward = TreasuryRlReward()
        
        # Check for settlement success
        settlement_successes = [
            e for e in outcome_events
            if e.__class__.__name__ == "PaymentSettled"
        ]
        reward.settlement_success_bonus = len(settlement_successes) * 1.0
        
        # Check for liquidity breaches
        breaches = [
            e for e in outcome_events
            if e.__class__.__name__ == "SettlementBreachOccurred"
        ]
        reward.liquidity_breach_penalty = len(breaches) * 1000.0
        
        # Check for payment failures
        failures = [
            e for e in outcome_events
            if e.__class__.__name__ == "PaymentFailed"
        ]
        reward.failure_penalty = len(failures) * 10.0
        
        # Check for facility draws (capital cost)
        facility_draws = [
            e for e in outcome_events
            if e.__class__.__name__ == "FundingFacilityDrawn"
        ]
        reward.capital_cost_penalty = sum(e.drawn_amount for e in facility_draws) * 0.001
        
        return reward


class TreasuryRlKillSwitch:
    """
    Emergency kill switch for Treasury RL.
    
    When activated:
    - No new RL evaluations
    - No new advisories
    - No bounded automation
    - Manual treasury only
    """
    
    def __init__(self):
        """Initialize kill switch."""
        self.is_active = False
        self.activated_by: Optional[str] = None
        self.activated_at: Optional[str] = None
        self.reason: Optional[str] = None
    
    def activate(
        self,
        activated_by: str,
        reason: str
    ) -> None:
        """Activate kill switch."""
        self.is_active = True
        self.activated_by = activated_by
        self.activated_at = datetime.utcnow().isoformat() + "Z"
        self.reason = reason
    
    def deactivate(self) -> None:
        """Deactivate kill switch."""
        self.is_active = False
        self.activated_by = None
        self.activated_at = None
        self.reason = None
    
    def check(self) -> bool:
        """Check if Treasury RL can operate."""
        return not self.is_active
