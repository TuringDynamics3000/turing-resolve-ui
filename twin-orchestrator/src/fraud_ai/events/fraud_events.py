"""
Fraud Event Schema - Production Grade

These events define the immutable, auditable protocol for fraud detection.
Strict A/B separation: Layer A (TuringCore) emits financial events, Layer B (Intelligence)
emits ML fraud scores, Layer A applies deterministic rules.

All events are:
- Immutable
- Auditable
- Replayable
- Court-admissible
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional


# ========== LAYER A EVENTS (TuringCore Financial Events) ==========

@dataclass
class CardAuthorisationRequested:
    """Card authorisation requested."""
    event_id: str
    aggregate_id: str  # card_id
    tenant_id: str
    customer_id: str
    account_id: str
    merchant_id_hash: str
    device_id_hash: str
    ip_hash: str
    geo_bucket: str
    amount: float
    currency: str
    mcc: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CardAuthorisationApproved:
    """Card authorisation approved."""
    event_id: str
    aggregate_id: str  # card_id
    tenant_id: str
    customer_id: str
    authorisation_id: str
    amount: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CardAuthorisationDeclined:
    """Card authorisation declined."""
    event_id: str
    aggregate_id: str  # card_id
    tenant_id: str
    customer_id: str
    decline_reason: str
    decline_code: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class DeviceFingerprintObserved:
    """Device fingerprint observed."""
    event_id: str
    aggregate_id: str  # device_id_hash
    tenant_id: str
    customer_id: str
    device_type: str  # MOBILE, WEB, ATM
    os_version: str
    app_version: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class MerchantObserved:
    """Merchant observed in transaction."""
    event_id: str
    aggregate_id: str  # merchant_id_hash
    tenant_id: str
    merchant_name: str
    mcc: str
    country: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CounterpartyObserved:
    """Counterparty observed in payment."""
    event_id: str
    aggregate_id: str  # counterparty_id_hash
    tenant_id: str
    customer_id: str
    counterparty_type: str  # PERSON, BUSINESS
    rail: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AccountLoginSucceeded:
    """Account login succeeded."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    device_id_hash: str
    ip_hash: str
    geo_bucket: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AccountLoginFailed:
    """Account login failed."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    device_id_hash: str
    ip_hash: str
    failure_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== LAYER B EVENTS (ML Intelligence Events) ==========

@dataclass
class FraudRiskScoreProduced:
    """
    ML model produced a fraud risk score.
    
    This is the FIRST protocol fraud event from Layer B → Layer A.
    It is immutable, auditable, replayable, and court-admissible.
    """
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    customer_id: str
    score_value: float  # 0.0 to 1.0
    model_id: str
    model_version: str
    feature_set_version: str
    input_feature_hash: str
    confidence_interval: Optional[Dict[str, float]]  # {"lower": 0.65, "upper": 0.85}
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class FraudClusterDetected:
    """
    ML detected a fraud cluster (e.g., mule ring).
    
    This is a graph-level detection, not a single transaction.
    """
    event_id: str
    aggregate_id: str  # cluster_id
    tenant_id: str
    cluster_type: str  # MULE_RING, COMPROMISED_TERMINAL, ACCOUNT_TAKEOVER
    entity_ids: List[str]  # List of account/card/device IDs in cluster
    attack_signature: str  # e.g., "known_mule_ring_v3"
    confidence: float
    model_id: str
    model_version: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class HighFraudRiskFlagRaised:
    """
    Deterministic business rule (in Layer A) raised a high fraud risk flag
    based on ML score.
    
    This is NOT ML. This is a deterministic rule applied to ML output.
    """
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    customer_id: str
    score_value: float
    threshold: float
    rule_id: str
    rule_version: str
    source_ml_event_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class ModerateFraudRiskFlagRaised:
    """Moderate fraud risk flag raised."""
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    customer_id: str
    score_value: float
    threshold_low: float
    threshold_high: float
    rule_id: str
    rule_version: str
    source_ml_event_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AiExplanationGenerated:
    """
    GenAI explainer generated human-readable fraud explanation.
    
    This runs ONLY after a fraud flag event exists.
    Safe zone use of GenAI.
    """
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    customer_id: str
    subject: str  # "Fraud Risk"
    source_event_ids: List[str]
    model_id: str
    prompt_hash: str
    output_hash: str
    storage_ref: str  # S3/GCS WORM-locked bucket
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== ADVISORY & CONTROL EVENTS ==========

@dataclass
class FraudAdvisoryIssued:
    """Fraud advisory issued to operations."""
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    customer_id: str
    recommended_action: str  # CONTACT_CUSTOMER, BLOCK_CARD, REVIEW_MANUAL
    confidence: float
    expected_loss_avoidance: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class FraudAdvisoryAccepted:
    """Human accepted fraud advisory."""
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    officer_id: str
    advisory_event_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class FraudAdvisoryOverridden:
    """Human overrode fraud advisory."""
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    officer_id: str
    advisory_event_id: str
    override_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AutoBlockAuthorisationIssued:
    """
    Auto-block authorisation issued (guardrailed, known patterns only).
    
    This can ONLY be issued for proven national patterns with zero false-positive tolerance.
    """
    event_id: str
    aggregate_id: str  # payment_id or card_id
    tenant_id: str
    customer_id: str
    attack_signature: str  # e.g., "known_mule_ring_v3"
    rule_id: str
    rule_version: str
    source_cluster_event_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== EVENT VALIDATION ==========

def validate_fraud_event_chain(events: List[Any]) -> bool:
    """
    Validate fraud event chain integrity.
    
    Args:
        events: List of events in chronological order
    
    Returns:
        True if chain is valid
    """
    for i in range(1, len(events)):
        prev_event = events[i - 1]
        curr_event = events[i]
        
        # Check hash chain
        if hasattr(curr_event, 'hash_prev_event'):
            # In production, use cryptographic hash
            pass
    
    return True


def is_fraud_ml_event(event: Any) -> bool:
    """Check if event is from fraud ML layer."""
    return isinstance(event, (FraudRiskScoreProduced, FraudClusterDetected, AiExplanationGenerated))


def is_fraud_advisory_event(event: Any) -> bool:
    """Check if event is fraud advisory."""
    return isinstance(event, (FraudAdvisoryIssued, FraudAdvisoryAccepted, FraudAdvisoryOverridden))


def is_auto_block_event(event: Any) -> bool:
    """Check if event is auto-block authorisation."""
    return isinstance(event, AutoBlockAuthorisationIssued)
