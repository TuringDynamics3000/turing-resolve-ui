"""
Merkle tree operations for TuringDynamics audit trail verification.

Tree construction uses domain separation:
- Leaf nodes: SHA256(0x00 || event_digest)
- Internal nodes: SHA256(0x01 || left || right)

This prevents second preimage attacks.
"""

from .hash import sha256

# Domain separation prefixes
LEAF_PREFIX = b"\x00"
NODE_PREFIX = b"\x01"


def compute_leaf(event_digest: bytes) -> bytes:
    """
    Compute Merkle leaf hash from event digest.
    
    Uses domain separation: SHA256(0x00 || event_digest)
    
    Args:
        event_digest: 32-byte event digest
        
    Returns:
        32-byte leaf hash
    """
    return sha256(LEAF_PREFIX + event_digest)


def parent_hash(left: bytes, right: bytes) -> bytes:
    """
    Compute parent node hash from two child hashes.
    
    Uses domain separation: SHA256(0x01 || left || right)
    
    Args:
        left: 32-byte left child hash
        right: 32-byte right child hash
        
    Returns:
        32-byte parent hash
    """
    return sha256(NODE_PREFIX + left + right)


def verify_inclusion(
    leaf_hash: bytes,
    leaf_index: int,
    siblings: list[bytes],
    root_hash: bytes,
) -> bool:
    """
    Verify a Merkle inclusion proof.
    
    Args:
        leaf_hash: 32-byte hash of the leaf to verify
        leaf_index: 0-based index of the leaf in the tree
        siblings: List of sibling hashes from leaf to root
        root_hash: Expected 32-byte root hash
        
    Returns:
        True if the proof is valid, False otherwise
        
    Example:
        >>> # For a tree with 4 leaves, verifying leaf at index 1:
        >>> # siblings = [hash of leaf 0, hash of parent(leaf 2, leaf 3)]
        >>> verify_inclusion(leaf_hash, 1, siblings, root_hash)
        True
    """
    h = leaf_hash
    idx = leaf_index
    
    for sibling in siblings:
        if idx % 2 == 0:
            # Current node is left child
            h = parent_hash(h, sibling)
        else:
            # Current node is right child
            h = parent_hash(sibling, h)
        idx //= 2
    
    return h == root_hash


def build_tree(leaves: list[bytes]) -> list[list[bytes]]:
    """
    Build a complete Merkle tree from leaf hashes.
    
    Args:
        leaves: List of leaf hashes
        
    Returns:
        List of levels, where level[0] = leaves and level[-1] = [root]
        
    Note:
        If the number of leaves is odd, the last leaf is duplicated.
    """
    if not leaves:
        return []
    
    levels = [list(leaves)]
    current = leaves
    
    while len(current) > 1:
        next_level = []
        for i in range(0, len(current), 2):
            left = current[i]
            # If odd number, duplicate last
            right = current[i + 1] if i + 1 < len(current) else current[i]
            next_level.append(parent_hash(left, right))
        levels.append(next_level)
        current = next_level
    
    return levels


def generate_proof(levels: list[list[bytes]], leaf_index: int) -> list[bytes]:
    """
    Generate a Merkle inclusion proof for a leaf.
    
    Args:
        levels: Tree levels from build_tree()
        leaf_index: Index of the leaf to prove
        
    Returns:
        List of sibling hashes from leaf to root
    """
    if not levels:
        return []
    
    proof = []
    idx = leaf_index
    
    for level in levels[:-1]:  # Exclude root level
        if idx % 2 == 0:
            # Need right sibling
            sibling_idx = idx + 1
            if sibling_idx < len(level):
                proof.append(level[sibling_idx])
            else:
                # Odd number of nodes, sibling is self
                proof.append(level[idx])
        else:
            # Need left sibling
            proof.append(level[idx - 1])
        idx //= 2
    
    return proof


def get_root(levels: list[list[bytes]]) -> bytes:
    """
    Get the root hash from tree levels.
    
    Args:
        levels: Tree levels from build_tree()
        
    Returns:
        32-byte root hash
    """
    if not levels:
        raise ValueError("Empty tree has no root")
    return levels[-1][0]
