"""
Fraud Shadow Consumer — Stage 2 Implementation

This service observes live fraud-relevant events and produces fraud risk scores.

PURPOSE:
- Shadow intelligence for fraud detection
- Observes card authorizations, account logins
- Produces fraud risk scores (advisory only)
- Zero execution authority

SAFETY GUARANTEES:
- Read-only, observational only
- No execution authority
- No ability to block cards, freeze accounts, or decline transactions
- Advisory-only outputs (FraudRiskScoreProduced)

ARCHITECTURE:
- Layer B (Risk Brain) component
- Consumes from: protocol.fraud.live.shadow
- Emits to: protocol.fraud.risk.scored

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Fraud Shadow)
"""

import os
import sys
import signal
import json
import time
import uuid
from typing import Dict, Any
from kafka import KafkaConsumer, KafkaProducer

# Import fraud model
sys.path.append(os.path.dirname(os.path.dirname(os.path.dirname(__file__))))
from fraud_models.behavioural import FraudBehaviourModel


# ============================================================================
# KILL-SWITCH & AUTHORITY GUARD
# ============================================================================

PANIC = False


def panic_handler(signum, frame):
    """
    Emergency stop handler for SIGTERM/SIGINT.
    
    When triggered, the service halts immediately.
    Fraud detection stops, but core banking continues normally.
    """
    global PANIC
    PANIC = True
    print("🚨 PANIC STOP: Fraud Shadow halted immediately")
    sys.exit(1)


signal.signal(signal.SIGTERM, panic_handler)
signal.signal(signal.SIGINT, panic_handler)


def fraud_shadow_enabled() -> bool:
    """
    Kill-switch: Environment variable.
    
    Set RISK_BRAIN_FRAUD_ENABLED=false to disable fraud shadow.
    Default: false (safe by default)
    """
    return os.getenv("RISK_BRAIN_FRAUD_ENABLED", "false").lower() == "true"


def governance_disabled() -> bool:
    """
    Kill-switch: Governance layer.
    
    If ModelAuthorityLevelChanged → FRAUD_SHADOW_DISABLED, stop immediately.
    """
    # TODO: Query governance service for fraud shadow status
    # For now, respect environment variable only
    return not fraud_shadow_enabled()


# ============================================================================
# FRAUD RISK SCORE EVENT EMITTER
# ============================================================================

def emit_fraud_risk_score(
    producer: KafkaProducer,
    event: Dict[str, Any],
    risk_score: float,
    model: FraudBehaviourModel
) -> None:
    """
    Emit FraudRiskScoreProduced event to Protocol bus.
    
    This is the ONLY output from this service.
    
    HARD INVARIANT:
    - NO BlockCard
    - NO FreezeAccount
    - NO DeclineTransaction
    - NO execution authority
    
    Args:
        producer: Kafka producer for Protocol events
        event: Original fraud event
        risk_score: Computed fraud risk score
        model: Fraud model instance
    """
    # Classify risk band
    if risk_score >= 0.85:
        risk_band = "HIGH"
    elif risk_score >= 0.65:
        risk_band = "MEDIUM"
    else:
        risk_band = "LOW"
    
    # Create fraud risk score event
    fraud_event = {
        "event_type": "FraudRiskScoreProduced",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        
        "tenant_id": event.get("tenant_id", "UNKNOWN"),
        "account_id_hash": event.get("account_id_hash", "UNKNOWN"),
        "card_id_hash": event.get("card_id_hash"),
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
    producer.send("protocol.fraud.risk.scored", fraud_event)
    
    # Log for observability (non-PII)
    print(f"✅ FraudRiskScoreProduced: {event.get('card_id_hash', 'UNKNOWN')} → {risk_band} (score={risk_score:.4f})")


# ============================================================================
# FRAUD SHADOW CONSUMER (Main Service)
# ============================================================================

def main():
    """
    Main fraud shadow consumer loop.
    
    LIFECYCLE:
    1. Connect to Kafka
    2. Load fraud model
    3. Consume fraud-relevant events
    4. Compute fraud risk scores
    5. Emit FraudRiskScoreProduced events
    6. Continue loop
    
    SAFETY:
    - Respects kill-switches (env, governance, panic)
    - Read-only (no execution authority)
    - Advisory-only outputs
    """
    
    # Kafka configuration
    kafka_bootstrap = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
    
    print("=" * 80)
    print("Fraud Shadow Consumer v1.0")
    print("=" * 80)
    print(f"Kafka Bootstrap: {kafka_bootstrap}")
    print(f"Fraud Shadow Enabled: {fraud_shadow_enabled()}")
    print("=" * 80)
    
    # Initialize Kafka consumer
    consumer = KafkaConsumer(
        "protocol.fraud.live.shadow",
        bootstrap_servers=kafka_bootstrap,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="latest",
        group_id="fraud-shadow-consumer"
    )
    
    # Initialize Kafka producer
    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap,
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    
    # Load fraud model
    model = FraudBehaviourModel()
    print(f"✅ Loaded fraud model: {model.model_id} v{model.model_version}")
    
    print("🚀 Fraud Shadow Consumer started")
    print("Waiting for fraud-relevant events...")
    
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
            print("🚨 PANIC detected, stopping fraud shadow loop")
            break
        
        # Kill-switch: Environment variable
        if not fraud_shadow_enabled():
            time.sleep(1)
            continue
        
        # Kill-switch: Governance layer
        if governance_disabled():
            print("🚨 Governance disabled fraud shadow, stopping loop")
            break
        
        try:
            event = msg.value
            
            # Build features
            features = model.build_features(event)
            
            # Compute fraud risk score
            risk_score = model.score(features)
            
            # Emit fraud risk score event
            emit_fraud_risk_score(producer, event, risk_score, model)
            
            # Update statistics
            events_processed += 1
            if risk_score >= 0.85:
                high_risk_count += 1
            elif risk_score >= 0.65:
                medium_risk_count += 1
            else:
                low_risk_count += 1
            
            # Emit statistics every 60 seconds
            if time.time() - last_stats_time > 60:
                print(f"📊 Fraud Shadow Stats: {events_processed} events, "
                      f"{high_risk_count} HIGH, {medium_risk_count} MEDIUM, {low_risk_count} LOW")
                last_stats_time = time.time()
        
        except Exception as e:
            print(f"❌ Fraud shadow error: {e}")
            continue
    
    # Cleanup
    consumer.close()
    producer.close()
    print("🛑 Fraud Shadow Consumer stopped")


if __name__ == "__main__":
    main()
