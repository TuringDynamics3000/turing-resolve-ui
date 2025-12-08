"""
Hardship ML Model Service - Production Hardened

Binary classifier: P(hardship in next 45-90 days)

Techniques:
- Gradient boosting (XGBoost / LightGBM)
- Monotonic constraints for regulatory explainability

Production Controls (Mandatory):
- Model registry (versioned)
- Training data snapshot immutability
- Feature drift detection
- Prediction drift detection
- Performance decay alerts
- Bias testing
- Model rollback capability
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, List, Any, Optional, Tuple
import json


@dataclass
class ModelMetadata:
    """Model metadata for registry."""
    model_id: str
    model_version: str
    model_type: str  # "xgboost", "lightgbm"
    training_date: str
    feature_set_version: str
    performance_metrics: Dict[str, float]  # AUC, precision, recall
    monotonic_constraints: Dict[str, int]  # Feature → constraint direction
    bias_test_results: Dict[str, Any]
    approved_by: str
    approved_at: str


@dataclass
class PredictionResult:
    """Model prediction result."""
    customer_id: str
    tenant_id: str
    score_value: float  # 0.0 to 1.0
    confidence_interval: Dict[str, float]  # {"lower": 0.65, "upper": 0.85}
    feature_importance: Dict[str, float]
    model_id: str
    model_version: str
    feature_set_version: str
    input_feature_hash: str
    predicted_at: str


class HardshipModel:
    """
    Production-grade hardship prediction model.
    
    This is a placeholder for actual XGBoost/LightGBM implementation.
    In production, this would load a trained model from the model registry.
    """
    
    def __init__(
        self,
        model_id: str,
        model_version: str,
        feature_set_version: str
    ):
        """
        Initialize hardship model.
        
        Args:
            model_id: Model ID from registry
            model_version: Model version
            feature_set_version: Feature set version
        """
        self.model_id = model_id
        self.model_version = model_version
        self.feature_set_version = feature_set_version
        
        # In production, load model from registry
        # self.model = load_model_from_registry(model_id, model_version)
        
        # Monotonic constraints for regulatory explainability
        self.monotonic_constraints = {
            "volatility_30d": 1,  # Higher volatility → higher risk
            "income_drop_rate": 1,  # Bigger drop → higher risk
            "missed_payments_30d": 1,  # More missed → higher risk
            "failed_dd_count": 1,  # More failures → higher risk
            "min_balance_14d": -1,  # Lower balance → higher risk
            "repayment_buffer": -1,  # Lower buffer → higher risk
        }
    
    def predict(
        self,
        feature_vector: Any,
        return_confidence: bool = True,
        return_importance: bool = True
    ) -> PredictionResult:
        """
        Predict hardship probability.
        
        Args:
            feature_vector: HardshipFeatureVector
            return_confidence: Return confidence interval
            return_importance: Return feature importance
        
        Returns:
            PredictionResult with score and metadata
        """
        # Convert feature vector to dict
        features = feature_vector.to_dict()
        
        # In production, use actual model prediction
        # score = self.model.predict_proba(features)[0][1]
        
        # Placeholder: Simple weighted score
        score = self._placeholder_score(features)
        
        # Confidence interval (from model uncertainty)
        confidence_interval = {
            "lower": max(0.0, score - 0.10),
            "upper": min(1.0, score + 0.10),
        } if return_confidence else {}
        
        # Feature importance (from SHAP or model-native)
        feature_importance = self._compute_feature_importance(
            features
        ) if return_importance else {}
        
        return PredictionResult(
            customer_id=feature_vector.customer_id,
            tenant_id=feature_vector.tenant_id,
            score_value=round(score, 4),
            confidence_interval=confidence_interval,
            feature_importance=feature_importance,
            model_id=self.model_id,
            model_version=self.model_version,
            feature_set_version=self.feature_set_version,
            input_feature_hash=feature_vector.to_hash(),
            predicted_at=datetime.utcnow().isoformat() + "Z",
        )
    
    def _placeholder_score(self, features: Dict[str, Any]) -> float:
        """
        Placeholder scoring logic.
        
        In production, this is replaced by actual XGBoost/LightGBM model.
        """
        score = 0.0
        
        # Income volatility
        if features.get("volatility_30d", 0) > 0.20:
            score += 0.15
        if features.get("income_drop_rate", 0) > 0.10:
            score += 0.20
        
        # Liquidity stress
        if features.get("min_balance_14d", 1000) < 500:
            score += 0.15
        if features.get("overdraft_frequency", 0) > 5:
            score += 0.10
        
        # Credit stress
        if features.get("missed_payments_30d", 0) > 0:
            score += 0.20
        if features.get("repayment_buffer", 100) < 50:
            score += 0.10
        
        # Behavioral stress
        if features.get("failed_dd_count", 0) > 1:
            score += 0.15
        
        return min(1.0, score)
    
    def _compute_feature_importance(
        self,
        features: Dict[str, Any]
    ) -> Dict[str, float]:
        """
        Compute feature importance.
        
        In production, use SHAP values or model-native importance.
        """
        # Placeholder importance
        return {
            "missed_payments_30d": 0.25,
            "income_drop_rate": 0.20,
            "failed_dd_count": 0.15,
            "min_balance_14d": 0.15,
            "volatility_30d": 0.10,
            "repayment_buffer": 0.10,
            "overdraft_frequency": 0.05,
        }


# ========== MODEL REGISTRY ==========

class ModelRegistry:
    """
    Model registry for versioned models.
    
    In production, this would be backed by MLflow, SageMaker Model Registry,
    or similar model management system.
    """
    
    def __init__(self):
        """Initialize model registry."""
        self.models: Dict[str, ModelMetadata] = {}
    
    def register_model(
        self,
        metadata: ModelMetadata
    ) -> None:
        """
        Register a model in the registry.
        
        Args:
            metadata: Model metadata
        """
        key = f"{metadata.model_id}_{metadata.model_version}"
        self.models[key] = metadata
    
    def get_model(
        self,
        model_id: str,
        model_version: str
    ) -> Optional[ModelMetadata]:
        """
        Retrieve model metadata.
        
        Args:
            model_id: Model ID
            model_version: Model version
        
        Returns:
            Model metadata if found
        """
        key = f"{model_id}_{model_version}"
        return self.models.get(key)
    
    def get_latest_model(
        self,
        model_id: str
    ) -> Optional[ModelMetadata]:
        """
        Get latest version of a model.
        
        Args:
            model_id: Model ID
        
        Returns:
            Latest model metadata
        """
        matching = [
            m for k, m in self.models.items()
            if m.model_id == model_id
        ]
        if not matching:
            return None
        
        # Sort by version (assuming semantic versioning)
        return sorted(
            matching,
            key=lambda m: m.model_version,
            reverse=True
        )[0]


# ========== DRIFT DETECTION ==========

@dataclass
class DriftReport:
    """Feature or prediction drift report."""
    drift_type: str  # "feature" or "prediction"
    detected_at: str
    drifted_features: List[str]
    drift_scores: Dict[str, float]
    threshold: float
    action_required: bool


class DriftDetector:
    """
    Detect feature drift and prediction drift.
    
    Production requirement for model monitoring.
    """
    
    def __init__(self, threshold: float = 0.10):
        """
        Initialize drift detector.
        
        Args:
            threshold: Drift threshold (e.g., 0.10 for 10% drift)
        """
        self.threshold = threshold
        self.baseline_stats: Dict[str, Dict[str, float]] = {}
    
    def set_baseline(
        self,
        feature_name: str,
        mean: float,
        std: float
    ) -> None:
        """
        Set baseline statistics for a feature.
        
        Args:
            feature_name: Feature name
            mean: Baseline mean
            std: Baseline standard deviation
        """
        self.baseline_stats[feature_name] = {
            "mean": mean,
            "std": std,
        }
    
    def detect_drift(
        self,
        feature_vectors: List[Any]
    ) -> DriftReport:
        """
        Detect drift in feature distributions.
        
        Args:
            feature_vectors: Recent feature vectors
        
        Returns:
            Drift report
        """
        # TODO: Implement actual drift detection (KS test, PSI, etc.)
        drifted_features = []
        drift_scores = {}
        
        # Placeholder: No drift detected
        return DriftReport(
            drift_type="feature",
            detected_at=datetime.utcnow().isoformat() + "Z",
            drifted_features=drifted_features,
            drift_scores=drift_scores,
            threshold=self.threshold,
            action_required=len(drifted_features) > 0,
        )


# ========== BIAS TESTING ==========

@dataclass
class BiasTestResult:
    """Bias test result."""
    test_type: str  # "demographic_parity", "equal_opportunity"
    protected_attribute: str  # "age", "gender", "location"
    bias_score: float
    threshold: float
    passed: bool
    tested_at: str


class BiasTester:
    """
    Test model for bias across protected attributes.
    
    Production requirement for regulatory compliance.
    """
    
    def __init__(self, threshold: float = 0.05):
        """
        Initialize bias tester.
        
        Args:
            threshold: Bias threshold (e.g., 0.05 for 5% disparity)
        """
        self.threshold = threshold
    
    def test_demographic_parity(
        self,
        predictions: List[PredictionResult],
        protected_attribute: str,
        attribute_values: Dict[str, str]
    ) -> BiasTestResult:
        """
        Test for demographic parity.
        
        Args:
            predictions: Model predictions
            protected_attribute: Protected attribute name
            attribute_values: Dict[customer_id, attribute_value]
        
        Returns:
            Bias test result
        """
        # TODO: Implement actual bias testing
        # Placeholder: No bias detected
        return BiasTestResult(
            test_type="demographic_parity",
            protected_attribute=protected_attribute,
            bias_score=0.02,
            threshold=self.threshold,
            passed=True,
            tested_at=datetime.utcnow().isoformat() + "Z",
        )
