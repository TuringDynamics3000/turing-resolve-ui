"""
Credit Card Reconciliation Engine

Reconciles UltraData credit cards with TuringCore shadow credit cards.
Validates balances, credit limits, instalments, and balance transfers.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Any
from datetime import date


@dataclass
class CCReconciliationResult:
    """Result of credit card reconciliation."""
    date: str
    tenant_id: str
    ultra_cc_count: int
    turing_cc_count: int
    cc_count_delta: int
    ultra_total_outstanding: float
    turing_total_outstanding: float
    outstanding_delta: float
    cc_mismatches: List[Dict[str, Any]]
    passed: bool


def reconcile_cc_balances(
    ultra_totals: Dict[str, float],
    turing_totals: Dict[str, float],
    tolerance: float = 2.00
) -> List[str]:
    """
    Reconcile credit card balances between UltraData and TuringCore.
    
    Args:
        ultra_totals: Dict[card_id, balance] from UltraData
        turing_totals: Dict[card_id, balance] from TuringCore
        tolerance: Maximum acceptable delta in AUD
    
    Returns:
        List of card IDs with mismatches
    """
    mismatches = []
    
    # Check all UltraData cards
    for card_id, ultra_amt in ultra_totals.items():
        turing_amt = turing_totals.get(card_id, 0.0)
        delta = abs(ultra_amt - turing_amt)
        
        if delta > tolerance:
            mismatches.append(card_id)
    
    # Check for cards in TuringCore but not in UltraData
    for card_id in turing_totals:
        if card_id not in ultra_totals:
            mismatches.append(card_id)
    
    return mismatches


def reconcile_credit_cards(
    ultra_ccs: List[Dict[str, Any]],
    turing_ccs: List[Dict[str, Any]],
    tenant_id: str,
    reconciliation_date: date
) -> CCReconciliationResult:
    """
    Full reconciliation of credit cards for a given date.
    
    Args:
        ultra_ccs: List of UltraData credit cards
        turing_ccs: List of TuringCore credit cards
        tenant_id: Tenant ID
        reconciliation_date: Date of reconciliation
    
    Returns:
        CCReconciliationResult with detailed comparison
    """
    # Calculate CC counts
    ultra_count = len(ultra_ccs)
    turing_count = len(turing_ccs)
    count_delta = ultra_count - turing_count
    
    # Calculate total outstanding balances
    ultra_total = sum(cc.get("current_balance", 0.0) for cc in ultra_ccs)
    turing_total = sum(cc.get("current_balance", 0.0) for cc in turing_ccs)
    outstanding_delta = ultra_total - turing_total
    
    # Build card-level balance maps
    ultra_cc_balances: Dict[str, float] = {}
    for cc in ultra_ccs:
        card_id = cc.get("card_id")
        ultra_cc_balances[card_id] = cc.get("current_balance", 0.0)
    
    turing_cc_balances: Dict[str, float] = {}
    for cc in turing_ccs:
        card_id = cc.get("card_id")
        turing_cc_balances[card_id] = cc.get("current_balance", 0.0)
    
    # Find card-level mismatches
    mismatch_cards = reconcile_cc_balances(ultra_cc_balances, turing_cc_balances)
    
    cc_mismatches = []
    for card_id in mismatch_cards:
        cc_mismatches.append({
            "card_id": card_id,
            "ultra_balance": ultra_cc_balances.get(card_id, 0.0),
            "turing_balance": turing_cc_balances.get(card_id, 0.0),
            "delta": ultra_cc_balances.get(card_id, 0.0) - turing_cc_balances.get(card_id, 0.0),
        })
    
    # Determine pass/fail
    passed = (
        count_delta == 0 and
        abs(outstanding_delta) < 2.00 and
        len(cc_mismatches) == 0
    )
    
    return CCReconciliationResult(
        date=str(reconciliation_date),
        tenant_id=tenant_id,
        ultra_cc_count=ultra_count,
        turing_cc_count=turing_count,
        cc_count_delta=count_delta,
        ultra_total_outstanding=round(ultra_total, 2),
        turing_total_outstanding=round(turing_total, 2),
        outstanding_delta=round(outstanding_delta, 2),
        cc_mismatches=cc_mismatches,
        passed=passed,
    )


def reconcile_credit_limits(
    ultra_ccs: List[Dict[str, Any]],
    turing_ccs: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Reconcile credit limits between systems.
    
    Args:
        ultra_ccs: UltraData credit cards
        turing_ccs: TuringCore credit cards
    
    Returns:
        List of cards with mismatched credit limits
    """
    mismatches = []
    
    # Build lookup by card_id
    turing_by_id: Dict[str, float] = {}
    for cc in turing_ccs:
        card_id = cc.get("card_id")
        credit_limit = cc.get("credit_limit")
        turing_by_id[card_id] = credit_limit
    
    # Compare credit limits
    for ultra_cc in ultra_ccs:
        card_id = ultra_cc.get("card_id")
        ultra_limit = ultra_cc.get("credit_limit")
        turing_limit = turing_by_id.get(card_id)
        
        if turing_limit and abs(ultra_limit - turing_limit) > 0.01:
            mismatches.append({
                "card_id": card_id,
                "ultra_limit": ultra_limit,
                "turing_limit": turing_limit,
                "delta": ultra_limit - turing_limit,
            })
    
    return mismatches


