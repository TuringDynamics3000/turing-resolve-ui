# ==========================================================
# FRAUD POLICY GATEWAY
# Deterministic translation of fraud intelligence into
# human-controlled or rule-approved actions.
# ==========================================================

HIGH_RISK_THRESHOLD = 0.90
MEDIUM_RISK_THRESHOLD = 0.75


def apply_policy(event: dict, current_state: dict | None = None) -> dict | None:
    """
    Fraud policy gateway - deterministic translation of fraud ML scores.
    
    Args:
        event: FraudRiskScoreProduced or FraudAdvisoryIssued event
        current_state: Current state dict with fraud_policy (optional)
    
    Returns:
        Domain command dict or None
    
    Pure function - no I/O, no DB access, no external calls.
    """
    if event.get("event_type") not in {
        "FraudRiskScoreProduced",
        "FraudAdvisoryIssued",
    }:
        return None

    score = event.get("score_value") or event.get("risk_score")
    tenant_policy = current_state.get("fraud_policy", {}) if current_state else {}
    auto_block_enabled = tenant_policy.get("auto_block_enabled", False)

    if score is None:
        return None

    if score >= HIGH_RISK_THRESHOLD:
        if auto_block_enabled:
            return {
                "command_type": "AutoBlockAuthorisationIssued",
                "payload": {
                    "payment_id": event.get("payment_id"),
                    "reason": "HIGH_FRAUD_SCORE",
                },
            }

        return {
            "command_type": "HighFraudRiskFlagRaised",
            "payload": {
                "payment_id": event.get("payment_id"),
                "score": score,
            },
        }

    if score >= MEDIUM_RISK_THRESHOLD:
        return {
            "command_type": "ModerateFraudRiskFlagRaised",
            "payload": {
                "payment_id": event.get("payment_id"),
                "score": score,
            },
        }

    return None
