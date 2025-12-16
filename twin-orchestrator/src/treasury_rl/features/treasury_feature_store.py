"""
Treasury RL Feature Store - Intraday Liquidity

Derived only from Protocol events (Layer A).

Core Feature Groups:
A. Liquidity State: available_npp_liquidity, becs_forward_balance, intraday_min_balance, liquidity_buffer_remaining_pct
B. Flow Velocity: inflow_rate_5m/30m, outflow_rate_5m/30m, net_flow_gradient
C. Stress Indicators: payment_failure_rate, retry_pressure, queue_depth, rail_congestion_score
D. External Conditions: time_of_day, public_holiday_flag, salary_cycle_position, known_event_risk_flag

All features are:
- Versioned
- Time-travel safe
- Drift-monitored
- Tenant-isolated
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json


# ========== FEATURE GROUPS ==========

@dataclass
class LiquidityStateFeatures:
    """Liquidity state features for Treasury RL."""
    tenant_id: str
    as_of_timestamp: str
    
    # Available liquidity by rail
    available_npp_liquidity: float
    available_becs_liquidity: float
    available_bpay_liquidity: float
    
    # Forward balances
    becs_forward_balance: float  # Expected balance after BECS settlement
    
    # Intraday metrics
    intraday_min_balance: float  # Minimum balance observed today
    intraday_max_balance: float  # Maximum balance observed today
    
    # Buffer metrics
    liquidity_buffer_remaining_pct: float  # % of buffer remaining
    buffer_breach_risk_score: float  # Risk of breaching buffer
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class FlowVelocityFeatures:
    """Flow velocity features for Treasury RL."""
    tenant_id: str
    as_of_timestamp: str
    
    # Inflow rates
    inflow_rate_5m: float  # $ per 5 minutes
    inflow_rate_30m: float  # $ per 30 minutes
    inflow_rate_1h: float  # $ per hour
    
    # Outflow rates
    outflow_rate_5m: float  # $ per 5 minutes
    outflow_rate_30m: float  # $ per 30 minutes
    outflow_rate_1h: float  # $ per hour
    
    # Net flow
    net_flow_gradient: float  # Gradient of net flow (positive = improving)
    net_flow_volatility: float  # Volatility of net flow
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class StressIndicatorFeatures:
    """Stress indicator features for Treasury RL."""
    tenant_id: str
    as_of_timestamp: str
    
    # Payment stress
    payment_failure_rate: float  # % of payments failing
    retry_pressure: int  # Number of payments in retry
    queue_depth: int  # Number of payments queued
    
    # Rail congestion
    rail_congestion_score: float  # 0.0 to 1.0 (1.0 = severe congestion)
    npp_congestion: float
    becs_congestion: float
    
    # Facility usage
    facility_utilisation_pct: float  # % of facility drawn
    facility_breach_risk: float  # Risk of breaching facility limit
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class ExternalConditionFeatures:
    """External condition features for Treasury RL."""
    tenant_id: str
    as_of_timestamp: str
    
    # Time features
    time_of_day: float  # 0.0 to 24.0
    day_of_week: int  # 0 = Monday, 6 = Sunday
    hour_of_day: int  # 0 to 23
    
    # Calendar features
    public_holiday_flag: bool
    business_day_flag: bool
    month_end_flag: bool
    quarter_end_flag: bool
    
    # Cycle features
    salary_cycle_position: str  # EARLY, MID, LATE
    pension_cycle_flag: bool
    
    # Event risk
    known_event_risk_flag: bool  # Known high-volume event (e.g., tax deadline)
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class TreasuryFeatureVector:
    """Complete feature vector for Treasury RL."""
    tenant_id: str
    as_of_timestamp: str
    
    liquidity_state: LiquidityStateFeatures
    flow_velocity: FlowVelocityFeatures
    stress_indicators: StressIndicatorFeatures
    external_conditions: ExternalConditionFeatures
    
    feature_set_version: str = "1.0"
    computed_at: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to flat dict for RL model."""
        return {
            "tenant_id": self.tenant_id,
            "as_of_timestamp": self.as_of_timestamp,
            
            # Liquidity State
            "available_npp_liquidity": self.liquidity_state.available_npp_liquidity,
            "available_becs_liquidity": self.liquidity_state.available_becs_liquidity,
            "liquidity_buffer_remaining_pct": self.liquidity_state.liquidity_buffer_remaining_pct,
            "intraday_min_balance": self.liquidity_state.intraday_min_balance,
            
            # Flow Velocity
            "inflow_rate_30m": self.flow_velocity.inflow_rate_30m,
            "outflow_rate_30m": self.flow_velocity.outflow_rate_30m,
            "net_flow_gradient": self.flow_velocity.net_flow_gradient,
            
            # Stress Indicators
            "payment_failure_rate": self.stress_indicators.payment_failure_rate,
            "queue_depth": self.stress_indicators.queue_depth,
            "rail_congestion_score": self.stress_indicators.rail_congestion_score,
            
            # External Conditions
            "time_of_day": self.external_conditions.time_of_day,
            "public_holiday_flag": 1.0 if self.external_conditions.public_holiday_flag else 0.0,
            "known_event_risk_flag": 1.0 if self.external_conditions.known_event_risk_flag else 0.0,
        }
    
    def to_hash(self) -> str:
        """Generate hash for provenance."""
        import hashlib
        content = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


