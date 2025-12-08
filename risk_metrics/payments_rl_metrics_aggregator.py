"""
Payments RL Metrics Aggregator — Stage 4 Implementation

This service joins RL advisories with actual payment outcomes to produce operational metrics.

PURPOSE:
- Join RlPolicyEvaluated with PaymentSettled events
- Compute delta metrics (latency, cost, retry avoidance)
- Emit PaymentsRlAdvisoryMetric for monitoring
- Enable Ops visibility and board reporting

SAFETY GUARANTEES:
- Read-only, observational only
- No execution authority
- No impact on payment processing
- Advisory-only metrics

ARCHITECTURE:
- Metrics Aggregation component
- Consumes from: protocol.payments.rl.evaluated, protocol.payments.settlements
- Emits to: protocol.payments.rl.advisory.metrics

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Metrics Stream)
"""

import os
import sys
import signal
import json
import time
from typing import Dict, Any, Optional
from collections import defaultdict
from kafka import KafkaConsumer, KafkaProducer


# ============================================================================
# KILL-SWITCH
# ============================================================================

PANIC = False


def panic_handler(signum, frame):
    """
    Emergency stop handler for SIGTERM/SIGINT.
    
    When triggered, the service halts immediately.
    Payments continue normally (no impact).
    """
    global PANIC
    PANIC = True
    print("🚨 PANIC STOP: Metrics Aggregator halted immediately")
    sys.exit(1)


signal.signal(signal.SIGTERM, panic_handler)
signal.signal(signal.SIGINT, panic_handler)


def metrics_aggregator_enabled() -> bool:
    """
    Kill-switch: Environment variable.
    
    Set RISK_BRAIN_METRICS_AGGREGATOR_ENABLED=false to disable metrics aggregator.
    Default: false (safe by default)
    """
    return os.getenv("RISK_BRAIN_METRICS_AGGREGATOR_ENABLED", "false").lower() == "true"


# ============================================================================
# METRICS EVENT SCHEMA
# ============================================================================

