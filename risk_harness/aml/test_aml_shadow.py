"""
AML Shadow CI Harness — Red/Green Gate for AML Shadow v1

This harness validates that AML Shadow maintains safety invariants under all conditions.

PURPOSE:
- CI red/green gate for AML Shadow
- Assert no execution commands (AI origin blocker)
- Assert schema stability (schema version guard)
- Assert policy provenance (policy gateway validator)
- AUSTRAC compliance (no SMR/TTR/IFTI lodgement)

SAFETY GUARANTEES:
- CI fails if AI attempts execution
- CI fails if schema drift detected
- CI fails if unapproved policy source detected
- CI fails if AI attempts AUSTRAC report lodgement

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (CI Harness)
"""

import pytest
import json
import uuid
import time
from typing import List, Dict, Any, Tuple

# Import AML components
import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from aml_models.behavioural import AmlBehaviourModel
from domains.aml.policy_gateway import (
    evaluate_aml_policy,
    AmlRiskScoreEvent,
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
# SYNTHETIC AML EVENT GENERATION
# ============================================================================

def generate_synthetic_aml_events(count: int) -> List[Dict[str, Any]]:
    """
    Generate synthetic AML events for testing.
    
    Args:
        count: Number of events to generate
        
    Returns:
        List of TransactionPosted events
    """
    events = []
    
    for i in range(count):
        # Vary amount, channel, jurisdiction to create diverse test cases
        amount_cents = 1000 + (i * 500) % 100000
        channel = ["BRANCH", "API", "CARD", "NPP"][i % 4]
        jurisdiction = ["AU", "US", "GB", "SG", "CN"][i % 5]
        geo_bucket = f"AU-{['NSW', 'VIC', 'QLD', 'WA', 'SA'][i % 5]}"
        
        event = {
            "event_type": "TransactionPosted",
            "schema_version": "1.0",
            "event_id": str(uuid.uuid4()),
            
            "tenant_id": "CU-TEST",
            "customer_id_hash": f"cust_test_{i}",
            "account_id_hash": f"acct_test_{i}",
            "counterparty_hash": f"cp_test_{i % 20}",
            "amount_cents": amount_cents,
            "currency": "AUD",
            "channel": channel,
            "geo_bucket": geo_bucket,
            "jurisdiction": jurisdiction,
            
            "origin": "CORE",
            "occurred_at": int(time.time() * 1000) + i
        }
        
        events.append(event)
    
    return events


# ============================================================================
# AML SHADOW REPLAY
# ============================================================================

def replay_aml_shadow(events: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], bool]:
    """
    Replay AML shadow pipeline with synthetic events.
    
    Args:
        events: List of TransactionPosted events
        
    Returns:
        Tuple of (aml_flags, forbidden_detected)
    """
    model = AmlBehaviourModel()
    aml_flags = []
    forbidden_detected = False
    
    for event in events:
        # Stage 1: AML model scoring (Layer B)
        features = model.build_features(event)
        risk_score = model.score(features)
        
        # Create AmlRiskScoreProduced event
        aml_score_event = {
            "event_type": "AmlRiskScoreProduced",
            "schema_version": "1.0",
            "event_id": str(uuid.uuid4()),
            
            "tenant_id": event["tenant_id"],
            "customer_id_hash": event["customer_id_hash"],
            "account_id_hash": event["account_id_hash"],
            "risk_score": risk_score,
            "risk_band": "HIGH" if risk_score >= 0.85 else "MEDIUM" if risk_score >= 0.70 else "LOW",
            
            "model_id": model.model_id,
            "model_version": model.model_version,
            "feature_set_version": model.feature_set_version,
            "confidence_interval": [max(risk_score - 0.05, 0.0), min(risk_score + 0.05, 1.0)],
            
            "origin": "AI",
            "occurred_at": int(time.time() * 1000)
        }
        
        # Stage 2: Policy gateway evaluation (Layer A)
        aml_score_obj = AmlRiskScoreEvent(
            tenant_id=aml_score_event["tenant_id"],
            customer_id_hash=aml_score_event["customer_id_hash"],
            account_id_hash=aml_score_event["account_id_hash"],
            risk_score=aml_score_event["risk_score"],
            risk_band=aml_score_event["risk_band"],
            model_id=aml_score_event["model_id"],
            model_version=aml_score_event["model_version"],
            occurred_at=aml_score_event["occurred_at"]
        )
        
        flag = evaluate_aml_policy(aml_score_obj)
        
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
                
                aml_flags.append(flag)
            
            except (SchemaVersionViolation, PolicyGatewayViolation, AiOriginViolation):
                # CRITICAL: Enforcement violation detected
                forbidden_detected = True
                break
        
        # Check for forbidden commands in original event
        if event.get("command_type") in FORBIDDEN_COMMAND_TYPES:
            forbidden_detected = True
            break
    
    return aml_flags, forbidden_detected


