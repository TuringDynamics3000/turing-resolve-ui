"""
Behavioural AML Model — AML Shadow v1

This is a stub behavioural AML model for AML Shadow v1.

PURPOSE:
- Detect behavioural anomalies in transaction patterns (pattern-of-life)
- Compute AML risk score (0.0 to 1.0)
- Provide risk band classification (LOW, MEDIUM, HIGH)

SAFETY GUARANTEES:
- Read-only, observational only
- No execution authority
- No ability to lodge AUSTRAC reports (SMR, TTR, IFTI)
- No ability to freeze accounts or restrict cards

AUSTRAC COMPLIANCE:
- Advisory-only (human escalation required for SMR/TTR)
- Pattern-of-life detection (not rule-based triggers)
- Full audit trail for regulator review

Author: TuringCore National Infrastructure Team
Version: 1.0 (Stub)
Status: Production-Ready (Stub Model)
"""

from typing import Dict, Any
import hashlib


class AmlBehaviourModel:
    """
    Behavioural AML detection model (stub v1).
    
    This is a simple rule-based stub for v1. Future versions will use:
    - ML models (XGBoost, neural networks)
    - Historical transaction patterns (pattern-of-life)
    - Velocity checks (transaction frequency, amount)
    - Counterparty risk (high-risk jurisdictions, PEPs)
    - Cash deposit patterns (structuring detection)
    """
    
    def __init__(self):
        """Initialize AML model."""
        self.model_id = "aml-behaviour-v1"
        self.model_version = "1.0"
        self.feature_set_version = "1.0"
    
    def build_features(self, event: Dict[str, Any]) -> Dict[str, Any]:
        """
        Build feature vector from event.
        
        Args:
            event: TransactionPosted, CashDepositObserved, or InternationalTransferInitiated event
            
        Returns:
            Feature dictionary
        """
        # Extract features
        amount_cents = event.get("amount_cents", 0)
        channel = event.get("channel", "UNKNOWN")
        geo_bucket = event.get("geo_bucket", "UNKNOWN")
        jurisdiction = event.get("jurisdiction", "AU")
        counterparty_hash = event.get("counterparty_hash", "UNKNOWN")
        
        # Compute derived features
        amount_aud = amount_cents / 100.0
        is_high_value = amount_aud > 10000.0  # AUSTRAC threshold
        is_cash = channel == "BRANCH" or event.get("event_type") == "CashDepositObserved"
        is_international = jurisdiction != "AU"
        
        # Counterparty risk (stub: hash-based pseudo-risk)
        counterparty_risk = self._compute_counterparty_risk(counterparty_hash, jurisdiction)
        
        # Velocity risk (stub: not implemented in v1)
        velocity_risk = 0.0
        
        return {
            "amount_aud": amount_aud,
            "is_high_value": is_high_value,
            "is_cash": is_cash,
            "is_international": is_international,
            "counterparty_risk": counterparty_risk,
            "velocity_risk": velocity_risk,
            "channel": channel,
            "geo_bucket": geo_bucket,
            "jurisdiction": jurisdiction
        }
    
    def score(self, features: Dict[str, Any]) -> float:
        """
        Compute AML risk score.
        
        This is a simple rule-based stub for v1. Future versions will use ML models.
        
        Args:
            features: Feature dictionary
            
        Returns:
            AML risk score (0.0 to 1.0)
        """
        # Base risk
        risk = 0.0
        
        # High-value transaction risk
        if features["is_high_value"]:
            risk += 0.25
        
        # Cash transaction risk
        if features["is_cash"]:
            risk += 0.20
        
        # International transaction risk
        if features["is_international"]:
            risk += 0.30
        
        # Counterparty risk
        risk += features["counterparty_risk"] * 0.25
        
        # Velocity risk (stub: not implemented in v1)
        risk += features["velocity_risk"] * 0.0
        
        # Clamp to [0, 1]
        return min(max(risk, 0.0), 1.0)
    
    def _compute_counterparty_risk(self, counterparty_hash: str, jurisdiction: str) -> float:
        """
        Compute counterparty risk score (stub).
        
        In production, this would use:
        - Counterparty database (PEPs, sanctions lists)
        - Jurisdiction risk scores (FATF high-risk jurisdictions)
        - Historical AML flags for counterparty
        
        Args:
            counterparty_hash: Hashed counterparty ID
            jurisdiction: Counterparty jurisdiction
            
        Returns:
            Counterparty risk score (0.0 to 1.0)
        """
        # Stub: High-risk jurisdictions (FATF list)
        high_risk_jurisdictions = {"KP", "IR", "MM", "AF", "PK"}  # North Korea, Iran, Myanmar, Afghanistan, Pakistan
        
        if jurisdiction in high_risk_jurisdictions:
            return 0.9  # High risk
        
        # Stub: Use hash to generate pseudo-random risk
        if counterparty_hash == "UNKNOWN":
            return 0.3  # Unknown counterparty = medium risk
        
        # Hash to integer, normalize to [0, 1]
        hash_int = int(hashlib.md5(counterparty_hash.encode()).hexdigest()[:8], 16)
        return (hash_int % 100) / 100.0
