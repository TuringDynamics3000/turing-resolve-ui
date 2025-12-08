from tests.intelligence.harness.event_generators import (
    fraud_event,
    aml_event,
    hardship_event,
    payments_rl_event,
    treasury_rl_event,
)

def full_risk_brain_scenario(tenant_id, customer_id, account_id):
    return [
        fraud_event(tenant_id, payment_id="PAY-001", score=0.94),
        aml_event(tenant_id, account_id, score=0.91),
        hardship_event(tenant_id, customer_id, score=0.82),
        payments_rl_event(tenant_id, "PAY-002", "ROUTE_NPP", 0.88),
        treasury_rl_event(tenant_id, "PROPOSE_THROTTLE", 0.85),
    ]
