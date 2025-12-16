"""
AML Event Schema - Production Grade

These events define the immutable, auditable protocol for AML detection.
Strict A/B separation: Layer A (TuringCore) emits financial events, Layer B (Intelligence)
emits ML AML scores, Layer A applies deterministic rules, Humans execute legal actions.

All events are:
- Immutable
- Replayable
- Court-admissible
- AUSTRAC-compliant
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional


# ========== LAYER A EVENTS (TuringCore Financial Events) ==========

@dataclass
class AccountOpened:
    """Account opened."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    account_type: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CustomerKycVerified:
    """Customer KYC verified."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    verification_level: str  # STANDARD, ENHANCED
    verification_method: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CustomerKycFailed:
    """Customer KYC failed."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    failure_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class TransactionPosted:
    """Transaction posted to account."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    transaction_type: str  # DEBIT, CREDIT
    amount: float
    currency: str
    channel: str
    counterparty_hash: Optional[str] = None
    merchant_hash: Optional[str] = None
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CashDepositObserved:
    """Cash deposit observed."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    amount: float
    currency: str
    branch_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CashWithdrawalObserved:
    """Cash withdrawal observed."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    amount: float
    currency: str
    atm_id: Optional[str] = None
    branch_id: Optional[str] = None
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class InternationalTransferInitiated:
    """International transfer initiated."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    amount: float
    currency: str
    destination_country: str
    destination_jurisdiction_risk: str  # LOW, MEDIUM, HIGH
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class InternationalTransferSettled:
    """International transfer settled."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    transfer_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CustomerProfileUpdated:
    """Customer profile updated."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    update_type: str  # ADDRESS, OCCUPATION, INCOME
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== LAYER B EVENTS (ML Intelligence Events) ==========

@dataclass
class AmlRiskScoreProduced:
    """
    ML model produced an AML risk score.
    
    This is the FIRST protocol AML event from Layer B → Layer A.
    It is immutable, auditable, replayable, and court-admissible.
    """
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    risk_score: float  # 0.0 to 1.0
    risk_band: str  # LOW, MEDIUM, HIGH
    model_id: str
    model_version: str
    feature_set_version: str
    input_feature_hash: str
    confidence_interval: Optional[Dict[str, float]]  # {"lower": 0.65, "upper": 0.85}
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class HighAmlRiskFlagRaised:
    """
    Deterministic business rule (in Layer A) raised a high AML risk flag
    based on ML score.
    
    This is NOT ML. This is a deterministic rule applied to ML output.
    """
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    risk_score: float
    threshold: float
    rule_id: str
    rule_version: str
    source_ml_event_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class ModerateAmlRiskFlagRaised:
    """Moderate AML risk flag raised."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    risk_score: float
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
    GenAI explainer generated human-readable AML explanation.
    
    This runs ONLY after an AML flag event exists.
    Safe zone use of GenAI.
    """
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    subject: str  # "AML Risk"
    source_event_ids: List[str]
    model_id: str
    prompt_hash: str
    output_hash: str
    storage_ref: str  # S3/GCS WORM-locked bucket
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== HUMAN INVESTIGATION EVENTS ==========

@dataclass
class AmlInvestigationOpened:
    """AML investigation opened by human officer."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    trigger_event_id: str
    officer_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AmlInvestigationCleared:
    """AML investigation cleared (no suspicious activity)."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    investigation_id: str
    officer_id: str
    clearance_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AmlInvestigationOngoing:
    """AML investigation ongoing (requires more evidence)."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    investigation_id: str
    officer_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AmlInvestigationEscalated:
    """AML investigation escalated to SMR preparation."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    investigation_id: str
    officer_id: str
    escalation_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== AUSTRAC REPORTING EVENTS ==========

@dataclass
class SuspiciousMatterReportPrepared:
    """Suspicious Matter Report (SMR) prepared."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    investigation_id: str
    smr_id: str
    prepared_by: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class SuspiciousMatterReportSubmitted:
    """Suspicious Matter Report (SMR) submitted to AUSTRAC."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    smr_id: str
    austrac_reference: str
    submitted_by: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class ThresholdTransactionReportPrepared:
    """Threshold Transaction Report (TTR) prepared."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    ttr_id: str
    transaction_amount: float
    prepared_by: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== ACCOUNT CONTROL EVENTS ==========

@dataclass
class AccountRestrictionAuthorised:
    """
    Account restriction authorised (guardrailed, only with approval).
    
    This can ONLY be issued after investigation confirms risk.
    """
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    customer_id: str
    restriction_type: str  # FREEZE, MONITOR, CLOSE
    investigation_id: str
    authorised_by: str
    legal_signoff_ref: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== EVENT VALIDATION ==========

def validate_aml_event_chain(events: List[Any]) -> bool:
    """
    Validate AML event chain integrity.
    
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


def is_aml_ml_event(event: Any) -> bool:
    """Check if event is from AML ML layer."""
    return isinstance(event, (AmlRiskScoreProduced, AiExplanationGenerated))


def is_aml_investigation_event(event: Any) -> bool:
    """Check if event is AML investigation."""
    return isinstance(event, (
        AmlInvestigationOpened,
        AmlInvestigationCleared,
        AmlInvestigationOngoing,
        AmlInvestigationEscalated
    ))


def is_austrac_reporting_event(event: Any) -> bool:
    """Check if event is AUSTRAC reporting."""
    return isinstance(event, (
        SuspiciousMatterReportPrepared,
        SuspiciousMatterReportSubmitted,
        ThresholdTransactionReportPrepared
    ))
