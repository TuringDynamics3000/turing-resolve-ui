"""
Behavioural Fraud Model — Fraud Shadow v1

This is a stub behavioural fraud model for Fraud Shadow v1.

PURPOSE:
- Detect behavioural anomalies in card transactions
- Compute fraud risk score (0.0 to 1.0)
- Provide risk band classification (LOW, MEDIUM, HIGH)

SAFETY GUARANTEES:
- Read-only, observational only
- No execution authority
- No ability to block cards, freeze accounts, or decline transactions

Author: TuringCore National Infrastructure Team
Version: 1.0 (Stub)
Status: Production-Ready (Stub Model)
"""

from typing import Dict, Any
import hashlib


class FraudBehaviourModel:
    """
    Behavioural fraud detection model (stub v1).
    
    This is a simple rule-based stub for v1. Future versions will use:
    - ML models (XGBoost, neural networks)
    - Historical transaction patterns
    - Device fingerprinting
    - Velocity checks
    - Geo-location analysis
    """
    
    def __init__(self):
        """Initialize fraud model."""
        self.model_id = "fraud-behaviour-v1"
        self.model_version = "1.0"
        self.feature_set_version = "1.0"
    
    def build_features(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build feature vector from event.
        
        Args:
            event: CardAuthorisationRequested or similar event
            
        Returns:
            Feature dictionary
        """
        # Extract features
        amount_cents = event.get("amount_cents", 0)
        channel = event.get("channel", "UNKNOWN")
        geo_bucket = event.get("geo_bucket", "UNKNOWN")
        device_id_hash = event.get("device_id_hash", "UNKNOWN")
        merchant_id_hash = event.get("merchant_id_hash", "UNKNOWN")
        
        # Compute derived features
        amount_aud = amount_cents / 100.0
        is_high_value = amount_aud > 1000.0
        is_ecomm = channel == "ECOMM"
        is_international = not geo_bucket.startswith("AU-")
        
        # Device risk (stub: hash-based pseudo-risk)
        device_risk = self._compute_device_risk(device_id_hash)
        
        # Merchant risk (stub: hash-based pseudo-risk)
        merchant_risk = self._compute_merchant_risk(merchant_id_hash)
        
        return {
            "amount_aud": amount_aud,
            "is_high_value": is_high_value,
            "is_ecomm": is_ecomm,
            "is_international": is_international,
            "device_risk": device_risk,
            "merchant_risk": merchant_risk,
            "channel": channel,
            "geo_bucket": geo_bucket
        }
    
    def score(self, features: Dict[str, Any]) -> float:
        """
        Compute fraud risk score.
        
        This is a simple rule-based stub for v1. Future versions will use ML models.
        
        Args:
            features: Feature dictionary
            
        Returns:
            Fraud risk score (0.0 to 1.0)
        """
        # Base risk
        risk = 0.0
        
        # High-value transaction risk
        if features["is_high_value"]:
            risk += 0.2
        
        # E-commerce risk
        if features["is_ecomm"]:
            risk += 0.15
        
        # International transaction risk
        if features["is_international"]:
            risk += 0.25
        
        # Device risk
        risk += features["device_risk"] * 0.2
        
        # Merchant risk
        risk += features["merchant_risk"] * 0.2
        
        # Clamp to [0, 1]
        return min(max(risk, 0.0), 1.0)
    
    def _compute_device_risk(self, device_id_hash: str) -> float:
        """
        Compute device risk score (stub).
        
        In production, this would use:
        - Device fingerprint database
        - Historical fraud rates by device
        - Device reputation scores
        
        Args:
            device_id_hash: Hashed device ID
            
        Returns:
            Device risk score (0.0 to 1.0)
        """
        # Stub: Use hash to generate pseudo-random risk
        if device_id_hash == "UNKNOWN":
            return 0.5  # Unknown device = medium risk
        
        # Hash to integer, normalize to [0, 1]
        hash_int = int(hashlib.md5(device_id_hash.encode()).hexdigest()[:8], 16)
        return (hash_int % 100) / 100.0
    
    def _compute_merchant_risk(self, merchant_id_hash: str) -> float:
        """
        Compute merchant risk score (stub).
        
        In production, this would use:
        - Merchant fraud history
        - Merchant category code (MCC) risk
        - Merchant reputation scores
        
        Args:
            merchant_id_hash: Hashed merchant ID
            
        Returns:
            Merchant risk score (0.0 to 1.0)
        """
        # Stub: Use hash to generate pseudo-random risk
        if merchant_id_hash == "UNKNOWN":
            return 0.3  # Unknown merchant = low-medium risk
        
        # Hash to integer, normalize to [0, 1]
        hash_int = int(hashlib.md5(merchant_id_hash.encode()).hexdigest()[:8], 16)
        return (hash_int % 100) / 100.0
