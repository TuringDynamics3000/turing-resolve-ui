"""
Evidence pack verification for TuringDynamics.

An evidence pack contains:
- Policy provenance (bytecode hash, signature)
- Model provenance (artifact hash, signature) - optional
- Input commitment (facts hash)
- Decision trace hash
- Events with Merkle inclusion proofs

Verification checks:
1. Evidence pack hash matches contents
2. Policy signature verifies against stored public key
3. Model signature verifies (if present)
4. All Merkle inclusion proofs verify against batch roots
5. All root signatures verify
6. Anchor references exist (optional online verification)
"""

import binascii
from dataclasses import dataclass, field
from typing import Any, Callable

from .canonical_json import dumps_canonical
from .hash import sha256
from .sig import verify_ed25519
from .merkle import verify_inclusion


def hex_to_bytes(h: str) -> bytes:
    """Convert hex string to bytes."""
    return binascii.unhexlify(h)


def bytes_to_hex(b: bytes) -> str:
    """Convert bytes to lowercase hex string."""
    return binascii.hexlify(b).decode("ascii")


@dataclass
class VerifyResult:
    """Result of evidence pack verification."""
    ok: bool
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    
    def __str__(self) -> str:
        status = "OK" if self.ok else "FAIL"
        parts = [status]
        if self.errors:
            parts.append(f"errors={self.errors}")
        if self.warnings:
            parts.append(f"warnings={self.warnings}")
        return " ".join(parts)


# Type alias for key lookup function
KeyLookup = dict[str, bytes]  # key_id -> public_key_bytes


