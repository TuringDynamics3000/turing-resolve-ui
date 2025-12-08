"""
Fraud Kill Switch Drill - MANDATORY REHEARSAL FOR APRA PACK

This script tests all three kill switch mechanisms for Fraud Dark Graph:
1. Environment Variable (Hard Stop)
2. Protocol Governance Event (ModelAuthorityLevelChanged)
3. Runtime Panic Switch (Immediate Process Halt)

This rehearsal log becomes part of your APRA disclosure pack.
"""

import os
import sys
from intelligence_bus.consumers.fraud_consumer import FraudConsumer


def test_kill_switch_1_environment():
    """Test Kill Switch 1: Environment Variable"""
    print("\n🧯 KILL SWITCH DRILL 1: Environment Variable")
    print("=" * 60)
    
    # Disable Fraud ML via environment variable
    os.environ["RISK_BRAIN_FRAUD_ENABLED"] = "false"
    
    consumer = FraudConsumer()
    event = {
        "event_type": "FraudRiskScoreProduced",
        "card_id": "CARD-TEST-001",
        "score_value": 0.95,
        "risk_band": "HIGH"
    }
    
    result = consumer.process(event)
    
    if result is None:
        print("✅ PASS: Fraud output = 0 (completely disabled)")
        return True
    else:
        print("❌ FAIL: Fraud still producing output despite env flag = false")
        return False


def test_kill_switch_2_governance():
    """Test Kill Switch 2: Protocol Governance Event"""
    print("\n🧯 KILL SWITCH DRILL 2: Protocol Governance Event")
    print("=" * 60)
    
    # Enable Fraud ML via environment variable (so we test governance kill only)
    os.environ["RISK_BRAIN_FRAUD_ENABLED"] = "true"
    
    consumer = FraudConsumer()
    
    # Trigger governance kill
    consumer.update_model_authority("SHADOW_DISABLED")
    
    event = {
        "event_type": "FraudRiskScoreProduced",
        "card_id": "CARD-TEST-002",
        "score_value": 0.92,
        "risk_band": "HIGH"
    }
    
    result = consumer.process(event)
    
    if result is None:
        print("✅ PASS: Fraud output = 0 (disabled by governance event)")
        return True
    else:
        print("❌ FAIL: Fraud still producing output despite governance kill")
        return False


def test_kill_switch_3_panic():
    """Test Kill Switch 3: Runtime Panic Switch"""
    print("\n🧯 KILL SWITCH DRILL 3: Runtime Panic Switch")
    print("=" * 60)
    
    # Enable Fraud ML via environment variable and governance
    os.environ["RISK_BRAIN_FRAUD_ENABLED"] = "true"
    
    consumer = FraudConsumer()
    consumer.update_model_authority("SHADOW_ADVISORY")
    
    try:
        # Trigger panic stop
        consumer.trigger_panic_stop("Test panic scenario - suspected Dark Graph compromise")
        print("❌ FAIL: Panic stop did not halt process")
        return False
    except SystemExit as e:
        if "PANIC STOP" in str(e):
            print(f"✅ PASS: Fraud Dark Graph process exited with panic stop - {e}")
            return True
        else:
            print(f"❌ FAIL: Unexpected exit - {e}")
            return False


def main():
    print("\n" + "=" * 60)
    print("🚨 FRAUD DARK GRAPH KILL SWITCH DRILL")
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
        print("You are cleared for live fraud shadow pilot.")
        return 0
    else:
        print("\n❌ KILL SWITCH DRILL FAILED")
        print("DO NOT PROCEED WITH LIVE PILOT until all switches pass.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
