"""
Canonical JSON serialization for deterministic hashing.

CRITICAL: Canonicalization must be identical across all services.
Any difference will cause verification failures.

Rules:
- Keys sorted alphabetically
- No whitespace
- No trailing commas
- Floats are FORBIDDEN (use string decimals)
- UTF-8 encoding
"""

import json
from decimal import Decimal
from typing import Any


def _normalize(obj: Any) -> Any:
    """
    Recursively normalize an object for canonical JSON serialization.
    
    - Dicts: sort keys alphabetically
    - Lists: preserve order, normalize elements
    - Floats: RAISE ERROR (must use string decimals)
    - Decimals: convert to string
    - Other: pass through
    """
    if isinstance(obj, dict):
        return {k: _normalize(obj[k]) for k in sorted(obj.keys())}
    if isinstance(obj, list):
        return [_normalize(x) for x in obj]
    if isinstance(obj, float):
        raise ValueError(
            f"Floats not allowed in canonical JSON: {obj}. "
            "Use string decimals instead (e.g., '123.45')."
        )
    if isinstance(obj, Decimal):
        return str(obj)
    return obj


def dumps_canonical(obj: Any) -> bytes:
    """
    Serialize object to canonical JSON bytes.
    
    Returns UTF-8 encoded bytes suitable for hashing.
    
    Example:
        >>> dumps_canonical({"b": 1, "a": 2})
        b'{"a":2,"b":1}'
    """
    normalized = _normalize(obj)
    json_str = json.dumps(
        normalized,
        separators=(",", ":"),  # No whitespace
        sort_keys=True,         # Redundant but explicit
        ensure_ascii=False,     # Allow UTF-8
    )
    return json_str.encode("utf-8")


def loads_canonical(data: bytes) -> Any:
    """
    Parse canonical JSON bytes.
    
    Note: This doesn't enforce canonicalization on input,
    but the output should be re-canonicalized before hashing.
    """
    return json.loads(data.decode("utf-8"))
