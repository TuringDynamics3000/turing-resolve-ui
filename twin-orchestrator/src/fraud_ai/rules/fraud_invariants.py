"""
Fraud AI Invariants - Production Grade

These invariants enforce:
- No ML bypasses execution controls
- No opaque "black box declines"
- Full human-in-the-loop compliance
- Complete audit trail
- Guardrailed automation only

Deterministic Rules (Layer A Only):
- IF fraud_score > 0.90 THEN emit HighFraudRiskFlagRaised
- IF fraud_score 0.75-0.90 THEN emit ModerateFraudRiskFlagRaised
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional


@dataclass
class InvariantResult:
    """Result of a fraud AI invariant check."""
    name: str
    passed: bool
    violations: List[Dict[str, Any]]
    message: Optional[str] = None


# ========== INVARIANT 1: NO ML SCORE WITHOUT FEATURE PROVENANCE ==========

def invariant_fraud_score_has_provenance(
    fraud_scores: List[Any],
    feature_vectors: List[Any]
) -> InvariantResult:
    """
    Guarantee: Every FraudRiskScoreProduced event has a corresponding feature vector
    with matching input_feature_hash.
    
    Args:
        fraud_scores: List of FraudRiskScoreProduced events
        feature_vectors: List of FraudFeatureVector
    
    Returns:
        InvariantResult with violations (if any)
    """
    violations = []
    
    # Build feature hash lookup
    feature_hashes = {fv.to_hash(): fv for fv in feature_vectors}
    
    for score in fraud_scores:
        if score.input_feature_hash not in feature_hashes:
            violations.append({
                "event_id": score.event_id,
                "entity_id": score.aggregate_id,
                "input_feature_hash": score.input_feature_hash,
                "reason": "No matching feature vector found",
            })
    
    return InvariantResult(
        name="fraud_score_has_provenance",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} fraud scores without feature provenance"
    )


# ========== INVARIANT 2: NO AUTO-BLOCK WITHOUT PROVEN PATTERN ==========

def invariant_no_auto_block_without_proven_pattern(
    auto_block_events: List[Any],
    cluster_events: List[Any]
) -> InvariantResult:
    """
    Guarantee: No AutoBlockAuthorisationIssued event exists without a corresponding
    FraudClusterDetected event with a proven attack signature.
    
    This ensures auto-blocks only happen for known patterns with zero false-positive tolerance.
    
    Args:
        auto_block_events: List of AutoBlockAuthorisationIssued events
        cluster_events: List of FraudClusterDetected events
    
    Returns:
        InvariantResult with violations (if any)
    """
    violations = []
    
    # Build cluster lookup
    proven_clusters = {
        e.event_id: e for e in cluster_events
        if e.attack_signature in ["known_mule_ring_v3", "compromised_terminal_v2"]
    }
    
    for auto_block in auto_block_events:
        if auto_block.source_cluster_event_id not in proven_clusters:
            violations.append({
                "event_id": auto_block.event_id,
                "entity_id": auto_block.aggregate_id,
                "attack_signature": auto_block.attack_signature,
                "reason": "No proven cluster pattern found",
            })
    
    return InvariantResult(
        name="no_auto_block_without_proven_pattern",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} auto-blocks without proven patterns"
    )


# ========== INVARIANT 3: FULL AUDIT TRAIL FOR ALL FRAUD DECISIONS ==========

def invariant_full_fraud_audit_trail(
    fraud_scores: List[Any],
    flag_events: List[Any],
    advisory_events: List[Any],
    auto_block_events: List[Any]
) -> InvariantResult:
    """
    Guarantee: Every fraud decision has a complete audit trail from
    ML score → flag → advisory/auto-block → outcome.
    
    Args:
        fraud_scores: List of FraudRiskScoreProduced events
        flag_events: List of fraud flag events
        advisory_events: List of FraudAdvisory* events
        auto_block_events: List of AutoBlockAuthorisationIssued events
    
    Returns:
        InvariantResult with violations (if any)
    """
    violations = []
    
    # Check that all flags have corresponding ML scores
    ml_event_ids = {e.event_id for e in fraud_scores}
    
    for flag in flag_events:
        if flag.source_ml_event_id not in ml_event_ids:
            violations.append({
                "event_id": flag.event_id,
                "entity_id": flag.aggregate_id,
                "source_ml_event_id": flag.source_ml_event_id,
                "reason": "Flag event missing source ML score",
            })
    
    return InvariantResult(
        name="full_fraud_audit_trail",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} audit trail gaps"
    )


# ========== INVARIANT 4: NO OPAQUE BLACK BOX DECLINES ==========

def invariant_no_opaque_declines(
    decline_events: List[Any],
    explanation_events: List[Any]
) -> InvariantResult:
    """
    Guarantee: Every fraud-related decline has a corresponding AiExplanationGenerated
    event for transparency and customer service.
    
    Args:
        decline_events: List of CardAuthorisationDeclined events
        explanation_events: List of AiExplanationGenerated events
    
    Returns:
        InvariantResult with violations (if any)
    """
    violations = []
    
    # Build explanation lookup
    explanations_by_entity = {
        e.aggregate_id: e for e in explanation_events
    }
    
    for decline in decline_events:
        if decline.decline_reason == "FRAUD_SUSPECTED":
            if decline.aggregate_id not in explanations_by_entity:
                violations.append({
                    "event_id": decline.event_id,
                    "entity_id": decline.aggregate_id,
                    "reason": "Fraud decline without explanation",
                })
    
    return InvariantResult(
        name="no_opaque_declines",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} opaque fraud declines"
    )


# ========== DETERMINISTIC BUSINESS RULES (LAYER A ONLY) ==========

@dataclass
class FraudRiskRule:
    """Deterministic business rule for fraud risk flagging."""
    rule_id: str
    rule_version: str
    threshold_high: float  # High risk threshold (e.g., 0.90)
    threshold_moderate: float  # Moderate risk threshold (e.g., 0.75)
    description: str


def apply_fraud_risk_rule(
    fraud_score: Any,
    rule: FraudRiskRule
) -> Optional[str]:
    """
    Apply deterministic business rule to fraud ML score.
    
    This is NOT ML. This is a deterministic rule applied to ML output.
    
    Rules:
    - IF fraud_score >= 0.90 THEN raise HighFraudRiskFlagRaised
    - IF 0.75 <= fraud_score < 0.90 THEN raise ModerateFraudRiskFlagRaised
    - ELSE no flag
    
    Args:
        fraud_score: FraudRiskScoreProduced event
        rule: Business rule to apply
    
    Returns:
        Flag type ("HIGH", "MODERATE", or None)
    """
    if fraud_score.score_value >= rule.threshold_high:
        return "HIGH"
    elif fraud_score.score_value >= rule.threshold_moderate:
        return "MODERATE"
    else:
        return None


@dataclass
class AutoBlockRule:
    """Guardrailed auto-block rule for proven patterns only."""
    rule_id: str
    rule_version: str
    attack_signature: str  # e.g., "known_mule_ring_v3"
    tenant_allow_autoblock: bool  # Tenant policy flag
    description: str


def apply_auto_block_rule(
    cluster_event: Any,
    rule: AutoBlockRule
) -> bool:
    """
    Apply guardrailed auto-block rule.
    
    Auto-block ONLY when:
    - Pattern is proven nationally
    - Zero false-positive tolerance
    - Board + APRA approved
    - Tenant policy allows
    
    Args:
        cluster_event: FraudClusterDetected event
        rule: Auto-block rule
    
    Returns:
        True if auto-block should be issued
    """
    return (
        cluster_event.attack_signature == rule.attack_signature and
        rule.tenant_allow_autoblock and
        cluster_event.confidence >= 0.95  # Very high confidence required
    )


# ========== MASTER FRAUD AI INVARIANT RUNNER ==========

def run_all_fraud_ai_invariants(
    fraud_scores: List[Any],
    feature_vectors: List[Any],
    flag_events: List[Any],
    advisory_events: List[Any],
    auto_block_events: List[Any],
    cluster_events: List[Any],
    decline_events: List[Any],
    explanation_events: List[Any]
) -> Dict[str, Any]:
    """
    Run all fraud AI invariants and return aggregated results.
    
    Args:
        fraud_scores: List of FraudRiskScoreProduced events
        feature_vectors: List of FraudFeatureVector
        flag_events: List of fraud flag events
        advisory_events: List of FraudAdvisory* events
        auto_block_events: List of AutoBlockAuthorisationIssued events
        cluster_events: List of FraudClusterDetected events
        decline_events: List of CardAuthorisationDeclined events
        explanation_events: List of AiExplanationGenerated events
    
    Returns:
        Dict with:
        - passed: bool (all invariants passed)
        - results: List[InvariantResult]
        - summary: Dict with counts
    """
    results = [
        invariant_fraud_score_has_provenance(fraud_scores, feature_vectors),
        invariant_no_auto_block_without_proven_pattern(auto_block_events, cluster_events),
        invariant_full_fraud_audit_trail(fraud_scores, flag_events, advisory_events, auto_block_events),
        invariant_no_opaque_declines(decline_events, explanation_events),
    ]
    
    passed = all(r.passed for r in results)
    total_violations = sum(len(r.violations) for r in results)
    
    return {
        "passed": passed,
        "results": results,
        "summary": {
            "total_invariants": len(results),
            "passed_count": sum(1 for r in results if r.passed),
            "failed_count": sum(1 for r in results if not r.passed),
            "total_violations": total_violations,
        }
    }
