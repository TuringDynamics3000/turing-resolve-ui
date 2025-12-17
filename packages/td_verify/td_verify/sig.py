"""
Cryptographic signature verification for TuringDynamics.

Supports Ed25519 (recommended) and ECDSA P-256.
"""

from typing import Literal

# Try to import cryptography library
try:
    from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PublicKey
    from cryptography.hazmat.primitives.asymmetric.ec import (
        EllipticCurvePublicKey,
        ECDSA,
        SECP256R1,
    )
    from cryptography.hazmat.primitives import hashes
    from cryptography.exceptions import InvalidSignature
    CRYPTO_AVAILABLE = True
except ImportError:
    CRYPTO_AVAILABLE = False


def verify_ed25519(public_key_bytes: bytes, message: bytes, signature: bytes) -> bool:
    """
    Verify an Ed25519 signature.
    
    Args:
        public_key_bytes: 32-byte Ed25519 public key
        message: Original message that was signed
        signature: 64-byte Ed25519 signature
        
    Returns:
        True if signature is valid, False otherwise
        
    Raises:
        ImportError: If cryptography library is not installed
        
    Example:
        >>> verify_ed25519(pub_key, message, sig)
        True
    """
    if not CRYPTO_AVAILABLE:
        raise ImportError(
            "cryptography library required for signature verification. "
            "Install with: pip install cryptography"
        )
    
    try:
        pk = Ed25519PublicKey.from_public_bytes(public_key_bytes)
        pk.verify(signature, message)
        return True
    except InvalidSignature:
        return False
    except Exception:
        return False


def verify_ecdsa_p256(public_key_bytes: bytes, message: bytes, signature: bytes) -> bool:
    """
    Verify an ECDSA P-256 signature.
    
    Args:
        public_key_bytes: P-256 public key in uncompressed format (65 bytes)
        message: Original message that was signed (will be SHA-256 hashed)
        signature: DER-encoded ECDSA signature
        
    Returns:
        True if signature is valid, False otherwise
    """
    if not CRYPTO_AVAILABLE:
        raise ImportError(
            "cryptography library required for signature verification. "
            "Install with: pip install cryptography"
        )
    
    try:
        from cryptography.hazmat.primitives.serialization import (
            load_der_public_key,
        )
        from cryptography.hazmat.backends import default_backend
        
        # Try to load as raw bytes first
        if len(public_key_bytes) == 65 and public_key_bytes[0] == 0x04:
            # Uncompressed point format
            from cryptography.hazmat.primitives.asymmetric.ec import (
                EllipticCurvePublicNumbers,
            )
            x = int.from_bytes(public_key_bytes[1:33], "big")
            y = int.from_bytes(public_key_bytes[33:65], "big")
            numbers = EllipticCurvePublicNumbers(x, y, SECP256R1())
            pk = numbers.public_key(default_backend())
        else:
            # Try DER format
            pk = load_der_public_key(public_key_bytes, default_backend())
        
        pk.verify(signature, message, ECDSA(hashes.SHA256()))
        return True
    except InvalidSignature:
        return False
    except Exception:
        return False


def verify_signature(
    algorithm: Literal["ed25519", "ecdsa_p256"],
    public_key_bytes: bytes,
    message: bytes,
    signature: bytes,
) -> bool:
    """
    Verify a signature using the specified algorithm.
    
    Args:
        algorithm: "ed25519" or "ecdsa_p256"
        public_key_bytes: Public key bytes
        message: Original message
        signature: Signature bytes
        
    Returns:
        True if valid, False otherwise
    """
    if algorithm == "ed25519":
        return verify_ed25519(public_key_bytes, message, signature)
    elif algorithm == "ecdsa_p256":
        return verify_ecdsa_p256(public_key_bytes, message, signature)
    else:
        raise ValueError(f"Unsupported algorithm: {algorithm}")
