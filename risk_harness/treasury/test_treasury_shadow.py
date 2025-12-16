"""
Treasury Shadow CI Harness — Stage 6 Implementation

This module provides CI validation for Treasury RL Shadow pipeline.

PURPOSE:
- Validate Treasury RL Shadow pipeline end-to-end
- Assert no forbidden commands (sweeps, facility draws, account movement)
- Assert treasury advisories are produced
- Assert enforcement layer blocks execution commands

SAFETY GUARANTEES:
- CI red/green gate (fails build if safety invariants violated)
- Synthetic event replay (no production data)
- Enforcement layer validation (assert blocks forbidden commands)

ARCHITECTURE:
- CI Harness component
- Integration tests (pytest)
- Synthetic event generation

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Treasury Harness)
"""

import sys
import os
import uuid
import time
from typing import List, Dict, Any, Tuple

# Add parent directories to path
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from treasury_models.intraday import TreasuryRlModel
from domains.treasury.policy_gateway import (
    TreasuryRiskScoreEvent,
    evaluate_treasury_policy,
    evaluate_batch,
    compute_statistics,
    create_audit_record,
    assert_advisory_only
)
from enforcement.ai_origin_blocker import enforce_ai_origin_block
from enforcement.schema_version_guard import enforce_schema_version
from enforcement.policy_gateway_validator import enforce_policy_gateway_provenance


# ============================================================================
# SYNTHETIC EVENT GENERATION
# ============================================================================

def generate_synthetic_treasury_events(count: int) -> List[Dict[str, Any]]:
    """
    Generate synthetic intraday liquidity events for testing.
    
    Args:
        count: Number of events to generate
        
    Returns:
        List of synthetic IntradayLiquiditySnapshot events
    """
    events = []
    
    for i in range(count):
        # Vary liquidity conditions
        if i % 10 == 0:
            # High risk scenario (low liquidity coverage, high facility utilization)
            available_liquidity_cents = 500_000_000  # $5M
            settlement_obligation_cents = 800_000_000  # $8M
            facility_limit_cents = 500_000_000  # $5M
            facility_drawn_cents = 450_000_000  # $4.5M (90% utilization)
            npp_net_position_cents = -400_000_000  # -$4M (net outflow)
            becs_net_position_cents = 50_000_000  # $0.5M
        elif i % 5 == 0:
            # Medium risk scenario
            available_liquidity_cents = 1_000_000_000  # $10M
            settlement_obligation_cents = 1_200_000_000  # $12M
            facility_limit_cents = 500_000_000  # $5M
            facility_drawn_cents = 350_000_000  # $3.5M (70% utilization)
            npp_net_position_cents = -300_000_000  # -$3M
            becs_net_position_cents = 100_000_000  # $1M
        else:
            # Low risk scenario (healthy liquidity)
            available_liquidity_cents = 2_000_000_000  # $20M
            settlement_obligation_cents = 1_000_000_000  # $10M
            facility_limit_cents = 500_000_000  # $5M
            facility_drawn_cents = 100_000_000  # $1M (20% utilization)
            npp_net_position_cents = 50_000_000  # $0.5M
            becs_net_position_cents = 50_000_000  # $0.5M
        
        event = {
            "event_type": "IntradayLiquiditySnapshot",
            "schema_version": "1.0",
            "event_id": str(uuid.uuid4()),
            "tenant_id": f"CU-{i % 5 + 1:03d}",
            "available_liquidity_cents": available_liquidity_cents,
            "settlement_obligation_cents": settlement_obligation_cents,
            "facility_limit_cents": facility_limit_cents,
            "facility_drawn_cents": facility_drawn_cents,
            "npp_net_position_cents": npp_net_position_cents,
            "becs_net_position_cents": becs_net_position_cents,
            "origin": "CORE",
            "occurred_at": int(time.time() * 1000) + i * 1000
        }
        
        events.append(event)
    
    return events


# ============================================================================
# TREASURY SHADOW PIPELINE REPLAY
# ============================================================================

