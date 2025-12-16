import time
import uuid


def base_event(event_type, tenant_id, origin="AI"):
    return {
        "event_type": event_type,
        "base": {
            "event_id": str(uuid.uuid4()),
            "tenant_id": tenant_id,
            "origin": origin,
            "occurred_at": int(time.time() * 1000),
            "schema_version": "1.0",
            "hash_prev_event": None,
        },
    }


def fraud_event(tenant_id, payment_id, score):
    e = base_event("FraudRiskScoreProduced", tenant_id)
    e.update({
        "payment_id": payment_id,
        "customer_id": "CUST-TEST",
        "score_value": score,
        "risk_band": "HIGH" if score > 0.9 else "MEDIUM",
        "model_id": "fraud-v1",
        "model_version": "1.0",
        "feature_set_version": "1.0",
        "confidence_interval": 0.98,
        "input_feature_hash": "abc123",
    })
    return e


def aml_event(tenant_id, account_id, score):
    e = base_event("AmlRiskScoreProduced", tenant_id)
    e.update({
        "customer_id": "CUST-TEST",
        "account_id": account_id,
        "risk_score": score,
        "risk_band": "HIGH",
        "model_id": "aml-v1",
        "model_version": "1.0",
        "feature_set_version": "1.0",
        "confidence_interval": 0.95,
        "input_feature_hash": "def456",
    })
    return e


def hardship_event(tenant_id, customer_id, score):
    e = base_event("HardshipRiskScoreProduced", tenant_id)
    e.update({
        "customer_id": customer_id,
        "score_value": score,
        "risk_band": "HIGH",
        "model_id": "hardship-v1",
        "model_version": "1.0",
        "feature_set_version": "1.0",
        "confidence_interval": 0.92,
        "input_feature_hash": "ghi789",
    })
    return e


def payments_rl_event(tenant_id, payment_id, action, confidence):
    e = base_event("RlPolicyEvaluated", tenant_id)
    e.update({
        "payment_id": payment_id,
        "state_hash": "state123",
        "proposed_action": action,
        "policy_id": "payments-rl-v1",
        "policy_version": "1.0",
        "confidence_score": confidence,
        "reward_estimate": 0.015,
    })
    return e


def treasury_rl_event(tenant_id, action, confidence):
    e = base_event("RlTreasuryPolicyEvaluated", tenant_id)
    e.update({
        "state_hash": "treasury-state-xyz",
        "proposed_action": action,
        "policy_id": "treasury-rl-v1",
        "policy_version": "1.0",
        "confidence_score": confidence,
        "reward_estimate": 0.02,
    })
    return e
