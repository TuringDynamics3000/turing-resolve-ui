"""
Customer Generator

Pure functions for generating synthetic customer seeds based on tenant demographics
and scenario configuration.

These functions do NOT call TuringCore - they only return CustomerSeed objects.
"""

from __future__ import annotations

from datetime import date
from random import Random
from typing import Iterable, List

from models.customer import CustomerSeed
from models.scenario import SteadyStateScenarioConfig
from models.tenant import TenantConfig


def generate_customer_seeds(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    rng: Random,
) -> List[CustomerSeed]:
    """
    Generate synthetic customers based on tenant demographics and scenario config.

    This function is PURE: it does NOT call TuringCore. It only returns seeds.
    
    Args:
        tenant_cfg: Tenant configuration with demographics
        scenario_cfg: Scenario configuration with num_customers
        rng: Random number generator for reproducibility
        
    Returns:
        List of CustomerSeed objects ready to be created in TuringCore
    
    Implementation will:
    - Use tenant_cfg.raw["demographics"] and scenario_cfg.raw as distributions
    - Draw names, DOB, income bands, etc. using `rng`
    - Generate realistic Australian addresses, phone numbers, emails
    """
    raise NotImplementedError


def iter_customer_seeds(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    rng: Random,
) -> Iterable[CustomerSeed]:
    """
    Memory-friendly iterator version. Useful for streaming seeding to TuringCore.
    
    This is more efficient for large numbers of customers as it doesn't
    load all seeds into memory at once.
    
    Args:
        tenant_cfg: Tenant configuration with demographics
        scenario_cfg: Scenario configuration with num_customers
        rng: Random number generator for reproducibility
        
    Yields:
        CustomerSeed objects one at a time
    """
    for idx in range(scenario_cfg.num_customers):
        yield _generate_single_customer(tenant_cfg, scenario_cfg, rng, idx)


def _generate_single_customer(
    tenant_cfg: TenantConfig,
    scenario_cfg: SteadyStateScenarioConfig,
    rng: Random,
    index: int,
) -> CustomerSeed:
    """
    Internal helper for single-customer generation.
    
    Args:
        tenant_cfg: Tenant configuration with demographics
        scenario_cfg: Scenario configuration
        rng: Random number generator for reproducibility
        index: Customer index (used for external_ref)
        
    Returns:
        CustomerSeed object
        
    Implementation will:
    - Generate external_ref as "CUST-{index:06d}"
    - Sample from demographics distributions (age, income, employment)
    - Generate realistic Australian names, addresses, emails, phones
    - Assign segment based on age and income
    """
    # TODO: implement
    raise NotImplementedError