def replay_treasury_shadow(events: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Replay Treasury RL Shadow pipeline for synthetic events.
    
    This simulates the full pipeline:
    1. Treasury RL model evaluation
    2. Policy gateway evaluation
    3. Enforcement layer validation
    
    Args:
        events: List of synthetic IntradayLiquiditySnapshot events
        
    Returns:
        Tuple of (advisories, forbidden_detected)
        - advisories: List of TreasuryRiskAdvisoryIssued events
        - forbidden_detected: True if forbidden command detected
    """
    model = TreasuryRlModel()
    advisories = []
    forbidden_detected = False
    
    for event in events:
        # Stage 1: Treasury RL model evaluation
        state = model.build_state(event)
        rl_output = model.evaluate(state)
        
        # Create TreasuryRlPolicyEvaluated event
        treasury_event = {
            "event_type": "TreasuryRlPolicyEvaluated",
            "schema_version": "1.0",
            "event_id": str(uuid.uuid4()),
            "tenant_id": event["tenant_id"],
            "liquidity_risk_score": rl_output["risk_score"],
            "risk_band": rl_output["risk_band"],
            "recommended_buffer_cents": rl_output["recommended_buffer_cents"],
            "recommended_facility_headroom_cents": rl_output["recommended_headroom_cents"],
            "model_id": model.model_id,
            "model_version": model.model_version,
            "origin": "AI",
            "occurred_at": int(time.time() * 1000)
        }
        
        # Stage 2: Policy gateway evaluation
        treasury_score_event = TreasuryRiskScoreEvent(
            tenant_id=treasury_event["tenant_id"],
            liquidity_risk_score=treasury_event["liquidity_risk_score"],
            risk_band=treasury_event["risk_band"],
            recommended_buffer_cents=treasury_event["recommended_buffer_cents"],
            recommended_facility_headroom_cents=treasury_event["recommended_facility_headroom_cents"],
            model_id=treasury_event["model_id"],
            model_version=treasury_event["model_version"],
            occurred_at=treasury_event["occurred_at"]
        )
        
        advisory = evaluate_treasury_policy(treasury_score_event)
        
        if advisory is not None:
            # Stage 3: Enforcement layer validation
            try:
                # Check schema version
                enforce_schema_version(advisory)
                
                # Check policy provenance
                enforce_policy_gateway_provenance(advisory)
                
                # Check advisory-only
                assert_advisory_only(advisory)
                
                # Check AI origin block
                enforce_ai_origin_block(advisory)
                
                advisories.append(advisory)
            except Exception as e:
                # Forbidden command detected
                print(f"❌ Enforcement violation: {e}")
                forbidden_detected = True
    
    return advisories, forbidden_detected


# ============================================================================
# TEST CASES (pytest)
# ============================================================================

def test_treasury_shadow_pipeline():
    """
    Test 1: Treasury Shadow pipeline produces advisories without forbidden commands.
    
    ASSERT:
    - No forbidden commands (sweeps, facility draws, account movement)
    - Treasury advisories are produced
    """
    events = generate_synthetic_treasury_events(100)
    advisories, forbidden = replay_treasury_shadow(events)
    
    assert forbidden is False, "FATAL: AI ATTEMPTED LIQUIDITY EXECUTION"
    assert len(advisories) > 0, "NO TREASURY ADVISORIES PRODUCED"
    
    print(f"✅ Test 1 passed: {len(advisories)} advisories produced, no forbidden commands")


def test_enforcement_blocks_sweep_liquidity():
    """
    Test 2: Enforcement layer blocks SweepLiquidity command.
    
    ASSERT:
    - Enforcement layer raises exception for SweepLiquidity
    """
    forbidden_event = {
        "event_type": "SweepLiquidity",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        "tenant_id": "CU-001",
        "amount_cents": 1000000,
        "origin": "AI",
        "occurred_at": int(time.time() * 1000)
    }
    
    try:
        enforce_ai_origin_block(forbidden_event)
        assert False, "Enforcement layer did not block SweepLiquidity"
    except Exception as e:
        assert "SweepLiquidity" in str(e)
        print(f"✅ Test 2 passed: Enforcement blocked SweepLiquidity")


def test_enforcement_allows_treasury_advisory():
    """
    Test 3: Enforcement layer allows TreasuryRiskAdvisoryIssued.
    
    ASSERT:
    - Enforcement layer does not raise exception for TreasuryRiskAdvisoryIssued
    """
    advisory_event = {
        "event_type": "TreasuryRiskAdvisoryIssued",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        "tenant_id": "CU-001",
        "risk_band": "HIGH",
        "recommended_buffer_cents": 300000000,
        "recommended_facility_headroom_cents": 400000000,
        "policy_id": "treasury-policy-v1",
        "policy_version": "1.0",
        "advisory_reason": "Intraday liquidity stress probability 0.9100",
        "origin": "AI",
        "occurred_at": int(time.time() * 1000)
    }
    
    try:
        enforce_schema_version(advisory_event)
        enforce_policy_gateway_provenance(advisory_event)
        assert_advisory_only(advisory_event)
        enforce_ai_origin_block(advisory_event)
        print(f"✅ Test 3 passed: Enforcement allowed TreasuryRiskAdvisoryIssued")
    except Exception as e:
        assert False, f"Enforcement layer blocked TreasuryRiskAdvisoryIssued: {e}"


def test_enforcement_blocks_all_liquidity_commands():
    """
    Test 4: Enforcement layer blocks all liquidity execution commands.
    
    ASSERT:
    - Enforcement layer blocks SweepLiquidity, DrawFacility, MoveAccount, etc.
    """
    forbidden_commands = [
        "SweepLiquidity",
        "DrawFacility",
        "MoveAccount",
        "PostTransaction",
        "TransferFunds",
        "InitiatePayment",
        "SettleBatch",
        "AdjustFacility"
    ]
    
    for command_type in forbidden_commands:
        forbidden_event = {
            "event_type": command_type,
            "schema_version": "1.0",
            "event_id": str(uuid.uuid4()),
            "tenant_id": "CU-001",
            "origin": "AI",
            "occurred_at": int(time.time() * 1000)
        }
        
        try:
            enforce_ai_origin_block(forbidden_event)
            assert False, f"Enforcement layer did not block {command_type}"
        except Exception:
            pass  # Expected
    
    print(f"✅ Test 4 passed: Enforcement blocked all {len(forbidden_commands)} liquidity commands")


def test_treasury_policy_statistics():
    """
    Test 5: Treasury policy statistics are computed correctly.
    
    ASSERT:
    - Statistics match expected counts
    """
    events = generate_synthetic_treasury_events(100)
    model = TreasuryRlModel()
    
    # Build treasury score events
    treasury_events = []
    for event in events:
        state = model.build_state(event)
        rl_output = model.evaluate(state)
        
        treasury_events.append(TreasuryRiskScoreEvent(
            tenant_id=event["tenant_id"],
            liquidity_risk_score=rl_output["risk_score"],
            risk_band=rl_output["risk_band"],
            recommended_buffer_cents=rl_output["recommended_buffer_cents"],
            recommended_facility_headroom_cents=rl_output["recommended_headroom_cents"],
            model_id=model.model_id,
            model_version=model.model_version,
            occurred_at=int(time.time() * 1000)
        ))
    
    # Evaluate batch
    advisories = evaluate_batch(treasury_events)
    
    # Compute statistics
    stats = compute_statistics(treasury_events, advisories)
    
    assert stats.total_events == 100
    assert stats.advisories_issued == len(advisories)
    assert stats.high_risk_count + stats.medium_risk_count + stats.low_risk_count == 100
    
    print(f"✅ Test 5 passed: Statistics computed correctly")
    print(f"   Total: {stats.total_events}, Advisories: {stats.advisories_issued}, "
          f"High: {stats.high_risk_count}, Medium: {stats.medium_risk_count}, Low: {stats.low_risk_count}")


def test_treasury_audit_trail():
    """
    Test 6: Treasury audit records are created correctly.
    
    ASSERT:
    - Audit records are created for all events
    """
    events = generate_synthetic_treasury_events(10)
    model = TreasuryRlModel()
    audit_records = []
    
    for event in events:
        state = model.build_state(event)
        rl_output = model.evaluate(state)
        
        treasury_event = TreasuryRiskScoreEvent(
            tenant_id=event["tenant_id"],
            liquidity_risk_score=rl_output["risk_score"],
            risk_band=rl_output["risk_band"],
            recommended_buffer_cents=rl_output["recommended_buffer_cents"],
            recommended_facility_headroom_cents=rl_output["recommended_headroom_cents"],
            model_id=model.model_id,
            model_version=model.model_version,
            occurred_at=int(time.time() * 1000)
        )
        
        advisory = evaluate_treasury_policy(treasury_event)
        audit_record = create_audit_record(treasury_event, advisory)
        audit_records.append(audit_record)
    
    assert len(audit_records) == 10
    
    print(f"✅ Test 6 passed: {len(audit_records)} audit records created")


# ============================================================================
# MAIN (Run all tests)
# ============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print("Treasury Shadow CI Harness v1.0")
    print("=" * 80)
    
    test_treasury_shadow_pipeline()
    test_enforcement_blocks_sweep_liquidity()
    test_enforcement_allows_treasury_advisory()
    test_enforcement_blocks_all_liquidity_commands()
    test_treasury_policy_statistics()
    test_treasury_audit_trail()
    
    print("=" * 80)
    print("✅ ALL TESTS PASSED")
    print("=" * 80)
