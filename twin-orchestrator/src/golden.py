"""
Golden Snapshot Engine for CU Digital Twin

Provides commit-level golden baselines and drift detection for:
- Risk scores and metrics
- Ledger totals and balances
- Policy violations and enforcement outcomes
- Shadow system recommendations

This enables:
- Regression visibility across code changes
- Deterministic outcome verification
- Audit trail for regulatory compliance
- Zero-drift assurance for production promotion

Usage:
    # Capture a golden snapshot
    result = {
        "risk_score": 0.23,
        "ledger_totals": {"AUD": 1_234_567.89},
        "policy_violations": []
    }
    path, sha = snapshot(result, "cu-digital")
    print(f"Golden snapshot: {path}")
    
    # Compare against golden baseline
    is_match = compare(result, "golden/cu-digital-abc123.json")
    if not is_match:
        print("⚠️ Drift detected!")
"""

import json
import hashlib
import os
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from pathlib import Path


def snapshot(data: Dict[str, Any], name: str, golden_dir: str = "golden") -> Tuple[str, str]:
    """
    Create a golden snapshot of CU run results.
    
    Snapshots are content-addressed by SHA-256 hash, ensuring:
    - Identical results produce identical filenames
    - Different results are automatically versioned
    - No manual version management needed
    
    Args:
        data: Dictionary of results to snapshot (risk scores, ledger totals, etc.)
        name: Base name for the snapshot (e.g., "cu-digital")
        golden_dir: Directory to store golden snapshots (default: "golden")
        
    Returns:
        Tuple of (file_path, sha_hash)
    """
    # Ensure golden directory exists
    golden_path = Path(golden_dir)
    golden_path.mkdir(parents=True, exist_ok=True)
    
    # Add metadata
    snapshot_data = {
        "timestamp": datetime.utcnow().isoformat(),
        "name": name,
        "data": data
    }
    
    # Serialize with sorted keys for deterministic hashing
    payload = json.dumps(snapshot_data, sort_keys=True, indent=2)
    sha = hashlib.sha256(payload.encode()).hexdigest()[:16]
    
    # Write snapshot file
    file_path = golden_path / f"{name}-{sha}.json"
    with open(file_path, "w") as f:
        f.write(payload)
    
    print(f"[GOLDEN] Snapshot saved: {file_path}")
    return str(file_path), sha


def compare(current: Dict[str, Any], golden_path: str) -> bool:
    """
    Compare current results against a golden baseline.
    
    Args:
        current: Current run results
        golden_path: Path to golden snapshot file
        
    Returns:
        True if results match golden baseline, False if drift detected
        
    Raises:
        FileNotFoundError: If golden file doesn't exist
    """
    golden_file = Path(golden_path)
    if not golden_file.exists():
        raise FileNotFoundError(
            f"Golden file not found: {golden_path}\n"
            f"Create a baseline first with snapshot()"
        )
    
    with open(golden_file, "r") as f:
        golden_snapshot = json.load(f)
    
    # Extract data portion (ignore metadata)
    golden_data = golden_snapshot.get("data", golden_snapshot)
    
    return current == golden_data


def diff(current: Dict[str, Any], golden_path: str) -> Dict[str, Any]:
    """
    Generate detailed diff between current results and golden baseline.
    
    Args:
        current: Current run results
        golden_path: Path to golden snapshot file
        
    Returns:
        Dictionary containing differences found
    """
    golden_file = Path(golden_path)
    if not golden_file.exists():
        return {"error": f"Golden file not found: {golden_path}"}
    
    with open(golden_file, "r") as f:
        golden_snapshot = json.load(f)
    
    golden_data = golden_snapshot.get("data", golden_snapshot)
    
    differences = {}
    
    # Find keys in current but not in golden
    current_keys = set(current.keys())
    golden_keys = set(golden_data.keys())
    
    added_keys = current_keys - golden_keys
    removed_keys = golden_keys - current_keys
    common_keys = current_keys & golden_keys
    
    if added_keys:
        differences["added_keys"] = list(added_keys)
    
    if removed_keys:
        differences["removed_keys"] = list(removed_keys)
    
    # Find value differences in common keys
    changed_values = {}
    for key in common_keys:
        if current[key] != golden_data[key]:
            changed_values[key] = {
                "current": current[key],
                "golden": golden_data[key]
            }
    
    if changed_values:
        differences["changed_values"] = changed_values
    
    return differences if differences else {"status": "no_differences"}


