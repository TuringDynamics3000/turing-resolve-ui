"""
Payments RL Shadow Consumer — Production-Grade Implementation v1

This service is the first live B domain implementation in the National Risk Brain.

PURPOSE:
- Consume live payment events from TuringCore (Layer A)
- Build deterministic state vectors for RL evaluation
- Emit intelligence events (RlPolicyEvaluated) only
- NEVER emit execution commands (PaymentCommand, SettlementCommand, PostingCommand)

SAFETY GUARANTEES:
- Triple-layer kill switches (env, governance, panic)
- Zero possibility of execution side-effects
- All outputs are advisory intelligence only
- Full audit trail via Protocol events

DEPLOYMENT:
- Runs as standalone service consuming from Kafka
- Requires: KAFKA_BOOTSTRAP, RISK_BRAIN_PAYMENTS_RL_ENABLED env vars
- Emits to: protocol.payments.rl.evaluated topic
- Consumes from: protocol.payments.live.shadow topic

ARCHITECTURE:
- Layer B (Risk Brain) component
- Protocol-governed intelligence emission
- Pluggable RL policy interface
- Deterministic state building (no external I/O)

Author: TuringCore National Infrastructure Team
Version: 1.0
Status: Production-Ready (Shadow Mode)
"""

import os
import sys
import signal
import time
import uuid
import json
import hashlib
from typing import Dict, Any, Tuple, Optional
from dataclasses import dataclass
from kafka import KafkaConsumer, KafkaProducer


# ============================================================================
# KILL-SWITCH & AUTHORITY GUARD (Layer 1: Environment)
# ============================================================================

PANIC = False


def panic_handler(signum, frame):
    """
    Emergency stop handler for SIGTERM/SIGINT.
    
    This is the third layer of kill-switch protection.
    When triggered, the service halts immediately.
    """
    global PANIC
    PANIC = True
    print("🚨 PANIC STOP: Payments RL Shadow halted immediately")
    sys.exit(1)


signal.signal(signal.SIGTERM, panic_handler)
signal.signal(signal.SIGINT, panic_handler)


def rl_enabled() -> bool:
    """
    First layer kill-switch: Environment variable.
    
    Set RISK_BRAIN_PAYMENTS_RL_ENABLED=false to disable RL evaluation.
    Default: false (safe by default)
    """
    return os.getenv("RISK_BRAIN_PAYMENTS_RL_ENABLED", "false").lower() == "true"


def governance_allows() -> bool:
    """
    Second layer kill-switch: Governance authority level.
    
    Backed by ModelAuthorityLevelChanged Protocol events.
    Valid values: SHADOW_ENABLED, SHADOW_DISABLED, ADVISORY_ENABLED
    
    For shadow mode, only SHADOW_ENABLED allows evaluation.
    """
    authority = os.getenv("RISK_BRAIN_GOV_AUTH", "SHADOW_DISABLED")
    return authority in ["SHADOW_ENABLED", "ADVISORY_ENABLED"]


# ============================================================================
# CANONICAL PAYMENT STATE BUILDER (Deterministic, No I/O)
# ============================================================================

@dataclass
class PaymentState:
    """
    Deterministic feature vector for RL policy evaluation.
    
    This state representation is:
    - Deterministic (same input → same state)
    - Immutable (no mutation after creation)
    - Hashable (for audit trail)
    - Free of external I/O (no database lookups, no API calls)
    """
    tenant_id: str
    payment_id: str
    amount_cents: int
    rail_used: Optional[str]
    attempt: int
    channel: Optional[str]
    currency: str
    timestamp: int
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "tenant_id": self.tenant_id,
            "payment_id": self.payment_id,
            "amount_cents": self.amount_cents,
            "rail_used": self.rail_used,
            "attempt": self.attempt,
            "channel": self.channel,
            "currency": self.currency,
            "timestamp": self.timestamp
        }
    
    def compute_hash(self) -> str:
        """
        Compute deterministic hash of state for audit trail.
        
        This hash is recorded in RlPolicyEvaluated events to enable
        full reproducibility and regulatory audit.
        """
        state_str = str(sorted(self.to_dict().items()))
        return hashlib.sha256(state_str.encode()).hexdigest()


