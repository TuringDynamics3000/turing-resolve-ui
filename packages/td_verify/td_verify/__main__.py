"""
Allow running td_verify as a module:
    python -m td_verify pack.json keys.json
"""

from .cli import main

if __name__ == "__main__":
    exit(main())
