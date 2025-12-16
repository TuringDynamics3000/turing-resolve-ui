"""
Fraud Advisory Workflow Orchestrator

Advisory Mode (Human in Control):
- Ops receives FraudAdvisoryIssued
- Humans choose: FraudAdvisoryAccepted OR FraudAdvisoryOverridden
- Logged as Protocol events

Guardrailed Auto-Block (Later, Known Patterns Only):
- Only when pattern is proven nationally
- Zero false-positive tolerance
- Board + APRA approved
- CU policy allows
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional
from enum import Enum


class FraudCaseStage(Enum):
    """Fraud case workflow stages."""
    ML_SCORED = "ml_scored"
    FLAG_RAISED = "flag_raised"
    ADVISORY_ISSUED = "advisory_issued"
    HUMAN_REVIEW_PENDING = "human_review_pending"
    ADVISORY_ACCEPTED = "advisory_accepted"
    ADVISORY_OVERRIDDEN = "advisory_overridden"
    AUTO_BLOCK_ISSUED = "auto_block_issued"
    RESOLVED = "resolved"


@dataclass
class FraudCase:
    """Fraud case for human review."""
    case_id: str
    entity_id: str  # card_id or account_id
    tenant_id: str
    customer_id: str
    
    # ML context
    fraud_score: float
    ml_event_id: str
    feature_vector_hash: str
    model_version: str
    
    # Flag context
    flag_event_id: Optional[str] = None
    flag_type: Optional[str] = None  # HIGH, MODERATE
    flag_raised_at: Optional[str] = None
    
    # Advisory context
    advisory_event_id: Optional[str] = None
    recommended_action: Optional[str] = None  # CONTACT_CUSTOMER, BLOCK_CARD, REVIEW_MANUAL
    expected_loss_avoidance: Optional[float] = None
    
    # Workflow state
    current_stage: FraudCaseStage = FraudCaseStage.ML_SCORED
    assigned_to: Optional[str] = None
    
    # Resolution
    resolution_event_id: Optional[str] = None
    resolution_type: Optional[str] = None  # ACCEPTED, OVERRIDDEN, AUTO_BLOCKED
    
    # Timestamps
    created_at: str = ""
    updated_at: str = ""


@dataclass
class FraudAction:
    """Human action in fraud workflow."""
    action_id: str
    case_id: str
    actor_id: str
    actor_role: str  # FRAUD_ANALYST, SUPERVISOR
    action_type: str  # REVIEW, ACCEPT, OVERRIDE, BLOCK
    action_data: Dict[str, Any]
    performed_at: str


class FraudAdvisoryOrchestrator:
    """
    Orchestrates fraud advisory workflow.
    
    Ensures:
    - All ML flags go to human review (in advisory mode)
    - No automated blocks without proven patterns
    - Full audit trail
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize orchestrator.
        
        Args:
            tenant_id: Tenant ID
        """
        self.tenant_id = tenant_id
        self.cases: Dict[str, FraudCase] = {}
        self.actions: List[FraudAction] = []
    
    def create_case_from_score(
        self,
        fraud_score_event: Any,
        feature_vector: Any
    ) -> FraudCase:
        """
        Create fraud case from ML score.
        
        Args:
            fraud_score_event: FraudRiskScoreProduced event
            feature_vector: FraudFeatureVector
        
        Returns:
            New fraud case
        """
        case = FraudCase(
            case_id=f"FRAUD_{fraud_score_event.event_id}",
            entity_id=fraud_score_event.aggregate_id,
            tenant_id=self.tenant_id,
            customer_id=fraud_score_event.customer_id,
            fraud_score=fraud_score_event.score_value,
            ml_event_id=fraud_score_event.event_id,
            feature_vector_hash=feature_vector.to_hash(),
            model_version=fraud_score_event.model_version,
            created_at=datetime.utcnow().isoformat() + "Z",
            updated_at=datetime.utcnow().isoformat() + "Z",
        )
        
        self.cases[case.case_id] = case
        return case
    
    def raise_flag(
        self,
        case_id: str,
        flag_event: Any,
        flag_type: str
    ) -> None:
        """
        Record fraud flag raised.
        
        Args:
            case_id: Case ID
            flag_event: FraudRiskFlagRaised event
            flag_type: Flag type (HIGH, MODERATE)
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.flag_event_id = flag_event.event_id
        case.flag_type = flag_type
        case.flag_raised_at = flag_event.occurred_at
        case.current_stage = FraudCaseStage.FLAG_RAISED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
    
    def issue_advisory(
        self,
        case_id: str,
        advisory_event_id: str,
        recommended_action: str,
        expected_loss_avoidance: float
    ) -> None:
        """
        Issue fraud advisory to operations.
        
        Args:
            case_id: Case ID
            advisory_event_id: FraudAdvisoryIssued event ID
            recommended_action: Recommended action
            expected_loss_avoidance: Expected loss avoidance
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.advisory_event_id = advisory_event_id
        case.recommended_action = recommended_action
        case.expected_loss_avoidance = expected_loss_avoidance
        case.current_stage = FraudCaseStage.ADVISORY_ISSUED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
    
    def assign_to_analyst(
        self,
        case_id: str,
        analyst_id: str
    ) -> None:
        """
        Assign case to fraud analyst.
        
        Args:
            case_id: Case ID
            analyst_id: Analyst ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.assigned_to = analyst_id
        case.current_stage = FraudCaseStage.HUMAN_REVIEW_PENDING
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(FraudAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=analyst_id,
            actor_role="FRAUD_ANALYST",
            action_type="ASSIGN",
            action_data={},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def accept_advisory(
        self,
        case_id: str,
        officer_id: str,
        acceptance_event_id: str
    ) -> None:
        """
        Record human acceptance of fraud advisory.
        
        Args:
            case_id: Case ID
            officer_id: Officer ID
            acceptance_event_id: FraudAdvisoryAccepted event ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.resolution_event_id = acceptance_event_id
        case.resolution_type = "ACCEPTED"
        case.current_stage = FraudCaseStage.ADVISORY_ACCEPTED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(FraudAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=officer_id,
            actor_role="FRAUD_ANALYST",
            action_type="ACCEPT",
            action_data={},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def override_advisory(
        self,
        case_id: str,
        officer_id: str,
        override_event_id: str,
        override_reason: str
    ) -> None:
        """
        Record human override of fraud advisory.
        
        Args:
            case_id: Case ID
            officer_id: Officer ID
            override_event_id: FraudAdvisoryOverridden event ID
            override_reason: Reason for override
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.resolution_event_id = override_event_id
        case.resolution_type = "OVERRIDDEN"
        case.current_stage = FraudCaseStage.ADVISORY_OVERRIDDEN
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(FraudAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=officer_id,
            actor_role="FRAUD_ANALYST",
            action_type="OVERRIDE",
            action_data={"override_reason": override_reason},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def issue_auto_block(
        self,
        case_id: str,
        auto_block_event_id: str
    ) -> None:
        """
        Record auto-block issuance (guardrailed, known patterns only).
        
        This can ONLY be issued for proven national patterns.
        
        Args:
            case_id: Case ID
            auto_block_event_id: AutoBlockAuthorisationIssued event ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.resolution_event_id = auto_block_event_id
        case.resolution_type = "AUTO_BLOCKED"
        case.current_stage = FraudCaseStage.AUTO_BLOCK_ISSUED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
    
    def get_pending_cases(
        self,
        analyst_id: Optional[str] = None
    ) -> List[FraudCase]:
        """
        Get pending cases for review.
        
        Args:
            analyst_id: Filter by assigned analyst
        
        Returns:
            List of pending cases
        """
        pending_stages = {
            FraudCaseStage.FLAG_RAISED,
            FraudCaseStage.ADVISORY_ISSUED,
            FraudCaseStage.HUMAN_REVIEW_PENDING,
        }
        
        cases = [
            c for c in self.cases.values()
            if c.current_stage in pending_stages
        ]
        
        if analyst_id:
            cases = [c for c in cases if c.assigned_to == analyst_id]
        
        return cases
    
    def get_case_audit_trail(
        self,
        case_id: str
    ) -> List[FraudAction]:
        """
        Get complete audit trail for a case.
        
        Args:
            case_id: Case ID
        
        Returns:
            List of fraud actions
        """
        return [
            a for a in self.actions
            if a.case_id == case_id
        ]
    
    def get_acceptance_rate(self) -> float:
        """
        Get advisory acceptance rate.
        
        Returns:
            Acceptance rate (0.0 to 1.0)
        """
        resolved_cases = [
            c for c in self.cases.values()
            if c.resolution_type in ["ACCEPTED", "OVERRIDDEN"]
        ]
        
        if not resolved_cases:
            return 0.0
        
        accepted = sum(
            1 for c in resolved_cases
            if c.resolution_type == "ACCEPTED"
        )
        
        return accepted / len(resolved_cases)
