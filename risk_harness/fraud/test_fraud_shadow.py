"""
Fraud Shadow CI Harness — Red/Green Gate for Fraud Shadow v1

This harness validates that Fraud Shadow maintains safety invariants under all conditions.

PURPOSE:
- CI red/green gate for Fraud Shadow
- Assert no execution commands (AI origin blocker)
- Assert schema stability (schema version guard)
- Assert policy provenance (policy gateway validator)

SAFETY GUARANTEES:
- CI fails if AI attempts execution
- CI fails if schema drift detected
- CI fails if unapproved policy source detected

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (CI Harness)
"""

import pytest
import json
import uuid
import time
from typing import List, Dict, Any, Tuple

# Import fraud components
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from fraud_models.behavioural import FraudBehaviourModel
from domains.fraud.policy_gateway import (
    evaluate_fraud_policy,
    FraudRiskScoreEvent,
    FORBIDDEN_COMMAND_TYPES
)
from enforcement.ai_origin_blocker import (
    enforce_ai_origin_block,
    enforce_ai_only_advisory,
    AiOriginViolation
)
from enforcement.schema_version_guard import (
    enforce_schema_version,
    SchemaVersionViolation
)
from enforcement.policy_gateway_validator import (
    enforce_policy_origin,
    PolicyGatewayViolation
)


# ============================================================================
# SYNTHETIC FRAUD EVENT GENERATION
# ============================================================================

def generate_synthetic_fraud_events(count: int) -> List[Dict[str, Any]]:
    """
    Generate synthetic fraud events for testing.
    
    Args:
        count: Number of events to generate
        
    Returns:
        List of CardAuthorisationRequested events
    """
    events = []
    
    for i in range(count):
        # Vary amount, channel, geo to create diverse test cases
        amount_cents = 1000 + (i * 100) % 50000
        channel = "ECOMM" if i % 2 == 0 else "POS"
        geo_bucket = f"AU-{['NSW', 'VIC', 'QLD', 'WA', 'SA'][i % 5]}"
        
        event = {
            "event_type": "CardAuthorisationRequested",
            "schema_version": "1.0",
            "event_id": str(uuid.uuid4()),
            
            "tenant_id": "CU-TEST",
            "card_id_hash": f"card_test_{i}",
            "account_id_hash": f"acct_test_{i}",
            "merchant_id_hash": f"merchant_test_{i % 10}",
            "amount_cents": amount_cents,
            "currency": "AUD",
            "geo_bucket": geo_bucket,
            "device_id_hash": f"device_test_{i % 20}",
            "ip_cluster": f"asn{i % 5}-au",
            "channel": channel,
            
            "origin": "CORE",
            "occurred_at": int(time.time() * 1000) + i
        }
        
        events.append(event)
    
    return events


# ============================================================================
# FRAUD SHADOW REPLAY
# ============================================================================

