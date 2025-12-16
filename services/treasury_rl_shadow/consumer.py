"""
Treasury RL Shadow Consumer — Stage 2 Implementation

This service observes live intraday liquidity events and produces treasury risk scores.

PURPOSE:
- Shadow intelligence for intraday liquidity management
- Observes liquidity snapshots, settlement batches, facility rates
- Produces treasury risk scores (advisory only)
- Zero execution authority

SAFETY GUARANTEES:
- Read-only, observational only
- No execution authority
- No ability to move liquidity (sweeps, facility draws, account movement)
- Advisory-only outputs (TreasuryRlPolicyEvaluated)

ARCHITECTURE:
- Layer B (Risk Brain) component
- Consumes from: protocol.treasury.live.shadow
- Emits to: protocol.treasury.rl.scored

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Treasury RL Shadow)
"""

import os
import sys
import signal
import json
import time
import uuid
from typing import Dict, Any
from kafka import KafkaConsumer, KafkaProducer

# Import Treasury RL model
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from treasury_models.intraday import TreasuryRlModel


# ============================================================================
# KILL-SWITCH & AUTHORITY GUARD
# ============================================================================

PANIC = False


def panic_handler(signum, frame):
    """
    Emergency stop handler for SIGTERM/SIGINT.
    
    When triggered, the service halts immediately.
    Treasury RL detection stops, but core banking continues normally.
    """
    global PANIC
    PANIC = True
    print("🚨 PANIC STOP: Treasury RL Shadow halted immediately")
    sys.exit(1)


signal.signal(signal.SIGTERM, panic_handler)
signal.signal(signal.SIGINT, panic_handler)


def treasury_shadow_enabled() -> bool:
    """
    Kill-switch: Environment variable.
    
    Set RISK_BRAIN_TREASURY_ENABLED=false to disable treasury shadow.
    Default: false (safe by default)
    """
    return os.getenv("RISK_BRAIN_TREASURY_ENABLED", "false").lower() == "true"


def governance_disabled() -> bool:
    """
    Kill-switch: Governance layer.
    
    If ModelAuthorityLevelChanged → TREASURY_SHADOW_DISABLED, stop immediately.
    """
    # TODO: Query governance service for treasury shadow status
    # For now, respect environment variable only
    return not treasury_shadow_enabled()


# ============================================================================
# TREASURY RL POLICY EVENT EMITTER
# ============================================================================

def emit_treasury_rl_policy(
    producer: KafkaProducer,
    event: Dict[str, Any],
    rl_output: Dict[str, Any],
    model: TreasuryRlModel
) -> None:
    """
    Emit TreasuryRlPolicyEvaluated event to Protocol bus.
    
    This is the ONLY output from this service.
    
    HARD INVARIANT:
    - NO SweepLiquidity
    - NO DrawFacility
    - NO MoveAccount
    - NO PostTransaction
    - NO execution authority
    
    Args:
        producer: Kafka producer for Protocol events
        event: Original liquidity snapshot event
        rl_output: RL model output
        model: Treasury RL model instance
    """
    # Create Treasury RL policy event
    treasury_event = {
        "event_type": "TreasuryRlPolicyEvaluated",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        
        "tenant_id": event.get("tenant_id", "UNKNOWN"),
        "liquidity_risk_score": round(rl_output["risk_score"], 4),
        "risk_band": rl_output["risk_band"],
        
        "recommended_buffer_cents": rl_output["recommended_buffer_cents"],
        "recommended_facility_headroom_cents": rl_output["recommended_headroom_cents"],
        
        "model_id": model.model_id,
        "model_version": model.model_version,
        
        "origin": "AI",
        "occurred_at": int(time.time() * 1000)
    }
    
    # Emit to Protocol bus
    producer.send("protocol.treasury.rl.scored", treasury_event)
    
    # Log for observability (non-PII)
    print(f"✅ TreasuryRlPolicyEvaluated: {event.get('tenant_id', 'UNKNOWN')} → {rl_output['risk_band']} (score={rl_output['risk_score']:.4f})")


# ============================================================================
# TREASURY RL SHADOW CONSUMER (Main Service)
# ============================================================================

def main():
    """
    Main Treasury RL shadow consumer loop.
    
    LIFECYCLE:
    1. Connect to Kafka
    2. Load Treasury RL model
    3. Consume intraday liquidity events
    4. Compute treasury risk scores
    5. Emit TreasuryRlPolicyEvaluated events
    6. Continue loop
    
    SAFETY:
    - Respects kill-switches (env, governance, panic)
    - Read-only (no execution authority)
    - Advisory-only outputs
    """
    
    # Kafka configuration
    kafka_bootstrap = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
    
    print("=" * 80)
    print("Treasury RL Shadow Consumer v1.0")
    print("=" * 80)
    print(f"Kafka Bootstrap: {kafka_bootstrap}")
    print(f"Treasury Shadow Enabled: {treasury_shadow_enabled()}")
    print("=" * 80)
    
    # Initialize Kafka consumer
    consumer = KafkaConsumer(
        "protocol.treasury.live.shadow",
        bootstrap_servers=kafka_bootstrap,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="latest",
        group_id="treasury-rl-shadow-consumer"
    )
    
    # Initialize Kafka producer
    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap,
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    
    # Load Treasury RL model
    model = TreasuryRlModel()
    print(f"✅ Loaded Treasury RL model: {model.model_id} v{model.model_version}")
    
    print("🚀 Treasury RL Shadow Consumer started")
    print("Waiting for intraday liquidity events...")
    
    # Statistics
    events_processed = 0
    high_risk_count = 0
    medium_risk_count = 0
    low_risk_count = 0
    last_stats_time = time.time()
    
    # Main consumer loop
    for msg in consumer:
        # Kill-switch: Panic signal
        if PANIC:
            print("🚨 PANIC detected, stopping Treasury RL shadow loop")
            break
        
        # Kill-switch: Environment variable
        if not treasury_shadow_enabled():
            time.sleep(1)
            continue
        
        # Kill-switch: Governance layer
        if governance_disabled():
            print("🚨 Governance disabled Treasury RL shadow, stopping loop")
            break
        
        try:
            event = msg.value
            
            # Build state
            state = model.build_state(event)
            
            # Evaluate RL policy
            rl_output = model.evaluate(state)
            
            # Emit Treasury RL policy event
            emit_treasury_rl_policy(producer, event, rl_output, model)
            
            # Update statistics
            events_processed += 1
            risk_score = rl_output["risk_score"]
            if risk_score >= 0.85:
                high_risk_count += 1
            elif risk_score >= 0.65:
                medium_risk_count += 1
            else:
                low_risk_count += 1
            
            # Emit statistics every 60 seconds
            if time.time() - last_stats_time > 60:
                print(f"📊 Treasury RL Shadow Stats: {events_processed} events, "
                      f"{high_risk_count} HIGH, {medium_risk_count} MEDIUM, {low_risk_count} LOW")
                last_stats_time = time.time()
        
        except Exception as e:
            print(f"❌ Treasury RL shadow error: {e}")
            continue
    
    # Cleanup
    consumer.close()
    producer.close()
    print("🛑 Treasury RL Shadow Consumer stopped")


if __name__ == "__main__":
    main()
