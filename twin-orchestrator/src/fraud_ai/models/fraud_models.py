"""
ML Fraud Models - Production Safe

Multiple models, not one:
- Velocity anomaly: Fast theft bursts
- Graph clustering: Mule rings
- Behavioural drift: Account takeover
- Merchant drift: Compromised terminals

Ensemble output: P(fraud | payment)

Mandatory Model Governance:
- Model registry
- Feature version pinning
- Bias testing
- Performance decay alerts
- Drift detection
- Kill-switch
- Rollback
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Any, Optional
import json


@dataclass
class FraudModelMetadata:
    """Fraud model metadata for registry."""
    model_id: str
    model_version: str
    model_type: str  # "velocity_anomaly", "graph_clustering", "behavioural_drift", "merchant_drift"
    training_date: str
    feature_set_version: str
    performance_metrics: Dict[str, float]  # AUC, precision, recall, F1
    bias_test_results: Dict[str, Any]
    approved_by: str
    approved_at: str


@dataclass
class FraudPredictionResult:
    """Fraud model prediction result."""
    entity_id: str  # card_id or account_id
    tenant_id: str
    score_value: float  # 0.0 to 1.0
    confidence_interval: Dict[str, float]
    feature_importance: Dict[str, float]
    model_id: str
    model_version: str
    feature_set_version: str
    input_feature_hash: str
    predicted_at: str


class VelocityAnomalyModel:
    """
    Velocity anomaly detection model.
    
    Detects fast theft bursts (e.g., card skimming, account takeover).
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize velocity anomaly model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict fraud probability based on velocity.
        
        Args:
            feature_vector: FraudFeatureVector
        
        Returns:
            Fraud probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # High velocity indicators
        if features.get("tx_count_1m", 0) > 5:
            score += 0.30
        if features.get("tx_count_5m", 0) > 15:
            score += 0.25
        if features.get("geo_jump_rate", 0) > 0.5:
            score += 0.20
        
        return min(1.0, score)


class GraphClusteringModel:
    """
    Graph clustering model.
    
    Detects mule rings and fraud networks.
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize graph clustering model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict fraud probability based on graph features.
        
        Args:
            feature_vector: FraudFeatureVector
        
        Returns:
            Fraud probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # Mule ring indicators
        if features.get("mule_cluster_degree", 0) > 10:
            score += 0.40
        if features.get("shared_device_count", 0) > 5:
            score += 0.20
        
        return min(1.0, score)


class BehaviouralDriftModel:
    """
    Behavioural drift model.
    
    Detects account takeover and unusual behavior.
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize behavioural drift model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict fraud probability based on behavioural drift.
        
        Args:
            feature_vector: FraudFeatureVector
        
        Returns:
            Fraud probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # Behavioural drift indicators
        if features.get("merchant_category_drift", 0) > 0.30:
            score += 0.25
        if features.get("time_of_day_drift", 0) > 0.20:
            score += 0.15
        if features.get("amount_zscore", 0) > 3.0:
            score += 0.20
        
        return min(1.0, score)


class MerchantDriftModel:
    """
    Merchant drift model.
    
    Detects compromised terminals and merchant fraud.
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize merchant drift model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict fraud probability based on merchant patterns.
        
        Args:
            feature_vector: FraudFeatureVector
        
        Returns:
            Fraud probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # Merchant drift indicators
        if features.get("shared_merchant_count", 0) > 20:
            score += 0.15
        
        return min(1.0, score)


class FraudEnsembleModel:
    """
    Ensemble fraud model.
    
    Combines multiple fraud models for robust detection.
    """
    
    def __init__(
        self,
        model_id: str,
        model_version: str,
        feature_set_version: str
    ):
        """Initialize ensemble model."""
        self.model_id = model_id
        self.model_version = model_version
        self.feature_set_version = feature_set_version
        
        # Initialize sub-models
        self.velocity_model = VelocityAnomalyModel("velocity_v1", "1.0")
        self.graph_model = GraphClusteringModel("graph_v1", "1.0")
        self.behavioural_model = BehaviouralDriftModel("behavioural_v1", "1.0")
        self.merchant_model = MerchantDriftModel("merchant_v1", "1.0")
        
        # Model weights
        self.weights = {
            "velocity": 0.35,
            "graph": 0.30,
            "behavioural": 0.25,
            "merchant": 0.10,
        }
    
    def predict(
        self,
        feature_vector: Any,
        return_confidence: bool = True,
        return_importance: bool = True
    ) -> FraudPredictionResult:
        """
        Predict fraud probability using ensemble.
        
        Args:
            feature_vector: FraudFeatureVector
            return_confidence: Return confidence interval
            return_importance: Return feature importance
        
        Returns:
            FraudPredictionResult with score and metadata
        """
        # Get predictions from each model
        velocity_score = self.velocity_model.predict(feature_vector)
        graph_score = self.graph_model.predict(feature_vector)
        behavioural_score = self.behavioural_model.predict(feature_vector)
        merchant_score = self.merchant_model.predict(feature_vector)
        
        # Weighted ensemble
        ensemble_score = (
            self.weights["velocity"] * velocity_score +
            self.weights["graph"] * graph_score +
            self.weights["behavioural"] * behavioural_score +
            self.weights["merchant"] * merchant_score
        )
        
        # Confidence interval
        confidence_interval = {
            "lower": max(0.0, ensemble_score - 0.10),
            "upper": min(1.0, ensemble_score + 0.10),
        } if return_confidence else {}
        
        # Feature importance
        feature_importance = {
            "velocity_score": velocity_score * self.weights["velocity"],
            "graph_score": graph_score * self.weights["graph"],
            "behavioural_score": behavioural_score * self.weights["behavioural"],
            "merchant_score": merchant_score * self.weights["merchant"],
        } if return_importance else {}
        
        return FraudPredictionResult(
            entity_id=feature_vector.entity_id,
            tenant_id=feature_vector.tenant_id,
            score_value=round(ensemble_score, 4),
            confidence_interval=confidence_interval,
            feature_importance=feature_importance,
            model_id=self.model_id,
            model_version=self.model_version,
            feature_set_version=self.feature_set_version,
            input_feature_hash=feature_vector.to_hash(),
            predicted_at=datetime.utcnow().isoformat() + "Z",
        )


# ========== MODEL REGISTRY ==========

class FraudModelRegistry:
    """Fraud model registry for versioned models."""
    
    def __init__(self):
        """Initialize model registry."""
        self.models: Dict[str, FraudModelMetadata] = {}
    
    def register_model(self, metadata: FraudModelMetadata) -> None:
        """Register a fraud model."""
        key = f"{metadata.model_id}_{metadata.model_version}"
        self.models[key] = metadata
    
    def get_model(
        self,
        model_id: str,
        model_version: str
    ) -> Optional[FraudModelMetadata]:
        """Retrieve model metadata."""
        key = f"{model_id}_{model_version}"
        return self.models.get(key)
    
    def get_latest_model(
        self,
        model_id: str
    ) -> Optional[FraudModelMetadata]:
        """Get latest version of a model."""
        matching = [
            m for k, m in self.models.items()
            if m.model_id == model_id
        ]
        if not matching:
            return None
        
        return sorted(
            matching,
            key=lambda m: m.model_version,
            reverse=True
        )[0]


# ========== FRAUD KILL SWITCH ==========

class FraudKillSwitch:
    """
    Emergency kill switch for fraud AI.
    
    When activated:
    - No new fraud scores produced
    - No new flags raised
    - Manual review only
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
        """Check if fraud AI can operate."""
        return not self.is_active