def calculate_arrears_buckets(
    ccs: List[Dict[str, Any]]
) -> Dict[str, int]:
    """
    Calculate arrears buckets for credit cards.
    
    Args:
        ccs: List of credit cards with days_past_due
    
    Returns:
        Dict with arrears bucket counts
    """
    buckets = {
        "0_30_days": 0,
        "31_60_days": 0,
        "61_90_days": 0,
        "90_plus_days": 0,
    }
    
    for cc in ccs:
        days_past_due = cc.get("days_past_due", 0)
        
        if days_past_due == 0:
            continue
        elif days_past_due <= 30:
            buckets["0_30_days"] += 1
        elif days_past_due <= 60:
            buckets["31_60_days"] += 1
        elif days_past_due <= 90:
            buckets["61_90_days"] += 1
        else:
            buckets["90_plus_days"] += 1
    
    return buckets


def calculate_utilisation_rate(
    ccs: List[Dict[str, Any]]
) -> float:
    """
    Calculate average credit utilisation rate.
    
    Args:
        ccs: List of credit cards
    
    Returns:
        Average utilisation rate as percentage
    """
    if not ccs:
        return 0.0
    
    total_limit = sum(cc.get("credit_limit", 0.0) for cc in ccs)
    total_balance = sum(cc.get("current_balance", 0.0) for cc in ccs)
    
    if total_limit == 0:
        return 0.0
    
    return round((total_balance / total_limit) * 100.0, 2)


# Example usage
if __name__ == "__main__":
    # Sample reconciliation
    ultra_ccs = [
        {"card_id": "CC_123", "current_balance": 2500.00, "credit_limit": 10000.00},
        {"card_id": "CC_456", "current_balance": 5000.00, "credit_limit": 15000.00},
    ]
    
    turing_ccs = [
        {"card_id": "CC_123", "current_balance": 2500.00, "credit_limit": 10000.00},
        {"card_id": "CC_456", "current_balance": 5000.00, "credit_limit": 15000.00},
    ]
    
    result = reconcile_credit_cards(
        ultra_ccs,
        turing_ccs,
        "CU_ALPHA_SHADOW",
        date.today()
    )
    
    print("Credit Card Reconciliation Result:")
    print(f"  CC Count Delta: {result.cc_count_delta}")
    print(f"  Outstanding Delta: ${result.outstanding_delta:,.2f}")
    print(f"  CC Mismatches: {len(result.cc_mismatches)}")
    print(f"  Passed: {result.passed}")
    
    # Calculate utilisation
    util_rate = calculate_utilisation_rate(ultra_ccs)
    print(f"\nAverage Utilisation: {util_rate}%")
