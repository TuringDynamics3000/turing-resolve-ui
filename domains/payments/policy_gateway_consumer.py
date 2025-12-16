"""
Payments Policy Gateway Consumer — Stage 3 Implementation

This service consumes RL intelligence events and applies deterministic policy rules.

PURPOSE:
- Consume RlPolicyEvaluated events from Kafka
- Apply deterministic policy gateway rules
- Emit RlRoutingAdvisoryIssued events (ADVISORY ONLY)
- Maintain audit trail for regulatory compliance

SAFETY GUARANTEES:
- NO execution commands (enforced by policy_gateway.py)
- NO ledger access
- NO external I/O (except Kafka)
- Full audit trail

ARCHITECTURE:
- Layer A (TuringCore) component
- Consumes from: protocol.payments.rl.evaluated
- Emits to: protocol.payments.rl.advisory
- Uses: domains.payments.policy_gateway for deterministic rules

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Advisory Mode)
"""

import os
import sys
import signal
import json
import time
from typing import Dict, Any
from kafka import KafkaConsumer, KafkaProducer

# Import policy gateway
from policy_gateway import (
    evaluate_payments_rl_policy,
    evaluate_batch,
    compute_statistics,
    create_audit_record,
    RlPolicyEvaluatedEvent,
    assert_advisory_only,
    FORBIDDEN_COMMAND_TYPES
)

# Import enforcement layer
from enforced_policy_adapter import (
    enforce_payments_rl_advisory,
    enforce_with_audit,
    get_enforcement_statistics,
    AiOriginViolation,
    SchemaVersionViolation,
    PolicyGatewayViolation
)


# ============================================================================
# KILL-SWITCH & AUTHORITY GUARD
# ============================================================================

PANIC = False


def panic_handler(signum, frame):
    """
    Emergency stop handler for SIGTERM/SIGINT.
    
    When triggered, the service halts immediately.
    Payments continue normally in Layer A (no impact).
    """
    global PANIC
    PANIC = True
    print("🚨 PANIC STOP: Policy Gateway Consumer halted immediately")
    sys.exit(1)


signal.signal(signal.SIGTERM, panic_handler)
signal.signal(signal.SIGINT, panic_handler)


def policy_gateway_enabled() -> bool:
    """
    Kill-switch: Environment variable.
    
    Set RISK_BRAIN_POLICY_GATEWAY_ENABLED=false to disable policy gateway.
    Default: false (safe by default)
    """
    return os.getenv("RISK_BRAIN_POLICY_GATEWAY_ENABLED", "false").lower() == "true"


# ============================================================================
# ADVISORY EVENT EMITTER
# ============================================================================

def emit_advisory_event(
    producer: KafkaProducer,
    advisory_dict: Dict[str, Any]
) -> None:
    """
    Emit RlRoutingAdvisoryIssued event to Protocol bus.
    
    This is the ONLY output from this service.
    
    HARD INVARIANT:
    - NO PaymentCommand
    - NO SettlementCommand
    - NO PostingCommand
    - NO execution authority
    
    ENFORCEMENT LAYERS:
    1. enforce_payments_rl_advisory() - Runtime enforcement (schema, policy, AI origin)
    2. assert_advisory_only() - Legacy defense in depth
    
    Args:
        producer: Kafka producer for Protocol events
        advisory_dict: Advisory event dictionary
        
    Raises:
        SchemaVersionViolation: If schema version mismatch (FATAL)
        PolicyGatewayViolation: If unapproved policy source (FATAL)
        AiOriginViolation: If AI attempts forbidden action (FATAL)
    """
    # ENFORCEMENT LAYER: Runtime-enforced safety guarantees
    # This is the FINAL gate before Kafka emit
    # If this raises, the process dies (fail-fast)
    enforced_advisory = enforce_with_audit(advisory_dict)
    
    # Legacy defense in depth (should never fail if enforcement passed)
    assert_advisory_only(enforced_advisory)
    
    # Emit to Protocol bus
    producer.send("protocol.payments.rl.advisory", enforced_advisory)
    
    # Log for observability (non-PII)
    print(f"✅ RlRoutingAdvisoryIssued: {enforced_advisory['payment_id']} → {enforced_advisory['recommended_rail']} (confidence={enforced_advisory['confidence_score']:.2f})")


# ============================================================================
# AUDIT TRAIL EMITTER
# ============================================================================

def emit_audit_record(
    producer: KafkaProducer,
    audit_dict: Dict[str, Any]
) -> None:
    """
    Emit audit record to audit trail topic.
    
    This provides full traceability for regulatory review.
    
    Args:
        producer: Kafka producer for audit events
        audit_dict: Audit record dictionary
    """
    producer.send("protocol.payments.rl.audit", audit_dict)


# ============================================================================
# STATISTICS EMITTER
# ============================================================================

def emit_statistics(
    producer: KafkaProducer,
    stats_dict: Dict[str, Any]
) -> None:
    """
    Emit policy gateway statistics for monitoring.
    
    Args:
        producer: Kafka producer for metrics events
        stats_dict: Statistics dictionary
    """
    producer.send("protocol.payments.rl.metrics", stats_dict)
    
    print(f"📊 Policy Gateway Stats: {stats_dict['advisories_issued']}/{stats_dict['total_events']} advisories issued ({stats_dict['advisory_rate']:.1f}%)")


# ============================================================================
# MAIN CONSUMER LOOP
# ============================================================================

