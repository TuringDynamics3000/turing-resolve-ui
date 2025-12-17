"""
Command-line interface for TuringDynamics evidence pack verification.

Usage:
    python -m td_verify pack.json keys.json
    python -m td_verify --help
"""

import argparse
import json
import sys
from pathlib import Path

from .evidence_pack import verify_evidence_pack, hex_to_bytes


def main() -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        prog="td_verify",
        description="Verify TuringDynamics evidence packs",
    )
    parser.add_argument(
        "pack_file",
        type=Path,
        help="Path to evidence pack JSON file",
    )
    parser.add_argument(
        "keys_file",
        type=Path,
        help="Path to keys JSON file (key_id -> hex_public_key)",
    )
    parser.add_argument(
        "--require-anchoring",
        action="store_true",
        help="Fail if any batch is not anchored",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed output",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output result as JSON",
    )
    
    args = parser.parse_args()
    
    # Load files
    try:
        with open(args.pack_file) as f:
            pack = json.load(f)
    except Exception as e:
        print(f"Error loading pack file: {e}", file=sys.stderr)
        return 1
    
    try:
        with open(args.keys_file) as f:
            keys_dict = json.load(f)
        key_lookup = {kid: hex_to_bytes(v) for kid, v in keys_dict.items()}
    except Exception as e:
        print(f"Error loading keys file: {e}", file=sys.stderr)
        return 1
    
    # Verify
    result = verify_evidence_pack(
        pack,
        key_lookup,
        verify_anchoring=args.require_anchoring,
    )
    
    # Output
    if args.json:
        output = {
            "ok": result.ok,
            "errors": result.errors,
            "warnings": result.warnings,
        }
        print(json.dumps(output, indent=2))
    else:
        print("=" * 60)
        print("  TURINGDYNAMICS EVIDENCE PACK VERIFICATION")
        print("=" * 60)
        print()
        print(f"  Pack:    {args.pack_file}")
        print(f"  Keys:    {args.keys_file}")
        print()
        print("-" * 60)
        print(f"  RESULT:  {'✓ PASS' if result.ok else '✗ FAIL'}")
        print("-" * 60)
        
        if args.verbose or result.errors:
            print()
            if result.errors:
                print("  Errors:")
                for err in result.errors:
                    print(f"    ✗ {err}")
            
            if result.warnings:
                print("  Warnings:")
                for warn in result.warnings:
                    print(f"    ⚠ {warn}")
        
        print()
        print("=" * 60)
    
    return 0 if result.ok else 1


if __name__ == "__main__":
    sys.exit(main())
