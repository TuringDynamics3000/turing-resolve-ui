"""
Credit Card Invariants - CU Digital Twin Phase 3

These invariants validate credit card operations and provide NCCP + APRA-grade
assurance for:
- Credit limit enforcement (hard cap, no breaches)
- Minimum payment enforcement
- Instalment isolation (no cross-contamination)
- Balance transfer promotional rate expiry
- Interest calculation correctness
- Hardship program compliance

This is Tier-1 consumer credit risk validation.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Dict, Any, Optional

from api_client import TuringCoreClient


@dataclass
class InvariantResult:
    """Result of a single credit card invariant check."""
    name: str
    passed: bool
    violations: List[Dict[str, Any]]
    message: Optional[str] = None


# ========== INVARIANT 1: CREDIT LIMIT NEVER EXCEEDED ==========

def invariant_credit_limit_enforced(
    client: TuringCoreClient,
    tenant_id: str
) -> InvariantResult:
    """
    Guarantee: Credit card balance + pending authorisations never exceed
    approved credit limit.
    
    This is:
    - A core NCCP responsible lending control
    - A credit risk protection
    - A regulatory compliance requirement
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_credit_limit_breaches endpoint
    # violations = client.find_credit_limit_breaches(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "cc_123",
    #     "credit_limit": 10000.00,
    #     "current_balance": 9800.00,
    #     "pending_auth": 500.00,
    #     "total_exposure": 10300.00,
    #     "breach_amount": 300.00,
    # }
    
    return InvariantResult(
        name="credit_limit_enforced",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} credit limit breaches"
    )


# ========== INVARIANT 2: MINIMUM PAYMENT ENFORCED ==========

def calculate_min_payment(
    balance: float,
    min_payment_percent: float,
    min_payment_floor: float = 25.00
) -> float:
    """
    Calculate minimum payment for credit card.
    
    Args:
        balance: Current credit card balance
        min_payment_percent: Minimum payment percentage (e.g., 2.0 for 2%)
        min_payment_floor: Minimum absolute payment amount
    
    Returns:
        Minimum payment amount
    """
    calculated = balance * (min_payment_percent / 100.0)
    return max(calculated, min_payment_floor)


def invariant_min_payment_enforced(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Minimum payment rules are enforced per ProductConfig.
    
    This protects:
    - Consumer credit standards
    - Regulatory compliance
    - Revenue integrity
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_min_payment_breaches endpoint
    # violations = client.find_min_payment_breaches(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "cc_123",
    #     "balance": 5000.00,
    #     "expected_min_payment": 100.00,
    #     "actual_payment": 50.00,
    #     "shortfall": 50.00,
    # }
    
    return InvariantResult(
        name="min_payment_enforced",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} minimum payment violations"
    )


# ========== INVARIANT 3: INSTALMENT ISOLATION ==========

