"""
Term Deposit Reconciliation Engine

Reconciles UltraData term deposits with TuringCore shadow term deposits.
Validates balances, maturity dates, interest rates, and lifecycle events.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Any
from datetime import date


@dataclass
class TDReconciliationResult:
    """Result of term deposit reconciliation."""
    date: str
    tenant_id: str
    ultra_td_count: int
    turing_td_count: int
    td_count_delta: int
    ultra_total_balance: float
    turing_total_balance: float
    balance_delta: float
    td_mismatches: List[Dict[str, Any]]
    passed: bool


def reconcile_td_balances(
    ultra_totals: Dict[str, float],
    turing_totals: Dict[str, float],
    tolerance: float = 1.00
) -> List[str]:
    """
    Reconcile term deposit balances between UltraData and TuringCore.
    
    Args:
        ultra_totals: Dict[td_id, balance] from UltraData
        turing_totals: Dict[td_id, balance] from TuringCore
        tolerance: Maximum acceptable delta in AUD
    
    Returns:
        List of TD IDs with mismatches
    """
    mismatches = []
    
    # Check all UltraData TDs
    for td_id, ultra_amt in ultra_totals.items():
        turing_amt = turing_totals.get(td_id, 0.0)
        delta = abs(ultra_amt - turing_amt)
        
        if delta > tolerance:
            mismatches.append(td_id)
    
    # Check for TDs in TuringCore but not in UltraData
    for td_id in turing_totals:
        if td_id not in ultra_totals:
            mismatches.append(td_id)
    
    return mismatches


def reconcile_term_deposits(
    ultra_tds: List[Dict[str, Any]],
    turing_tds: List[Dict[str, Any]],
    tenant_id: str,
    reconciliation_date: date
) -> TDReconciliationResult:
    """
    Full reconciliation of term deposits for a given date.
    
    Args:
        ultra_tds: List of UltraData term deposits
        turing_tds: List of TuringCore term deposits
        tenant_id: Tenant ID
        reconciliation_date: Date of reconciliation
    
    Returns:
        TDReconciliationResult with detailed comparison
    """
    # Calculate TD counts
    ultra_count = len(ultra_tds)
    turing_count = len(turing_tds)
    count_delta = ultra_count - turing_count
    
    # Calculate total balances (principal only)
    ultra_total = sum(td.get("principal", 0.0) for td in ultra_tds)
    turing_total = sum(td.get("principal", 0.0) for td in turing_tds)
    balance_delta = ultra_total - turing_total
    
    # Build TD-level balance maps
    ultra_td_balances: Dict[str, float] = {}
    for td in ultra_tds:
        td_id = td.get("td_id")
        ultra_td_balances[td_id] = td.get("principal", 0.0)
    
    turing_td_balances: Dict[str, float] = {}
    for td in turing_tds:
        td_id = td.get("td_id")
        turing_td_balances[td_id] = td.get("principal", 0.0)
    
    # Find TD-level mismatches
    mismatch_tds = reconcile_td_balances(ultra_td_balances, turing_td_balances)
    
    td_mismatches = []
    for td_id in mismatch_tds:
        td_mismatches.append({
            "td_id": td_id,
            "ultra_balance": ultra_td_balances.get(td_id, 0.0),
            "turing_balance": turing_td_balances.get(td_id, 0.0),
            "delta": ultra_td_balances.get(td_id, 0.0) - turing_td_balances.get(td_id, 0.0),
        })
    
    # Determine pass/fail
    passed = (
        count_delta == 0 and
        abs(balance_delta) < 1.00 and
        len(td_mismatches) == 0
    )
    
    return TDReconciliationResult(
        date=str(reconciliation_date),
        tenant_id=tenant_id,
        ultra_td_count=ultra_count,
        turing_td_count=turing_count,
        td_count_delta=count_delta,
        ultra_total_balance=round(ultra_total, 2),
        turing_total_balance=round(turing_total, 2),
        balance_delta=round(balance_delta, 2),
        td_mismatches=td_mismatches,
        passed=passed,
    )


def reconcile_maturity_dates(
    ultra_tds: List[Dict[str, Any]],
    turing_tds: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Reconcile maturity dates between systems.
    
    Args:
        ultra_tds: UltraData term deposits
        turing_tds: TuringCore term deposits
    
    Returns:
        List of TDs with mismatched maturity dates
    """
    mismatches = []
    
    # Build lookup by td_id
    turing_by_id: Dict[str, str] = {}
    for td in turing_tds:
        td_id = td.get("td_id")
        maturity_date = td.get("maturity_date")
        turing_by_id[td_id] = maturity_date
    
    # Compare maturity dates
    for ultra_td in ultra_tds:
        td_id = ultra_td.get("td_id")
        ultra_maturity = ultra_td.get("maturity_date")
        turing_maturity = turing_by_id.get(td_id)
        
        if turing_maturity and ultra_maturity != turing_maturity:
            mismatches.append({
                "td_id": td_id,
                "ultra_maturity": ultra_maturity,
                "turing_maturity": turing_maturity,
                "principal": ultra_td.get("principal"),
            })
    
    return mismatches


def calculate_td_maturity_ladder(
    tds: List[Dict[str, Any]],
    as_of_date: date
) -> Dict[str, float]:
    """
    Calculate term deposit maturity ladder (30/60/90 days).
    
    Args:
        tds: List of term deposits
        as_of_date: Reference date
    
    Returns:
        Dict with maturity buckets and amounts
    """
    from datetime import timedelta
    
    ladder = {
        "0_30_days": 0.0,
        "31_60_days": 0.0,
        "61_90_days": 0.0,
        "91_plus_days": 0.0,
    }
    
    for td in tds:
        maturity_str = td.get("maturity_date")
        if not maturity_str:
            continue
        
        maturity_date = date.fromisoformat(maturity_str)
        days_to_maturity = (maturity_date - as_of_date).days
        principal = td.get("principal", 0.0)
        
        if days_to_maturity <= 30:
            ladder["0_30_days"] += principal
        elif days_to_maturity <= 60:
            ladder["31_60_days"] += principal
        elif days_to_maturity <= 90:
            ladder["61_90_days"] += principal
        else:
            ladder["91_plus_days"] += principal
    
    return ladder


# Example usage
if __name__ == "__main__":
    # Sample reconciliation
    ultra_tds = [
        {"td_id": "TD_123", "principal": 10000.00, "maturity_date": "2026-01-15"},
        {"td_id": "TD_456", "principal": 25000.00, "maturity_date": "2025-06-15"},
    ]
    
    turing_tds = [
        {"td_id": "TD_123", "principal": 10000.00, "maturity_date": "2026-01-15"},
        {"td_id": "TD_456", "principal": 25000.00, "maturity_date": "2025-06-15"},
    ]
    
    result = reconcile_term_deposits(
        ultra_tds,
        turing_tds,
        "CU_ALPHA_SHADOW",
        date.today()
    )
    
    print("Term Deposit Reconciliation Result:")
    print(f"  TD Count Delta: {result.td_count_delta}")
    print(f"  Balance Delta: ${result.balance_delta:,.2f}")
    print(f"  TD Mismatches: {len(result.td_mismatches)}")
    print(f"  Passed: {result.passed}")
    
    # Calculate maturity ladder
    ladder = calculate_td_maturity_ladder(ultra_tds, date.today())
    print("\nMaturity Ladder:")
    for bucket, amount in ladder.items():
        print(f"  {bucket}: ${amount:,.2f}")
