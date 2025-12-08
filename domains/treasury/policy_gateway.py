# ==========================================================
# TREASURY RL POLICY GATEWAY
# Strictly advisory. Never moves real liquidity.
# ==========================================================


def apply_policy(event: dict, current_state: dict | None = None) -> dict | None:
    """
    Treasury RL policy gateway - strictly advisory.
    
    Args:
        event: RlTreasuryPolicyEvaluated event
        current_state: Current state dict with treasury_policy (optional)
    
    Returns:
        Domain command dict or None
    
    Pure function - no I/O, no DB access, no external calls.
    Strictly advisory. Never moves real liquidity.
    """
    if event.get("event_type") != "RlTreasuryPolicyEvaluated":
        return None

    min_confidence = (
        current_state.get("treasury_policy", {}).get("min_confidence", 0.80)
        if current_state else 0.80
    )

    confidence = event.get("confidence_score")

    if confidence is None:
        return None

    if confidence >= min_confidence:
        return {
            "command_type": "RlTreasuryAdvisoryIssued",
            "payload": {
                "recommended_action": event.get("proposed_action"),
                "confidence": confidence,
                "expected_reward": event.get("reward_estimate"),
            },
        }

    return None