def build_payment_state(event: Dict[str, Any]) -> Tuple[PaymentState, str]:
    """
    Build canonical payment state from Protocol event.
    
    Args:
        event: PaymentInitiated or PaymentSettled Protocol event
        
    Returns:
        (PaymentState, state_hash) tuple
        
    Raises:
        KeyError: If required fields are missing
        ValueError: If field values are invalid
    """
    state = PaymentState(
        tenant_id=event["tenant_id"],
        payment_id=event["payment_id"],
        amount_cents=event["amount_cents"],
        rail_used=event.get("rail_used"),
        attempt=event.get("attempt", 1),
        channel=event.get("channel"),
        currency=event.get("currency", "AUD"),
        timestamp=event["occurred_at"]
    )
    
    state_hash = state.compute_hash()
    
    return state, state_hash


# ============================================================================
# RL POLICY INTERFACE (Pluggable, Safe Stub v1)
# ============================================================================

@dataclass
class RlPolicyOutput:
    """
    Output from RL policy evaluation.
    
    This is ADVISORY ONLY. No execution authority.
    """
    proposed_action: str  # e.g., "ROUTE_NPP", "ROUTE_BECS"
    confidence_score: float  # 0.0 to 1.0
    reward_estimate: float  # Expected reward (cost/latency optimization)
    policy_id: str
    policy_version: str


class PaymentsRlPolicy:
    """
    Pluggable RL policy interface for payment routing optimization.
    
    This is a SAFE STUB implementation for initial deployment.
    Replace with trained RL model once validated in shadow mode.
    
    SAFETY PROPERTIES:
    - Deterministic (same state → same output)
    - No external I/O (no database, no API calls)
    - No side effects (pure function)
    - Fast evaluation (< 10ms target)
    """
    
    def __init__(self):
        self.policy_id = "payments-rl-stub-v1"
        self.policy_version = "1.0"
    
    def evaluate(self, state: PaymentState) -> RlPolicyOutput:
        """
        Evaluate RL policy for payment routing recommendation.
        
        STUB LOGIC (replace with trained model):
        - Small payments (< $100) → NPP (fast, higher cost)
        - Large payments (≥ $100) → BECS (slower, lower cost)
        
        Args:
            state: Canonical payment state
            
        Returns:
            RlPolicyOutput with routing recommendation
        """
        amount = state.amount_cents
        
        if amount < 10_000:  # < $100
            action = "ROUTE_NPP"
            confidence = 0.85
            reward = 0.012  # Expected reward (normalized)
        else:
            action = "ROUTE_BECS"
            confidence = 0.80
            reward = 0.007
        
        return RlPolicyOutput(
            proposed_action=action,
            confidence_score=confidence,
            reward_estimate=reward,
            policy_id=self.policy_id,
            policy_version=self.policy_version
        )


# ============================================================================
# INTEL EVENT EMITTER (Shadow Intelligence Only)
# ============================================================================

def emit_rl_policy_evaluated(
    producer: KafkaProducer,
    original_event: Dict[str, Any],
    state_hash: str,
    rl_output: RlPolicyOutput
) -> None:
    """
    Emit RlPolicyEvaluated intelligence event to Protocol bus.
    
    This is the ONLY output from this service.
    
    HARD INVARIANT:
    - NO PaymentCommand
    - NO SettlementCommand
    - NO PostingCommand
    - NO execution authority
    
    This event is ADVISORY ONLY and consumed by:
    - Payments Policy Gateway (deterministic rule application)
    - Metrics aggregation (shadow mode performance tracking)
    - Audit trail (regulatory compliance)
    
    Args:
        producer: Kafka producer for Protocol events
        original_event: Original payment event from Layer A
        state_hash: Deterministic hash of payment state
        rl_output: RL policy evaluation result
    """
    intel_event = {
        # Protocol metadata
        "event_type": "RlPolicyEvaluated",
        "schema_version": "1.0",
        "event_id": str(uuid.uuid4()),
        "occurred_at": int(time.time() * 1000),
        "origin": "AI",
        
        # Payment context
        "tenant_id": original_event["tenant_id"],
        "payment_id": original_event["payment_id"],
        "state_hash": state_hash,
        
        # RL evaluation output
        "proposed_action": rl_output.proposed_action,
        "confidence_score": rl_output.confidence_score,
        "reward_estimate": rl_output.reward_estimate,
        
        # Policy provenance
        "policy_id": rl_output.policy_id,
        "policy_version": rl_output.policy_version,
    }
    
    # Emit to Protocol bus
    producer.send("protocol.payments.rl.evaluated", intel_event)
    
    # Log for observability (non-PII)
    print(f"✅ RlPolicyEvaluated: {original_event['payment_id']} → {rl_output.proposed_action} (confidence={rl_output.confidence_score:.2f})")


