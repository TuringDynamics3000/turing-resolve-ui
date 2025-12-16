"""
Tenant Configuration Loader

Functions for loading tenant configuration from cu-digital.yaml into TenantConfig objects.
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List

import yaml

from models.tenant import ProductConfig, TenantConfig


def load_tenant_config(path: str | Path) -> TenantConfig:
    """
    Load cu-digital.yaml (or similar) into TenantConfig.

    Expected shape (simplified):
      tenant:
        code: "CU_DIGITAL"
        displayName: "CU Digital Twin"
        region: "AU"
        baseCurrency: "AUD"
        timeZone: "Australia/Sydney"
      products:
        - code: "TXN_EVERYDAY"
          name: "Everyday Transaction Account"
          type: "DEPOSIT"
          currency: "AUD"
          interestRate: 0.0
          monthlyFee: 0.0
          constraints: {...}

      # anything else goes into raw
      
    Args:
        path: Path to cu-digital.yaml
        
    Returns:
        TenantConfig object
    """
    path = Path(path)
    data: Dict[str, Any] = yaml.safe_load(path.read_text(encoding="utf-8"))

    tenant_raw = data.get("tenant", {})
    products_raw: List[Dict[str, Any]] = data.get("products", [])

    tenant_cfg = TenantConfig(
        tenant_code=tenant_raw["code"],
        display_name=tenant_raw["displayName"],
        region=tenant_raw.get("region", "AU"),
        base_currency=tenant_raw.get("baseCurrency", "AUD"),
        time_zone=tenant_raw.get("timeZone", "Australia/Sydney"),
        products=[
            ProductConfig(
                code=p["code"],
                name=p["name"],
                product_type=p["type"],
                currency=p.get("currency", tenant_raw.get("baseCurrency", "AUD")),
                interest_rate=float(p.get("interestRate", 0.0)),
                monthly_fee=float(p.get("monthlyFee", 0.0)),
                constraints=p.get("constraints", {}),
            )
            for p in products_raw
        ],
        raw=data,
    )
    return tenant_cfg
