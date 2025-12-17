# td_verify

**TuringDynamics Evidence Pack Verifier**

A standalone Python package for offline verification of TuringDynamics evidence packs, Merkle proofs, and cryptographic signatures.

## Installation

```bash
pip install td_verify
```

Or install from source:

```bash
cd packages/td_verify
pip install -e .
```

## Quick Start

### Python API

```python
import json
from td_verify import verify_evidence_pack

# Load evidence pack
with open("evidence_pack.json") as f:
    pack = json.load(f)

# Load public keys (key_id -> hex_public_key)
keys = {
    "k-policy-2026-01": bytes.fromhex("..."),
    "k-merkle-root-2026-01": bytes.fromhex("..."),
}

# Verify
result = verify_evidence_pack(pack, keys)

if result.ok:
    print("✓ Evidence pack verified successfully")
else:
    print("✗ Verification failed:")
    for error in result.errors:
        print(f"  - {error}")
```

### Command Line

```bash
# Basic verification
python -m td_verify pack.json keys.json

# Require anchoring
python -m td_verify pack.json keys.json --require-anchoring

# JSON output
python -m td_verify pack.json keys.json --json

# Verbose output
python -m td_verify pack.json keys.json -v
```

## Verification Checks

The verifier performs the following checks:

| Check | Error Code | Description |
|-------|------------|-------------|
| Pack hash | `EVIDENCE_PACK_HASH_MISMATCH` | SHA-256 of pack contents matches `evidence_pack_hash` |
| Policy signature | `POLICY_SIGNATURE_INVALID` | Ed25519 signature over `bytecode_hash` verifies |
| Model signature | `MODEL_SIGNATURE_INVALID` | Ed25519 signature over `artifact_hash` verifies (if present) |
| Merkle inclusion | `MERKLE_INCLUSION_FAIL:{event_id}` | Event's inclusion proof verifies against batch root |
| Root signature | `MERKLE_ROOT_SIG_INVALID:{batch_id}` | Ed25519 signature over `root_hash` verifies |
| Anchoring | `MERKLE_ROOT_NOT_ANCHORED:{batch_id}` | Anchor reference exists (if `--require-anchoring`) |

## Keys File Format

```json
{
  "k-policy-2026-01": "a1b2c3d4...",
  "k-merkle-root-2026-01": "e5f6a7b8...",
  "k-model-2026-01": "c9d0e1f2..."
}
```

Keys are hex-encoded Ed25519 public keys (32 bytes = 64 hex characters).

## Evidence Pack Schema

```json
{
  "schema": "TD:EVIDENCEPACK:v1",
  "pack_id": "evp_...",
  "decision_id": "dec_...",
  "tenant_id": "tenant_...",
  "environment_id": "prod",
  "generated_at": "2024-12-18T00:00:00Z",
  
  "policy": {
    "policy_id": "credit.dti_limit",
    "version": "2026.01.0",
    "bytecode_hash": "abc123...",
    "signature": "def456...",
    "key_id": "k-policy-2026-01"
  },
  
  "model": {
    "model_id": "credit.scorer",
    "version": "2026.02.1",
    "artifact_hash": "789abc...",
    "signature": "012def...",
    "key_id": "k-model-2026-01"
  },
  
  "inputs": {
    "feature_snapshot_hash": "...",
    "feature_schema_id": "credit.v1",
    "feature_schema_version": "1.0.0"
  },
  
  "decision_trace": {
    "trace_hash": "...",
    "trace_schema": "TD:TRACE:v1"
  },
  
  "actions": {
    "recommended": "APPROVE",
    "gated": "permit",
    "executed": "APPROVE"
  },
  
  "events": [
    {
      "event_id": "evt_...",
      "event_type": "LoanApproved",
      "occurred_at": "2024-12-18T00:00:00Z",
      "leaf_hash": "...",
      "merkle_proof": {
        "batch_id": "batch_...",
        "leaf_index": 42,
        "siblings": ["...", "..."],
        "root_hash": "...",
        "root_signature": "...",
        "signing_key_id": "k-merkle-root-2026-01",
        "anchor_type": "WORM",
        "anchor_ref": "s3://bucket/roots/2024-12-18/..."
      }
    }
  ],
  
  "evidence_pack_hash": "..."
}
```

## Development

```bash
# Install dev dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Type checking
mypy td_verify

# Linting
ruff check td_verify
```

## License

Proprietary - TuringDynamics
