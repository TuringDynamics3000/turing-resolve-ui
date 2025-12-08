"""
Product Configuration Loader - CU Digital Twin

This module loads CU-specific product configurations from YAML
and maps them to the TuringCore product schema.

The schema is defined in TuringCore-v3 (domains/product_configuration/product_schema.py).
This loader is in the CUSTOMER repo because it reads CUSTOMER-specific configs.
"""

from __future__ import annotations

from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Optional

import yaml


@dataclass
class ProductConfig:
    """
    Product configuration for CU-Digital.
    
    This is a simplified version that maps to TuringCore's ProductSchema.
    The full schema validation happens in TuringCore-v3.
    """
    
    # Identity
    code: str
    name: str
    product_type: str
    description: str
    
    # Interest rate
    interest_base_rate: Decimal = Decimal("0.00")
    interest_bonus_rate: Optional[Decimal] = None
    interest_calculation_method: str = "DAILY_BALANCE"
    interest_compounding_frequency_days: Optional[int] = None
    
    # Fees
    monthly_fee: Decimal = Decimal("0.00")
    transaction_fee: Decimal = Decimal("0.00")
    atm_fee_domestic: Decimal = Decimal("0.00")
    atm_fee_international: Decimal = Decimal("0.00")
    overdraft_fee: Decimal = Decimal("0.00")
    late_payment_fee: Decimal = Decimal("0.00")
    establishment_fee: Decimal = Decimal("0.00")
    early_repayment_fee: Decimal = Decimal("0.00")
    
    # Limits
    min_opening_balance: Decimal = Decimal("0.00")
    max_balance: Optional[Decimal] = None
    daily_withdrawal_limit: Optional[Decimal] = None
    daily_transfer_limit: Optional[Decimal] = None
    min_loan_amount: Optional[Decimal] = None
    max_loan_amount: Optional[Decimal] = None
    min_term_months: Optional[int] = None
    max_term_months: Optional[int] = None
    
    # Credit criteria (for lending products)
    min_age: int = 18
    max_age: int = 75
    min_income_annual: Decimal = Decimal("0.00")
    min_credit_score: int = 0
    max_dti_ratio: Decimal = Decimal("1.00")
    employment_required: bool = False
    
    # Loan config
    amortisation_method: Optional[str] = None
    repayment_frequency_days: Optional[int] = None
    
    # Features
    supports_npp: bool = False
    supports_bpay: bool = False
    supports_apple_pay: bool = False
    supports_google_pay: bool = False
    supports_international_transfers: bool = False
    supports_redraw: bool = False
    supports_offset: bool = False
    
    # Constraints
    overdraft_allowed: bool = False
    overdraft_limit: Decimal = Decimal("0.00")
    age_restricted: bool = False
    max_age_for_product: Optional[int] = None
    
    # Status
    active: bool = True
    
    # Raw YAML for extensions
    _raw: dict = None


def load_product_configs(yaml_path: str | Path) -> list[ProductConfig]:
    """
    Load product configurations from YAML file.
    
    Args:
        yaml_path: Path to cu_products_base.yaml
    
    Returns:
        List of ProductConfig objects
    """
    path = Path(yaml_path)
    
    if not path.exists():
        raise FileNotFoundError(f"Product config file not found: {path}")
    
    with open(path, "r") as f:
        data = yaml.safe_load(f)
    
    products = []
    
    for prod_yaml in data.get("products", []):
        # Extract interest rate config
        interest = prod_yaml.get("interest_rate", {})
        
        # Extract fees
        fees = prod_yaml.get("fees", {})
        
        # Extract limits
        limits = prod_yaml.get("limits", {})
        
        # Extract credit criteria
        credit = prod_yaml.get("credit_criteria", {})
        
        # Extract loan config
        loan = prod_yaml.get("loan_config", {})
        
        # Extract features
        features = prod_yaml.get("features", {})
        
        # Extract constraints
        constraints = prod_yaml.get("constraints", {})
        
        # Build ProductConfig
        product = ProductConfig(
            # Identity
            code=prod_yaml["code"],
            name=prod_yaml["name"],
            product_type=prod_yaml["product_type"],
            description=prod_yaml["description"],
            
            # Interest rate
            interest_base_rate=Decimal(str(interest.get("base_rate", 0.0))),
            interest_bonus_rate=Decimal(str(interest["bonus_rate"])) if "bonus_rate" in interest else None,
            interest_calculation_method=interest.get("calculation_method", "DAILY_BALANCE"),
            interest_compounding_frequency_days=interest.get("compounding_frequency_days"),
            
            # Fees
            monthly_fee=Decimal(str(fees.get("monthly_fee", 0.0))),
            transaction_fee=Decimal(str(fees.get("transaction_fee", 0.0))),
            atm_fee_domestic=Decimal(str(fees.get("atm_fee_domestic", 0.0))),
            atm_fee_international=Decimal(str(fees.get("atm_fee_international", 0.0))),
            overdraft_fee=Decimal(str(fees.get("overdraft_fee", 0.0))),
            late_payment_fee=Decimal(str(fees.get("late_payment_fee", 0.0))),
            establishment_fee=Decimal(str(loan.get("establishment_fee", 0.0))),
            early_repayment_fee=Decimal(str(loan.get("early_repayment_fee", 0.0))),
            
            # Limits
            min_opening_balance=Decimal(str(limits.get("min_opening_balance", 0.0))),
            max_balance=Decimal(str(limits["max_balance"])) if "max_balance" in limits else None,
            daily_withdrawal_limit=Decimal(str(limits["daily_withdrawal_limit"])) if "daily_withdrawal_limit" in limits else None,
            daily_transfer_limit=Decimal(str(limits["daily_transfer_limit"])) if "daily_transfer_limit" in limits else None,
            min_loan_amount=Decimal(str(limits["min_loan_amount"])) if "min_loan_amount" in limits else None,
            max_loan_amount=Decimal(str(limits["max_loan_amount"])) if "max_loan_amount" in limits else None,
            min_term_months=limits.get("min_term_months"),
            max_term_months=limits.get("max_term_months"),
            
            # Credit criteria
            min_age=credit.get("min_age", 18),
            max_age=credit.get("max_age", 75),
            min_income_annual=Decimal(str(credit.get("min_income_annual", 0.0))),
            min_credit_score=credit.get("min_credit_score", 0),
            max_dti_ratio=Decimal(str(credit.get("max_dti_ratio", 1.0))),
            employment_required=credit.get("employment_required", False),
            
            # Loan config
            amortisation_method=loan.get("amortisation_method"),
            repayment_frequency_days=loan.get("repayment_frequency_days"),
            
            # Features
            supports_npp=features.get("supports_npp", False),
            supports_bpay=features.get("supports_bpay", False),
            supports_apple_pay=features.get("supports_apple_pay", False),
            supports_google_pay=features.get("supports_google_pay", False),
            supports_international_transfers=features.get("supports_international_transfers", False),
            supports_redraw=features.get("supports_redraw", False),
            supports_offset=features.get("supports_offset", False),
            
            # Constraints
            overdraft_allowed=constraints.get("overdraft_allowed", False),
            overdraft_limit=Decimal(str(constraints.get("overdraft_limit", 0.0))),
            age_restricted=constraints.get("age_restricted", False),
            max_age_for_product=constraints.get("max_age_for_product"),
            
            # Status
            active=prod_yaml.get("active", True),
            
            # Raw YAML
            _raw=prod_yaml,
        )
        
        products.append(product)
    
    return products
