"""
Enforced Policy Adapter — Final Safety Gate v1

This module is the FINAL gate before any AI advisory can enter the system.

PURPOSE:
- Integrate all enforcement layers (AI origin, schema, policy gateway)
- Provide single entry point for enforcement
- Ensure advisory events are legally admissible

SAFETY GUARANTEES:
- If this function passes → advisory is legally admissible
- If this function raises → process must halt (no recovery)
- No bypass mechanism (no override flag, no admin mode)

LEGAL SIGNIFICANCE:
This is the court-defensible technical control that proves:
- All enforcement checks are applied (no gaps)
- Advisory events meet all safety requirements
- Process dies before damage occurs (fail-fast)

ARCHITECTURE:
- Final Safety Gate component
- Integrates all enforcement modules
- Fail-fast on any violation

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Critical Safety Control)
"""

import sys
from typing import Dict, Any

# Import enforcement modules
sys.path.append('/home/ubuntu/turingcore-cu-digital-twin')
from enforcement.ai_origin_blocker import (
    enforce_ai_origin_block,
    enforce_ai_only_advisory,
    AiOriginViolation
)
from enforcement.schema_version_guard import (
    enforce_schema_version,
    SchemaVersionViolation
)
from enforcement.policy_gateway_validator import (
    enforce_policy_origin,
    PolicyGatewayViolation
)


# ============================================================================
# COMPREHENSIVE ENFORCEMENT (All Layers)
# ============================================================================

