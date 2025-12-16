"""
Human-in-the-Loop Workflow Orchestrator

This orchestrator ensures that all AI-flagged hardship risks go through
mandatory human review and approval before any ledger impact.

No AI auto-contacts customers. Ever.
No AI auto-modifies balances. Ever.

This keeps:
- ASIC safe-harbour
- Customer consent validity
- Legal enforceability
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional
from enum import Enum


class WorkflowStage(Enum):
    """Hardship workflow stages."""
    ML_SCORED = "ml_scored"
    FLAG_RAISED = "flag_raised"
    HUMAN_REVIEW_PENDING = "human_review_pending"
    OUTREACH_INITIATED = "outreach_initiated"
    ARRANGEMENT_PROPOSED = "arrangement_proposed"
    SUPERVISOR_REVIEW = "supervisor_review"
    APPROVED = "approved"
    REJECTED = "rejected"
    LEDGER_APPLIED = "ledger_applied"


@dataclass
class HardshipCase:
    """Hardship case for human review."""
    case_id: str
    customer_id: str
    tenant_id: str
    
    # ML context
    ml_score: float
    ml_event_id: str
    feature_vector_hash: str
    model_version: str
    
    # Flag context
    flag_event_id: str
    flag_threshold: float
    flag_raised_at: str
    
    # Workflow state
    current_stage: WorkflowStage
    assigned_to: Optional[str] = None
    
    # Human actions
    outreach_event_id: Optional[str] = None
    arrangement_event_id: Optional[str] = None
    approval_event_id: Optional[str] = None
    
    # Timestamps
    created_at: str = ""
    updated_at: str = ""


@dataclass
class HumanAction:
    """Human action in workflow."""
    action_id: str
    case_id: str
    actor_id: str
    actor_role: str  # COLLECTIONS_OFFICER, HARDSHIP_SPECIALIST, SUPERVISOR
    action_type: str  # REVIEW, OUTREACH, PROPOSE, APPROVE, REJECT
    action_data: Dict[str, Any]
    performed_at: str


class HumanInLoopOrchestrator:
    """
    Orchestrates human-in-the-loop workflow for hardship cases.
    
    Ensures:
    - All ML flags go to human review
    - No automated customer contact
    - No automated ledger impact
    - Full audit trail
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize orchestrator.
        
        Args:
            tenant_id: Tenant ID
        """
        self.tenant_id = tenant_id
        self.cases: Dict[str, HardshipCase] = {}
        self.actions: List[HumanAction] = []
    
    def create_case_from_flag(
        self,
        ml_score_event: Any,
        flag_event: Any,
        feature_vector: Any
    ) -> HardshipCase:
        """
        Create hardship case from ML flag.
        
        Args:
            ml_score_event: MlScoreProduced event
            flag_event: HardshipRiskFlagRaised event
            feature_vector: HardshipFeatureVector
        
        Returns:
            New hardship case
        """
        case = HardshipCase(
            case_id=f"CASE_{flag_event.event_id}",
            customer_id=flag_event.aggregate_id,
            tenant_id=self.tenant_id,
            ml_score=ml_score_event.score_value,
            ml_event_id=ml_score_event.event_id,
            feature_vector_hash=feature_vector.to_hash(),
            model_version=ml_score_event.model_version,
            flag_event_id=flag_event.event_id,
            flag_threshold=flag_event.threshold,
            flag_raised_at=flag_event.occurred_at,
            current_stage=WorkflowStage.FLAG_RAISED,
            created_at=datetime.utcnow().isoformat() + "Z",
            updated_at=datetime.utcnow().isoformat() + "Z",
        )
        
        self.cases[case.case_id] = case
        return case
    
    def assign_to_officer(
        self,
        case_id: str,
        officer_id: str
    ) -> None:
        """
        Assign case to collections officer.
        
        Args:
            case_id: Case ID
            officer_id: Officer ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.assigned_to = officer_id
        case.current_stage = WorkflowStage.HUMAN_REVIEW_PENDING
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(HumanAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=officer_id,
            actor_role="COLLECTIONS_OFFICER",
            action_type="ASSIGN",
            action_data={},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def initiate_outreach(
        self,
        case_id: str,
        officer_id: str,
        contact_method: str,
        outreach_event_id: str
    ) -> None:
        """
        Record human-initiated customer outreach.
        
        Args:
            case_id: Case ID
            officer_id: Officer ID
            contact_method: Contact method (EMAIL, SMS, PHONE)
            outreach_event_id: ProactiveCustomerOutreachInitiated event ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.outreach_event_id = outreach_event_id
        case.current_stage = WorkflowStage.OUTREACH_INITIATED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(HumanAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=officer_id,
            actor_role="COLLECTIONS_OFFICER",
            action_type="OUTREACH",
            action_data={"contact_method": contact_method},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def propose_arrangement(
        self,
        case_id: str,
        specialist_id: str,
        arrangement_type: str,
        proposed_terms: Dict[str, Any],
        arrangement_event_id: str
    ) -> None:
        """
        Record hardship arrangement proposal.
        
        Args:
            case_id: Case ID
            specialist_id: Hardship specialist ID
            arrangement_type: Arrangement type
            proposed_terms: Proposed terms
            arrangement_event_id: HardshipArrangementProposed event ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.arrangement_event_id = arrangement_event_id
        case.current_stage = WorkflowStage.ARRANGEMENT_PROPOSED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(HumanAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=specialist_id,
            actor_role="HARDSHIP_SPECIALIST",
            action_type="PROPOSE",
            action_data={
                "arrangement_type": arrangement_type,
                "proposed_terms": proposed_terms,
            },
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def approve_arrangement(
        self,
        case_id: str,
        supervisor_id: str,
        approval_event_id: str
    ) -> None:
        """
        Record supervisor approval of hardship arrangement.
        
        ONLY after this can ledger impact occur.
        
        Args:
            case_id: Case ID
            supervisor_id: Supervisor ID
            approval_event_id: HardshipArrangementApproved event ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.approval_event_id = approval_event_id
        case.current_stage = WorkflowStage.APPROVED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(HumanAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=supervisor_id,
            actor_role="SUPERVISOR",
            action_type="APPROVE",
            action_data={},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def reject_arrangement(
        self,
        case_id: str,
        supervisor_id: str,
        rejection_reason: str,
        rejection_event_id: str
    ) -> None:
        """
        Record supervisor rejection of hardship arrangement.
        
        Args:
            case_id: Case ID
            supervisor_id: Supervisor ID
            rejection_reason: Reason for rejection
            rejection_event_id: HardshipArrangementRejected event ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        case.current_stage = WorkflowStage.REJECTED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(HumanAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            case_id=case_id,
            actor_id=supervisor_id,
            actor_role="SUPERVISOR",
            action_type="REJECT",
            action_data={"rejection_reason": rejection_reason},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def mark_ledger_applied(
        self,
        case_id: str
    ) -> None:
        """
        Mark that ledger impact has been applied.
        
        This can ONLY happen after approval.
        
        Args:
            case_id: Case ID
        """
        case = self.cases.get(case_id)
        if not case:
            raise ValueError(f"Case {case_id} not found")
        
        if case.current_stage != WorkflowStage.APPROVED:
            raise ValueError(
                f"Cannot apply ledger for case {case_id} in stage {case.current_stage}"
            )
        
        case.current_stage = WorkflowStage.LEDGER_APPLIED
        case.updated_at = datetime.utcnow().isoformat() + "Z"
    
    def get_pending_cases(
        self,
        officer_id: Optional[str] = None
    ) -> List[HardshipCase]:
        """
        Get pending cases for review.
        
        Args:
            officer_id: Filter by assigned officer
        
        Returns:
            List of pending cases
        """
        pending_stages = {
            WorkflowStage.FLAG_RAISED,
            WorkflowStage.HUMAN_REVIEW_PENDING,
            WorkflowStage.OUTREACH_INITIATED,
            WorkflowStage.ARRANGEMENT_PROPOSED,
        }
        
        cases = [
            c for c in self.cases.values()
            if c.current_stage in pending_stages
        ]
        
        if officer_id:
            cases = [c for c in cases if c.assigned_to == officer_id]
        
        return cases
    
    def get_case_audit_trail(
        self,
        case_id: str
    ) -> List[HumanAction]:
        """
        Get complete audit trail for a case.
        
        Args:
            case_id: Case ID
        
        Returns:
            List of human actions
        """
        return [
            a for a in self.actions
            if a.case_id == case_id
        ]


# ========== KILL SWITCH ==========

class AIKillSwitch:
    """
    Emergency kill switch for all AI operations.
    
    When activated:
    - No new ML scores produced
    - No new flags raised
    - Existing cases continue with human-only workflow
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
        """
        Activate kill switch.
        
        Args:
            activated_by: User ID who activated
            reason: Reason for activation
        """
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
        """
        Check if AI operations are allowed.
        
        Returns:
            True if AI can operate, False if kill switch active
        """
        return not self.is_active
