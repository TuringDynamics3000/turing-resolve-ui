"""
UltraData → TuringCore Credit Card Mapper

Maps UltraData credit card format to TuringCore CreditCardApproved events.
This is the translation layer for shadow migration of credit cards.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Dict, Any, Optional


@dataclass
class UltraDataCreditCard:
    """Raw UltraData credit card record."""
    card_id: str
    account_id: str
    credit_limit: float
    current_balance: float
    available_credit: float
    purchase_rate: float
    cash_rate: float
    status: str  # ACTIVE, CLOSED, SUSPENDED
    product_code: str


@dataclass
class TuringCoreCreditCardEvent:
    """Mapped TuringCore CreditCardApproved event."""
    card_id: str
    account_id: str
    credit_limit: float
    current_balance: float
    available_credit: float
    purchase_rate: float
    product_code: str


def map_ultra_cc(raw: Dict[str, Any]) -> TuringCoreCreditCardEvent:
    """
    Map UltraData credit card to TuringCore CreditCardApproved event.
    
    Args:
        raw: Raw UltraData credit card dict
    
    Returns:
        Mapped TuringCore credit card event
    """
    return TuringCoreCreditCardEvent(
        card_id=raw["card_id"],
        account_id=raw["account_id"],
        credit_limit=float(raw["credit_limit"]),
        current_balance=float(raw["current_balance"]),
        available_credit=float(raw.get("available_credit", 0.0)),
        purchase_rate=float(raw.get("purchase_rate", 18.99)),
        product_code=raw.get("product_code", "CC_STD"),
    )


def map_ultra_cc_batch(raw_batch: list[Dict[str, Any]]) -> list[TuringCoreCreditCardEvent]:
    """
    Map a batch of UltraData credit cards.
    
    Args:
        raw_batch: List of raw UltraData credit cards
    
    Returns:
        List of mapped TuringCore credit card events
    """
    return [map_ultra_cc(cc) for cc in raw_batch]


def calculate_available_credit(credit_limit: float, current_balance: float) -> float:
    """
    Calculate available credit.
    
    Args:
        credit_limit: Credit limit
        current_balance: Current balance
    
    Returns:
        Available credit
    """
    return max(0.0, credit_limit - current_balance)


# Example usage
if __name__ == "__main__":
    # Sample UltraData credit card
    ultra_cc = {
        "card_id": "CC_123456",
        "account_id": "ACC_789",
        "credit_limit": 10000.00,
        "current_balance": 2500.00,
        "available_credit": 7500.00,
        "purchase_rate": 18.99,
        "cash_rate": 21.99,
        "status": "ACTIVE",
        "product_code": "CC_STD",
    }
    
    # Map to TuringCore event
    turing_event = map_ultra_cc(ultra_cc)
    
    print("UltraData → TuringCore Credit Card Mapping:")
    print(f"  Card ID: {turing_event.card_id}")
    print(f"  Credit Limit: ${turing_event.credit_limit:,.2f}")
    print(f"  Current Balance: ${turing_event.current_balance:,.2f}")
    print(f"  Available Credit: ${turing_event.available_credit:,.2f}")
    print(f"  Purchase Rate: {turing_event.purchase_rate}%")
