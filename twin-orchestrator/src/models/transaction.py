"""
Transaction Models

Dataclasses for planned transactions (ledger-agnostic) that will be
converted to PostEntry commands.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, List, Literal


Direction = Literal["DEBIT", "CREDIT"]


@dataclass
class PlannedLeg:
    """
    A single leg of a multi-leg posting.
    
    Uses symbolic aliases (like "GL_SALARY_CLEARING" or "TXN_MAIN")
    that will be resolved to concrete accountIds later.
    """
    
    account_alias: str  # symbolic alias
    direction: Direction
    amount: float


@dataclass
class PlannedTransaction:
    """
    Ledger-agnostic transaction plan.
    
    This represents what we want to post, but doesn't yet have
    concrete accountIds. The mapping to concrete accountIds
    happens when converting to PostEntry payloads.
    """
    
    customer_external_ref: str
    booking_date: date
    value_date: date
    currency: str
    legs: List[PlannedLeg]
    narrative: str
    tags: Dict[str, str]
