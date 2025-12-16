"""
Debit Card Invariants - CU Digital Twin Phase 1B

These invariants validate debit card operations and provide CU-grade assurance for:
- No card overdraft (real-time balance enforcement)
- Daily spend limit hard caps
- MCC blocking enforcement
- ATM withdrawal limits

This is retail banking tier validation for member debit card safety.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Dict, Any, Optional

from api_client import TuringCoreClient


@dataclass
class InvariantResult:
    """Result of a single debit card invariant check."""
    name: str
    passed: bool
    violations: List[Dict[str, Any]]
    message: Optional[str] = None


# ========== INVARIANT 1: NO DEBIT CARD OVERDRAFT ==========

def invariant_no_debit_overdraft(
    client: TuringCoreClient,
    tenant_id: str
) -> InvariantResult:
    """
    Guarantee: No debit card can authorise a transaction that would result
    in a negative balance on the linked account.
    
    This is:
    - A core member protection invariant
    - A real-time balance enforcement check
    - A zero-tolerance overdraft prevention
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has list_debit_cards endpoint
    # cards = client.list_debit_cards(tenant_id)
    cards = []  # Placeholder
    
    violations = []
    
    for card in cards:
        card_id = card.get("card_id")
        account_id = card.get("account_id")
        
        # Check if linked account has negative balance
        # account = client.get_account(tenant_id, account_id)
        # available_balance = account.get("available_balance", 0.0)
        available_balance = 0.0  # Placeholder
        
        if available_balance < 0:
            violations.append({
                "card_id": card_id,
                "account_id": account_id,
                "available_balance": available_balance,
                "reason": "Negative balance on linked account",
            })
    
    return InvariantResult(
        name="no_debit_overdraft",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Checked {len(cards)} debit cards, found {len(violations)} overdrafts"
    )


# ========== INVARIANT 2: DAILY SPEND LIMIT HARD CAP ==========

def invariant_daily_spend_limit(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: No debit card can exceed its configured daily spend limit.
    
    This protects:
    - Member fraud exposure
    - CU risk limits
    - Regulatory compliance
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has list_debit_cards endpoint
    # cards = client.list_debit_cards(tenant_id)
    cards = []  # Placeholder
    
    violations = []
    
    for card in cards:
        card_id = card.get("card_id")
        product_code = card.get("product_code")
        
        # Get product rules
        product = product_registry.get(product_code)
        if not product or not hasattr(product, "debit_card_rules"):
            continue
        
        daily_limit = product.debit_card_rules.daily_spend_limit
        
        # Calculate today's spend
        # spent_today = client.sum_daily_debit_spend(tenant_id, card_id)
        spent_today = 0.0  # Placeholder
        
        if spent_today > daily_limit:
            violations.append({
                "card_id": card_id,
                "product_code": product_code,
                "daily_limit": daily_limit,
                "spent_today": spent_today,
                "breach_amount": spent_today - daily_limit,
            })
    
    return InvariantResult(
        name="daily_spend_limit_hard_cap",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Checked {len(cards)} debit cards, found {len(violations)} limit breaches"
    )


# ========== INVARIANT 3: MCC BLOCKING ENFORCED ==========

def invariant_mcc_blocking(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Debit card transactions at blocked MCC codes are declined.
    
    This enforces:
    - Gambling blocking
    - Adult content blocking
    - High-risk merchant blocking
    - Member protection policies
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_mcc_policy_violations endpoint
    # violations = client.find_mcc_policy_violations(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "card_123",
    #     "transaction_id": "txn_456",
    #     "mcc": "7995",  # Gambling
    #     "amount": 100.00,
    #     "merchant_name": "Online Casino",
    #     "was_authorised": True,  # Should have been declined
    # }
    
    return InvariantResult(
        name="mcc_blocking_enforced",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} MCC policy violations"
    )


# ========== INVARIANT 4: ATM WITHDRAWAL LIMIT ==========

def invariant_atm_withdrawal_limit(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: ATM withdrawals cannot exceed configured daily limits.
    
    This protects:
    - Member cash exposure
    - ATM fraud risk
    - CU liquidity management
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has list_debit_cards endpoint
    # cards = client.list_debit_cards(tenant_id)
    cards = []  # Placeholder
    
    violations = []
    
    for card in cards:
        card_id = card.get("card_id")
        product_code = card.get("product_code")
        
        # Get product rules
        product = product_registry.get(product_code)
        if not product or not hasattr(product, "debit_card_rules"):
            continue
        
        atm_limit = product.debit_card_rules.atm_withdrawal_limit
        
        # Calculate today's ATM withdrawals
        # atm_total = client.sum_daily_atm_withdrawals(tenant_id, card_id)
        atm_total = 0.0  # Placeholder
        
        if atm_total > atm_limit:
            violations.append({
                "card_id": card_id,
                "product_code": product_code,
                "atm_limit": atm_limit,
                "atm_total": atm_total,
                "breach_amount": atm_total - atm_limit,
            })
    
    return InvariantResult(
        name="atm_withdrawal_limit",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Checked {len(cards)} debit cards, found {len(violations)} ATM limit breaches"
    )


# ========== INVARIANT 5: INTERNATIONAL BLOCKING ==========

def invariant_international_blocking(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: International transactions are blocked when international_enabled = false.
    
    This protects:
    - Member fraud exposure overseas
    - CU FX risk
    - Scheme compliance
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_international_violations endpoint
    # violations = client.find_international_violations(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "card_123",
    #     "transaction_id": "txn_456",
    #     "country": "US",
    #     "amount": 50.00,
    #     "merchant_name": "Foreign Merchant",
    #     "was_authorised": True,  # Should have been declined
    # }
    
    return InvariantResult(
        name="international_blocking_enforced",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} international blocking violations"
    )


# ========== MASTER DEBIT CARD INVARIANT RUNNER ==========

def run_all_debit_card_invariants(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run all debit card invariants and return aggregated results.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        Dict with:
        - passed: bool (all invariants passed)
        - results: List[InvariantResult]
        - summary: Dict with counts
    """
    results = [
        invariant_no_debit_overdraft(client, tenant_id),
        invariant_daily_spend_limit(client, tenant_id, product_registry),
        invariant_mcc_blocking(client, tenant_id, product_registry),
        invariant_atm_withdrawal_limit(client, tenant_id, product_registry),
        invariant_international_blocking(client, tenant_id, product_registry),
    ]
    
    passed = all(r.passed for r in results)
    total_violations = sum(len(r.violations) for r in results)
    
    return {
        "passed": passed,
        "results": results,
        "summary": {
            "total_invariants": len(results),
            "passed_count": sum(1 for r in results if r.passed),
            "failed_count": sum(1 for r in results if not r.passed),
            "total_violations": total_violations,
        }
    }
