"""
Tenant and Product Configuration Models

These dataclasses represent the tenant configuration loaded from cu-digital.yaml.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional


@dataclass
class ProductConfig:
    """Configuration for a single product (deposit, loan, card, etc.)."""
    
    code: str
    name: str
    product_type: str  # "DEPOSIT" | "LOAN" | "TERM_DEPOSIT" | "CARD"
    currency: str
    interest_rate: float
    monthly_fee: float
    constraints: Dict[str, object]


@dataclass
class TenantConfig:
    """Complete configuration for a CU tenant."""
    
    tenant_code: str
    display_name: str
    region: str
    base_currency: str
    time_zone: str
    products: List[ProductConfig]
    raw: Dict[str, object]  # underlying YAML for anything extra (AI flags, AML, etc.)