def main():
    """
    Main consumer loop for Policy Gateway service.
    
    LIFECYCLE:
    1. Connect to Kafka
    2. Consume RlPolicyEvaluated events from protocol.payments.rl.evaluated
    3. Check kill-switch
    4. Apply deterministic policy rules
    5. Emit RlRoutingAdvisoryIssued events (ADVISORY ONLY)
    6. Emit audit records
    7. Continue loop
    
    SAFETY:
    - Respects kill-switch
    - Catches and logs all exceptions (no crash on bad data)
    - Zero execution side-effects
    - Full audit trail
    """
    
    # Kafka configuration
    kafka_bootstrap = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
    
    print("=" * 80)
    print("Payments Policy Gateway Consumer v1.0")
    print("=" * 80)
    print(f"Kafka Bootstrap: {kafka_bootstrap}")
    print(f"Policy Gateway Enabled: {policy_gateway_enabled()}")
    print("=" * 80)
    
    # Initialize Kafka consumer
    consumer = KafkaConsumer(
        "protocol.payments.rl.evaluated",
        bootstrap_servers=kafka_bootstrap,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="earliest",
        group_id="payments-policy-gateway-consumer"
    )
    
    # Initialize Kafka producer
    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap,
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    
    print("🚀 Payments Policy Gateway Consumer started")
    print("Waiting for RL evaluation events...")
    
    # Statistics tracking
    batch = []
    batch_size = 100
    batch_start_time = time.time()
    
    # Main consumer loop
    for msg in consumer:
        # Kill-switch: Panic signal
        if PANIC:
            print("🚨 PANIC detected, stopping consumer loop")
            break
        
        # Kill-switch: Environment variable
        if not policy_gateway_enabled():
            continue
        
        event_dict = msg.value
        
        try:
            # Parse event
            event = RlPolicyEvaluatedEvent.from_dict(event_dict)
            
            # Apply deterministic policy rules
            advisory = evaluate_payments_rl_policy(event)
            
            if advisory is not None:
                # Emit advisory event (ADVISORY ONLY)
                emit_advisory_event(producer, advisory.to_dict())
                
                # Emit audit record
                audit = create_audit_record(event, advisory, "APPROVED")
                emit_audit_record(producer, audit.to_dict())
            else:
                # Determine rejection reason for audit
                if event.confidence_score < 0.70:
                    decision = "REJECTED_LOW_CONFIDENCE"
                elif abs(event.reward_estimate) > 0.20:
                    decision = "REJECTED_HIGH_VARIANCE"
                else:
                    decision = "REJECTED_INVALID_RAIL"
                
                # Emit audit record for rejection
                audit = create_audit_record(event, None, decision)
                emit_audit_record(producer, audit.to_dict())
            
            # Add to batch for statistics
            batch.append(event_dict)
            
            # Emit statistics every batch_size events or every 60 seconds
            if len(batch) >= batch_size or (time.time() - batch_start_time) > 60:
                advisories = evaluate_batch(batch)
                stats = compute_statistics(batch, advisories)
                
                # Get enforcement statistics
                enforcement_stats = get_enforcement_statistics()
                
                emit_statistics(producer, {
                    "timestamp": int(time.time() * 1000),
                    "total_events": stats.total_events,
                    "advisories_issued": stats.advisories_issued,
                    "rejected_low_confidence": stats.rejected_low_confidence,
                    "rejected_high_variance": stats.rejected_high_variance,
                    "rejected_invalid_rail": stats.rejected_invalid_rail,
                    "advisory_rate": stats.advisory_rate,
                    "rejection_rate": stats.rejection_rate,
                    # Enforcement statistics
                    "enforcement_checks": enforcement_stats["total_checks"],
                    "enforcement_pass_rate": enforcement_stats["pass_rate"],
                    "schema_violations": enforcement_stats["schema_violations"],
                    "policy_violations": enforcement_stats["policy_violations"],
                    "ai_origin_violations": enforcement_stats["ai_origin_violations"]
                })
                
                # Reset batch
                batch = []
                batch_start_time = time.time()
            
        except KeyError as e:
            print(f"⚠️  Missing required field in RL event {event_dict.get('payment_id', 'UNKNOWN')}: {e}")
        except ValueError as e:
            print(f"⚠️  Invalid data in RL event {event_dict.get('payment_id', 'UNKNOWN')}: {e}")
        except (SchemaVersionViolation, PolicyGatewayViolation, AiOriginViolation) as e:
            # CRITICAL: Enforcement violation detected
            print(f"🚨 CRITICAL ENFORCEMENT VIOLATION: {type(e).__name__}")
            print(f"🚨 {e}")
            print(f"🚨 Disabling Policy Gateway immediately")
            os.environ["RISK_BRAIN_POLICY_GATEWAY_ENABLED"] = "false"
            # Notify emergency contacts
            print(f"🚨 NOTIFY: APRA, AUSTRAC, board, insurers immediately")
            break
        except RuntimeError as e:
            # CRITICAL: Legacy forbidden command detected
            print(f"🚨 CRITICAL SAFETY BREACH: {e}")
            print(f"🚨 Disabling Policy Gateway immediately")
            os.environ["RISK_BRAIN_POLICY_GATEWAY_ENABLED"] = "false"
            break
        except Exception as e:
            print(f"❌ Policy Gateway error on event {event_dict.get('payment_id', 'UNKNOWN')}: {e}")
    
    # Cleanup
    consumer.close()
    producer.close()
    print("🛑 Payments Policy Gateway Consumer stopped")


if __name__ == "__main__":
    main()
