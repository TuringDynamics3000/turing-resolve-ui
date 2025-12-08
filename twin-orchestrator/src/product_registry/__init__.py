"""
Product Registry Module

Handles loading and merging of product configurations for multi-tenant SaaS.
"""

from .tenant_merge import (
    deep_merge,
    load_tenant_product_registry,
    load_multi_tenant_registries,
)

__all__ = [
    "deep_merge",
    "load_tenant_product_registry",
    "load_multi_tenant_registries",
]