# ============================================================================
# CI HARNESS TESTS
# ============================================================================

def test_aml_shadow_pipeline():
    """
    Test AML shadow pipeline with synthetic events.
    
    CRITICAL ASSERTIONS:
    - No forbidden commands detected (especially SMR/TTR/IFTI)
    - At least some AML flags produced (model is working)
    """
    # Generate synthetic events
    events = generate_synthetic_aml_events(200)
    
    # Replay AML shadow pipeline
    flags, forbidden = replay_aml_shadow(events)
    
    # CRITICAL: No forbidden commands (AUSTRAC compliance)
    assert forbidden is False, "🚨 FATAL: AI ATTEMPTED AML ENFORCEMENT"
    
    # SANITY: At least some AML flags produced
    assert len(flags) > 0, "❌ NO AML FLAGS PRODUCED (model may be broken)"
    
    print(f"✅ AML shadow pipeline test passed: {len(flags)} flags from {len(events)} events")


def test_aml_model_scoring():
    """Test AML model produces valid risk scores."""
    model = AmlBehaviourModel()
    
    # Test event (high-value international transaction)
    event = {
        "amount_cents": 50000,
        "channel": "BRANCH",
        "geo_bucket": "AU-NSW",
        "jurisdiction": "CN",
        "counterparty_hash": "cp_test_1"
    }
    
    features = model.build_features(event)
    score = model.score(features)
    
    # Assert valid score range
    assert 0.0 <= score <= 1.0, f"Invalid risk score: {score}"
    
    print(f"✅ AML model scoring test passed: score={score:.4f}")


def test_aml_policy_gateway():
    """Test AML policy gateway produces valid flags."""
    # High-risk event
    high_risk_event = AmlRiskScoreEvent(
        tenant_id="CU-TEST",
        customer_id_hash="cust_test",
        account_id_hash="acct_test",
        risk_score=0.92,
        risk_band="HIGH",
        model_id="aml-behaviour-v1",
        model_version="1.0",
        occurred_at=int(time.time() * 1000)
    )
    
    flag = evaluate_aml_policy(high_risk_event)
    
    # Assert flag raised
    assert flag is not None, "No flag raised for high-risk event"
    assert flag["event_type"] == "AmlRiskFlagRaised"
    assert flag["risk_band"] == "HIGH"
    assert flag["policy_id"] == "aml-policy-v1"
    
    # Low-risk event
    low_risk_event = AmlRiskScoreEvent(
        tenant_id="CU-TEST",
        customer_id_hash="cust_test",
        account_id_hash="acct_test",
        risk_score=0.30,
        risk_band="LOW",
        model_id="aml-behaviour-v1",
        model_version="1.0",
        occurred_at=int(time.time() * 1000)
    )
    
    flag = evaluate_aml_policy(low_risk_event)
    
    # Assert no flag raised
    assert flag is None, "Flag raised for low-risk event"
    
    print("✅ AML policy gateway test passed")


def test_aml_enforcement_blocks_austrac_reports():
    """Test enforcement layer blocks AUSTRAC report lodgement."""
    # Forbidden command (SubmitSmr)
    forbidden_event = {
        "event_type": "SubmitSmr",
        "schema_version": "1.0",
        "customer_id_hash": "cust_test",
        "origin": "AI"
    }
    
    # Should raise AiOriginViolation
    with pytest.raises(AiOriginViolation, match="FATAL SAFETY VIOLATION"):
        enforce_ai_origin_block(forbidden_event)
    
    print("✅ AML enforcement test passed: SubmitSmr blocked")


def test_aml_enforcement_allows_advisory():
    """Test enforcement layer allows advisory events."""
    # Advisory event (AmlRiskFlagRaised)
    advisory_event = {
        "event_type": "AmlRiskFlagRaised",
        "schema_version": "1.0",
        "policy_id": "aml-policy-v1",
        "origin": "AI"
    }
    
    # Should not raise exception
    enforce_schema_version(advisory_event)
    enforce_policy_origin(advisory_event)
    enforce_ai_only_advisory(advisory_event)
    enforce_ai_origin_block(advisory_event)
    
    print("✅ AML enforcement test passed: AmlRiskFlagRaised allowed")


def test_aml_enforcement_blocks_all_austrac_commands():
    """Test enforcement layer blocks all AUSTRAC commands."""
    austrac_commands = ["SubmitSmr", "SubmitTtr", "SubmitIfti"]
    
    for command in austrac_commands:
        forbidden_event = {
            "event_type": command,
            "schema_version": "1.0",
            "origin": "AI"
        }
        
        with pytest.raises(AiOriginViolation, match="FATAL SAFETY VIOLATION"):
            enforce_ai_origin_block(forbidden_event)
    
    print(f"✅ AML enforcement test passed: All AUSTRAC commands blocked ({len(austrac_commands)} commands)")


# ============================================================================
# CI ENTRY POINT
# ============================================================================

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