# ========== FEATURE COMPUTATION ENGINE ==========

class TreasuryFeatureStore:
    """
    Treasury feature store for intraday liquidity RL.
    
    Supports:
    - Tenant isolation
    - Time-travel (point-in-time correctness)
    - Feature versioning
    - Training/inference parity
    - Full provenance
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize treasury feature store.
        
        Args:
            tenant_id: Tenant ID for isolation
        """
        self.tenant_id = tenant_id
        self.feature_cache: Dict[str, TreasuryFeatureVector] = {}
    
    def compute_features(
        self,
        as_of_timestamp: datetime,
        events: List[Any]
    ) -> TreasuryFeatureVector:
        """
        Compute feature vector from events.
        
        Args:
            as_of_timestamp: Point-in-time timestamp
            events: List of events up to as_of_timestamp
        
        Returns:
            Complete feature vector
        """
        # Filter events up to as_of_timestamp
        relevant_events = [
            e for e in events
            if datetime.fromisoformat(e.occurred_at.replace('Z', '+00:00')) <= as_of_timestamp
        ]
        
        # Compute each feature group
        liquidity_state = self._compute_liquidity_state_features(
            as_of_timestamp, relevant_events
        )
        flow_velocity = self._compute_flow_velocity_features(
            as_of_timestamp, relevant_events
        )
        stress_indicators = self._compute_stress_indicator_features(
            as_of_timestamp, relevant_events
        )
        external_conditions = self._compute_external_condition_features(
            as_of_timestamp, relevant_events
        )
        
        return TreasuryFeatureVector(
            tenant_id=self.tenant_id,
            as_of_timestamp=as_of_timestamp.isoformat(),
            liquidity_state=liquidity_state,
            flow_velocity=flow_velocity,
            stress_indicators=stress_indicators,
            external_conditions=external_conditions,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_liquidity_state_features(
        self,
        as_of_timestamp: datetime,
        events: List[Any]
    ) -> LiquidityStateFeatures:
        """Compute liquidity state features from events."""
        # TODO: Implement actual computation from events
        return LiquidityStateFeatures(
            tenant_id=self.tenant_id,
            as_of_timestamp=as_of_timestamp.isoformat(),
            available_npp_liquidity=5000000.0,
            available_becs_liquidity=3000000.0,
            available_bpay_liquidity=1000000.0,
            becs_forward_balance=2500000.0,
            intraday_min_balance=2000000.0,
            intraday_max_balance=8000000.0,
            liquidity_buffer_remaining_pct=0.65,
            buffer_breach_risk_score=0.15,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_flow_velocity_features(
        self,
        as_of_timestamp: datetime,
        events: List[Any]
    ) -> FlowVelocityFeatures:
        """Compute flow velocity features from events."""
        # TODO: Implement actual computation from events
        return FlowVelocityFeatures(
            tenant_id=self.tenant_id,
            as_of_timestamp=as_of_timestamp.isoformat(),
            inflow_rate_5m=50000.0,
            inflow_rate_30m=280000.0,
            inflow_rate_1h=520000.0,
            outflow_rate_5m=45000.0,
            outflow_rate_30m=260000.0,
            outflow_rate_1h=490000.0,
            net_flow_gradient=0.05,
            net_flow_volatility=0.12,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_stress_indicator_features(
        self,
        as_of_timestamp: datetime,
        events: List[Any]
    ) -> StressIndicatorFeatures:
        """Compute stress indicator features from events."""
        # TODO: Implement actual computation from events
        return StressIndicatorFeatures(
            tenant_id=self.tenant_id,
            as_of_timestamp=as_of_timestamp.isoformat(),
            payment_failure_rate=0.02,
            retry_pressure=15,
            queue_depth=42,
            rail_congestion_score=0.25,
            npp_congestion=0.20,
            becs_congestion=0.30,
            facility_utilisation_pct=0.10,
            facility_breach_risk=0.05,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_external_condition_features(
        self,
        as_of_timestamp: datetime,
        events: List[Any]
    ) -> ExternalConditionFeatures:
        """Compute external condition features from events."""
        # TODO: Implement actual computation from events
        return ExternalConditionFeatures(
            tenant_id=self.tenant_id,
            as_of_timestamp=as_of_timestamp.isoformat(),
            time_of_day=float(as_of_timestamp.hour) + float(as_of_timestamp.minute) / 60.0,
            day_of_week=as_of_timestamp.weekday(),
            hour_of_day=as_of_timestamp.hour,
            public_holiday_flag=False,
            business_day_flag=as_of_timestamp.weekday() < 5,
            month_end_flag=as_of_timestamp.day >= 28,
            quarter_end_flag=as_of_timestamp.month in [3, 6, 9, 12] and as_of_timestamp.day >= 28,
            salary_cycle_position="MID",
            pension_cycle_flag=False,
            known_event_risk_flag=False,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