def verify_evidence_pack(
    pack: dict[str, Any],
    key_lookup: KeyLookup,
    verify_anchoring: bool = False,
    anchor_verifier: Callable[[str, str], bool] | None = None,
) -> VerifyResult:
    """
    Verify a TuringDynamics evidence pack.
    
    Args:
        pack: Evidence pack dictionary (parsed from JSON)
        key_lookup: Mapping of key_id to public key bytes
        verify_anchoring: If True, verify anchor references exist
        anchor_verifier: Optional callback to verify anchor online
        
    Returns:
        VerifyResult with ok=True if all checks pass
        
    Example:
        >>> pack = json.load(open("evidence_pack.json"))
        >>> keys = {"k-policy-1": bytes.fromhex("...")}
        >>> result = verify_evidence_pack(pack, keys)
        >>> print("OK" if result.ok else "FAIL", result.errors)
    """
    errors: list[str] = []
    warnings: list[str] = []
    
    # 1) Verify evidence pack hash
    try:
        expected_hash = hex_to_bytes(pack["evidence_pack_hash"])
        pack_copy = dict(pack)
        pack_copy.pop("evidence_pack_hash", None)
        actual_hash = sha256(dumps_canonical(pack_copy))
        
        if actual_hash != expected_hash:
            errors.append("EVIDENCE_PACK_HASH_MISMATCH")
    except KeyError:
        errors.append("EVIDENCE_PACK_HASH_MISSING")
    except Exception as e:
        errors.append(f"EVIDENCE_PACK_HASH_ERROR:{e}")
    
    # 2) Verify policy signature
    try:
        pol = pack["policy"]
        policy_key_id = pol["key_id"]
        
        if policy_key_id not in key_lookup:
            errors.append(f"POLICY_KEY_NOT_FOUND:{policy_key_id}")
        else:
            pk_bytes = key_lookup[policy_key_id]
            msg = hex_to_bytes(pol["bytecode_hash"])
            sig = hex_to_bytes(pol["signature"])
            
            if not verify_ed25519(pk_bytes, msg, sig):
                errors.append("POLICY_SIGNATURE_INVALID")
    except KeyError as e:
        errors.append(f"POLICY_FIELD_MISSING:{e}")
    except Exception as e:
        errors.append(f"POLICY_VERIFICATION_ERROR:{e}")
    
    # 3) Verify model signature (optional)
    if "model" in pack and pack["model"]:
        try:
            m = pack["model"]
            model_key_id = m["key_id"]
            
            if model_key_id not in key_lookup:
                errors.append(f"MODEL_KEY_NOT_FOUND:{model_key_id}")
            else:
                mk_bytes = key_lookup[model_key_id]
                mmsg = hex_to_bytes(m["artifact_hash"])
                msig = hex_to_bytes(m["signature"])
                
                if not verify_ed25519(mk_bytes, mmsg, msig):
                    errors.append("MODEL_SIGNATURE_INVALID")
        except KeyError as e:
            errors.append(f"MODEL_FIELD_MISSING:{e}")
        except Exception as e:
            errors.append(f"MODEL_VERIFICATION_ERROR:{e}")
    else:
        warnings.append("NO_MODEL_PROVENANCE")
    
    # 4) Verify each event's Merkle proof and root signature
    events = pack.get("events", [])
    if not events:
        warnings.append("NO_EVENTS_IN_PACK")
    
    verified_batches: set[str] = set()
    
    for ev in events:
        event_id = ev.get("event_id", "unknown")
        
        try:
            mp = ev["merkle_proof"]
            leaf_hash = hex_to_bytes(ev["leaf_hash"])
            leaf_index = int(mp["leaf_index"])
            siblings = [hex_to_bytes(x) for x in mp["siblings"]]
            root_hash = hex_to_bytes(mp["root_hash"])
            
            # Verify Merkle inclusion
            if not verify_inclusion(leaf_hash, leaf_index, siblings, root_hash):
                errors.append(f"MERKLE_INCLUSION_FAIL:{event_id}")
            
            # Verify root signature (once per batch)
            batch_id = mp.get("batch_id", "unknown")
            if batch_id not in verified_batches:
                root_key_id = mp["signing_key_id"]
                
                if root_key_id not in key_lookup:
                    errors.append(f"ROOT_KEY_NOT_FOUND:{root_key_id}")
                else:
                    rk_bytes = key_lookup[root_key_id]
                    rsig = hex_to_bytes(mp["root_signature"])
                    
                    if not verify_ed25519(rk_bytes, root_hash, rsig):
                        errors.append(f"MERKLE_ROOT_SIG_INVALID:{batch_id}")
                    else:
                        verified_batches.add(batch_id)
            
            # Check anchoring
            anchor_ref = mp.get("anchor_ref")
            if not anchor_ref:
                if verify_anchoring:
                    errors.append(f"MERKLE_ROOT_NOT_ANCHORED:{batch_id}")
                else:
                    warnings.append(f"MERKLE_ROOT_NOT_ANCHORED:{batch_id}")
            elif anchor_verifier:
                anchor_type = mp.get("anchor_type", "UNKNOWN")
                if not anchor_verifier(anchor_type, anchor_ref):
                    errors.append(f"ANCHOR_VERIFICATION_FAILED:{batch_id}")
                    
        except KeyError as e:
            errors.append(f"EVENT_FIELD_MISSING:{event_id}:{e}")
        except Exception as e:
            errors.append(f"EVENT_VERIFICATION_ERROR:{event_id}:{e}")
    
    return VerifyResult(
        ok=(len(errors) == 0),
        errors=errors,
        warnings=warnings,
    )


def verify_evidence_pack_json(
    pack_json: str,
    keys_json: str,
) -> VerifyResult:
    """
    Verify evidence pack from JSON strings.
    
    Convenience wrapper for CLI usage.
    
    Args:
        pack_json: Evidence pack as JSON string
        keys_json: Key lookup as JSON string {"key_id": "hex_public_key"}
        
    Returns:
        VerifyResult
    """
    import json
    
    pack = json.loads(pack_json)
    keys_dict = json.loads(keys_json)
    key_lookup = {kid: hex_to_bytes(v) for kid, v in keys_dict.items()}
    
    return verify_evidence_pack(pack, key_lookup)
