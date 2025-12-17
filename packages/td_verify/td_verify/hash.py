"""
Cryptographic hash functions for TuringDynamics verification.
"""

import hashlib


def sha256(data: bytes) -> bytes:
    """
    Compute SHA-256 hash of data.
    
    Args:
        data: Bytes to hash
        
    Returns:
        32-byte SHA-256 digest
        
    Example:
        >>> sha256(b"hello").hex()
        '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'
    """
    return hashlib.sha256(data).digest()


def sha256_hex(data: bytes) -> str:
    """
    Compute SHA-256 hash and return as lowercase hex string.
    
    Args:
        data: Bytes to hash
        
    Returns:
        64-character hex string
    """
    return sha256(data).hex()
