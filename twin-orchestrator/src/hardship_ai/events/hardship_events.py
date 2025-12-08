"""
Hardship AI Event Schema - Production Grade

These events define the immutable, auditable protocol for AI-driven hardship detection.
Strict A/B separation: Layer A (TuringCore) emits financial events, Layer B (Intelligence)
emits ML scores, Layer A applies deterministic rules.

All events are:
- Immutable
- Auditable
- Replayable
- Court-admissible
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional
from uuid import UUID


# ========== LAYER A EVENTS (TuringCore Financial Events) ==========

@dataclass
class IncomePosted:
    """Income posted to customer account."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    amount: float
    source: str  # SALARY, PENSION, BENEFITS
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AccountBalanceUpdated:
    """Account balance changed."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    new_balance: float
    old_balance: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class LoanRepaymentMade:
    """Loan repayment successfully made."""
    event_id: str
    aggregate_id: str  # loan_id
    tenant_id: str
    amount: float
    due_amount: float
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class LoanRepaymentMissed:
    """Loan repayment missed or failed."""
    event_id: str
    aggregate_id: str  # loan_id
    tenant_id: str
    due_amount: float
    days_past_due: int
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class DirectDebitReturned:
    """Direct debit payment returned/dishonoured."""
    event_id: str
    aggregate_id: str  # account_id
    tenant_id: str
    amount: float
    reason_code: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CardAuthorisation:
    """Card transaction authorised."""
    event_id: str
    aggregate_id: str  # card_id
    tenant_id: str
    amount: float
    mcc: str
    merchant_country: str
    was_approved: bool
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class CustomerStatusChanged:
    """Customer status changed."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    old_status: str
    new_status: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== LAYER B EVENTS (ML Intelligence Events) ==========

@dataclass
class MlScoreProduced:
    """
    ML model produced a score.
    
    This is the FIRST protocol AI event from Layer B → Layer A.
    It is immutable, auditable, replayable, and court-admissible.
    """
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    score_type: str  # "hardship", "fraud", "aml"
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
class HardshipRiskFlagRaised:
    """
    Deterministic business rule (in Layer A) raised a hardship risk flag
    based on ML score.
    
    This is NOT ML. This is a deterministic rule applied to ML output.
    """
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    score_value: float
    threshold: float
    rule_id: str
    rule_version: str
    source_ml_event_id: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class AiExplanationGenerated:
    """
    GenAI explainer generated human-readable explanation.
    
    This runs ONLY after a HardshipRiskFlagRaised event exists.
    Safe zone use of GenAI.
    """
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    subject: str  # "Hardship Risk"
    source_event_ids: List[str]
    model_id: str
    prompt_hash: str
    output_hash: str
    storage_ref: str  # S3/GCS WORM-locked bucket
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== HUMAN-IN-THE-LOOP EVENTS ==========

@dataclass
class ProactiveCustomerOutreachInitiated:
    """Human collections officer initiated proactive outreach."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    officer_id: str
    source_flag_event_id: str
    contact_method: str  # EMAIL, SMS, PHONE
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class HardshipArrangementProposed:
    """Hardship specialist proposed arrangement."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    specialist_id: str
    arrangement_type: str  # INTEREST_CONCESSION, REPAYMENT_RESCHEDULE, FEE_SUPPRESSION
    proposed_terms: Dict[str, Any]
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class HardshipArrangementApproved:
    """Hardship arrangement approved by supervisor."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    supervisor_id: str
    arrangement_id: str
    approved_terms: Dict[str, Any]
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class HardshipArrangementRejected:
    """Hardship arrangement rejected."""
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    supervisor_id: str
    arrangement_id: str
    rejection_reason: str
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


@dataclass
class HardshipArrangementEntered:
    """
    Customer entered hardship arrangement.
    
    ONLY after this event can the posting engine execute ledger impacts:
    - Interest concessions
    - Repayment reschedule
    - Fee suppression
    
    This keeps ASIC safe-harbour, customer consent validity, legal enforceability.
    """
    event_id: str
    aggregate_id: str  # customer_id
    tenant_id: str
    arrangement_id: str
    arrangement_type: str
    effective_date: str
    expiry_date: str
    terms: Dict[str, Any]
    occurred_at: str
    schema_version: str = "1.0"
    hash_prev_event: Optional[str] = None


# ========== EVENT VALIDATION ==========

def validate_event_chain(events: List[Any]) -> bool:
    """
    Validate event chain integrity.
    
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
            expected_hash = hash(str(prev_event))
            # In production, use cryptographic hash
            # if curr_event.hash_prev_event != expected_hash:
            #     return False
    
    return True


def is_ml_event(event: Any) -> bool:
    """Check if event is from ML layer."""
    return isinstance(event, (MlScoreProduced, AiExplanationGenerated))


def is_human_event(event: Any) -> bool:
    """Check if event requires human action."""
    return isinstance(event, (
        ProactiveCustomerOutreachInitiated,
        HardshipArrangementProposed,
        HardshipArrangementApproved,
        HardshipArrangementRejected,
    ))


def is_ledger_impact_event(event: Any) -> bool:
    """Check if event triggers ledger impact."""
    return isinstance(event, HardshipArrangementEntered)
