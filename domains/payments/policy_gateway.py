# ==========================================================
# PAYMENTS RL POLICY GATEWAY
# Advisory only. Never executes routing or settlements.
# ==========================================================


def apply_policy(event: dict, current_state: dict | None = None) -> dict | None:
    """
    Payments RL policy gateway - advisory only.
    
    Args:
        event: RlPolicyEvaluated or RlRoutingAdvisoryIssued event
        current_state: Current state dict (optional)
    
    Returns:
        Domain command dict or None
    
    Pure function - no I/O, no DB access, no external calls.
    Advisory only. Never executes routing or settlements.
    """
    if event.get("event_type") not in {
        "RlPolicyEvaluated",
        "RlRoutingAdvisoryIssued",
    }:
        return None

    return {
        "command_type": "RlRoutingAdvisoryIssued",
        "payload": {
            "payment_id": event.get("payment_id"),
            "recommended_action": event.get("proposed_action"),
            "confidence": event.get("confidence_score"),
            "expected_reward": event.get("reward_estimate"),
        },
    }
