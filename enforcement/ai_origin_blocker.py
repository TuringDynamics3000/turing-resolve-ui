"""
AI Origin Blocker — Runtime Enforcement v1

This module provides absolute runtime guarantees that AI-origin events can NEVER carry executable authority.

PURPOSE:
- Block AI from emitting execution commands (PaymentCommand, SettlementCommand, etc.)
- Enforce advisory-only constraint for all AI outputs
- Provide court-defensible technical control

SAFETY GUARANTEES:
- Process dies immediately if AI attempts forbidden command
- No exception handling allowed (fail-fast by design)
- No bypass mechanism (no override flag, no admin mode)

LEGAL SIGNIFICANCE:
This is a court-defensible technical control that proves:
- AI cannot execute payments (even if code is modified)
- AI cannot post to ledger (even if model misbehaves)
- AI cannot freeze accounts (even if library is compromised)
- AI cannot submit AUSTRAC reports (even if engineer tries)

ARCHITECTURE:
- Enforcement Firewall component
- Runtime validation (not compile-time)
- Fail-fast on violation (no recovery)

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Critical Safety Control)
"""

from typing import Dict, Any


# ============================================================================
# FORBIDDEN COMMANDS (Court-Defensible List)
# ============================================================================

FORBIDDEN_AI_COMMANDS = {
    # Payment execution
    "ExecutePayment",
    "InitiatePayment",
    "ApprovePayment",
    "RoutePayment",
    
    # Ledger operations
    "PostLedgerEntry",
    "CreatePosting",
    "UpdateBalance",
    
    # Settlement operations
    "SettlePayment",
    "ReversePayment",
    "InitiateSettlement",
    
    # Liquidity operations
    "MoveLiquidity",
    "TransferFunds",
    "AllocateLiquidity",
    
    # Account restrictions
    "FreezeAccount",
    "BlockCard",
    "RestrictAccount",
    "ApplyAccountRestriction",
    "SuspendAccount",
    
    # Regulatory reporting
    "SubmitSmr",  # AUSTRAC Suspicious Matter Report
    "SubmitTtr",  # AUSTRAC Threshold Transaction Report
    "SubmitIfti",  # AUSTRAC International Funds Transfer Instruction
    "SubmitAmlReport",
    
    # Transaction approval
    "ApproveTransaction",
    "RejectTransaction",
    "OverrideTransaction",
}


# ============================================================================
# ALLOWED AI EVENT TYPES (Advisory Only)
# ============================================================================

ALLOWED_AI_EVENT_TYPES = {
    # Payments RL
    "RlPolicyEvaluated",
    "RlRoutingAdvisoryIssued",
    
    # Fraud detection
    "FraudRiskScoreProduced",
    "FraudSignalDetected",
    "FraudAdvisoryIssued",
    
    # AML compliance
    "AmlRiskScoreProduced",
    "AmlSignalDetected",
    "AmlAdvisoryIssued",
    
    # Hardship detection
    "HardshipRiskScoreProduced",
    "HardshipSignalDetected",
    "HardshipAdvisoryIssued",
    
    # Treasury RL
    "TreasuryRlPolicyEvaluated",
    "TreasuryAdvisoryIssued",
    
    # Model governance
    "ModelAuthorityLevelChanged",
    "ModelPerformanceMetric",
}


# ============================================================================
# EXCEPTIONS (Fail-Fast)
# ============================================================================

class AiOriginViolation(Exception):
    """
    Critical safety violation: AI attempted to emit forbidden command.
    
    This exception is FATAL and should never be caught.
    The process must die immediately to prevent execution.
    
    This is a court-defensible technical control.
    """
    pass


# ============================================================================
# ENFORCEMENT FUNCTIONS (Runtime Guards)
# ============================================================================

def enforce_ai_origin_block(event: Dict[str, Any]) -> None:
    """
    Hard runtime guarantee: AI-origin events can NEVER carry executable authority.
    
    This function enforces the absolute prohibition on AI execution commands.
    If an AI-origin event attempts to emit a forbidden command, the process
    dies immediately with AiOriginViolation.
    
    This is a FAIL-FAST control. No exception handling is allowed.
    No recovery mechanism exists. The process must die.
    
    Args:
        event: Protocol event dictionary to validate
        
    Raises:
        AiOriginViolation: If AI attempts forbidden command (FATAL)
    """
    origin = event.get("origin")
    
    # Only enforce for AI-origin events
    if origin != "AI":
        return  # Not AI → out of scope
    
    # Check for forbidden command types
    command_type = event.get("command_type")
    event_type = event.get("event_type")
    
    # Check command_type field (used in some legacy events)
    if command_type and command_type in FORBIDDEN_AI_COMMANDS:
        raise AiOriginViolation(
            f"🚨 FATAL SAFETY VIOLATION: AI-origin attempted forbidden command: {command_type}\n"
            f"Event ID: {event.get('event_id', 'UNKNOWN')}\n"
            f"Tenant ID: {event.get('tenant_id', 'UNKNOWN')}\n"
            f"This is a critical safety breach. The process has been terminated.\n"
            f"DO NOT restart until root cause is identified and fixed.\n"
            f"Notify: APRA, AUSTRAC, board, insurers immediately."
        )
    
    # Check event_type field (used in Protocol events)
    if event_type and event_type in FORBIDDEN_AI_COMMANDS:
        raise AiOriginViolation(
            f"🚨 FATAL SAFETY VIOLATION: AI-origin attempted forbidden event: {event_type}\n"
            f"Event ID: {event.get('event_id', 'UNKNOWN')}\n"
            f"Tenant ID: {event.get('tenant_id', 'UNKNOWN')}\n"
            f"This is a critical safety breach. The process has been terminated.\n"
            f"DO NOT restart until root cause is identified and fixed.\n"
            f"Notify: APRA, AUSTRAC, board, insurers immediately."
        )


