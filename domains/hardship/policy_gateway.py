# ==========================================================
# HARDSHIP POLICY GATEWAY
# Used only for proactive human outreach.
# ==========================================================

HARDSHIP_THRESHOLD = 0.75


def apply_policy(event: dict, current_state: dict | None = None) -> dict | None:
    """
    Hardship policy gateway - deterministic translation of hardship ML scores.
    
    Args:
        event: HardshipRiskScoreProduced event
        current_state: Current state dict (optional)
    
    Returns:
        Domain command dict or None
    
    Pure function - no I/O, no DB access, no external calls.
    Used only for proactive human outreach.
    """
    if event.get("event_type") != "HardshipRiskScoreProduced":
        return None

    score = event.get("score_value")

    if score is None:
        return None

    if score >= HARDSHIP_THRESHOLD:
        return {
            "command_type": "HardshipRiskFlagRaised",
            "payload": {
                "customer_id": event.get("customer_id"),
                "score": score,
            },
        }

    return None
