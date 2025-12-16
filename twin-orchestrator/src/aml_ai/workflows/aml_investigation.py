"""
AML Investigation Workflow Orchestrator

Human Investigation Workflow (Mandatory):
- ML ends at risk score
- Human AML officers initiate investigations
- Possible outcomes: Cleared, Ongoing, Escalated
- Only if escalated: SMR prepared and submitted
- No AI auto-reporting

Guardrailed Account Control (Later, Only With Approval):
- Only after investigation confirms risk
- CU policy permits freeze
- Legal sign-off exists
- Then: AccountRestrictionAuthorised
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import List, Dict, Any, Optional
from enum import Enum


class AmlInvestigationStage(Enum):
    """AML investigation workflow stages."""
    ML_SCORED = "ml_scored"
    FLAG_RAISED = "flag_raised"
    INVESTIGATION_OPENED = "investigation_opened"
    INVESTIGATION_ONGOING = "investigation_ongoing"
    INVESTIGATION_CLEARED = "investigation_cleared"
    INVESTIGATION_ESCALATED = "investigation_escalated"
    SMR_PREPARED = "smr_prepared"
    SMR_SUBMITTED = "smr_submitted"
    ACCOUNT_RESTRICTED = "account_restricted"


@dataclass
class AmlInvestigation:
    """AML investigation case."""
    investigation_id: str
    account_id: str
    customer_id: str
    tenant_id: str
    
    # ML context
    aml_risk_score: float
    risk_band: str  # LOW, MEDIUM, HIGH
    ml_event_id: str
    feature_vector_hash: str
    model_version: str
    
    # Flag context
    flag_event_id: Optional[str] = None
    flag_type: Optional[str] = None  # HIGH, MODERATE
    flag_raised_at: Optional[str] = None
    
    # Investigation context
    trigger_event_id: Optional[str] = None
    assigned_officer_id: Optional[str] = None
    
    # Workflow state
    current_stage: AmlInvestigationStage = AmlInvestigationStage.ML_SCORED
    
    # Resolution
    resolution_event_id: Optional[str] = None
    resolution_type: Optional[str] = None  # CLEARED, ONGOING, ESCALATED
    
    # SMR context
    smr_id: Optional[str] = None
    smr_prepared_at: Optional[str] = None
    smr_submitted_at: Optional[str] = None
    austrac_reference: Optional[str] = None
    
    # Account restriction context
    restriction_event_id: Optional[str] = None
    restriction_type: Optional[str] = None  # FREEZE, MONITOR, CLOSE
    legal_signoff_ref: Optional[str] = None
    
    # Timestamps
    created_at: str = ""
    updated_at: str = ""


@dataclass
class AmlAction:
    """Human action in AML workflow."""
    action_id: str
    investigation_id: str
    actor_id: str
    actor_role: str  # AML_OFFICER, SUPERVISOR, LEGAL
    action_type: str  # OPEN, CLEAR, ESCALATE, PREPARE_SMR, SUBMIT_SMR, RESTRICT
    action_data: Dict[str, Any]
    performed_at: str


class AmlInvestigationOrchestrator:
    """
    Orchestrates AML investigation workflow.
    
    Ensures:
    - All ML flags go to human review
    - No automated SMR filing
    - No automated account restrictions
    - Full audit trail
    """
    
    def __init__(self, tenant_id: str):
        """
        Initialize orchestrator.
        
        Args:
            tenant_id: Tenant ID
        """
        self.tenant_id = tenant_id
        self.investigations: Dict[str, AmlInvestigation] = {}
        self.actions: List[AmlAction] = []
    
    def create_investigation_from_score(
        self,
        aml_score_event: Any,
        feature_vector: Any
    ) -> AmlInvestigation:
        """
        Create AML investigation from ML score.
        
        Args:
            aml_score_event: AmlRiskScoreProduced event
            feature_vector: AmlFeatureVector
        
        Returns:
            New AML investigation
        """
        investigation = AmlInvestigation(
            investigation_id=f"AML_{aml_score_event.event_id}",
            account_id=aml_score_event.aggregate_id,
            customer_id=aml_score_event.customer_id,
            tenant_id=self.tenant_id,
            aml_risk_score=aml_score_event.risk_score,
            risk_band=aml_score_event.risk_band,
            ml_event_id=aml_score_event.event_id,
            feature_vector_hash=feature_vector.to_hash(),
            model_version=aml_score_event.model_version,
            created_at=datetime.utcnow().isoformat() + "Z",
            updated_at=datetime.utcnow().isoformat() + "Z",
        )
        
        self.investigations[investigation.investigation_id] = investigation
        return investigation
    
    def raise_flag(
        self,
        investigation_id: str,
        flag_event: Any,
        flag_type: str
    ) -> None:
        """
        Record AML flag raised.
        
        Args:
            investigation_id: Investigation ID
            flag_event: AmlRiskFlagRaised event
            flag_type: Flag type (HIGH, MODERATE)
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.flag_event_id = flag_event.event_id
        investigation.flag_type = flag_type
        investigation.flag_raised_at = flag_event.occurred_at
        investigation.current_stage = AmlInvestigationStage.FLAG_RAISED
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
    
    def open_investigation(
        self,
        investigation_id: str,
        trigger_event_id: str,
        officer_id: str
    ) -> None:
        """
        Open AML investigation.
        
        Args:
            investigation_id: Investigation ID
            trigger_event_id: Trigger event ID
            officer_id: AML officer ID
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.trigger_event_id = trigger_event_id
        investigation.assigned_officer_id = officer_id
        investigation.current_stage = AmlInvestigationStage.INVESTIGATION_OPENED
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(AmlAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            investigation_id=investigation_id,
            actor_id=officer_id,
            actor_role="AML_OFFICER",
            action_type="OPEN",
            action_data={},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def mark_ongoing(
        self,
        investigation_id: str,
        officer_id: str
    ) -> None:
        """
        Mark investigation as ongoing (requires more evidence).
        
        Args:
            investigation_id: Investigation ID
            officer_id: AML officer ID
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.current_stage = AmlInvestigationStage.INVESTIGATION_ONGOING
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(AmlAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            investigation_id=investigation_id,
            actor_id=officer_id,
            actor_role="AML_OFFICER",
            action_type="ONGOING",
            action_data={},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def clear_investigation(
        self,
        investigation_id: str,
        officer_id: str,
        clearance_event_id: str,
        clearance_reason: str
    ) -> None:
        """
        Clear investigation (no suspicious activity).
        
        Args:
            investigation_id: Investigation ID
            officer_id: AML officer ID
            clearance_event_id: Clearance event ID
            clearance_reason: Reason for clearance
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.resolution_event_id = clearance_event_id
        investigation.resolution_type = "CLEARED"
        investigation.current_stage = AmlInvestigationStage.INVESTIGATION_CLEARED
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(AmlAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            investigation_id=investigation_id,
            actor_id=officer_id,
            actor_role="AML_OFFICER",
            action_type="CLEAR",
            action_data={"clearance_reason": clearance_reason},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def escalate_investigation(
        self,
        investigation_id: str,
        officer_id: str,
        escalation_event_id: str,
        escalation_reason: str
    ) -> None:
        """
        Escalate investigation to SMR preparation.
        
        Args:
            investigation_id: Investigation ID
            officer_id: AML officer ID
            escalation_event_id: Escalation event ID
            escalation_reason: Reason for escalation
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.resolution_event_id = escalation_event_id
        investigation.resolution_type = "ESCALATED"
        investigation.current_stage = AmlInvestigationStage.INVESTIGATION_ESCALATED
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(AmlAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            investigation_id=investigation_id,
            actor_id=officer_id,
            actor_role="AML_OFFICER",
            action_type="ESCALATE",
            action_data={"escalation_reason": escalation_reason},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def prepare_smr(
        self,
        investigation_id: str,
        smr_id: str,
        prepared_by: str
    ) -> None:
        """
        Prepare Suspicious Matter Report (SMR).
        
        Args:
            investigation_id: Investigation ID
            smr_id: SMR ID
            prepared_by: Officer ID who prepared SMR
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.smr_id = smr_id
        investigation.smr_prepared_at = datetime.utcnow().isoformat() + "Z"
        investigation.current_stage = AmlInvestigationStage.SMR_PREPARED
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(AmlAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            investigation_id=investigation_id,
            actor_id=prepared_by,
            actor_role="AML_OFFICER",
            action_type="PREPARE_SMR",
            action_data={"smr_id": smr_id},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def submit_smr(
        self,
        investigation_id: str,
        austrac_reference: str,
        submitted_by: str
    ) -> None:
        """
        Submit Suspicious Matter Report (SMR) to AUSTRAC.
        
        Args:
            investigation_id: Investigation ID
            austrac_reference: AUSTRAC reference number
            submitted_by: Officer ID who submitted SMR
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.austrac_reference = austrac_reference
        investigation.smr_submitted_at = datetime.utcnow().isoformat() + "Z"
        investigation.current_stage = AmlInvestigationStage.SMR_SUBMITTED
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(AmlAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            investigation_id=investigation_id,
            actor_id=submitted_by,
            actor_role="AML_OFFICER",
            action_type="SUBMIT_SMR",
            action_data={"austrac_reference": austrac_reference},
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def restrict_account(
        self,
        investigation_id: str,
        restriction_event_id: str,
        restriction_type: str,
        legal_signoff_ref: str,
        authorised_by: str
    ) -> None:
        """
        Restrict account (guardrailed, only with approval).
        
        Args:
            investigation_id: Investigation ID
            restriction_event_id: Restriction event ID
            restriction_type: Restriction type (FREEZE, MONITOR, CLOSE)
            legal_signoff_ref: Legal sign-off reference
            authorised_by: Officer ID who authorised restriction
        """
        investigation = self.investigations.get(investigation_id)
        if not investigation:
            raise ValueError(f"Investigation {investigation_id} not found")
        
        investigation.restriction_event_id = restriction_event_id
        investigation.restriction_type = restriction_type
        investigation.legal_signoff_ref = legal_signoff_ref
        investigation.current_stage = AmlInvestigationStage.ACCOUNT_RESTRICTED
        investigation.updated_at = datetime.utcnow().isoformat() + "Z"
        
        # Record action
        self.actions.append(AmlAction(
            action_id=f"ACTION_{len(self.actions) + 1}",
            investigation_id=investigation_id,
            actor_id=authorised_by,
            actor_role="SUPERVISOR",
            action_type="RESTRICT",
            action_data={
                "restriction_type": restriction_type,
                "legal_signoff_ref": legal_signoff_ref,
            },
            performed_at=datetime.utcnow().isoformat() + "Z",
        ))
    
    def get_pending_investigations(
        self,
        officer_id: Optional[str] = None
    ) -> List[AmlInvestigation]:
        """
        Get pending investigations for review.
        
        Args:
            officer_id: Filter by assigned officer
        
        Returns:
            List of pending investigations
        """
        pending_stages = {
            AmlInvestigationStage.FLAG_RAISED,
            AmlInvestigationStage.INVESTIGATION_OPENED,
            AmlInvestigationStage.INVESTIGATION_ONGOING,
        }
        
        investigations = [
            i for i in self.investigations.values()
            if i.current_stage in pending_stages
        ]
        
        if officer_id:
            investigations = [i for i in investigations if i.assigned_officer_id == officer_id]
        
        return investigations
    
    def get_investigation_audit_trail(
        self,
        investigation_id: str
    ) -> List[AmlAction]:
        """
        Get complete audit trail for an investigation.
        
        Args:
            investigation_id: Investigation ID
        
        Returns:
            List of AML actions
        """
        return [
            a for a in self.actions
            if a.investigation_id == investigation_id
        ]
    
    def get_smr_submission_rate(self) -> float:
        """
        Get SMR submission rate.
        
        Returns:
            SMR submission rate (0.0 to 1.0)
        """
        resolved_investigations = [
            i for i in self.investigations.values()
            if i.resolution_type in ["CLEARED", "ESCALATED"]
        ]
        
        if not resolved_investigations:
            return 0.0
        
        escalated = sum(
            1 for i in resolved_investigations
            if i.resolution_type == "ESCALATED"
        )
        
        return escalated / len(resolved_investigations)
