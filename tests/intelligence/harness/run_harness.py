from tests.intelligence.harness.cu_generator import generate_cu_tenant, generate_customer
from tests.intelligence.harness.scenario_pack import full_risk_brain_scenario
from tests.intelligence.harness.replay_engine import ReplayEngine
from tests.intelligence.harness.assertions import (
    assert_no_ai_money_write,
    assert_policy_fired,
)


def main():
    tenant = generate_cu_tenant()
    customer = generate_customer(tenant["tenant_id"])

    scenario = full_risk_brain_scenario(
        tenant["tenant_id"],
        customer["customer_id"],
        customer["account_id"],
    )

    engine = ReplayEngine(tenant)
    commands = engine.replay(scenario)

    assert_no_ai_money_write(commands)
    assert_policy_fired(commands)

    print("✅ RISK BRAIN v1 HARNESS PASSED")
    print("Commands emitted:")
    for c in commands:
        print(c)


if __name__ == "__main__":
    main()
