"""
AML Feature Store - Pattern-of-Life Analysis

Derived only from Protocol events.

Core Feature Groups:
A. Structural Behaviour: unique_counterparties_30d, in_out_flow_ratio, account_hop_depth, round_trip_frequency
B. Velocity & Thresholds: tx_count_1d/7d/30d, value_accumulation_rate, threshold_hover_score
C. Geographic Risk: jurisdiction_risk_drift, cross_border_ratio
D. Network Propagation: shared_counterparty_degree, mule_hop_chain_length, known_high_risk_linkage
E. Customer Profile Drift: income_spend_divergence, merchant_category_shift, channel_entropy

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
class StructuralBehaviourFeatures:
    """Structural behaviour features for AML."""
    account_id: str
    tenant_id: str
    as_of_date: str
    
    # Counterparty patterns
    unique_counterparties_30d: int
    unique_counterparties_90d: int
    
    # Flow patterns
    in_out_flow_ratio: float  # Ratio of inbound to outbound
    account_hop_depth: int  # Layering depth
    round_trip_frequency: float  # Frequency of round-trip transactions
    
    # Structuring indicators
    near_threshold_tx_count: int  # Transactions near $10k threshold
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class VelocityThresholdFeatures:
    """Velocity and threshold features for AML."""
    account_id: str
    tenant_id: str
    as_of_date: str
    
    # Transaction velocity
    tx_count_1d: int
    tx_count_7d: int
    tx_count_30d: int
    
    # Value accumulation
    value_accumulation_rate: float  # $ per day
    value_accumulation_spike: bool  # Sudden spike in value
    
    # Threshold hovering (structuring detection)
    threshold_hover_score: float  # How often transactions cluster near $10k
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class GeographicRiskFeatures:
    """Geographic risk features for AML."""
    account_id: str
    tenant_id: str
    as_of_date: str
    
    # Jurisdiction risk
    jurisdiction_risk_drift: float  # Drift toward high-risk jurisdictions
    high_risk_jurisdiction_count: int
    
    # Cross-border patterns
    cross_border_ratio: float  # % of transactions that are cross-border
    cross_border_velocity: int  # Cross-border transactions per month
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class NetworkPropagationFeatures:
    """Network propagation features for AML."""
    account_id: str
    tenant_id: str
    as_of_date: str
    
    # Network patterns
    shared_counterparty_degree: int  # How many counterparties are shared with other accounts
    mule_hop_chain_length: int  # Length of mule chain
    known_high_risk_linkage: bool  # Linked to known high-risk entities
    
    # Cluster membership
    cluster_membership: Optional[str]  # Mule cluster ID if in cluster
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class CustomerProfileDriftFeatures:
    """Customer profile drift features for AML."""
    account_id: str
    tenant_id: str
    as_of_date: str
    
    # Income vs spend
    income_spend_divergence: float  # Divergence between stated income and spending
    
    # Merchant category drift
    merchant_category_shift: float  # Shift in merchant categories
    new_merchant_category_flag: bool  # First time in this category
    
    # Channel entropy
    channel_entropy: float  # Diversity of channels used
    channel_shift_score: float  # Sudden shift in channel usage
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class AmlFeatureVector:
    """Complete feature vector for AML detection."""
    account_id: str
    tenant_id: str
    customer_id: str
    as_of_date: str
    
    structural_behaviour: StructuralBehaviourFeatures
    velocity_threshold: VelocityThresholdFeatures
    geographic_risk: GeographicRiskFeatures
    network_propagation: NetworkPropagationFeatures
    customer_profile_drift: CustomerProfileDriftFeatures
    
    feature_set_version: str = "1.0"
    computed_at: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to flat dict for ML model."""
        return {
            "account_id": self.account_id,
            "tenant_id": self.tenant_id,
            "customer_id": self.customer_id,
            "as_of_date": self.as_of_date,
            
            # Structural Behaviour
            "unique_counterparties_30d": self.structural_behaviour.unique_counterparties_30d,
            "in_out_flow_ratio": self.structural_behaviour.in_out_flow_ratio,
            "round_trip_frequency": self.structural_behaviour.round_trip_frequency,
            
            # Velocity & Thresholds
            "tx_count_30d": self.velocity_threshold.tx_count_30d,
            "value_accumulation_rate": self.velocity_threshold.value_accumulation_rate,
            "threshold_hover_score": self.velocity_threshold.threshold_hover_score,
            
            # Geographic Risk
            "jurisdiction_risk_drift": self.geographic_risk.jurisdiction_risk_drift,
            "cross_border_ratio": self.geographic_risk.cross_border_ratio,
            
            # Network Propagation
            "shared_counterparty_degree": self.network_propagation.shared_counterparty_degree,
            "mule_hop_chain_length": self.network_propagation.mule_hop_chain_length,
            
            # Customer Profile Drift
            "income_spend_divergence": self.customer_profile_drift.income_spend_divergence,
            "merchant_category_shift": self.customer_profile_drift.merchant_category_shift,
        }
    
    def to_hash(self) -> str:
        """Generate hash for provenance."""
        import hashlib
        content = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


