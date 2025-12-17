"""
TuringDynamics Evidence Pack Verifier (td_verify)

A standalone Python package for offline verification of TuringDynamics
evidence packs, Merkle proofs, and cryptographic signatures.

Usage:
    from td_verify import verify_evidence_pack, VerifyResult
    
    result = verify_evidence_pack(pack_dict, key_lookup)
    print("OK" if result.ok else "FAIL", result.errors)

CLI:
    python -m td_verify pack.json keys.json
"""

from .evidence_pack import verify_evidence_pack, VerifyResult
from .merkle import verify_inclusion, compute_leaf, parent_hash
from .sig import verify_ed25519
from .hash import sha256
from .canonical_json import dumps_canonical

__version__ = "1.0.0"
__all__ = [
    "verify_evidence_pack",
    "VerifyResult",
    "verify_inclusion",
    "compute_leaf",
    "parent_hash",
    "verify_ed25519",
    "sha256",
    "dumps_canonical",
]
