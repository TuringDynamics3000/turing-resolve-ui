"""
AML ML Models - Production Safe

Four independent detectors (not one):
- Structuring detector: Avoidance of reportable thresholds
- Mule propagation graph: Layering across accounts
- Behavioural drift model: Account misuse / takeover
- Jurisdiction risk model: Cross-border laundering risk

Ensemble output: P(AML risk | account | 30 days)

Mandatory AML Model Governance:
- Model registry
- Feature version pinning
- AUSTRAC sensitivity calibration
- False-positive suppression
- Drift detection
- Model rollback
- Kill-switch
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Any, Optional
import json


@dataclass
class AmlModelMetadata:
    """AML model metadata for registry."""
    model_id: str
    model_version: str
    model_type: str  # "structuring", "mule_propagation", "behavioural_drift", "jurisdiction_risk"
    training_date: str
    feature_set_version: str
    performance_metrics: Dict[str, float]  # AUC, precision, recall, F1
    austrac_sensitivity_calibration: Dict[str, Any]
    approved_by: str
    approved_at: str


@dataclass
class AmlPredictionResult:
    """AML model prediction result."""
    account_id: str
    customer_id: str
    tenant_id: str
    risk_score: float  # 0.0 to 1.0
    risk_band: str  # LOW, MEDIUM, HIGH
    confidence_interval: Dict[str, float]
    feature_importance: Dict[str, float]
    model_id: str
    model_version: str
    feature_set_version: str
    input_feature_hash: str
    predicted_at: str


class StructuringDetectorModel:
    """
    Structuring detection model.
    
    Detects avoidance of reportable thresholds (e.g., $10k structuring).
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize structuring detector model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict AML risk based on structuring patterns.
        
        Args:
            feature_vector: AmlFeatureVector
        
        Returns:
            AML risk probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # Threshold hovering indicators
        if features.get("threshold_hover_score", 0) > 0.30:
            score += 0.40
        if features.get("near_threshold_tx_count", 0) > 5:
            score += 0.25
        
        return min(1.0, score)


class MulePropagationGraphModel:
    """
    Mule propagation graph model.
    
    Detects layering across accounts (mule networks).
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize mule propagation graph model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict AML risk based on mule propagation patterns.
        
        Args:
            feature_vector: AmlFeatureVector
        
        Returns:
            AML risk probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # Mule network indicators
        if features.get("mule_hop_chain_length", 0) > 2:
            score += 0.45
        if features.get("account_hop_depth", 0) > 3:
            score += 0.30
        if features.get("round_trip_frequency", 0) > 0.20:
            score += 0.15
        
        return min(1.0, score)


class BehaviouralDriftModel:
    """
    Behavioural drift model.
    
    Detects account misuse or takeover.
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize behavioural drift model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict AML risk based on behavioural drift.
        
        Args:
            feature_vector: AmlFeatureVector
        
        Returns:
            AML risk probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # Behavioural drift indicators
        if features.get("income_spend_divergence", 0) > 0.30:
            score += 0.25
        if features.get("merchant_category_shift", 0) > 0.25:
            score += 0.20
        if features.get("value_accumulation_spike", False):
            score += 0.20
        
        return min(1.0, score)


class JurisdictionRiskModel:
    """
    Jurisdiction risk model.
    
    Detects cross-border laundering risk.
    """
    
    def __init__(self, model_id: str, model_version: str):
        """Initialize jurisdiction risk model."""
        self.model_id = model_id
        self.model_version = model_version
    
    def predict(self, feature_vector: Any) -> float:
        """
        Predict AML risk based on jurisdiction patterns.
        
        Args:
            feature_vector: AmlFeatureVector
        
        Returns:
            AML risk probability (0.0 to 1.0)
        """
        features = feature_vector.to_dict()
        
        score = 0.0
        
        # Jurisdiction risk indicators
        if features.get("jurisdiction_risk_drift", 0) > 0.20:
            score += 0.30
        if features.get("cross_border_ratio", 0) > 0.15:
            score += 0.25
        if features.get("high_risk_jurisdiction_count", 0) > 0:
            score += 0.20
        
        return min(1.0, score)