# ========== FEATURE COMPUTATION ENGINE ==========

class AmlFeatureStore:
    """
    AML feature store for pattern-of-life analysis.
    
    Supports:
    - Tenant isolation
    - Time-travel (point-in-time correctness)
    - Feature versioning
    - Training/inference parity
    - Full provenance
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize AML feature store.
        
        Args:
            tenant_id: Tenant ID for isolation
        """
        self.tenant_id = tenant_id
        self.feature_cache: Dict[str, AmlFeatureVector] = {}
    
    def compute_features(
        self,
        account_id: str,
        customer_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> AmlFeatureVector:
        """
        Compute feature vector from events.
        
        Args:
            account_id: Account ID
            customer_id: Customer ID
            as_of_date: Point-in-time date
            events: List of events up to as_of_date
        
        Returns:
            Complete feature vector
        """
        # Filter events up to as_of_date
        relevant_events = [
            e for e in events
            if datetime.fromisoformat(e.occurred_at) <= as_of_date
        ]
        
        # Compute each feature group
        structural_behaviour = self._compute_structural_behaviour_features(
            account_id, as_of_date, relevant_events
        )
        velocity_threshold = self._compute_velocity_threshold_features(
            account_id, as_of_date, relevant_events
        )
        geographic_risk = self._compute_geographic_risk_features(
            account_id, as_of_date, relevant_events
        )
        network_propagation = self._compute_network_propagation_features(
            account_id, as_of_date, relevant_events
        )
        customer_profile_drift = self._compute_customer_profile_drift_features(
            account_id, as_of_date, relevant_events
        )
        
        return AmlFeatureVector(
            account_id=account_id,
            tenant_id=self.tenant_id,
            customer_id=customer_id,
            as_of_date=as_of_date.isoformat(),
            structural_behaviour=structural_behaviour,
            velocity_threshold=velocity_threshold,
            geographic_risk=geographic_risk,
            network_propagation=network_propagation,
            customer_profile_drift=customer_profile_drift,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_structural_behaviour_features(
        self,
        account_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> StructuralBehaviourFeatures:
        """Compute structural behaviour features from events."""
        # TODO: Implement actual computation from events
        return StructuralBehaviourFeatures(
            account_id=account_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            unique_counterparties_30d=15,
            unique_counterparties_90d=42,
            in_out_flow_ratio=0.95,
            account_hop_depth=2,
            round_trip_frequency=0.10,
            near_threshold_tx_count=3,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_velocity_threshold_features(
        self,
        account_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> VelocityThresholdFeatures:
        """Compute velocity and threshold features from events."""
        # TODO: Implement actual computation from events
        return VelocityThresholdFeatures(
            account_id=account_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            tx_count_1d=5,
            tx_count_7d=28,
            tx_count_30d=95,
            value_accumulation_rate=2500.0,
            value_accumulation_spike=False,
            threshold_hover_score=0.15,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_geographic_risk_features(
        self,
        account_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> GeographicRiskFeatures:
        """Compute geographic risk features from events."""
        # TODO: Implement actual computation from events
        return GeographicRiskFeatures(
            account_id=account_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            jurisdiction_risk_drift=0.05,
            high_risk_jurisdiction_count=0,
            cross_border_ratio=0.02,
            cross_border_velocity=2,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_network_propagation_features(
        self,
        account_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> NetworkPropagationFeatures:
        """Compute network propagation features from events."""
        # TODO: Implement actual computation from events
        return NetworkPropagationFeatures(
            account_id=account_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            shared_counterparty_degree=3,
            mule_hop_chain_length=0,
            known_high_risk_linkage=False,
            cluster_membership=None,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_customer_profile_drift_features(
        self,
        account_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> CustomerProfileDriftFeatures:
        """Compute customer profile drift features from events."""
        # TODO: Implement actual computation from events
        return CustomerProfileDriftFeatures(
            account_id=account_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            income_spend_divergence=0.10,
            merchant_category_shift=0.05,
            new_merchant_category_flag=False,
            channel_entropy=0.65,
            channel_shift_score=0.02,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
