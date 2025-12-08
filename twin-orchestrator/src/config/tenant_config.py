"""
Tenant Configuration Loader

Functions for loading tenant configuration from cu-digital.yaml into TenantConfig objects.
"""

from __future__ import annotations

from pathlib import Path
from typing import Dict, List

import yaml

from models.tenant import ProductConfig, TenantConfig


def load_tenant_config(config_path: str | Path) -> TenantConfig:
    """
    Load tenant configuration from YAML file.
    
    Args:
        config_path: Path to cu-digital.yaml
        
    Returns:
        TenantConfig object
        
    Implementation will:
    1. Load YAML file
    2. Extract tenant metadata (tenantCode, displayName, region, baseCurrency, timeZone)
    3. Parse products list into ProductConfig objects
    4. Store raw YAML in TenantConfig.raw for demographics, AI config, etc.
    5. Return TenantConfig
    """
    with open(config_path, "r") as f:
        raw = yaml.safe_load(f)
    
    # TODO: parse raw YAML into TenantConfig
    raise NotImplementedError


def _parse_product(product_dict: Dict) -> ProductConfig:
    """
    Parse a single product from YAML dict into ProductConfig.
    
    Args:
        product_dict: Product configuration from YAML
        
    Returns:
        ProductConfig object
    """
    # TODO: implement
    raise NotImplementedError
