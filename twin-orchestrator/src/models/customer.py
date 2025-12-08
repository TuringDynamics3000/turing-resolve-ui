"""
Customer Models

Dataclasses for customer seeds (synthetic plans) and handles (links to TuringCore IDs).
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Dict, Optional


@dataclass
class CustomerSeed:
    """
    Synthetic "plan" for a customer before we call TuringCore.
    
    This is a pure data structure representing what we want to create,
    not yet tied to any TuringCore customer_id.
    """
    
    external_ref: str
    first_name: str
    last_name: str
    date_of_birth: date
    email: str
    mobile: str
    address: Dict[str, str]
    segment: str            # "RETAIL", "YOUTH", "SENIOR", etc.
    income_band: str        # e.g. "LOW", "MEDIUM", "HIGH"
    employment_status: str  # e.g. "FULL_TIME", "PART_TIME", "STUDENT"


@dataclass
class CustomerHandle:
    """
    Link between our synthetic seed and TuringCore's IDs.
    
    After calling CreateCustomer, we store this handle to track
    the mapping from external_ref to customer_id.
    """
    
    external_ref: str
    customer_id: str
