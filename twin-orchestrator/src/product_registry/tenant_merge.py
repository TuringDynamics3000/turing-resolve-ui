"""
Tenant Override Merge Engine

This module implements deterministic deep merging of:
- Base product catalog (cu_products_base.yaml)
- Tenant-specific overrides (tenants/cu_alpha.yaml, tenants/cu_beta.yaml)

The result is a tenant-specific product registry that can be loaded at runtime
without any code changes.

This is the core of "Product Factory as a Service" multi-tenancy.
"""

from __future__ import annotations

import copy
import yaml
from pathlib import Path
from typing import Dict, Callable, Any


def deep_merge(base: dict, override: dict) -> dict:
    """
    Recursively merge override dict into base dict.
    
    Rules:
    - If value is dict in both, recurse
    - Otherwise, override wins
    - Lists are replaced, not merged
    
    Args:
        base: Base dictionary
        override: Override dictionary
    
    Returns:
        Merged dictionary (base is not mutated)
    """
    result = copy.deepcopy(base)
    
    for key, value in override.items():
        if isinstance(value, dict) and key in result and isinstance(result[key], dict):
            # Recurse for nested dicts
            result[key] = deep_merge(result[key], value)
        else:
            # Override wins (including lists, primitives, nulls)
            result[key] = value
    
    return result


def load_tenant_product_registry(
    base_path: str | Path,
    tenant_override_path: str | Path,
    parser_fn: Callable[[dict], Any]
) -> Dict[str, Any]:
    """
    Load tenant-specific product registry by merging base + overrides.
    
    Process:
    1. Load base product catalog (cu_products_base.yaml)
    2. Load tenant overrides (tenants/cu_alpha.yaml)
    3. For each product in base:
       a. Deep merge with tenant override (if exists)
       b. Parse merged dict into ProductConfig
       c. Add to registry
    
    Args:
        base_path: Path to cu_products_base.yaml
        tenant_override_path: Path to tenants/cu_*.yaml
        parser_fn: Function to convert dict → ProductConfig
    
    Returns:
        Dict[product_code, ProductConfig]
    
    Example:
        from turingcore_v3.domains.product_configuration.loader import parse_yaml_to_productconfig
        
        registry = load_tenant_product_registry(
            base_path="config/cu_products_base.yaml",
            tenant_override_path="config/tenants/cu_alpha.yaml",
            parser_fn=parse_yaml_to_productconfig
        )
        
        # Now registry["TXN_EVERYDAY"] has CU Alpha's pricing
        # registry["SAVER_BONUS"] has CU Alpha's rates
    """
    base_path = Path(base_path)
    tenant_override_path = Path(tenant_override_path)
    
    if not base_path.exists():
        raise FileNotFoundError(f"Base product catalog not found: {base_path}")
    
    if not tenant_override_path.exists():
        raise FileNotFoundError(f"Tenant override file not found: {tenant_override_path}")
    
    # Load YAML files
    with open(base_path, "r") as f:
        base_raw = yaml.safe_load(f)
    
    with open(tenant_override_path, "r") as f:
        tenant_raw = yaml.safe_load(f)
    
    # Extract products and overrides
    base_products = base_raw.get("products", [])
    tenant_overrides = tenant_raw.get("overrides", {})
    
    # Build registry
    registry = {}
    
    for product_dict in base_products:
        product_code = product_dict["product_code"]
        
        # Deep merge with tenant override (if exists)
        if product_code in tenant_overrides:
            merged_dict = deep_merge(product_dict, tenant_overrides[product_code])
        else:
            merged_dict = product_dict
        
        # Parse into ProductConfig
        product_config = parser_fn(merged_dict)
        
        # Add to registry
        registry[product_code] = product_config
    
    return registry


def load_multi_tenant_registries(
    base_path: str | Path,
    tenant_override_dir: str | Path,
    parser_fn: Callable[[dict], Any]
) -> Dict[str, Dict[str, Any]]:
    """
    Load product registries for ALL tenants in a directory.
    
    Args:
        base_path: Path to cu_products_base.yaml
        tenant_override_dir: Path to tenants/ directory
        parser_fn: Function to convert dict → ProductConfig
    
    Returns:
        Dict[tenant_code, Dict[product_code, ProductConfig]]
    
    Example:
        registries = load_multi_tenant_registries(
            base_path="config/cu_products_base.yaml",
            tenant_override_dir="config/tenants/",
            parser_fn=parse_yaml_to_productconfig
        )
        
        # registries["CU_ALPHA"]["TXN_EVERYDAY"] → CU Alpha's TXN product
        # registries["CU_BETA"]["TXN_EVERYDAY"] → CU Beta's TXN product
    """
    tenant_override_dir = Path(tenant_override_dir)
    
    if not tenant_override_dir.exists():
        raise FileNotFoundError(f"Tenant override directory not found: {tenant_override_dir}")
    
    registries = {}
    
    for tenant_file in tenant_override_dir.glob("*.yaml"):
        # Load tenant metadata
        with open(tenant_file, "r") as f:
            tenant_raw = yaml.safe_load(f)
        
        tenant_code = tenant_raw.get("tenant_code")
        
        if not tenant_code:
            raise ValueError(f"Tenant file missing tenant_code: {tenant_file}")
        
        # Load registry for this tenant
        registry = load_tenant_product_registry(
            base_path=base_path,
            tenant_override_path=tenant_file,
            parser_fn=parser_fn
        )
        
        registries[tenant_code] = registry
    
    return registries
