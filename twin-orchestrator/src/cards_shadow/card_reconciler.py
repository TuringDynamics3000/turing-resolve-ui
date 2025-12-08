"""
Debit Card Reconciliation Engine

Reconciles UltraData card transactions with TuringCore shadow card transactions.
Validates transaction counts, amounts, and authorisation outcomes.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Any
from datetime import date


@dataclass
class CardReconciliationResult:
    """Result of card reconciliation."""
    date: str
    tenant_id: str
    ultra_transaction_count: int
    turing_transaction_count: int
    transaction_delta: int
    ultra_total_spend: float
    turing_total_spend: float
    spend_delta: float
    card_mismatches: List[Dict[str, Any]]
    passed: bool


def reconcile_card_spend(
    ultra_totals: Dict[str, float],
    turing_totals: Dict[str, float],
    tolerance: float = 1.00
) -> List[str]:
    """
    Reconcile card spend totals between UltraData and TuringCore.
    
    Args:
        ultra_totals: Dict[card_id, total_spend] from UltraData
        turing_totals: Dict[card_id, total_spend] from TuringCore
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


def reconcile_card_transactions(
    ultra_transactions: List[Dict[str, Any]],
    turing_transactions: List[Dict[str, Any]],
    tenant_id: str,
    reconciliation_date: date
) -> CardReconciliationResult:
    """
    Full reconciliation of card transactions for a given date.
    
    Args:
        ultra_transactions: List of UltraData card transactions
        turing_transactions: List of TuringCore card transactions
        tenant_id: Tenant ID
        reconciliation_date: Date of reconciliation
    
    Returns:
        CardReconciliationResult with detailed comparison
    """
    # Calculate transaction counts
    ultra_count = len(ultra_transactions)
    turing_count = len(turing_transactions)
    transaction_delta = ultra_count - turing_count
    
    # Calculate total spend
    ultra_total = sum(tx.get("amount", 0.0) for tx in ultra_transactions)
    turing_total = sum(tx.get("amount", 0.0) for tx in turing_transactions)
    spend_delta = ultra_total - turing_total
    
    # Build card-level spend maps
    ultra_card_spend: Dict[str, float] = {}
    for tx in ultra_transactions:
        card_id = tx.get("card_id") or f"card_{tx.get('pan_last4')}"
        ultra_card_spend[card_id] = ultra_card_spend.get(card_id, 0.0) + tx.get("amount", 0.0)
    
    turing_card_spend: Dict[str, float] = {}
    for tx in turing_transactions:
        card_id = tx.get("card_id")
        turing_card_spend[card_id] = turing_card_spend.get(card_id, 0.0) + tx.get("amount", 0.0)
    
    # Find card-level mismatches
    mismatch_cards = reconcile_card_spend(ultra_card_spend, turing_card_spend)
    
    card_mismatches = []
    for card_id in mismatch_cards:
        card_mismatches.append({
            "card_id": card_id,
            "ultra_spend": ultra_card_spend.get(card_id, 0.0),
            "turing_spend": turing_card_spend.get(card_id, 0.0),
            "delta": ultra_card_spend.get(card_id, 0.0) - turing_card_spend.get(card_id, 0.0),
        })
    
    # Determine pass/fail
    passed = (
        transaction_delta == 0 and
        abs(spend_delta) < 1.00 and
        len(card_mismatches) == 0
    )
    
    return CardReconciliationResult(
        date=str(reconciliation_date),
        tenant_id=tenant_id,
        ultra_transaction_count=ultra_count,
        turing_transaction_count=turing_count,
        transaction_delta=transaction_delta,
        ultra_total_spend=round(ultra_total, 2),
        turing_total_spend=round(turing_total, 2),
        spend_delta=round(spend_delta, 2),
        card_mismatches=card_mismatches,
        passed=passed,
    )


def reconcile_authorisation_outcomes(
    ultra_transactions: List[Dict[str, Any]],
    turing_transactions: List[Dict[str, Any]]
) -> List[Dict[str, Any]]:
    """
    Reconcile authorisation outcomes (approved/declined) between systems.
    
    Args:
        ultra_transactions: UltraData transactions with response codes
        turing_transactions: TuringCore transactions with approval status
    
    Returns:
        List of transactions with mismatched outcomes
    """
    mismatches = []
    
    # Build lookup by auth_id
    turing_by_auth: Dict[str, bool] = {}
    for tx in turing_transactions:
        auth_id = tx.get("auth_id")
        was_approved = tx.get("was_approved", True)
        turing_by_auth[auth_id] = was_approved
    
    # Compare outcomes
    for ultra_tx in ultra_transactions:
        auth_id = ultra_tx.get("auth_code")
        ultra_approved = ultra_tx.get("response_code") == "00"
        turing_approved = turing_by_auth.get(auth_id)
        
        if turing_approved is not None and ultra_approved != turing_approved:
            mismatches.append({
                "auth_id": auth_id,
                "ultra_approved": ultra_approved,
                "turing_approved": turing_approved,
                "amount": ultra_tx.get("amount"),
            })
    
    return mismatches


# Example usage
if __name__ == "__main__":
    # Sample reconciliation
    ultra_txs = [
        {"pan_last4": "1234", "amount": 45.50, "auth_code": "AUTH1", "response_code": "00"},
        {"pan_last4": "1234", "amount": 12.00, "auth_code": "AUTH2", "response_code": "00"},
        {"pan_last4": "5678", "amount": 100.00, "auth_code": "AUTH3", "response_code": "00"},
    ]
    
    turing_txs = [
        {"card_id": "card_1234", "amount": 45.50, "auth_id": "AUTH1", "was_approved": True},
        {"card_id": "card_1234", "amount": 12.00, "auth_id": "AUTH2", "was_approved": True},
        {"card_id": "card_5678", "amount": 100.00, "auth_id": "AUTH3", "was_approved": True},
    ]
    
    result = reconcile_card_transactions(
        ultra_txs,
        turing_txs,
        "CU_ALPHA_SHADOW",
        date.today()
    )
    
    print("Card Reconciliation Result:")
    print(f"  Transaction Delta: {result.transaction_delta}")
    print(f"  Spend Delta: ${result.spend_delta}")
    print(f"  Card Mismatches: {len(result.card_mismatches)}")
    print(f"  Passed: {result.passed}")
