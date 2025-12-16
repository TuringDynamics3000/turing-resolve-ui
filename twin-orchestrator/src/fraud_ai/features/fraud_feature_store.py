"""
Fraud Feature Store

Derived from:
- Graph topology
- Event velocity
- Behavioural drift

Feature Groups:
- Velocity: tx_count_1m, tx_count_5m, geo_jump_rate
- Graph Risk: shared_device_count, shared_merchant_count, counterparty_reuse_score, mule_cluster_degree
- Behavioural Drift: merchant_category_drift, time_of_day_drift, amount_zscore
- Governance: previous_fraud_flags, manual_review_rate

All features are:
- Versioned
- Drift-monitored
- Tenant-scoped views
- Immutable at inference time
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import json


# ========== FEATURE GROUPS ==========

@dataclass
class VelocityFeatures:
    """Transaction velocity features."""
    entity_id: str  # card_id or account_id
    tenant_id: str
    as_of_date: str
    
    # Velocity
    tx_count_1m: int
    tx_count_5m: int
    tx_count_1h: int
    tx_count_24h: int
    
    # Geo
    geo_jump_rate: float  # Impossible travel rate
    unique_geo_buckets_24h: int
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class GraphRiskFeatures:
    """Graph-based risk features."""
    entity_id: str  # card_id or account_id
    tenant_id: str
    as_of_date: str
    
    # Device/Merchant sharing
    shared_device_count: int  # How many devices this card has used
    shared_merchant_count: int  # How many merchants this card has used
    device_reuse_score: float  # How many other cards share this device
    merchant_reuse_score: float  # How many other cards share this merchant
    
    # Counterparty
    counterparty_reuse_score: float  # How many times same counterparty
    mule_cluster_degree: int  # How many counterparties this account pays
    
    # Network
    network_centrality: float  # Graph centrality score
    cluster_membership: Optional[str]  # Cluster ID if in fraud cluster
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class BehaviouralDriftFeatures:
    """Behavioural drift features."""
    entity_id: str  # card_id or account_id
    tenant_id: str
    as_of_date: str
    
    # Merchant category drift
    merchant_category_drift: float  # Deviation from normal MCC distribution
    new_merchant_category_flag: bool  # First time in this MCC
    
    # Temporal drift
    time_of_day_drift: float  # Deviation from normal transaction times
    day_of_week_drift: float  # Deviation from normal transaction days
    
    # Amount drift
    amount_zscore: float  # Z-score of transaction amount
    amount_percentile: float  # Percentile of transaction amount
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class GovernanceFeatures:
    """Governance and history features."""
    entity_id: str  # card_id or account_id
    tenant_id: str
    as_of_date: str
    
    # Fraud history
    previous_fraud_flags: int
    previous_fraud_confirmed: int
    previous_fraud_false_positive: int
    
    # Review history
    manual_review_rate: float  # % of transactions manually reviewed
    last_review_date: Optional[str]
    
    # Account status
    account_age_days: int
    card_age_days: int
    
    feature_version: str = "1.0"
    computed_at: str = ""


@dataclass
class FraudFeatureVector:
    """Complete feature vector for fraud detection."""
    entity_id: str  # card_id or account_id
    tenant_id: str
    as_of_date: str
    
    velocity: VelocityFeatures
    graph_risk: GraphRiskFeatures
    behavioural_drift: BehaviouralDriftFeatures
    governance: GovernanceFeatures
    
    feature_set_version: str = "1.0"
    computed_at: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to flat dict for ML model."""
        return {
            "entity_id": self.entity_id,
            "tenant_id": self.tenant_id,
            "as_of_date": self.as_of_date,
            
            # Velocity
            "tx_count_1m": self.velocity.tx_count_1m,
            "tx_count_5m": self.velocity.tx_count_5m,
            "geo_jump_rate": self.velocity.geo_jump_rate,
            
            # Graph Risk
            "shared_device_count": self.graph_risk.shared_device_count,
            "shared_merchant_count": self.graph_risk.shared_merchant_count,
            "mule_cluster_degree": self.graph_risk.mule_cluster_degree,
            
            # Behavioural Drift
            "merchant_category_drift": self.behavioural_drift.merchant_category_drift,
            "time_of_day_drift": self.behavioural_drift.time_of_day_drift,
            "amount_zscore": self.behavioural_drift.amount_zscore,
            
            # Governance
            "previous_fraud_flags": self.governance.previous_fraud_flags,
            "manual_review_rate": self.governance.manual_review_rate,
        }
    
    def to_hash(self) -> str:
        """Generate hash for provenance."""
        import hashlib
        content = json.dumps(self.to_dict(), sort_keys=True)
        return hashlib.sha256(content.encode()).hexdigest()