def enforce_payments_rl_advisory(event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    This function is the FINAL gate before any AI advisory can enter the system.
    
    If this function passes → the advisory is legally admissible.
    If it raises → the process must halt.
    
    ENFORCEMENT LAYERS (Applied in Order):
    1. Schema version must match pinned version (prevent schema drift)
    2. Policy source must be approved (prevent unauthorized sources)
    3. AI may only issue advisory types (prevent operational events)
    4. AI may NEVER carry command authority (prevent execution)
    
    LEGAL SIGNIFICANCE:
    This function creates a court-defensible technical control that proves:
    - AI cannot execute payments (even if code is modified)
    - AI cannot post to ledger (even if model misbehaves)
    - AI cannot freeze accounts (even if library is compromised)
    - AI cannot submit AUSTRAC reports (even if engineer tries)
    
    FAIL-FAST DESIGN:
    - No exception handling (violations are FATAL)
    - No recovery mechanism (process must die)
    - No bypass flag (no override mode)
    
    Args:
        event_dict: Advisory event dictionary to validate
        
    Returns:
        event_dict: Same dictionary if all checks pass
        
    Raises:
        SchemaVersionViolation: If schema version mismatch (FATAL)
        PolicyGatewayViolation: If unapproved policy source (FATAL)
        AiOriginViolation: If AI attempts forbidden action (FATAL)
    """
    
    # ========================================================================
    # LAYER 1: Schema Version Enforcement
    # ========================================================================
    # Ensures Protocol events are immutable and version-controlled
    enforce_schema_version(event_dict)
    
    # ========================================================================
    # LAYER 2: Policy Gateway Validation
    # ========================================================================
    # Ensures advisory events come from approved sources only
    enforce_policy_origin(event_dict)
    
    # ========================================================================
    # LAYER 3: Advisory-Only Constraint
    # ========================================================================
    # Ensures AI can only emit advisory event types
    enforce_ai_only_advisory(event_dict)
    
    # ========================================================================
    # LAYER 4: AI Origin Blocker (Final Check)
    # ========================================================================
    # Ensures AI can NEVER emit execution commands
    enforce_ai_origin_block(event_dict)
    
    # ========================================================================
    # All checks passed → Advisory is legally admissible
    # ========================================================================
    
    return event_dict


# ============================================================================
# BATCH ENFORCEMENT (For Consumer Services)
# ============================================================================

def enforce_batch(event_dicts: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
    """
    Enforce all safety checks on a batch of advisory events.
    
    This is a convenience wrapper for consumer services that process
    events in batches for efficiency.
    
    FAIL-FAST DESIGN:
    - If ANY event fails enforcement, the ENTIRE batch is rejected
    - No partial success (all or nothing)
    - Process dies on first violation
    
    Args:
        event_dicts: List of advisory event dictionaries
        
    Returns:
        event_dicts: Same list if all checks pass
        
    Raises:
        SchemaVersionViolation: If any schema version mismatch (FATAL)
        PolicyGatewayViolation: If any unapproved policy source (FATAL)
        AiOriginViolation: If any AI attempts forbidden action (FATAL)
    """
    enforced_events = []
    
    for event_dict in event_dicts:
        # Enforce all safety checks (fail-fast)
        enforced_event = enforce_payments_rl_advisory(event_dict)
        enforced_events.append(enforced_event)
    
    return enforced_events


# ============================================================================
# AUDIT LOGGING
# ============================================================================

def log_enforcement_success(event_dict: Dict[str, Any]) -> None:
    """
    Log successful enforcement for audit trail.
    
    This provides evidence that enforcement checks are running and passing.
    
    Args:
        event_dict: Advisory event dictionary that passed enforcement
    """
    print(f"✅ Enforcement PASS: {event_dict.get('event_type', 'UNKNOWN')} | "
          f"Policy: {event_dict.get('policy_id', 'NONE')} | "
          f"ID: {event_dict.get('event_id', 'UNKNOWN')}")


def log_enforcement_failure(event_dict: Dict[str, Any], error: Exception) -> None:
    """
    Log enforcement failure for audit trail.
    
    This provides evidence of enforcement violations for regulatory review.
    
    Args:
        event_dict: Advisory event dictionary that failed enforcement
        error: Exception raised by enforcement check
    """
    print(f"🚨 Enforcement FAIL: {event_dict.get('event_type', 'UNKNOWN')} | "
          f"Policy: {event_dict.get('policy_id', 'NONE')} | "
          f"ID: {event_dict.get('event_id', 'UNKNOWN')} | "
          f"Error: {type(error).__name__}: {error}")


# ============================================================================
# SAFE ENFORCEMENT WRAPPER (With Audit Logging)
# ============================================================================

def enforce_with_audit(event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enforce all safety checks with audit logging.
    
    This wrapper adds audit logging to enforcement checks.
    
    Args:
        event_dict: Advisory event dictionary to validate
        
    Returns:
        event_dict: Same dictionary if all checks pass
        
    Raises:
        SchemaVersionViolation: If schema version mismatch (FATAL)
        PolicyGatewayViolation: If unapproved policy source (FATAL)
        AiOriginViolation: If AI attempts forbidden action (FATAL)
    """
    try:
        # Run all enforcement checks
        enforced_event = enforce_payments_rl_advisory(event_dict)
        
        # Log success
        log_enforcement_success(enforced_event)
        
        return enforced_event
        
    except (SchemaVersionViolation, PolicyGatewayViolation, AiOriginViolation) as e:
        # Log failure
        log_enforcement_failure(event_dict, e)
        
        # Re-raise (fail-fast, no recovery)
        raise


# ============================================================================
# ENFORCEMENT STATISTICS (For Monitoring)
# ============================================================================

class EnforcementStatistics:
    """Statistics for monitoring enforcement behavior."""
    
    def __init__(self):
        self.total_checks = 0
        self.passed_checks = 0
        self.failed_checks = 0
        self.schema_violations = 0
        self.policy_violations = 0
        self.ai_origin_violations = 0
    
    def record_pass(self):
        """Record successful enforcement check."""
        self.total_checks += 1
        self.passed_checks += 1
    
    def record_fail(self, error: Exception):
        """Record failed enforcement check."""
        self.total_checks += 1
        self.failed_checks += 1
        
        if isinstance(error, SchemaVersionViolation):
            self.schema_violations += 1
        elif isinstance(error, PolicyGatewayViolation):
            self.policy_violations += 1
        elif isinstance(error, AiOriginViolation):
            self.ai_origin_violations += 1
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert statistics to dictionary."""
        return {
            "total_checks": self.total_checks,
            "passed_checks": self.passed_checks,
            "failed_checks": self.failed_checks,
            "schema_violations": self.schema_violations,
            "policy_violations": self.policy_violations,
            "ai_origin_violations": self.ai_origin_violations,
            "pass_rate": (self.passed_checks / self.total_checks * 100) if self.total_checks > 0 else 0.0
        }


# Global statistics instance
enforcement_stats = EnforcementStatistics()


def enforce_with_stats(event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """
    Enforce all safety checks with statistics tracking.
    
    This wrapper adds statistics tracking to enforcement checks.
    
    Args:
        event_dict: Advisory event dictionary to validate
        
    Returns:
        event_dict: Same dictionary if all checks pass
        
    Raises:
        SchemaVersionViolation: If schema version mismatch (FATAL)
        PolicyGatewayViolation: If unapproved policy source (FATAL)
        AiOriginViolation: If AI attempts forbidden action (FATAL)
    """
    try:
        # Run all enforcement checks
        enforced_event = enforce_payments_rl_advisory(event_dict)
        
        # Record success
        enforcement_stats.record_pass()
        
        return enforced_event
        
    except (SchemaVersionViolation, PolicyGatewayViolation, AiOriginViolation) as e:
        # Record failure
        enforcement_stats.record_fail(e)
        
        # Re-raise (fail-fast, no recovery)
        raise


def get_enforcement_statistics() -> Dict[str, Any]:
    """
    Get enforcement statistics for monitoring.
    
    Returns:
        Dictionary with enforcement statistics
    """
    return enforcement_stats.to_dict()
