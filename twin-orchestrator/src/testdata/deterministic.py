"""
Deterministic Data Generator for CU Digital Twin

Provides deterministic, replayable test data generation for Digital Twin simulations.
Same tenant ID always produces the same accounts, transactions, and risk profiles.

Properties:
- Fully deterministic: Same tenant → same data → same outcomes
- Replayable across machines, CI runs, and future production
- Enables CU replay, policy diff testing, and stable risk metrics
- Critical for bank-grade assurance and audit capability
"""

import random
import hashlib
from datetime import datetime
from typing import Dict, Any, List


def seed_from_tenant(tenant_id: str) -> int:
    """
    Generate a deterministic seed from tenant ID using SHA-256 hash.
    
    Args:
        tenant_id: Unique tenant identifier
        
    Returns:
        32-bit integer seed derived from tenant ID
    """
    return int(hashlib.sha256(tenant_id.encode()).hexdigest(), 16) % (2**32)


def deterministic_rng(tenant_id: str) -> random.Random:
    """
    Create a deterministic random number generator seeded by tenant ID.
    
    Args:
        tenant_id: Unique tenant identifier
        
    Returns:
        Random instance with deterministic seed
    """
    seed = seed_from_tenant(tenant_id)
    return random.Random(seed)


def generate_accounts(tenant_id: str, count: int = 10) -> List[Dict[str, Any]]:
    """
    Generate deterministic account data for a tenant.
    
    Args:
        tenant_id: Unique tenant identifier
        count: Number of accounts to generate (default: 10)
        
    Returns:
        List of account dictionaries with account_id, balance, currency
    """
    rng = deterministic_rng(tenant_id)
    return [
        {
            "account_id": f"{tenant_id}-ACC-{i:04d}",
            "balance": round(rng.uniform(1_000, 250_000), 2),
            "currency": rng.choice(["AUD", "USD"]),
            "account_type": rng.choice(["savings", "checking", "term_deposit"]),
            "status": "active"
        }
        for i in range(count)
    ]


def generate_transactions(tenant_id: str, count: int = 50) -> List[Dict[str, Any]]:
    """
    Generate deterministic transaction data for a tenant.
    
    Args:
        tenant_id: Unique tenant identifier
        count: Number of transactions to generate (default: 50)
        
    Returns:
        List of transaction dictionaries with tx_id, amount, timestamp
    """
    rng = deterministic_rng(tenant_id)
    return [
        {
            "tx_id": f"{tenant_id}-TX-{i:06d}",
            "amount": round(rng.uniform(-5000, 5000), 2),
            "timestamp": datetime.utcnow().isoformat(),
            "tx_type": rng.choice(["debit", "credit", "transfer"]),
            "status": "completed"
        }
        for i in range(count)
    ]


def generate_members(tenant_id: str, count: int = 100) -> List[Dict[str, Any]]:
    """
    Generate deterministic member data for a tenant.
    
    Args:
        tenant_id: Unique tenant identifier
        count: Number of members to generate (default: 100)
        
    Returns:
        List of member dictionaries with member_id, risk_score, segment
    """
    rng = deterministic_rng(tenant_id)
    return [
        {
            "member_id": f"{tenant_id}-MEM-{i:05d}",
            "risk_score": round(rng.uniform(0.0, 1.0), 4),
            "segment": rng.choice(["low_risk", "medium_risk", "high_risk"]),
            "tenure_months": rng.randint(1, 240),
            "status": "active"
        }
        for i in range(count)
    ]


def generate_loans(tenant_id: str, count: int = 25) -> List[Dict[str, Any]]:
    """
    Generate deterministic loan data for a tenant.
    
    Args:
        tenant_id: Unique tenant identifier
        count: Number of loans to generate (default: 25)
        
    Returns:
        List of loan dictionaries with loan_id, principal, interest_rate
    """
    rng = deterministic_rng(tenant_id)
    return [
        {
            "loan_id": f"{tenant_id}-LOAN-{i:04d}",
            "principal": round(rng.uniform(5_000, 500_000), 2),
            "interest_rate": round(rng.uniform(0.03, 0.12), 4),
            "term_months": rng.choice([12, 24, 36, 48, 60, 84, 120]),
            "status": rng.choice(["current", "current", "current", "delinquent"])
        }
        for i in range(count)
    ]


if __name__ == "__main__":
    # Demo usage
    tenant = "cu-digital"
    
    print(f"Deterministic data for tenant: {tenant}")
    print(f"Seed: {seed_from_tenant(tenant)}\n")
    
    accounts = generate_accounts(tenant, count=5)
    print(f"Generated {len(accounts)} accounts:")
    for acc in accounts[:3]:
        print(f"  {acc}")
    
    transactions = generate_transactions(tenant, count=10)
    print(f"\nGenerated {len(transactions)} transactions:")
    for tx in transactions[:3]:
        print(f"  {tx}")
    
    members = generate_members(tenant, count=5)
    print(f"\nGenerated {len(members)} members:")
    for mem in members[:3]:
        print(f"  {mem}")
    
    loans = generate_loans(tenant, count=5)
    print(f"\nGenerated {len(loans)} loans:")
    for loan in loans[:3]:
        print(f"  {loan}")