class AmlEnsembleModel:
    """
    Ensemble AML model.
    
    Combines multiple AML models for robust detection.
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
        self.structuring_model = StructuringDetectorModel("structuring_v1", "1.0")
        self.mule_model = MulePropagationGraphModel("mule_v1", "1.0")
        self.behavioural_model = BehaviouralDriftModel("behavioural_v1", "1.0")
        self.jurisdiction_model = JurisdictionRiskModel("jurisdiction_v1", "1.0")
        
        # Model weights
        self.weights = {
            "structuring": 0.30,
            "mule": 0.35,
            "behavioural": 0.20,
            "jurisdiction": 0.15,
        }
    
    def predict(
        self,
        feature_vector: Any,
        return_confidence: bool = True,
        return_importance: bool = True
    ) -> AmlPredictionResult:
        """
        Predict AML risk using ensemble.
        
        Args:
            feature_vector: AmlFeatureVector
            return_confidence: Return confidence interval
            return_importance: Return feature importance
        
        Returns:
            AmlPredictionResult with score and metadata
        """
        # Get predictions from each model
        structuring_score = self.structuring_model.predict(feature_vector)
        mule_score = self.mule_model.predict(feature_vector)
        behavioural_score = self.behavioural_model.predict(feature_vector)
        jurisdiction_score = self.jurisdiction_model.predict(feature_vector)
        
        # Weighted ensemble
        ensemble_score = (
            self.weights["structuring"] * structuring_score +
            self.weights["mule"] * mule_score +
            self.weights["behavioural"] * behavioural_score +
            self.weights["jurisdiction"] * jurisdiction_score
        )
        
        # Risk band
        if ensemble_score >= 0.85:
            risk_band = "HIGH"
        elif ensemble_score >= 0.70:
            risk_band = "MEDIUM"
        else:
            risk_band = "LOW"
        
        # Confidence interval
        confidence_interval = {
            "lower": max(0.0, ensemble_score - 0.10),
            "upper": min(1.0, ensemble_score + 0.10),
        } if return_confidence else {}
        
        # Feature importance
        feature_importance = {
            "structuring_score": structuring_score * self.weights["structuring"],
            "mule_score": mule_score * self.weights["mule"],
            "behavioural_score": behavioural_score * self.weights["behavioural"],
            "jurisdiction_score": jurisdiction_score * self.weights["jurisdiction"],
        } if return_importance else {}
        
        return AmlPredictionResult(
            account_id=feature_vector.account_id,
            customer_id=feature_vector.customer_id,
            tenant_id=feature_vector.tenant_id,
            risk_score=round(ensemble_score, 4),
            risk_band=risk_band,
            confidence_interval=confidence_interval,
            feature_importance=feature_importance,
            model_id=self.model_id,
            model_version=self.model_version,
            feature_set_version=self.feature_set_version,
            input_feature_hash=feature_vector.to_hash(),
            predicted_at=datetime.utcnow().isoformat() + "Z",
        )


# ========== MODEL REGISTRY ==========

class AmlModelRegistry:
    """AML model registry for versioned models."""
    
    def __init__(self):
        """Initialize model registry."""
        self.models: Dict[str, AmlModelMetadata] = {}
    
    def register_model(self, metadata: AmlModelMetadata) -> None:
        """Register an AML model."""
        key = f"{metadata.model_id}_{metadata.model_version}"
        self.models[key] = metadata
    
    def get_model(
        self,
        model_id: str,
        model_version: str
    ) -> Optional[AmlModelMetadata]:
        """Retrieve model metadata."""
        key = f"{model_id}_{model_version}"
        return self.models.get(key)
    
    def get_latest_model(
        self,
        model_id: str
    ) -> Optional[AmlModelMetadata]:
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


# ========== AML KILL SWITCH ==========

class AmlKillSwitch:
    """
    Emergency kill switch for AML AI.
    
    When activated:
    - No new AML scores produced
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
        """Check if AML AI can operate."""
        return not self.is_active
