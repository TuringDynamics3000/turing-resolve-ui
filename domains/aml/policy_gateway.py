# ==========================================================
# AML POLICY GATEWAY
# ML detects risk. Humans retain enforcement authority.
# ==========================================================

HIGH_AML_THRESHOLD = 0.85
MEDIUM_AML_THRESHOLD = 0.70


def apply_policy(event: dict, current_state: dict | None = None) -> dict | None:
    """
    AML policy gateway - deterministic translation of AML ML scores.
    
    Args:
        event: AmlRiskScoreProduced event
        current_state: Current state dict (optional)
    
    Returns:
        Domain command dict or None
    
    Pure function - no I/O, no DB access, no external calls.
    ML detects risk. Humans retain enforcement authority.
    """
    if event.get("event_type") != "AmlRiskScoreProduced":
        return None

    score = event.get("risk_score")

    if score is None:
        return None

    if score >= HIGH_AML_THRESHOLD:
        return {
            "command_type": "HighAmlRiskFlagRaised",
            "payload": {
                "account_id": event.get("account_id"),
                "customer_id": event.get("customer_id"),
                "score": score,
            },
        }

    if score >= MEDIUM_AML_THRESHOLD:
        return {
            "command_type": "ModerateAmlRiskFlagRaised",
            "payload": {
                "account_id": event.get("account_id"),
                "customer_id": event.get("customer_id"),
                "score": score,
            },
        }

    return None