# ========== FEATURE COMPUTATION ENGINE ==========

class FraudFeatureStore:
    """
    Fraud feature store.
    
    Supports:
    - Tenant isolation
    - Time-travel (point-in-time correctness)
    - Feature versioning
    - Training/inference parity
    - Full provenance
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize fraud feature store.
        
        Args:
            tenant_id: Tenant ID for isolation
        """
        self.tenant_id = tenant_id
        self.feature_cache: Dict[str, FraudFeatureVector] = {}
    
    def compute_features(
        self,
        entity_id: str,
        as_of_date: datetime,
        events: List[Any],
        graph: Any  # NationalFraudGraph
    ) -> FraudFeatureVector:
        """
        Compute feature vector from events and graph.
        
        Args:
            entity_id: Card ID or account ID
            as_of_date: Point-in-time date
            events: List of events up to as_of_date
            graph: National fraud graph
        
        Returns:
            Complete feature vector
        """
        # Filter events up to as_of_date
        relevant_events = [
            e for e in events
            if datetime.fromisoformat(e.occurred_at) <= as_of_date
        ]
        
        # Compute each feature group
        velocity_features = self._compute_velocity_features(
            entity_id, as_of_date, relevant_events
        )
        graph_risk_features = self._compute_graph_risk_features(
            entity_id, as_of_date, graph
        )
        behavioural_drift_features = self._compute_behavioural_drift_features(
            entity_id, as_of_date, relevant_events
        )
        governance_features = self._compute_governance_features(
            entity_id, as_of_date, relevant_events
        )
        
        return FraudFeatureVector(
            entity_id=entity_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            velocity=velocity_features,
            graph_risk=graph_risk_features,
            behavioural_drift=behavioural_drift_features,
            governance=governance_features,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_velocity_features(
        self,
        entity_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> VelocityFeatures:
        """Compute velocity features from events."""
        # TODO: Implement actual computation from events
        return VelocityFeatures(
            entity_id=entity_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            tx_count_1m=2,
            tx_count_5m=5,
            tx_count_1h=12,
            tx_count_24h=45,
            geo_jump_rate=0.0,
            unique_geo_buckets_24h=2,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_graph_risk_features(
        self,
        entity_id: str,
        as_of_date: datetime,
        graph: Any
    ) -> GraphRiskFeatures:
        """Compute graph risk features from fraud graph."""
        # Use graph methods to compute features
        shared_device_count = graph.compute_shared_device_count(entity_id) if hasattr(graph, 'compute_shared_device_count') else 0
        shared_merchant_count = graph.compute_shared_merchant_count(entity_id) if hasattr(graph, 'compute_shared_merchant_count') else 0
        mule_cluster_degree = graph.compute_mule_cluster_degree(entity_id) if hasattr(graph, 'compute_mule_cluster_degree') else 0
        
        return GraphRiskFeatures(
            entity_id=entity_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            shared_device_count=shared_device_count,
            shared_merchant_count=shared_merchant_count,
            device_reuse_score=0.15,
            merchant_reuse_score=0.05,
            counterparty_reuse_score=0.20,
            mule_cluster_degree=mule_cluster_degree,
            network_centrality=0.35,
            cluster_membership=None,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_behavioural_drift_features(
        self,
        entity_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> BehaviouralDriftFeatures:
        """Compute behavioural drift features from events."""
        # TODO: Implement actual computation from events
        return BehaviouralDriftFeatures(
            entity_id=entity_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            merchant_category_drift=0.25,
            new_merchant_category_flag=False,
            time_of_day_drift=0.10,
            day_of_week_drift=0.05,
            amount_zscore=1.5,
            amount_percentile=0.85,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _compute_governance_features(
        self,
        entity_id: str,
        as_of_date: datetime,
        events: List[Any]
    ) -> GovernanceFeatures:
        """Compute governance features from events."""
        # TODO: Implement actual computation from events
        return GovernanceFeatures(
            entity_id=entity_id,
            tenant_id=self.tenant_id,
            as_of_date=as_of_date.isoformat(),
            previous_fraud_flags=0,
            previous_fraud_confirmed=0,
            previous_fraud_false_positive=0,
            manual_review_rate=0.05,
            last_review_date=None,
            account_age_days=365,
            card_age_days=180,
            computed_at=datetime.utcnow().isoformat() + "Z",
        )