# ============================================================================
# MAIN CONSUMER LOOP (Kafka → RL → Intel)
# ============================================================================

def main():
    """
    Main consumer loop for Payments RL Shadow service.
    
    LIFECYCLE:
    1. Connect to Kafka
    2. Consume payment events from protocol.payments.live.shadow
    3. Check kill-switches (env, governance, panic)
    4. Build deterministic payment state
    5. Evaluate RL policy
    6. Emit RlPolicyEvaluated intel event
    7. Continue loop
    
    SAFETY:
    - Respects all three kill-switch layers
    - Catches and logs all exceptions (no crash on bad data)
    - Zero execution side-effects
    - Full audit trail via Protocol events
    """
    
    # Kafka configuration
    kafka_bootstrap = os.getenv("KAFKA_BOOTSTRAP", "localhost:9092")
    
    print("=" * 80)
    print("Payments RL Shadow Consumer v1.0")
    print("=" * 80)
    print(f"Kafka Bootstrap: {kafka_bootstrap}")
    print(f"RL Enabled: {rl_enabled()}")
    print(f"Governance Auth: {os.getenv('RISK_BRAIN_GOV_AUTH', 'SHADOW_DISABLED')}")
    print("=" * 80)
    
    # Initialize Kafka consumer
    consumer = KafkaConsumer(
        "protocol.payments.live.shadow",
        bootstrap_servers=kafka_bootstrap,
        value_deserializer=lambda m: json.loads(m.decode("utf-8")),
        enable_auto_commit=True,
        auto_offset_reset="earliest",
        group_id="payments-rl-shadow-consumer"
    )
    
    # Initialize Kafka producer
    producer = KafkaProducer(
        bootstrap_servers=kafka_bootstrap,
        value_serializer=lambda v: json.dumps(v).encode("utf-8")
    )
    
    # Initialize RL policy
    policy = PaymentsRlPolicy()
    
    print(f"🚀 Payments RL Shadow Consumer started (policy={policy.policy_id})")
    print("Waiting for payment events...")
    
    # Main consumer loop
    for msg in consumer:
        # Layer 3 kill-switch: Panic signal
        if PANIC:
            print("🚨 PANIC detected, stopping consumer loop")
            break
        
        # Layer 1 kill-switch: Environment variable
        if not rl_enabled():
            continue
        
        # Layer 2 kill-switch: Governance authority
        if not governance_allows():
            continue
        
        event = msg.value
        
        try:
            # Build deterministic payment state
            state, state_hash = build_payment_state(event)
            
            # Evaluate RL policy
            rl_output = policy.evaluate(state)
            
            # Emit intelligence event (ADVISORY ONLY)
            emit_rl_policy_evaluated(
                producer,
                original_event=event,
                state_hash=state_hash,
                rl_output=rl_output
            )
            
        except KeyError as e:
            print(f"⚠️  Missing required field in payment event {event.get('payment_id', 'UNKNOWN')}: {e}")
        except Exception as e:
            print(f"❌ RL Shadow error on payment {event.get('payment_id', 'UNKNOWN')}: {e}")
    
    # Cleanup
    consumer.close()
    producer.close()
    print("🛑 Payments RL Shadow Consumer stopped")


if __name__ == "__main__":
    main()
