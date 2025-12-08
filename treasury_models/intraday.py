"""
Treasury RL Model — Intraday Liquidity Intelligence

This is a stub RL model for Treasury RL Shadow v1.

PURPOSE:
- Detect intraday liquidity stress
- Recommend buffer and facility headroom
- Optimize settlement timing

SAFETY GUARANTEES:
- Read-only, observational only
- No execution authority
- No ability to move liquidity (sweeps, facility draws, account movement)

Author: TuringCore National Infrastructure Team
Version: 1.0 (Stub)
Status: Production-Ready (Stub Model)
"""

from typing import Dict, Any


class TreasuryRlModel:
    """
    Treasury RL model for intraday liquidity stress detection (stub v1).
    
    This is a simple rule-based stub for v1. Future versions will use:
    - RL models (PPO, SAC, TD3)
    - Historical liquidity patterns
    - Settlement batch projections
    - Facility rate optimization
    """
    
    def __init__(self):
        """Initialize Treasury RL model."""
        self.model_id = "treasury-rl-v1"
        self.model_version = "1.0"
    
    def build_state(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build state representation from intraday liquidity snapshot.
        
        Args:
            event: IntradayLiquiditySnapshot event
            
        Returns:
            State dictionary
        """
        # Extract liquidity metrics
        available_liquidity_cents = event.get("available_liquidity_cents", 0)
        settlement_obligation_cents = event.get("settlement_obligation_cents", 0)
        facility_limit_cents = event.get("facility_limit_cents", 0)
        facility_drawn_cents = event.get("facility_drawn_cents", 0)
        
        # Net positions
        npp_net_position_cents = event.get("npp_net_position_cents", 0)
        becs_net_position_cents = event.get("becs_net_position_cents", 0)
        
        # Compute derived metrics
        liquidity_coverage_ratio = (
            available_liquidity_cents / settlement_obligation_cents
            if settlement_obligation_cents > 0 else 1.0
        )
        
        facility_utilization = (
            facility_drawn_cents / facility_limit_cents
            if facility_limit_cents > 0 else 0.0
        )
        
        facility_headroom_cents = facility_limit_cents - facility_drawn_cents
        
        net_settlement_position_cents = npp_net_position_cents + becs_net_position_cents
        
        return {
            "available_liquidity_cents": available_liquidity_cents,
            "settlement_obligation_cents": settlement_obligation_cents,
            "facility_limit_cents": facility_limit_cents,
            "facility_drawn_cents": facility_drawn_cents,
            "liquidity_coverage_ratio": liquidity_coverage_ratio,
            "facility_utilization": facility_utilization,
            "facility_headroom_cents": facility_headroom_cents,
            "net_settlement_position_cents": net_settlement_position_cents,
            "npp_net_position_cents": npp_net_position_cents,
            "becs_net_position_cents": becs_net_position_cents
        }
    
    def evaluate(self, state: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluate treasury RL policy for liquidity state.
        
        This is a simple rule-based stub for v1. Future versions will use RL models.
        
        Args:
            state: State dictionary
            
        Returns:
            RL output dictionary
        """
        # Compute liquidity risk score
        risk_score = self._compute_risk_score(state)
        
        # Classify risk band
        if risk_score >= 0.85:
            risk_band = "HIGH"
        elif risk_score >= 0.65:
            risk_band = "MEDIUM"
        else:
            risk_band = "LOW"
        
        # Recommend buffer and facility headroom
        recommended_buffer_cents = self._recommend_buffer(state, risk_score)
        recommended_headroom_cents = self._recommend_headroom(state, risk_score)
        
        return {
            "risk_score": risk_score,
            "risk_band": risk_band,
            "recommended_buffer_cents": recommended_buffer_cents,
            "recommended_headroom_cents": recommended_headroom_cents
        }
    
    def _compute_risk_score(self, state: Dict[str, Any]) -> float:
        """
        Compute liquidity risk score (stub).
        
        In production, this would use RL models trained on historical data.
        
        Args:
            state: State dictionary
            
        Returns:
            Risk score (0.0 to 1.0)
        """
        # Base risk
        risk = 0.0
        
        # Liquidity coverage ratio risk
        lcr = state["liquidity_coverage_ratio"]
        if lcr < 1.0:
            risk += 0.4  # High risk if coverage < 100%
        elif lcr < 1.2:
            risk += 0.2  # Medium risk if coverage < 120%
        
        # Facility utilization risk
        facility_util = state["facility_utilization"]
        if facility_util > 0.8:
            risk += 0.3  # High risk if facility > 80% utilized
        elif facility_util > 0.6:
            risk += 0.15  # Medium risk if facility > 60% utilized
        
        # Net settlement position risk
        net_position = state["net_settlement_position_cents"]
        available_liquidity = state["available_liquidity_cents"]
        
        if net_position < 0:  # Net outflow
            position_ratio = abs(net_position) / available_liquidity if available_liquidity > 0 else 1.0
            if position_ratio > 0.5:
                risk += 0.3  # High risk if net outflow > 50% of liquidity
            elif position_ratio > 0.3:
                risk += 0.15  # Medium risk if net outflow > 30% of liquidity
        
        # Clamp to [0, 1]
        return min(max(risk, 0.0), 1.0)
    
    def _recommend_buffer(self, state: Dict[str, Any], risk_score: float) -> int:
        """
        Recommend liquidity buffer (stub).
        
        Args:
            state: State dictionary
            risk_score: Computed risk score
            
        Returns:
            Recommended buffer in cents
        """
        settlement_obligation = state["settlement_obligation_cents"]
        
        # Rule-based buffer recommendation
        if risk_score >= 0.85:
            # High risk: recommend 30% buffer
            return int(settlement_obligation * 0.30)
        elif risk_score >= 0.65:
            # Medium risk: recommend 20% buffer
            return int(settlement_obligation * 0.20)
        else:
            # Low risk: recommend 10% buffer
            return int(settlement_obligation * 0.10)
    
    def _recommend_headroom(self, state: Dict[str, Any], risk_score: float) -> int:
        """
        Recommend facility headroom (stub).
        
        Args:
            state: State dictionary
            risk_score: Computed risk score
            
        Returns:
            Recommended facility headroom in cents
        """
        facility_limit = state["facility_limit_cents"]
        
        # Rule-based headroom recommendation
        if risk_score >= 0.85:
            # High risk: recommend 80% headroom (20% utilization)
            return int(facility_limit * 0.80)
        elif risk_score >= 0.65:
            # Medium risk: recommend 60% headroom (40% utilization)
            return int(facility_limit * 0.60)
        else:
            # Low risk: recommend 40% headroom (60% utilization)
            return int(facility_limit * 0.40)