def list_snapshots(name: Optional[str] = None, golden_dir: str = "golden") -> list:
    """
    List all golden snapshots, optionally filtered by name.
    
    Args:
        name: Optional name filter (e.g., "cu-digital")
        golden_dir: Directory containing golden snapshots
        
    Returns:
        List of snapshot file paths
    """
    golden_path = Path(golden_dir)
    if not golden_path.exists():
        return []
    
    pattern = f"{name}-*.json" if name else "*.json"
    snapshots = sorted(golden_path.glob(pattern), key=lambda p: p.stat().st_mtime, reverse=True)
    
    return [str(s) for s in snapshots]


def load_snapshot(golden_path: str) -> Dict[str, Any]:
    """
    Load a golden snapshot file.
    
    Args:
        golden_path: Path to golden snapshot file
        
    Returns:
        Snapshot data dictionary
    """
    with open(golden_path, "r") as f:
        return json.load(f)


def verify_with_tolerance(
    current: Dict[str, Any],
    golden_path: str,
    tolerance: float = 0.01
) -> Tuple[bool, Dict[str, Any]]:
    """
    Compare with tolerance for floating-point values.
    
    Useful for risk scores and metrics that may have minor numerical differences.
    
    Args:
        current: Current run results
        golden_path: Path to golden snapshot file
        tolerance: Acceptable relative difference for numeric values (default: 1%)
        
    Returns:
        Tuple of (is_within_tolerance, differences_dict)
    """
    golden_file = Path(golden_path)
    if not golden_file.exists():
        return False, {"error": f"Golden file not found: {golden_path}"}
    
    with open(golden_file, "r") as f:
        golden_snapshot = json.load(f)
    
    golden_data = golden_snapshot.get("data", golden_snapshot)
    
    differences = {}
    within_tolerance = True
    
    for key in set(current.keys()) | set(golden_data.keys()):
        if key not in current:
            differences[key] = {"status": "missing_in_current"}
            within_tolerance = False
        elif key not in golden_data:
            differences[key] = {"status": "missing_in_golden"}
            within_tolerance = False
        else:
            current_val = current[key]
            golden_val = golden_data[key]
            
            # Check if both are numeric
            if isinstance(current_val, (int, float)) and isinstance(golden_val, (int, float)):
                if golden_val != 0:
                    rel_diff = abs(current_val - golden_val) / abs(golden_val)
                    if rel_diff > tolerance:
                        differences[key] = {
                            "current": current_val,
                            "golden": golden_val,
                            "rel_diff": rel_diff
                        }
                        within_tolerance = False
                elif current_val != golden_val:
                    differences[key] = {
                        "current": current_val,
                        "golden": golden_val
                    }
                    within_tolerance = False
            elif current_val != golden_val:
                differences[key] = {
                    "current": current_val,
                    "golden": golden_val
                }
                within_tolerance = False
    
    return within_tolerance, differences


if __name__ == "__main__":
    # Demo usage
    print("Golden Snapshot Engine Demo\n")
    
    # Create a sample result
    result = {
        "risk_score": 0.234567,
        "ledger_totals": {
            "AUD": 1_234_567.89,
            "USD": 567_890.12
        },
        "policy_violations": [],
        "shadow_recommendations": 15
    }
    
    # Take a snapshot
    path, sha = snapshot(result, "cu-digital-demo")
    print(f"SHA: {sha}\n")
    
    # Compare against itself (should match)
    is_match = compare(result, path)
    print(f"Self-comparison: {'✅ Match' if is_match else '❌ Drift'}\n")
    
    # Create a modified result
    modified_result = result.copy()
    modified_result["risk_score"] = 0.245678
    
    # Compare modified (should differ)
    is_match = compare(modified_result, path)
    print(f"Modified comparison: {'✅ Match' if is_match else '❌ Drift'}")
    
    # Show detailed diff
    differences = diff(modified_result, path)
    print(f"Differences: {json.dumps(differences, indent=2)}\n")
    
    # Check with tolerance
    within_tolerance, diffs = verify_with_tolerance(modified_result, path, tolerance=0.05)
    print(f"Within 5% tolerance: {'✅ Yes' if within_tolerance else '❌ No'}")
    
    # List snapshots
    snapshots = list_snapshots("cu-digital-demo")
    print(f"\nSnapshots found: {len(snapshots)}")
    for snap in snapshots:
        print(f"  {snap}")
