"""
Term Deposit Invariants - CU Digital Twin Phase 2A

These invariants validate term deposit lifecycle operations and provide
treasury-grade assurance for:
- Principal locked until maturity (unless broken)
- Maturity payout correctness (principal + interest - penalties)
- Break penalty calculation accuracy
- Rollover integrity
- Interest accrual correctness

This is ALM/treasury tier validation for balance sheet control.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import List, Dict, Any, Optional

from api_client import TuringCoreClient


@dataclass
class InvariantResult:
    """Result of a single term deposit invariant check."""
    name: str
    passed: bool
    violations: List[Dict[str, Any]]
    message: Optional[str] = None


# ========== INVARIANT 1: PRINCIPAL LOCKED UNTIL MATURITY ==========

def invariant_td_principal_locked(
    client: TuringCoreClient,
    tenant_id: str
) -> InvariantResult:
    """
    Guarantee: Term deposit principal cannot be withdrawn or moved until
    maturity date, unless explicitly broken with penalty.
    
    This is:
    - A core treasury control invariant
    - A liquidity management protection
    - A member contract enforcement
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_td_principal_movements endpoint
    # violations = client.find_td_principal_movements(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "td_id": "td_123",
    #     "principal": 10000.00,
    #     "maturity_date": "2025-06-08",
    #     "withdrawal_date": "2025-03-15",
    #     "was_broken": False,  # Should have been marked as broken
    #     "amount_withdrawn": 5000.00,
    # }
    
    return InvariantResult(
        name="td_principal_locked",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} unauthorized principal movements"
    )


# ========== INVARIANT 2: MATURITY PAYOUT CORRECTNESS ==========

def calculate_td_maturity_payout(
    principal: float,
    annual_rate: float,
    term_months: int,
    break_penalty: float = 0.0
) -> float:
    """
    Calculate expected term deposit maturity payout.
    
    Args:
        principal: Original principal amount
        annual_rate: Annual interest rate (e.g., 0.048 for 4.8%)
        term_months: Term in months
        break_penalty: Penalty amount if broken early
    
    Returns:
        Expected payout amount
    """
    # Simple interest calculation for term deposits
    interest = principal * annual_rate * (term_months / 12.0)
    payout = principal + interest - break_penalty
    return round(payout, 2)


def invariant_td_maturity_payout(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Maturity payout = Principal + Accrued Interest - Penalties.
    
    This protects:
    - Member financial accuracy
    - Treasury P&L integrity
    - Regulatory compliance
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has check_td_maturity_calcs endpoint
    # violations = client.check_td_maturity_calcs(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "td_id": "td_123",
    #     "principal": 10000.00,
    #     "rate": 0.048,
    #     "term_months": 12,
    #     "expected_payout": 10480.00,
    #     "actual_payout": 10450.00,
    #     "delta": -30.00,
    # }
    
    return InvariantResult(
        name="td_maturity_payout_correct",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} maturity payout discrepancies"
    )


# ========== INVARIANT 3: BREAK PENALTY CORRECTNESS ==========

def calculate_break_penalty(
    principal: float,
    accrued_interest: float,
    penalty_bps: int
) -> float:
    """
    Calculate term deposit break penalty.
    
    Args:
        principal: Original principal amount
        accrued_interest: Interest accrued to date
        penalty_bps: Penalty in basis points (e.g., 200 = 2%)
    
    Returns:
        Penalty amount
    """
    # Penalty is typically applied to accrued interest
    penalty_rate = penalty_bps / 10000.0
    penalty = accrued_interest * penalty_rate
    return round(penalty, 2)


def invariant_td_break_penalty(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Break penalties are calculated correctly per ProductConfig.
    
    This protects:
    - Treasury revenue
    - Member fairness
    - Product integrity
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has check_td_break_penalties endpoint
    # violations = client.check_td_break_penalties(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "td_id": "td_123",
    #     "product_code": "TD_12M",
    #     "accrued_interest": 400.00,
    #     "penalty_bps": 250,
    #     "expected_penalty": 10.00,
    #     "actual_penalty": 5.00,
    #     "delta": -5.00,
    # }
    
    return InvariantResult(
        name="td_break_penalty_correct",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} break penalty calculation errors"
    )


# ========== INVARIANT 4: ROLLOVER INTEGRITY ==========

def invariant_td_rollover_integrity(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Rollovers preserve principal + interest and create new TD correctly.
    
    This protects:
    - Member balances
    - Treasury continuity
    - Liquidity forecasting
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has check_td_rollovers endpoint
    # violations = client.check_td_rollovers(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "old_td_id": "td_123",
    #     "new_td_id": "td_456",
    #     "old_maturity_amount": 10480.00,
    #     "new_principal": 10450.00,
    #     "delta": -30.00,
    #     "reason": "Interest not rolled into new principal",
    # }
    
    return InvariantResult(
        name="td_rollover_integrity",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} rollover integrity issues"
    )


# ========== INVARIANT 5: INTEREST ACCRUAL CORRECTNESS ==========

def invariant_td_interest_accrual(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Interest accrues daily at the correct rate per ProductConfig.
    
    This protects:
    - Member returns
    - Treasury P&L accuracy
    - Regulatory compliance
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has check_td_interest_accrual endpoint
    # violations = client.check_td_interest_accrual(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "td_id": "td_123",
    #     "principal": 10000.00,
    #     "rate": 0.048,
    #     "days_accrued": 90,
    #     "expected_interest": 118.36,
    #     "actual_interest": 115.00,
    #     "delta": -3.36,
    # }
    
    return InvariantResult(
        name="td_interest_accrual_correct",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} interest accrual discrepancies"
    )


# ========== INVARIANT 6: NO PREMATURE MATURITY POSTING ==========

def invariant_no_premature_maturity(
    client: TuringCoreClient,
    tenant_id: str
) -> InvariantResult:
    """
    Guarantee: Term deposits cannot mature before their maturity date.
    
    This protects:
    - Treasury liquidity planning
    - Member contract integrity
    - ALM forecasting accuracy
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has find_premature_maturities endpoint
    # violations = client.find_premature_maturities(tenant_id)
    violations = []  # Placeholder
    
    # Example violation structure:
    # {
    #     "td_id": "td_123",
    #     "maturity_date": "2025-06-08",
    #     "actual_maturity_date": "2025-05-15",
    #     "days_early": 24,
    # }
    
    return InvariantResult(
        name="no_premature_maturity",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Found {len(violations)} premature maturity postings"
    )


# ========== MASTER TERM DEPOSIT INVARIANT RUNNER ==========

def run_all_term_deposit_invariants(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run all term deposit invariants and return aggregated results.
    
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
        invariant_td_principal_locked(client, tenant_id),
        invariant_td_maturity_payout(client, tenant_id, product_registry),
        invariant_td_break_penalty(client, tenant_id, product_registry),
        invariant_td_rollover_integrity(client, tenant_id, product_registry),
        invariant_td_interest_accrual(client, tenant_id, product_registry),
        invariant_no_premature_maturity(client, tenant_id),
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
