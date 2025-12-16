"""
Feature Store - Bank-Grade, Not Data Science Toy

This is the core ML asset for hardship detection.

Requirements:
- Tenant isolation (per CU)
- Time-travel features (for replay)
- Feature versioning
- Training vs inference parity
- Full provenance

All features are computed ONLY from Layer A events — never scraped balances.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, date
from typing import Dict, List, Any, Optional
import json


# ========== FEATURE GROUPS ==========

@dataclass
class IncomeFeatures:
    """Income stability and volatility features."""
    customer_id: str
    tenant_id: str
    as_of_date: str
    
    # Volatility
    volatility_30d: float  # Coefficient of variation
    volatility_90d: float
    income_drop_rate: float  # % drop from 90d avg to 30d avg
    
    # Stability
    income_count_30d: int
    income_avg_30d: float
    income_avg_90d: float
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class SpendingFeatures:
    """Spending pattern features."""
    customer_id: str
    tenant_id: str
    as_of_date: str
    
    # Discretionary vs essential
    discretionary_spend_growth: float  # % change in discretionary spend
    essential_spend_ratio: float  # Essential / Total
    
    # Patterns
    total_spend_30d: float
    total_spend_90d: float
    discretionary_spend_30d: float
    essential_spend_30d: float
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class LiquidityFeatures:
    """Liquidity and cash flow features."""
    customer_id: str
    tenant_id: str
    as_of_date: str
    
    # Liquidity
    min_balance_14d: float
    min_balance_30d: float
    avg_balance_30d: float
    
    # Overdraft
    overdraft_frequency: int  # Days in overdraft in last 30d
    overdraft_depth_max: float  # Max overdraft depth
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class CreditFeatures:
    """Credit behavior features."""
    customer_id: str
    tenant_id: str
    as_of_date: str
    
    # Repayment
    missed_payments_30d: int
    missed_payments_90d: int
    repayment_buffer: float  # Avg payment - min payment
    
    # Utilization
    credit_utilization: float  # % of credit limit used
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class StressFeatures:
    """Financial stress indicators."""
    customer_id: str
    tenant_id: str
    as_of_date: str
    
    # Stress signals
    failed_dd_count: int  # Failed direct debits in 30d
    merchant_risk_drift: float  # Shift to high-risk merchant categories
    
    # Behavioral
    late_night_transactions: int  # 11pm-5am transactions (stress indicator)
    gambling_spend_30d: float
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class HardshipFeatureVector:
    """Complete feature vector for hardship prediction."""
    customer_id: str
    tenant_id: str
    as_of_date: str
    
    income: IncomeFeatures
    spending: SpendingFeatures
    liquidity: LiquidityFeatures
    credit: CreditFeatures
    stress: StressFeatures
    
    feature_set_version: str = "1.0"
    computed_at: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to flat dict for ML model."""
        return {
            "customer_id": self.customer_id,
            "tenant_id": self.tenant_id,
            "as_of_date": self.as_of_date,
            
            # Income
            "volatility_30d": self.income.volatility_30d,
            "volatility_90d": self.income.volatility_90d,
            "income_drop_rate": self.income.income_drop_rate,
            
            # Spending
            "discretionary_spend_growth": self.spending.discretionary_spend_growth,
            "essential_spend_ratio": self.spending.essential_spend_ratio,
            
            # Liquidity
            "min_balance_14d": self.liquidity.min_balance_14d,
            "overdraft_frequency": self.liquidity.overdraft_frequency,
            
            # Credit
            "missed_payments_30d": self.credit.missed_payments_30d,
            "repayment_buffer": self.credit.repayment_buffer,
            
            # Stress
            "failed_dd_count": self.stress.failed_dd_count,
            "merchant_risk_drift": self.stress.merchant_risk_drift,
        }
    
    def to_hash(self) -> str:
        """Generate hash for provenance."""
        import hashlib
        content = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


# ========== FEATURE COMPUTATION ENGINE ==========