def replay_fraud_shadow(events: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Replay fraud shadow pipeline with synthetic events.
    
    Args:
        events: List of CardAuthorisationRequested events
        
    Returns:
        Tuple of (fraud_flags, forbidden_detected)
    """
    model = FraudBehaviourModel()
    fraud_flags = []
    forbidden_detected = False
    
    for event in events:
        # Stage 1: Fraud model scoring (Layer B)
        features = model.build_features(event)
        risk_score = model.score(features)
        
        # Create FraudRiskScoreProduced event
        fraud_score_event = {
            "event_type": "FraudRiskScoreProduced",
            "schema_version": "1.0",
            "event_id": str(uuid.uuid4()),
            
            "tenant_id": event["tenant_id"],
            "account_id_hash": event["account_id_hash"],
            "card_id_hash": event["card_id_hash"],
            "risk_score": risk_score,
            "risk_band": "HIGH" if risk_score >= 0.85 else "MEDIUM" if risk_score >= 0.65 else "LOW",
            
            "model_id": model.model_id,
            "model_version": model.model_version,
            "feature_set_version": model.feature_set_version,
            "confidence_interval": [max(risk_score - 0.05, 0.0), min(risk_score + 0.05, 1.0)],
            
            "origin": "AI",
            "occurred_at": int(time.time() * 1000)
        }
        
        # Stage 2: Policy gateway evaluation (Layer A)
        fraud_score_obj = FraudRiskScoreEvent(
            tenant_id=fraud_score_event["tenant_id"],
            account_id_hash=fraud_score_event["account_id_hash"],
            card_id_hash=fraud_score_event["card_id_hash"],
            risk_score=fraud_score_event["risk_score"],
            risk_band=fraud_score_event["risk_band"],
            model_id=fraud_score_event["model_id"],
            model_version=fraud_score_event["model_version"],
            occurred_at=fraud_score_event["occurred_at"]
        )
        
        flag = evaluate_fraud_policy(fraud_score_obj)
        
        if flag is not None:
            # Stage 3: Enforcement checks
            try:
                # Check schema version
                enforce_schema_version(flag)
                
                # Check policy origin
                enforce_policy_origin(flag)
                
                # Check AI advisory-only constraint
                enforce_ai_only_advisory(flag)
                
                # Check AI origin blocker (FINAL CHECK)
                enforce_ai_origin_block(flag)
                
                fraud_flags.append(flag)
            
            except (SchemaVersionViolation, PolicyGatewayViolation, AiOriginViolation):
                # CRITICAL: Enforcement violation detected
                forbidden_detected = True
                break
        
        # Check for forbidden commands in original event
        if event.get("command_type") in FORBIDDEN_COMMAND_TYPES:
            forbidden_detected = True
            break
    
    return fraud_flags, forbidden_detected


# ============================================================================
# CI HARNESS TESTS
# ============================================================================

def test_fraud_shadow_pipeline():
    """
    Test fraud shadow pipeline with synthetic events.
    
    CRITICAL ASSERTIONS:
    - No forbidden commands detected
    - At least some fraud flags produced (model is working)
    """
    # Generate synthetic events
    events = generate_synthetic_fraud_events(100)
    
    # Replay fraud shadow pipeline
    flags, forbidden = replay_fraud_shadow(events)
    
    # CRITICAL: No forbidden commands
    assert forbidden is False, "🚨 FATAL: AI ATTEMPTED EXECUTION"
    
    # SANITY: At least some fraud flags produced
    assert len(flags) > 0, "❌ NO FRAUD FLAGS PRODUCED (model may be broken)"
    
    print(f"✅ Fraud shadow pipeline test passed: {len(flags)} flags from {len(events)} events")


def test_fraud_model_scoring():
    """Test fraud model produces valid risk scores."""
    model = FraudBehaviourModel()
    
    # Test event
    event = {
        "amount_cents": 50000,
        "channel": "ECOMM",
        "geo_bucket": "US-CA",
        "device_id_hash": "device_test_1",
        "merchant_id_hash": "merchant_test_1"
    }
    
    features = model.build_features(event)
    score = model.score(features)
    
    # Assert valid score range
    assert 0.0 <= score <= 1.0, f"Invalid risk score: {score}"
    
    print(f"✅ Fraud model scoring test passed: score={score:.4f}")


def test_fraud_policy_gateway():
    """Test fraud policy gateway produces valid flags."""
    # High-risk event
    high_risk_event = FraudRiskScoreEvent(
        tenant_id="CU-TEST",
        account_id_hash="acct_test",
        card_id_hash="card_test",
        risk_score=0.92,
        risk_band="HIGH",
        model_id="fraud-behaviour-v1",
        model_version="1.0",
        occurred_at=int(time.time() * 1000)
    )
    
    flag = evaluate_fraud_policy(high_risk_event)
    
    # Assert flag raised
    assert flag is not None, "No flag raised for high-risk event"
    assert flag["event_type"] == "FraudRiskFlagRaised"
    assert flag["risk_band"] == "HIGH"
    assert flag["policy_id"] == "fraud-policy-v1"
    
    # Low-risk event
    low_risk_event = FraudRiskScoreEvent(
        tenant_id="CU-TEST",
        account_id_hash="acct_test",
        card_id_hash="card_test",
        risk_score=0.30,
        risk_band="LOW",
        model_id="fraud-behaviour-v1",
        model_version="1.0",
        occurred_at=int(time.time() * 1000)
    )
    
    flag = evaluate_fraud_policy(low_risk_event)
    
    # Assert no flag raised
    assert flag is None, "Flag raised for low-risk event"
    
    print("✅ Fraud policy gateway test passed")


def test_fraud_enforcement_blocks_execution():
    """Test enforcement layer blocks execution commands."""
    # Forbidden command (BlockCard)
    forbidden_event = {
        "event_type": "BlockCard",
        "schema_version": "1.0",
        "card_id_hash": "card_test",
        "origin": "AI"
    }
    
    # Should raise AiOriginViolation
    with pytest.raises(AiOriginViolation, match="FATAL SAFETY VIOLATION"):
        enforce_ai_origin_block(forbidden_event)
    
    print("✅ Fraud enforcement test passed: BlockCard blocked")


def test_fraud_enforcement_allows_advisory():
    """Test enforcement layer allows advisory events."""
    # Advisory event (FraudRiskFlagRaised)
    advisory_event = {
        "event_type": "FraudRiskFlagRaised",
        "schema_version": "1.0",
        "policy_id": "fraud-policy-v1",
        "origin": "AI"
    }
    
    # Should not raise exception
    enforce_schema_version(advisory_event)
    enforce_policy_origin(advisory_event)
    enforce_ai_only_advisory(advisory_event)
    enforce_ai_origin_block(advisory_event)
    
    print("✅ Fraud enforcement test passed: FraudRiskFlagRaised allowed")


# ============================================================================
# CI ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
