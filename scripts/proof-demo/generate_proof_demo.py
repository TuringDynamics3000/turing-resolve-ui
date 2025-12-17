#!/usr/bin/env python3
"""
TuringDynamics Proof Demo

This script demonstrates the complete verification flow:
1. Generate payment events with proper hashing
2. Build Merkle tree and seal batch
3. Sign root with Ed25519
4. Generate evidence pack
5. Output files for offline verification

Usage:
    python generate_proof_demo.py
    
Output:
    - evidence_pack.json (the pack to verify)
    - keys.json (public keys for verification)
    - batch_info.json (batch metadata)
"""

import json
import hashlib
import os
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

# Try to import cryptography for Ed25519
try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
    from cryptography.hazmat.primitives import serialization
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False
    print("Warning: cryptography not installed. Using mock signatures.")


# ============================================================
# CANONICAL JSON
# ============================================================

def canonical_json(obj: Any) -> bytes:
    """Serialize object to canonical JSON bytes."""
    def normalize(o):
        if isinstance(o, dict):
            return {k: normalize(o[k]) for k in sorted(o.keys())}
        if isinstance(o, list):
            return [normalize(x) for x in o]
        if isinstance(o, float):
            raise ValueError(f"Floats not allowed: {o}")
        return o
    
    normalized = normalize(obj)
    return json.dumps(normalized, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


# ============================================================
# HASHING
# ============================================================

def sha256(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def sha256_hex(data: bytes) -> str:
    return sha256(data).hex()


# ============================================================
# MERKLE TREE
# ============================================================

LEAF_PREFIX = b"\x00"
NODE_PREFIX = b"\x01"


def compute_leaf(event_digest: bytes) -> bytes:
    """Compute Merkle leaf: SHA256(0x00 || event_digest)"""
    return sha256(LEAF_PREFIX + event_digest)


def parent_hash(left: bytes, right: bytes) -> bytes:
    """Compute parent: SHA256(0x01 || left || right)"""
    return sha256(NODE_PREFIX + left + right)


def build_merkle_tree(leaves: list[bytes]) -> list[list[bytes]]:
    """Build complete Merkle tree, return all levels."""
    if not leaves:
        return []
    
    levels = [list(leaves)]
    current = leaves
    
    while len(current) > 1:
        next_level = []
        for i in range(0, len(current), 2):
            left = current[i]
            right = current[i + 1] if i + 1 < len(current) else current[i]
            next_level.append(parent_hash(left, right))
        levels.append(next_level)
        current = next_level
    
    return levels


def generate_proof(levels: list[list[bytes]], leaf_index: int) -> list[bytes]:
    """Generate inclusion proof for a leaf."""
    proof = []
    idx = leaf_index
    
    for level in levels[:-1]:
        if idx % 2 == 0:
            sibling_idx = idx + 1
            if sibling_idx < len(level):
                proof.append(level[sibling_idx])
            else:
                proof.append(level[idx])
        else:
            proof.append(level[idx - 1])
        idx //= 2
    
    return proof


# ============================================================
# ED25519 SIGNING
# ============================================================

def generate_keypair() -> tuple[bytes, bytes]:
    """Generate Ed25519 keypair. Returns (private_key, public_key)."""
    if CRYPTO_AVAILABLE:
        private_key = Ed25519PrivateKey.generate()
        public_key = private_key.public_key()
        
        priv_bytes = private_key.private_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PrivateFormat.Raw,
            encryption_algorithm=serialization.NoEncryption()
        )
        pub_bytes = public_key.public_bytes(
            encoding=serialization.Encoding.Raw,
            format=serialization.PublicFormat.Raw
        )
        return priv_bytes, pub_bytes
    else:
        # Mock for demo
        return os.urandom(32), os.urandom(32)


def sign_ed25519(private_key: bytes, message: bytes) -> bytes:
    """Sign message with Ed25519."""
    if CRYPTO_AVAILABLE:
        from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey
        pk = Ed25519PrivateKey.from_private_bytes(private_key)
        return pk.sign(message)
    else:
        # Mock signature for demo
        return sha256(private_key + message) + sha256(message + private_key)


# ============================================================
# EVENT GENERATION
# ============================================================

def create_payment_event(
    tenant_id: str,
    environment_id: str,
    stream_id: str,
    amount_cents: int,
    currency: str,
    from_account: str,
    to_account: str,
    event_version: int = 1,
) -> dict:
    """Create a payment event with all hashes computed."""
    event_id = str(uuid4())
    occurred_at = datetime.now(timezone.utc).isoformat()
    
    payload = {
        "amount_cents": amount_cents,
        "currency": currency,
        "from_account": from_account,
        "to_account": to_account,
        "reference": f"PAY-{event_id[:8].upper()}",
    }
    
    metadata = {
        "correlation_id": str(uuid4()),
        "actor_id": "system",
        "source": "proof-demo",
    }
    
    # Compute hashes
    payload_hash = sha256_hex(canonical_json(payload))
    meta_hash = sha256_hex(canonical_json(metadata))
    
    # event_digest = SHA256(event_id || payload_hash || meta_hash || occurred_at)
    digest_input = f"{event_id}{payload_hash}{meta_hash}{occurred_at}"
    event_digest = sha256_hex(digest_input.encode("utf-8"))
    
    # leaf_hash = SHA256(0x00 || event_digest)
    leaf_hash = sha256_hex(LEAF_PREFIX + bytes.fromhex(event_digest))
    
    return {
        "event_id": event_id,
        "tenant_id": tenant_id,
        "environment_id": environment_id,
        "stream_id": stream_id,
        "stream_type": "payment",
        "event_type": "PaymentExecuted",
        "event_version": event_version,
        "payload": payload,
        "metadata": metadata,
        "occurred_at": occurred_at,
        "payload_hash": payload_hash,
        "meta_hash": meta_hash,
        "event_digest": event_digest,
        "leaf_hash": leaf_hash,
    }


# ============================================================
# MAIN DEMO
# ============================================================

def main():
    print("=" * 60)
    print("  TURINGDYNAMICS PROOF DEMO")
    print("=" * 60)
    print()
    
    # Configuration
    tenant_id = "demo-tenant"
    environment_id = "staging"
    output_dir = os.path.dirname(os.path.abspath(__file__))
    
    # Generate signing keys
    print("[1/5] Generating Ed25519 signing keys...")
    policy_priv, policy_pub = generate_keypair()
    merkle_priv, merkle_pub = generate_keypair()
    
    keys = {
        "k-policy-demo": policy_pub.hex(),
        "k-merkle-root-demo": merkle_pub.hex(),
    }
    
    # Generate payment events
    print("[2/5] Generating payment events...")
    events = []
    for i in range(5):
        event = create_payment_event(
            tenant_id=tenant_id,
            environment_id=environment_id,
            stream_id=f"payment-{i+1}",
            amount_cents=(i + 1) * 10000,  # $100, $200, etc.
            currency="AUD",
            from_account=f"ACC-{1000 + i}",
            to_account=f"ACC-{2000 + i}",
            event_version=1,
        )
        events.append(event)
        print(f"    Event {i+1}: {event['event_id'][:8]}... amount=${event['payload']['amount_cents']//100}")
    
    # Build Merkle tree
    print("[3/5] Building Merkle tree and sealing batch...")
    leaf_hashes = [bytes.fromhex(e["leaf_hash"]) for e in events]
    levels = build_merkle_tree(leaf_hashes)
    root_hash = levels[-1][0]
    
    # Sign root
    root_signature = sign_ed25519(merkle_priv, root_hash)
    
    batch_id = str(uuid4())
    sealed_at = datetime.now(timezone.utc).isoformat()
    
    batch_info = {
        "batch_id": batch_id,
        "tenant_id": tenant_id,
        "environment_id": environment_id,
        "algo_version": "TD-MERKLE-v1-SHA256",
        "start_commit_seq": 1,
        "end_commit_seq": len(events),
        "event_count": len(events),
        "root_hash": root_hash.hex(),
        "root_signature": root_signature.hex(),
        "signing_key_id": "k-merkle-root-demo",
        "sealed_at": sealed_at,
        "anchor_type": "DEMO",
        "anchor_ref": f"demo://proof-demo/{batch_id}",
    }
    
    print(f"    Batch ID: {batch_id[:8]}...")
    print(f"    Root hash: {root_hash.hex()[:16]}...")
    
    # Create stub policy and model
    print("[4/5] Creating policy stub, model artifact, and evidence pack...")
    policy_bytecode = b"STUB_POLICY_BYTECODE_V0"
    policy_bytecode_hash = sha256(policy_bytecode)
    policy_signature = sign_ed25519(policy_priv, policy_bytecode_hash)
    
    # Create model artifact (simulating a credit scoring model)
    model_priv, model_pub = generate_keypair()
    model_artifact = b"STUB_MODEL_ARTIFACT_CREDIT_SCORING_V1"
    model_artifact_hash = sha256(model_artifact)
    model_signature = sign_ed25519(model_priv, model_artifact_hash)
    
    # Add model key to keys dict
    keys["k-model-demo"] = model_pub.hex()
    
    # Generate evidence pack
    pack_events = []
    for i, event in enumerate(events):
        proof = generate_proof(levels, i)
        pack_events.append({
            "event_id": event["event_id"],
            "event_type": event["event_type"],
            "occurred_at": event["occurred_at"],
            "leaf_hash": event["leaf_hash"],
            "merkle_proof": {
                "batch_id": batch_id,
                "leaf_index": i,
                "siblings": [s.hex() for s in proof],
                "root_hash": root_hash.hex(),
                "root_signature": root_signature.hex(),
                "signing_key_id": "k-merkle-root-demo",
                "anchor_type": "DEMO",
                "anchor_ref": f"demo://proof-demo/{batch_id}",
            },
        })
    
    evidence_pack = {
        "schema": "TD:EVIDENCEPACK:v1",
        "pack_id": f"evp_{uuid4()}",
        "decision_id": f"dec_{uuid4()}",
        "tenant_id": tenant_id,
        "environment_id": environment_id,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        
        "policy": {
            "policy_id": "payments.authorize.v0",
            "version": "demo-1.0.0",
            "bytecode_hash": policy_bytecode_hash.hex(),
            "signature": policy_signature.hex(),
            "key_id": "k-policy-demo",
        },
        
        "model": {
            "model_id": "credit.scoring.v1",
            "version": "2024.12.1",
            "artifact_hash": model_artifact_hash.hex(),
            "signature": model_signature.hex(),
            "key_id": "k-model-demo",
            "domain_type": "CREDIT",
            "status": "PRODUCTION",
            "feature_schema_id": "credit.features.v1",
            "feature_schema_version": "1.0.0",
        },
        
        "inputs": {
            "feature_snapshot_hash": sha256_hex(b"demo-features"),
            "feature_schema_id": "payments.v1",
            "feature_schema_version": "1.0.0",
        },
        
        "decision_trace": {
            "trace_hash": sha256_hex(b"demo-trace"),
            "trace_schema": "TD:TRACE:v1",
        },
        
        "actions": {
            "recommended": "APPROVE",
            "gated": "permit",
            "executed": "APPROVE",
        },
        
        "events": pack_events,
    }
    
    # Compute evidence pack hash
    pack_hash = sha256_hex(canonical_json(evidence_pack))
    evidence_pack["evidence_pack_hash"] = pack_hash
    
    # Write output files
    print("[5/5] Writing output files...")
    
    with open(os.path.join(output_dir, "evidence_pack.json"), "w") as f:
        json.dump(evidence_pack, f, indent=2)
    
    with open(os.path.join(output_dir, "keys.json"), "w") as f:
        json.dump(keys, f, indent=2)
    
    with open(os.path.join(output_dir, "batch_info.json"), "w") as f:
        json.dump(batch_info, f, indent=2)
    
    with open(os.path.join(output_dir, "events.json"), "w") as f:
        json.dump(events, f, indent=2)
    
    print()
    print("=" * 60)
    print("  OUTPUT FILES")
    print("=" * 60)
    print(f"  evidence_pack.json  - The pack to verify")
    print(f"  keys.json           - Public keys for verification")
    print(f"  batch_info.json     - Merkle batch metadata")
    print(f"  events.json         - Raw events with hashes")
    print()
    print("=" * 60)
    print("  NEXT: VERIFY WITH td_verify")
    print("=" * 60)
    print()
    print("  cd packages/td_verify")
    print("  pip install -e .")
    print("  python -m td_verify ../../scripts/proof-demo/evidence_pack.json \\")
    print("                      ../../scripts/proof-demo/keys.json")
    print()


if __name__ == "__main__":
    main()