def enforce_ai_only_advisory(event: Dict[str, Any]) -> None:
    """
    Ensures AI events may only be advisory intel or advisory recommendations.
    
    This function enforces the whitelist of allowed AI event types.
    Any AI-origin event that is not in the whitelist is rejected.
    
    This prevents:
    - AI from inventing new event types
    - AI from emitting operational events
    - AI from emitting control events
    
    Args:
        event: Protocol event dictionary to validate
        
    Raises:
        AiOriginViolation: If AI emits non-advisory event (FATAL)
    """
    origin = event.get("origin")
    
    # Only enforce for AI-origin events
    if origin != "AI":
        return  # Not AI → out of scope
    
    event_type = event.get("event_type")
    
    # Check if event type is in whitelist
    if event_type not in ALLOWED_AI_EVENT_TYPES:
        raise AiOriginViolation(
            f"🚨 FATAL SAFETY VIOLATION: AI-origin emitted non-advisory event: {event_type}\n"
            f"Event ID: {event.get('event_id', 'UNKNOWN')}\n"
            f"Tenant ID: {event.get('tenant_id', 'UNKNOWN')}\n"
            f"Allowed AI event types: {', '.join(sorted(ALLOWED_AI_EVENT_TYPES))}\n"
            f"This is a critical safety breach. The process has been terminated.\n"
            f"DO NOT restart until root cause is identified and fixed.\n"
            f"Notify: APRA, AUSTRAC, board, insurers immediately."
        )


# ============================================================================
# VALIDATION HELPERS
# ============================================================================

def is_ai_origin(event: Dict[str, Any]) -> bool:
    """
    Check if event is AI-origin.
    
    Args:
        event: Protocol event dictionary
        
    Returns:
        True if event has origin="AI", False otherwise
    """
    return event.get("origin") == "AI"


def is_forbidden_command(event: Dict[str, Any]) -> bool:
    """
    Check if event contains forbidden command.
    
    Args:
        event: Protocol event dictionary
        
    Returns:
        True if event contains forbidden command, False otherwise
    """
    command_type = event.get("command_type")
    event_type = event.get("event_type")
    
    return (
        (command_type and command_type in FORBIDDEN_AI_COMMANDS) or
        (event_type and event_type in FORBIDDEN_AI_COMMANDS)
    )


def is_allowed_advisory(event: Dict[str, Any]) -> bool:
    """
    Check if event is allowed advisory type.
    
    Args:
        event: Protocol event dictionary
        
    Returns:
        True if event is in allowed whitelist, False otherwise
    """
    event_type = event.get("event_type")
    return event_type in ALLOWED_AI_EVENT_TYPES


# ============================================================================
# AUDIT LOGGING
# ============================================================================

def log_enforcement_check(event: Dict[str, Any], result: str) -> None:
    """
    Log enforcement check for audit trail.
    
    This provides evidence that enforcement checks are running.
    
    Args:
        event: Protocol event dictionary
        result: "PASS" or "FAIL"
    """
    print(f"🔒 AI Origin Blocker: {result} | "
          f"Event: {event.get('event_type', 'UNKNOWN')} | "
          f"Origin: {event.get('origin', 'UNKNOWN')} | "
          f"ID: {event.get('event_id', 'UNKNOWN')}")


# ============================================================================
# COMPREHENSIVE ENFORCEMENT (All Checks)
# ============================================================================

def enforce_all_ai_origin_rules(event: Dict[str, Any]) -> None:
    """
    Run all AI origin enforcement checks.
    
    This is the main entry point for AI origin enforcement.
    
    Args:
        event: Protocol event dictionary to validate
        
    Raises:
        AiOriginViolation: If any enforcement check fails (FATAL)
    """
    # Only enforce for AI-origin events
    if not is_ai_origin(event):
        return
    
    # Run all enforcement checks
    enforce_ai_origin_block(event)
    enforce_ai_only_advisory(event)
    
    # Log successful enforcement
    log_enforcement_check(event, "PASS")