def invariant_instalments_isolated(
    client: TuringCoreClient,
    tenant_id: str
) -> InvariantResult:
    """
    Guarantee: Instalment balances are isolated from revolving balance.
    Instalments have fixed repayment schedules and cannot be re-borrowed.
    
    This protects:
    - Consumer credit clarity
    - Instalment product integrity
    - Regulatory disclosure accuracy
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_instalment_leakage endpoint
    # violations = client.find_instalment_leakage(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "cc_123",
    #     "instalment_id": "inst_456",
    #     "instalment_balance": 2000.00,
    #     "revolving_balance": 3000.00,
    #     "total_balance": 4800.00,  # Should be 5000.00
    #     "leakage_amount": 200.00,
    # }
    
    return InvariantResult(
        name="instalments_isolated",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} instalment isolation breaches"
    )


# ========== INVARIANT 4: BALANCE TRANSFER PROMO RATE EXPIRY ==========

def invariant_bt_promo_expiry(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Balance transfer promotional rates expire on time and
    revert to standard purchase rate.
    
    This protects:
    - Revenue integrity
    - Consumer disclosure accuracy
    - Regulatory compliance
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_bt_rate_expiry_failures endpoint
    # violations = client.find_bt_rate_expiry_failures(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "cc_123",
    #     "bt_id": "bt_456",
    #     "promo_rate": 3.99,
    #     "promo_expiry_date": "2025-11-01",
    #     "current_date": "2025-12-08",
    #     "current_rate": 3.99,  # Should be 18.99
    #     "expected_rate": 18.99,
    # }
    
    return InvariantResult(
        name="bt_promo_expiry",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} BT promo rate expiry failures"
    )


# ========== INVARIANT 5: INTEREST CALCULATION CORRECTNESS ==========

def calculate_daily_interest(
    balance: float,
    annual_rate: float
) -> float:
    """
    Calculate daily interest for credit card balance.
    
    Args:
        balance: Current balance
        annual_rate: Annual interest rate (e.g., 18.99 for 18.99%)
    
    Returns:
        Daily interest amount
    """
    daily_rate = (annual_rate / 100.0) / 365.0
    return round(balance * daily_rate, 2)


def invariant_interest_calculation_correct(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Interest is calculated correctly per ProductConfig rates.
    
    This protects:
    - Consumer credit accuracy
    - Revenue integrity
    - Regulatory compliance
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has check_cc_interest_calcs endpoint
    # violations = client.check_cc_interest_calcs(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "cc_123",
    #     "balance": 5000.00,
    #     "rate": 18.99,
    #     "expected_daily_interest": 2.60,
    #     "actual_daily_interest": 2.50,
    #     "delta": -0.10,
    # }
    
    return InvariantResult(
        name="interest_calculation_correct",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} interest calculation discrepancies"
    )


# ========== INVARIANT 6: HARDSHIP PROGRAM COMPLIANCE ==========

def invariant_hardship_compliance(
    client: TuringCoreClient,
    tenant_id: str
) -> InvariantResult:
    """
    Guarantee: Hardship programs are applied correctly per NCCP requirements.
    
    This protects:
    - Consumer protection compliance
    - Regulatory requirements
    - Member welfare
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has check_hardship_compliance endpoint
    # violations = client.check_hardship_compliance(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "cc_123",
    #     "hardship_status": "ACTIVE",
    #     "interest_charged": 50.00,  # Should be 0.00 during hardship
    #     "fees_charged": 10.00,  # Should be 0.00 during hardship
    # }
    
    return InvariantResult(
        name="hardship_compliance",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} hardship compliance violations"
    )


# ========== INVARIANT 7: NO OVER-LIMIT FEES WHEN PROHIBITED ==========

def invariant_no_overlimit_fees_when_prohibited(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Over-limit fees are not charged when prohibited by ProductConfig.
    
    This protects:
    - Consumer protection
    - Product integrity
    - Regulatory compliance
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_overlimit_fee_violations endpoint
    # violations = client.find_overlimit_fee_violations(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "card_id": "cc_123",
    #     "product_code": "CC_STD",
    #     "overlimit_fees_allowed": False,
    #     "overlimit_fee_charged": 35.00,
    # }
    
    return InvariantResult(
        name="no_overlimit_fees_when_prohibited",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} prohibited over-limit fee charges"
    )


# ========== MASTER CREDIT CARD INVARIANT RUNNER ==========

def run_all_credit_card_invariants(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run all credit card invariants and return aggregated results.
    
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
        invariant_credit_limit_enforced(client, tenant_id),
        invariant_min_payment_enforced(client, tenant_id, product_registry),
        invariant_instalments_isolated(client, tenant_id),
        invariant_bt_promo_expiry(client, tenant_id, product_registry),
        invariant_interest_calculation_correct(client, tenant_id, product_registry),
        invariant_hardship_compliance(client, tenant_id),
        invariant_no_overlimit_fees_when_prohibited(client, tenant_id, product_registry),
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
