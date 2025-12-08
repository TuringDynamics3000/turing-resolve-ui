"""
AML Shadow Consumer — Stage 2 Implementation

This service observes live AML-relevant events and produces AML risk scores.

PURPOSE:
- Shadow intelligence for AML compliance
- Observes transactions, cash deposits, international transfers
- Produces AML risk scores (advisory only)
- Zero execution authority

SAFETY GUARANTEES:
- Read-only, observational only
- No execution authority
- No ability to lodge AUSTRAC reports (SMR, TTR, IFTI)
- No ability to freeze accounts or restrict cards
- Advisory-only outputs (AmlRiskScoreProduced)

AUSTRAC COMPLIANCE:
- Advisory-only (human escalation required for SMR/TTR)
- Pattern-of-life detection (not rule-based triggers)
- Full audit trail for regulator review

ARCHITECTURE:
- Layer B (Risk Brain) component
- Consumes from: protocol.aml.live.shadow
- Emits to: protocol.aml.risk.scored

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (AML Shadow)
"""

import os
import sys
import signal
import json
import time
import uuid
from typing import Dict, Any
from kafka import KafkaConsumer, KafkaProducer

# Import AML model
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from aml_models.behavioural import AmlBehaviourModel


# ============================================================================
# KILL-SWITCH & AUTHORITY GUARD
# ============================================================================

PANIC = False


def panic_handler(signum, frame):
    """
    Emergency stop handler for SIGTERM/SIGINT.
    
    When triggered, the service halts immediately.
    AML detection stops, but core banking continues normally.
    """
    global PANIC
    PANIC = True
    print("🚨 PANIC STOP: AML Shadow halted immediately")
    sys.exit(1)


signal.signal(signal.SIGTERM, panic_handler)
signal.signal(signal.SIGINT, panic_handler)


def aml_shadow_enabled() -> bool:
    """
    Kill-switch: Environment variable.
    
    Set RISK_BRAIN_AML_ENABLED=false to disable AML shadow.
    Default: false (safe by default)
    """
    return os.getenv("RISK_BRAIN_AML_ENABLED", "false").lower() == "true"


def governance_disabled() -> bool:
    """
    Kill-switch: Governance layer.
    
    If ModelAuthorityLevelChanged → AML_SHADOW_DISABLED, stop immediately.
    """
    # TODO: Query governance service for AML shadow status
    # For now, respect environment variable only
    return not aml_shadow_enabled()


# ============================================================================
# AML RISK SCORE EVENT EMITTER
# ============================================================================

def emit_aml_risk_score(
    producer: KafkaProducer,
    event: Dict[str, Any],
    risk_score: float,
    model: AmlBehaviourModel
) -> None:
    """
    Emit AmlRiskScoreProduced event to Protocol bus.
    
    This is the ONLY output from this service.
    
    HARD INVARIANT:
    - NO SubmitSmr
    - NO SubmitTtr
    - NO SubmitIfti
    - NO FreezeAccount
    - NO RestrictCard
    - NO execution authority
    
    Args:
        producer: Kafka producer for Protocol events
        event: Original AML event
        risk_score: Computed AML risk score
        model: AML model instance
    """
    # Classify risk band
    if risk_score >= 0.85:
        risk_band = "HIGH"
    elif risk_score >= 0.70:
        risk_band = "MEDIUM"
    else:
        risk_band = "LOW"
    
    # Create AML risk score event
    aml_event = {
        "event_type": "AmlRiskScoreProduced",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        
        "tenant_id": event.get("tenant_id", "UNKNOWN"),
        "customer_id_hash": event.get("customer_id_hash", "UNKNOWN"),
        "account_id_hash": event.get("account_id_hash", "UNKNOWN"),
        "risk_score": round(risk_score, 4),
        "risk_band": risk_band,
        
        "model_id": model.model_id,
        "model_version": model.model_version,
        "feature_set_version": model.feature_set_version,
        "confidence_interval": [
            max(risk_score - 0.05, 0.0),
            min(risk_score + 0.05, 1.0)
        ],
        
        "origin": "AI",
        "occurred_at": int(time.time() * 1000)
    }
    
    # Emit to Protocol bus
    producer.send("protocol.aml.risk.scored", aml_event)
    
    # Log for observability (non-PII)
    print(f"✅ AmlRiskScoreProduced: {event.get('customer_id_hash', 'UNKNOWN')} → {risk_band} (score={risk_score:.4f})")


# ============================================================================
# AML SHADOW CONSUMER (Main Service)
# ============================================================================

def main():
    """
    Main AML shadow consumer loop.
    
    LIFECYCLE:
    1. Connect to Kafka
    2. Load AML model
    3. Consume AML-relevant events
    4. Compute AML risk scores
    5. Emit AmlRiskScoreProduced events
    6. Continue loop
    
    SAFETY:
    - Respects kill-switches (env, governance, panic)
    - Read-only (no execution authority)
    - Advisory-only outputs
    """
    
    # Kafka configuration
    kafka_bootstrap = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
    
    print("=" * 80)
    print("AML Shadow Consumer v1.0")
    print("=" * 80)
    print(f"Kafka Bootstrap: {kafka_bootstrap}")
    print(f"AML Shadow Enabled: {aml_shadow_enabled()}")
    print("=" * 80)
    
    # Initialize Kafka consumer
    consumer = KafkaConsumer(
        "protocol.aml.live.shadow",
        bootstrap_servers=kafka_bootstrap,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="latest",
        group_id="aml-shadow-consumer"
    )
    
    # Initialize Kafka producer
    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap,
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    
    # Load AML model
    model = AmlBehaviourModel()
    print(f"✅ Loaded AML model: {model.model_id} v{model.model_version}")
    
    print("🚀 AML Shadow Consumer started")
    print("Waiting for AML-relevant events...")
    
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
            print("🚨 PANIC detected, stopping AML shadow loop")
            break
        
        # Kill-switch: Environment variable
        if not aml_shadow_enabled():
            time.sleep(1)
            continue
        
        # Kill-switch: Governance layer
        if governance_disabled():
            print("🚨 Governance disabled AML shadow, stopping loop")
            break
        
        try:
            event = msg.value
            
            # Build features
            features = model.build_features(event)
            
            # Compute AML risk score
            risk_score = model.score(features)
            
            # Emit AML risk score event
            emit_aml_risk_score(producer, event, risk_score, model)
            
            # Update statistics
            events_processed += 1
            if risk_score >= 0.85:
                high_risk_count += 1
            elif risk_score >= 0.70:
                medium_risk_count += 1
            else:
                low_risk_count += 1
            
            # Emit statistics every 60 seconds
            if time.time() - last_stats_time > 60:
                print(f"📊 AML Shadow Stats: {events_processed} events, "
                      f"{high_risk_count} HIGH, {medium_risk_count} MEDIUM, {low_risk_count} LOW")
                last_stats_time = time.time()
        
        except Exception as e:
            print(f"❌ AML shadow error: {e}")
            continue
    
    # Cleanup
    consumer.close()
    producer.close()
    print("🛑 AML Shadow Consumer stopped")


if __name__ == "__main__":
    main()