class FeatureStore:
    """
    Bank-grade feature store for hardship detection.
    
    Supports:
    - Tenant isolation
    - Time-travel (point-in-time correctness)
    - Feature versioning
    - Training/inference parity
    - Full provenance
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize feature store.
        
        Args:
            tenant_id: Tenant ID for isolation
        """
        self.tenant_id = tenant_id
        self.feature_cache: Dict[str, HardshipFeatureVector] = {}
    
    def compute_features(
        self,
        customer_id: str,
        as_of_date: date,
        events: List[Any]
    ) -> HardshipFeatureVector:
        """
        Compute feature vector from events.
        
        Args:
            customer_id: Customer ID
            as_of_date: Point-in-time date
            events: List of events up to as_of_date
        
        Returns:
            Complete feature vector
        """
        # Filter events up to as_of_date
        relevant_events = [
            e for e in events
            if datetime.fromisoformat(e.occurred_at).date() <= as_of_date
        ]
        
        # Compute each feature group
        income_features = self._compute_income_features(
            customer_id, as_of_date, relevant_events
        )
        spending_features = self._compute_spending_features(
            customer_id, as_of_date, relevant_events
        )
        liquidity_features = self._compute_liquidity_features(
            customer_id, as_of_date, relevant_events
        )
        credit_features = self._compute_credit_features(
            customer_id, as_of_date, relevant_events
        )
        stress_features = self._compute_stress_features(
            customer_id, as_of_date, relevant_events
        )
        
        return HardshipFeatureVector(
            customer_id=customer_id,
            tenant_id=self.tenant_id,
            as_of_date=str(as_of_date),
            income=income_features,
            spending=spending_features,
            liquidity=liquidity_features,
            credit=credit_features,
            stress=stress_features,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_income_features(
        self,
        customer_id: str,
        as_of_date: date,
        events: List[Any]
    ) -> IncomeFeatures:
        """Compute income features from IncomePosted events."""
        # TODO: Implement actual computation from events
        return IncomeFeatures(
            customer_id=customer_id,
            tenant_id=self.tenant_id,
            as_of_date=str(as_of_date),
            volatility_30d=0.15,
            volatility_90d=0.12,
            income_drop_rate=0.05,
            income_count_30d=2,
            income_avg_30d=3500.00,
            income_avg_90d=3600.00,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_spending_features(
        self,
        customer_id: str,
        as_of_date: date,
        events: List[Any]
    ) -> SpendingFeatures:
        """Compute spending features from CardAuthorisation events."""
        # TODO: Implement actual computation from events
        return SpendingFeatures(
            customer_id=customer_id,
            tenant_id=self.tenant_id,
            as_of_date=str(as_of_date),
            discretionary_spend_growth=0.20,
            essential_spend_ratio=0.65,
            total_spend_30d=2500.00,
            total_spend_90d=7200.00,
            discretionary_spend_30d=875.00,
            essential_spend_30d=1625.00,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_liquidity_features(
        self,
        customer_id: str,
        as_of_date: date,
        events: List[Any]
    ) -> LiquidityFeatures:
        """Compute liquidity features from AccountBalanceUpdated events."""
        # TODO: Implement actual computation from events
        return LiquidityFeatures(
            customer_id=customer_id,
            tenant_id=self.tenant_id,
            as_of_date=str(as_of_date),
            min_balance_14d=250.00,
            min_balance_30d=150.00,
            avg_balance_30d=800.00,
            overdraft_frequency=3,
            overdraft_depth_max=-150.00,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_credit_features(
        self,
        customer_id: str,
        as_of_date: date,
        events: List[Any]
    ) -> CreditFeatures:
        """Compute credit features from repayment events."""
        # TODO: Implement actual computation from events
        return CreditFeatures(
            customer_id=customer_id,
            tenant_id=self.tenant_id,
            as_of_date=str(as_of_date),
            missed_payments_30d=1,
            missed_payments_90d=2,
            repayment_buffer=50.00,
            credit_utilization=0.75,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_stress_features(
        self,
        customer_id: str,
        as_of_date: date,
        events: List[Any]
    ) -> StressFeatures:
        """Compute stress features from various events."""
        # TODO: Implement actual computation from events
        return StressFeatures(
            customer_id=customer_id,
            tenant_id=self.tenant_id,
            as_of_date=str(as_of_date),
            failed_dd_count=2,
            merchant_risk_drift=0.10,
            late_night_transactions=5,
            gambling_spend_30d=0.00,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def get_feature_vector(
        self,
        customer_id: str,
        as_of_date: date
    ) -> Optional[HardshipFeatureVector]:
        """
        Retrieve cached feature vector.
        
        Args:
            customer_id: Customer ID
            as_of_date: Point-in-time date
        
        Returns:
            Feature vector if cached, None otherwise
        """
        cache_key = f"{customer_id}_{as_of_date}"
        return self.feature_cache.get(cache_key)
    
    def store_feature_vector(
        self,
        feature_vector: HardshipFeatureVector
    ) -> None:
        """
        Store feature vector in cache.
        
        Args:
            feature_vector: Feature vector to store
        """
        cache_key = f"{feature_vector.customer_id}_{feature_vector.as_of_date}"
        self.feature_cache[cache_key] = feature_vector
