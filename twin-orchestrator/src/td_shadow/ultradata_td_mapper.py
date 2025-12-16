"""
UltraData → TuringCore Term Deposit Mapper

Maps UltraData term deposit format to TuringCore TermDepositOpened events.
This is the translation layer for shadow migration of term deposits.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from typing import Dict, Any, Optional


@dataclass
class UltraDataTermDeposit:
    """Raw UltraData term deposit record."""
    td_id: str
    account_id: str
    principal: float
    rate: float
    term_months: int
    open_date: str
    maturity_date: str
    status: str  # ACTIVE, MATURED, BROKEN
    product_code: str


@dataclass
class TuringCoreTermDepositEvent:
    """Mapped TuringCore TermDepositOpened event."""
    td_id: str
    account_id: str
    principal: float
    rate: float
    term_months: int
    open_date: str
    maturity_date: str
    product_code: str


def map_ultra_td(raw: Dict[str, Any]) -> TuringCoreTermDepositEvent:
    """
    Map UltraData term deposit to TuringCore TermDepositOpened event.
    
    Args:
        raw: Raw UltraData term deposit dict
    
    Returns:
        Mapped TuringCore term deposit event
    """
    return TuringCoreTermDepositEvent(
        td_id=raw["td_id"],
        account_id=raw["account_id"],
        principal=float(raw["principal"]),
        rate=float(raw["rate"]),
        term_months=int(raw["term_months"]),
        open_date=raw["open_date"],
        maturity_date=raw["maturity_date"],
        product_code=raw.get("product_code", "TERM_12M"),
    )


def map_ultra_td_batch(raw_batch: list[Dict[str, Any]]) -> list[TuringCoreTermDepositEvent]:
    """
    Map a batch of UltraData term deposits.
    
    Args:
        raw_batch: List of raw UltraData term deposits
    
    Returns:
        List of mapped TuringCore term deposit events
    """
    return [map_ultra_td(td) for td in raw_batch]


def calculate_maturity_date(open_date: date, term_months: int) -> date:
    """
    Calculate maturity date from open date and term.
    
    Args:
        open_date: Term deposit open date
        term_months: Term in months
    
    Returns:
        Maturity date
    """
    year = open_date.year + (open_date.month + term_months - 1) // 12
    month = (open_date.month + term_months - 1) % 12 + 1
    day = open_date.day
    
    # Handle month-end edge cases
    import calendar
    max_day = calendar.monthrange(year, month)[1]
    if day > max_day:
        day = max_day
    
    return date(year, month, day)


# Example usage
if __name__ == "__main__":
    # Sample UltraData term deposit
    ultra_td = {
        "td_id": "TD_123456",
        "account_id": "ACC_789",
        "principal": 10000.00,
        "rate": 0.048,
        "term_months": 12,
        "open_date": "2025-01-15",
        "maturity_date": "2026-01-15",
        "status": "ACTIVE",
        "product_code": "TERM_12M",
    }
    
    # Map to TuringCore event
    turing_event = map_ultra_td(ultra_td)
    
    print("UltraData → TuringCore Term Deposit Mapping:")
    print(f"  TD ID: {turing_event.td_id}")
    print(f"  Principal: ${turing_event.principal:,.2f}")
    print(f"  Rate: {turing_event.rate * 100:.2f}%")
    print(f"  Term: {turing_event.term_months} months")
    print(f"  Maturity: {turing_event.maturity_date}")
