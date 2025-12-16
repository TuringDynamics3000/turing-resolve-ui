"""
UltraData → TuringCore Debit Card Transaction Mapper

Maps UltraData card transaction format to TuringCore DebitAuthorised events.
This is the translation layer for shadow migration.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Dict, Any, Optional


@dataclass
class UltraDataCardTransaction:
    """Raw UltraData card transaction record."""
    pan_last4: str
    amount: float
    mcc: str
    merchant_name: str
    merchant_country: str
    timestamp: str
    auth_code: str
    response_code: str
    transaction_type: str  # PURCHASE, ATM_WITHDRAWAL, REFUND
    currency: str


@dataclass
class TuringCoreDebitEvent:
    """Mapped TuringCore DebitAuthorised event."""
    card_id: str
    amount: float
    mcc: str
    merchant_name: str
    merchant_country: str
    timestamp: str
    auth_id: str
    transaction_type: str
    currency: str
    was_approved: bool


def map_ultra_card_tx(raw: Dict[str, Any]) -> TuringCoreDebitEvent:
    """
    Map UltraData card transaction to TuringCore DebitAuthorised event.
    
    Args:
        raw: Raw UltraData transaction dict
    
    Returns:
        Mapped TuringCore debit event
    """
    # Map response code to approval status
    # UltraData: "00" = approved, anything else = declined
    was_approved = raw.get("response_code") == "00"
    
    return TuringCoreDebitEvent(
        card_id=f"card_{raw['pan_last4']}",
        amount=float(raw["amount"]),
        mcc=raw["mcc"],
        merchant_name=raw.get("merchant_name", "Unknown"),
        merchant_country=raw.get("merchant_country", "AU"),
        timestamp=raw["timestamp"],
        auth_id=raw["auth_code"],
        transaction_type=raw.get("transaction_type", "PURCHASE"),
        currency=raw.get("currency", "AUD"),
        was_approved=was_approved,
    )


def map_ultra_card_batch(raw_batch: list[Dict[str, Any]]) -> list[TuringCoreDebitEvent]:
    """
    Map a batch of UltraData card transactions.
    
    Args:
        raw_batch: List of raw UltraData transactions
    
    Returns:
        List of mapped TuringCore debit events
    """
    return [map_ultra_card_tx(tx) for tx in raw_batch]


def extract_card_id_from_ultra(pan_last4: str, account_id: str) -> str:
    """
    Generate consistent card ID from UltraData identifiers.
    
    Args:
        pan_last4: Last 4 digits of PAN
        account_id: UltraData account ID
    
    Returns:
        TuringCore card ID
    """
    return f"card_{account_id}_{pan_last4}"


# Example usage
if __name__ == "__main__":
    # Sample UltraData card transaction
    ultra_tx = {
        "pan_last4": "1234",
        "amount": 45.50,
        "mcc": "5411",  # Grocery stores
        "merchant_name": "WOOLWORTHS",
        "merchant_country": "AU",
        "timestamp": "2025-12-08T14:32:15Z",
        "auth_code": "AUTH123456",
        "response_code": "00",
        "transaction_type": "PURCHASE",
        "currency": "AUD",
    }
    
    # Map to TuringCore event
    turing_event = map_ultra_card_tx(ultra_tx)
    
    print("UltraData → TuringCore Card Transaction Mapping:")
    print(f"  Card ID: {turing_event.card_id}")
    print(f"  Amount: ${turing_event.amount}")
    print(f"  MCC: {turing_event.mcc}")
    print(f"  Merchant: {turing_event.merchant_name}")
    print(f"  Approved: {turing_event.was_approved}")