def create_payments_rl_advisory_metric(
    payment_id: str,
    tenant_id: str,
    account_id_hash: str,
    rl_event: Dict[str, Any],
    settlement_event: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Create PaymentsRlAdvisoryMetric event.
    
    This is the canonical metrics event for Payments RL Shadow.
    
    Args:
        payment_id: Payment ID
        tenant_id: Tenant ID
        account_id_hash: Hashed account ID (no PII)
        rl_event: RlPolicyEvaluated event
        settlement_event: PaymentSettled event
        
    Returns:
        PaymentsRlAdvisoryMetric event dictionary
    """
    # Extract RL recommendation
    rl_recommended_rail = rl_event.get("proposed_action", "").replace("ROUTE_", "")
    rl_confidence = rl_event.get("confidence_score", 0.0)
    rl_reward = rl_event.get("reward_estimate", 0.0)
    
    # Extract actual outcome
    actual_rail = settlement_event.get("rail_used", "UNKNOWN")
    actual_latency_ms = settlement_event.get("latency_ms")
    actual_cost_cents = settlement_event.get("network_cost_cents")
    actual_retry_count = settlement_event.get("retry_count", 0)
    actual_outcome = settlement_event.get("final_outcome", "SETTLED")
    
    # Compute delta
    delta = compute_delta(
        rl_recommended_rail,
        actual_rail,
        rl_reward,
        actual_latency_ms,
        actual_retry_count,
        actual_cost_cents
    )
    
    return {
        "event_type": "PaymentsRlAdvisoryMetric",
        "schema_version": "1.0",
        "event_id": settlement_event.get("event_id", ""),
        
        "tenant_id": tenant_id,
        "payment_id": payment_id,
        "account_id_hash": account_id_hash,
        "occurred_at": int(time.time() * 1000),
        
        "rl": {
            "recommended_rail": rl_recommended_rail,
            "confidence_score": rl_confidence,
            "reward_estimate": rl_reward
        },
        
        "actual": {
            "rail_used": actual_rail,
            "latency_ms": actual_latency_ms,
            "network_cost_cents": actual_cost_cents,
            "retry_count": actual_retry_count,
            "final_outcome": actual_outcome
        },
        
        "delta": delta
    }


# ============================================================================
# DELTA COMPUTATION
# ============================================================================

def compute_delta(
    rl_recommended_rail: str,
    actual_rail: str,
    rl_reward: float,
    actual_latency_ms: Optional[int],
    actual_retry_count: int,
    actual_cost_cents: Optional[float]
) -> Dict[str, Any]:
    """
    Compute delta metrics between RL recommendation and actual outcome.
    
    This is a simple v1 implementation. Future versions can add:
    - Counterfactual latency estimation
    - Cost model refinement
    - Retry probability modeling
    
    Args:
        rl_recommended_rail: RL recommended payment rail
        actual_rail: Actual payment rail used
        rl_reward: RL reward estimate
        actual_latency_ms: Actual latency in milliseconds
        actual_retry_count: Actual retry count
        actual_cost_cents: Actual network cost in cents
        
    Returns:
        Delta dictionary with direction classification
    """
    # Simple v1 direction classification based on reward estimate
    # Positive reward = RL would have been better
    # Negative reward = RL would have been worse
    # Zero reward = Neutral
    
    direction = "NEUTRAL"
    if rl_reward > 0.01:  # Threshold for "better"
        direction = "RL_BETTER"
    elif rl_reward < -0.01:  # Threshold for "worse"
        direction = "RL_WORSE"
    
    # For v1, we don't have exact counterfactual deltas
    # These will be populated in future versions with:
    # - Historical latency data by rail
    # - Cost models by rail
    # - Retry probability by rail
    
    return {
        "latency_ms_delta": None,  # Future: estimate counterfactual latency
        "retry_delta": None,        # Future: estimate retry probability
        "cost_cents_delta": None,   # Future: estimate cost difference
        "direction": direction
    }


# ============================================================================
# METRICS AGGREGATOR (Main Service)
# ============================================================================

def main():
    """
    Main metrics aggregator loop.
    
    LIFECYCLE:
    1. Connect to Kafka
    2. Consume RlPolicyEvaluated events
    3. Consume PaymentSettled events
    4. Join by payment_id
    5. Emit PaymentsRlAdvisoryMetric events
    6. Continue loop
    
    SAFETY:
    - Respects kill-switch
    - Read-only (no execution authority)
    - No impact on payment processing
    """
    
    # Kafka configuration
    kafka_bootstrap = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
    
    print("=" * 80)
    print("Payments RL Metrics Aggregator v1.0")
    print("=" * 80)
    print(f"Kafka Bootstrap: {kafka_bootstrap}")
    print(f"Metrics Aggregator Enabled: {metrics_aggregator_enabled()}")
    print("=" * 80)
    
    # Initialize Kafka consumers
    rl_consumer = KafkaConsumer(
        "protocol.payments.rl.evaluated",
        bootstrap_servers=kafka_bootstrap,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="earliest",
        group_id="payments-rl-metrics-aggregator"
    )
    
    settlement_consumer = KafkaConsumer(
        "protocol.payments.settlements",
        bootstrap_servers=kafka_bootstrap,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="earliest",
        group_id="payments-rl-metrics-aggregator"
    )
    
    # Initialize Kafka producer
    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap,
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    
    print("🚀 Payments RL Metrics Aggregator started")
    print("Waiting for RL evaluations and settlements...")
    
    # In-memory join state
    # In production, use a stateful stream processor (Kafka Streams, Flink, etc.)
    rl_by_payment = {}
    settlements_by_payment = {}
    
    # Statistics
    metrics_emitted = 0
    last_stats_time = time.time()
    
    # Main aggregator loop
    # NOTE: This is a simplified implementation for demonstration
    # In production, use separate threads or a stream processor
    while True:
        # Kill-switch: Panic signal
        if PANIC:
            print("🚨 PANIC detected, stopping aggregator loop")
            break
        
        # Kill-switch: Environment variable
        if not metrics_aggregator_enabled():
            time.sleep(1)
            continue
        
        # Consume RL evaluations (batch)
        rl_messages = rl_consumer.poll(timeout_ms=1000, max_records=100)
        for topic_partition, messages in rl_messages.items():
            for msg in messages:
                rl_event = msg.value
                payment_id = rl_event.get("payment_id")
                if payment_id:
                    rl_by_payment[payment_id] = rl_event
        
        # Consume settlements (batch)
        settlement_messages = settlement_consumer.poll(timeout_ms=1000, max_records=100)
        for topic_partition, messages in settlement_messages.items():
            for msg in messages:
                settlement_event = msg.value
                payment_id = settlement_event.get("payment_id")
                if payment_id:
                    settlements_by_payment[payment_id] = settlement_event
        
        # Join by payment_id
        common_payment_ids = set(rl_by_payment.keys()) & set(settlements_by_payment.keys())
        
        for payment_id in common_payment_ids:
            rl_event = rl_by_payment.pop(payment_id)
            settlement_event = settlements_by_payment.pop(payment_id)
            
            try:
                # Create metrics event
                metric_event = create_payments_rl_advisory_metric(
                    payment_id=payment_id,
                    tenant_id=settlement_event.get("tenant_id", "UNKNOWN"),
                    account_id_hash=settlement_event.get("account_id_hash", "UNKNOWN"),
                    rl_event=rl_event,
                    settlement_event=settlement_event
                )
                
                # Emit metrics event
                producer.send("protocol.payments.rl.advisory.metrics", metric_event)
                
                metrics_emitted += 1
                
                # Log for observability (non-PII)
                print(f"✅ PaymentsRlAdvisoryMetric: {payment_id} | "
                      f"RL: {metric_event['rl']['recommended_rail']} | "
                      f"Actual: {metric_event['actual']['rail_used']} | "
                      f"Direction: {metric_event['delta']['direction']}")
                
            except Exception as e:
                print(f"❌ Metrics aggregation error for payment {payment_id}: {e}")
        
        # Emit statistics every 60 seconds
        if time.time() - last_stats_time > 60:
            print(f"📊 Metrics Aggregator Stats: {metrics_emitted} metrics emitted, "
                  f"{len(rl_by_payment)} pending RL events, "
                  f"{len(settlements_by_payment)} pending settlements")
            last_stats_time = time.time()
        
        # Clean up old events (older than 1 hour)
        # In production, use TTL in stream processor
        current_time = int(time.time() * 1000)
        for payment_id in list(rl_by_payment.keys()):
            if current_time - rl_by_payment[payment_id].get("occurred_at", 0) > 3600000:
                rl_by_payment.pop(payment_id)
        
        for payment_id in list(settlements_by_payment.keys()):
            if current_time - settlements_by_payment[payment_id].get("occurred_at", 0) > 3600000:
                settlements_by_payment.pop(payment_id)
    
    # Cleanup
    rl_consumer.close()
    settlement_consumer.close()
    producer.close()
    print("🛑 Payments RL Metrics Aggregator stopped")


if __name__ == "__main__":
    main()
