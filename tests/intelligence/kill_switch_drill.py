"""
Kill Switch Drill - MANDATORY REHEARSAL FOR APRA PACK

This script tests all three kill switch mechanisms:
1. Environment Variable (Hard Stop)
2. Protocol Governance Event (ModelAuthorityLevelChanged)
3. Runtime Panic Switch (Immediate Process Halt)

This rehearsal log becomes part of your APRA disclosure pack.
"""

import os
import sys
from intelligence_bus.consumers.payments_rl_consumer import PaymentsRlConsumer


def test_kill_switch_1_environment():
    """Test Kill Switch 1: Environment Variable"""
    print("\n🧯 KILL SWITCH DRILL 1: Environment Variable")
    print("=" * 60)
    
    # Disable RL via environment variable
    os.environ["RISK_BRAIN_PAYMENTS_RL_ENABLED"] = "false"
    
    consumer = PaymentsRlConsumer()
    event = {
        "event_type": "RlPolicyEvaluated",
        "payment_id": "PAY-TEST-001",
        "proposed_action": "ROUTE_NPP"
    }
    
    result = consumer.process(event)
    
    if result is None:
        print("✅ PASS: RL output = 0 (completely disabled)")
        return True
    else:
        print("❌ FAIL: RL still producing output despite env flag = false")
        return False


def test_kill_switch_2_governance():
    """Test Kill Switch 2: Protocol Governance Event"""
    print("\n🧯 KILL SWITCH DRILL 2: Protocol Governance Event")
    print("=" * 60)
    
    # Enable RL via environment variable (so we test governance kill only)
    os.environ["RISK_BRAIN_PAYMENTS_RL_ENABLED"] = "true"
    
    consumer = PaymentsRlConsumer()
    
    # Trigger governance kill
    consumer.update_model_authority("SHADOW_DISABLED")
    
    event = {
        "event_type": "RlPolicyEvaluated",
        "payment_id": "PAY-TEST-002",
        "proposed_action": "ROUTE_NPP"
    }
    
    result = consumer.process(event)
    
    if result is None:
        print("✅ PASS: RL output = 0 (disabled by governance event)")
        return True
    else:
        print("❌ FAIL: RL still producing output despite governance kill")
        return False


def test_kill_switch_3_panic():
    """Test Kill Switch 3: Runtime Panic Switch"""
    print("\n🧯 KILL SWITCH DRILL 3: Runtime Panic Switch")
    print("=" * 60)
    
    # Enable RL via environment variable and governance
    os.environ["RISK_BRAIN_PAYMENTS_RL_ENABLED"] = "true"
    
    consumer = PaymentsRlConsumer()
    consumer.update_model_authority("SHADOW_ADVISORY")
    
    try:
        # Trigger panic stop
        consumer.trigger_panic_stop("Test panic scenario")
        print("❌ FAIL: Panic stop did not halt process")
        return False
    except SystemExit as e:
        if "PANIC STOP" in str(e):
            print(f"✅ PASS: RL process exited with panic stop - {e}")
            return True
        else:
            print(f"❌ FAIL: Unexpected exit - {e}")
            return False


def main():
    print("\n" + "=" * 60)
    print("🚨 PAYMENTS RL KILL SWITCH DRILL")
    print("=" * 60)
    print("This rehearsal is MANDATORY for APRA disclosure pack.")
    print("All three kill switches must pass before live pilot.")
    print("=" * 60)
    
    results = []
    
    # Test all three kill switches
    results.append(("Environment Kill", test_kill_switch_1_environment()))
    results.append(("Governance Kill", test_kill_switch_2_governance()))
    results.append(("Panic Kill", test_kill_switch_3_panic()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 KILL SWITCH DRILL SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status}: {name}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    
    if all_passed:
        print("\n✅ ALL KILL SWITCHES OPERATIONAL")
        print("This log is now part of your APRA disclosure pack.")
        print("You are cleared for live shadow pilot.")
        return 0
    else:
        print("\n❌ KILL SWITCH DRILL FAILED")
        print("DO NOT PROCEED WITH LIVE PILOT until all switches pass.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
