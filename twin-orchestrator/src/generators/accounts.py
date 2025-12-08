"""
Account Assignment Generator

Pure functions for deciding which products each customer should hold,
based on segment and product catalog.

These functions do NOT call TuringCore - they only return AccountPlan objects.
"""

from __future__ import annotations

from random import Random
from typing import Dict, List

from models.account import AccountPlan
from models.customer import CustomerSeed
from models.tenant import TenantConfig


def plan_accounts_for_customers(
    tenant_cfg: TenantConfig,
    customers: List[CustomerSeed],
    rng: Random,
) -> List[AccountPlan]:
    """
    Decide which products each customer should hold, based on segment and product catalog.

    E.g.:
    - All customers get a TXN account.
    - Youth segment gets a YOUTH_SAVER if defined.
    - High-income segments may get a credit card or home loan.

    PURE: returns plans; does not call TuringCore.
    
    Args:
        tenant_cfg: Tenant configuration with product catalog
        customers: List of CustomerSeed objects
        rng: Random number generator for reproducibility
        
    Returns:
        List of AccountPlan objects mapping customers to products
        
    Implementation will:
    - Iterate through customers
    - For each customer, determine which products they should have based on:
      * Segment (RETAIL, YOUTH, SENIOR)
      * Income band (LOW, MEDIUM, HIGH)
      * Employment status
      * Random variation (some customers get more products than others)
    - Return AccountPlan for each customer
    """
    raise NotImplementedError


def build_open_account_payloads(
    tenant_cfg: TenantConfig,
    account_plans: List[AccountPlan],
    customer_handles: Dict[str, str],  # external_ref -> customer_id
) -> List[dict]:
    """
    Convert AccountPlan objects into concrete OpenAccount command payloads.

    Returns a list of payload dicts, each of which can be passed into:
        client.open_account(tenant_id, payload, idem_key=...)
        
    Args:
        tenant_cfg: Tenant configuration with product details
        account_plans: List of AccountPlan objects
        customer_handles: Mapping from external_ref to customer_id
        
    Returns:
        List of OpenAccount payload dicts ready to send to TuringCore
        
    Implementation will:
    - For each AccountPlan:
      * Look up customer_id from customer_handles
      * For each product_code in the plan:
        - Build OpenAccount payload with:
          * customerId (from handles)
          * productCode
          * initialDeposit (if applicable)
        - Add to output list
    - Return list of payloads
    """
    raise NotImplementedError
