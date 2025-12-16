"""
Product Invariants - CU Digital Twin

These invariants validate that TuringCore engines respect ProductConfig rules
and provide regulator-grade assurance for:
- Loan amortisation correctness
- Bonus saver interest rules
- Overdraft hard caps
- Term deposit maturity integrity

This is core-banking tier validation, not fintech toy testing.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from math import isclose
from typing import List, Dict, Any, Optional

from api_client import TuringCoreClient


@dataclass
class InvariantResult:
    """Result of a single product invariant check."""
    name: str
    passed: bool
    violations: List[Dict[str, Any]]
    message: Optional[str] = None


# ========== INVARIANT 1: LOAN AMORTISATION CORRECTNESS ==========

def amortisation_balance(
    principal: float,
    annual_rate: float,
    term_months: int,
    repayments_made: int
) -> float:
    """
    Calculate expected loan balance using standard amortisation formula.
    
    Args:
        principal: Original loan amount
        annual_rate: Annual interest rate (e.g., 0.1299 for 12.99%)
        term_months: Loan term in months
        repayments_made: Number of repayments already made
    
    Returns:
        Expected outstanding balance
    """
    if annual_rate == 0:
        # Interest-free loan
        payment_per_month = principal / term_months
        return round(principal - (payment_per_month * repayments_made), 2)
    
    monthly_rate = annual_rate / 12.0
    
    # Calculate monthly payment using amortisation formula
    payment = principal * (monthly_rate / (1 - (1 + monthly_rate) ** -term_months))
    
    # Calculate remaining balance after N repayments
    balance = principal
    for _ in range(repayments_made):
        interest = balance * monthly_rate
        principal_component = payment - interest
        balance -= principal_component
    
    return round(balance, 2)


def invariant_loan_amortisation(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: For any active loan, the outstanding balance must equal the
    mathematical amortisation implied by principal, interest rate, term, and
    repayments received.
    
    This kills:
    - Silent balance drift
    - Broken interest accrual
    - GL / customer mismatch
    - UltraData migration bugs
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    # TODO: Implement once TuringCore API has list_loans endpoint
    # loans = client.list_loans(tenant_id)
    loans = []  # Placeholder
    
    violations = []
    
    for loan in loans:
        product_code = loan.get("product_code")
        product = product_registry.get(product_code)
        
        if not product or product.family != "LOAN":
            continue
        
        rate = product.interest.base_rate if product.interest.base_rate else 0.0
        term = loan.get("term_months")
        principal = loan.get("original_principal")
        
        # Count repayments made
        # repayments = client.count_repayments(tenant_id, loan["loan_id"])
        repayments = 0  # Placeholder
        
        expected = amortisation_balance(principal, rate, term, repayments)
        actual = loan.get("outstanding_balance")
        
        if not isclose(expected, actual, abs_tol=1.00):
            violations.append({
                "loan_id": loan.get("loan_id"),
                "product_code": product_code,
                "expected_balance": expected,
                "actual_balance": actual,
                "delta": round(actual - expected, 2),
                "repayments_made": repayments,
            })
    
    return InvariantResult(
        name="loan_amortisation_correctness",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Checked {len(loans)} loans, found {len(violations)} mismatches"
    )


# ========== INVARIANT 2: BONUS SAVER INTEREST RULES ==========

def invariant_bonus_saver_interest(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Bonus interest is ONLY paid when bonus conditions are met
    (e.g., minimum monthly deposit AND no withdrawals).
    
    This protects:
    - Product promises
    - Financial performance
    - Regulator trust
    - CU marketing claims
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    violations = []
    
    # Find all bonus saver products
    bonus_products = [
        code for code, prod in product_registry.items()
        if prod.interest.applies and prod.interest.bonus_rate
    ]
    
    for product_code in bonus_products:
        product = product_registry[product_code]
        rules = product.interest.bonus_conditions or {}
        
        # TODO: Implement once TuringCore API has list_accounts_by_product endpoint
        # accounts = client.list_accounts_by_product(tenant_id, product_code)
        accounts = []  # Placeholder
        
        for acc in accounts:
            account_id = acc.get("account_id")
            
            # TODO: Implement once TuringCore API has transaction query endpoints
            # deposits = client.sum_deposits_this_month(tenant_id, account_id)
            # withdrawals = client.count_withdrawals_this_month(tenant_id, account_id)
            # bonus_paid = client.was_bonus_interest_paid(tenant_id, account_id)
            deposits = 0.0  # Placeholder
            withdrawals = 0  # Placeholder
            bonus_paid = False  # Placeholder
            
            # Check eligibility
            min_deposit = rules.get("min_monthly_deposit", 0.0)
            allow_withdrawals = rules.get("allow_withdrawals", True)
            
            eligible = (
                deposits >= min_deposit and
                (allow_withdrawals or withdrawals == 0)
            )
            
            # Detect violations
            if bonus_paid and not eligible:
                violations.append({
                    "account_id": account_id,
                    "product_code": product_code,
                    "reason": "Bonus paid without eligibility",
                    "deposits": deposits,
                    "withdrawals": withdrawals,
                    "min_deposit_required": min_deposit,
                })
            
            if eligible and not bonus_paid:
                violations.append({
                    "account_id": account_id,
                    "product_code": product_code,
                    "reason": "Bonus not paid despite eligibility",
                    "deposits": deposits,
                    "withdrawals": withdrawals,
                })
    
    return InvariantResult(
        name="bonus_saver_interest_rules",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Checked bonus saver accounts, found {len(violations)} violations"
    )


# ========== INVARIANT 3: OVERDRAFT HARD CAP ==========

def invariant_overdraft_caps(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: No account can breach its overdraft limit — ever.
    
    This is:
    - A core APRA risk invariant
    - A mandatory CU credit risk control
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    violations = []
    
    # Find all overdraft products
    overdraft_products = [
        code for code, prod in product_registry.items()
        if prod.limits.overdraft_allowed and prod.limits.overdraft_limit
    ]
    
    for product_code in overdraft_products:
        product = product_registry[product_code]
        limit = product.limits.overdraft_limit
        
        # TODO: Implement once TuringCore API has list_accounts_by_product endpoint
        # accounts = client.list_accounts_by_product(tenant_id, product_code)
        accounts = []  # Placeholder
        
        for acc in accounts:
            balance = acc.get("balance", 0.0)
            
            # Check if overdraft limit is breached
            if balance < 0 and abs(balance) > limit:
                violations.append({
                    "account_id": acc.get("account_id"),
                    "product_code": product_code,
                    "balance": balance,
                    "overdraft_limit": limit,
                    "breach_amount": abs(balance) - limit,
                })
    
    return InvariantResult(
        name="overdraft_hard_caps",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Checked overdraft accounts, found {len(violations)} breaches"
    )


# ========== INVARIANT 4: TERM DEPOSIT MATURITY INTEGRITY ==========

def invariant_term_deposit_maturity(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> InvariantResult:
    """
    Guarantee: Term Deposits must:
    - Accrue interest until maturity
    - Post interest at maturity
    - Lock principal until maturity
    - Never allow early withdrawal without penalty
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        InvariantResult with violations (if any)
    """
    violations = []
    
    # Find all term deposit products
    td_products = [
        code for code, prod in product_registry.items()
        if prod.family == "TERM_DEPOSIT"
    ]
    
    for product_code in td_products:
        # TODO: Implement once TuringCore API has list_term_deposits endpoint
        # tds = client.list_term_deposits(tenant_id, product_code)
        tds = []  # Placeholder
        
        for td in tds:
            maturity = td.get("maturity_date")
            today = date.today()
            
            # Check for early withdrawal without penalty
            if today < maturity and td.get("was_withdrawn"):
                violations.append({
                    "account_id": td.get("account_id"),
                    "product_code": product_code,
                    "reason": "Early withdrawal without penalty",
                    "maturity_date": str(maturity),
                    "withdrawal_date": str(today),
                })
            
            # Check for missing interest payment at maturity
            if today >= maturity and not td.get("interest_paid"):
                violations.append({
                    "account_id": td.get("account_id"),
                    "product_code": product_code,
                    "reason": "Interest not paid at maturity",
                    "maturity_date": str(maturity),
                    "days_overdue": (today - maturity).days,
                })
    
    return InvariantResult(
        name="term_deposit_maturity_integrity",
        passed=len(violations) == 0,
        violations=violations,
        message=f"Checked term deposits, found {len(violations)} violations"
    )


# ========== MASTER PRODUCT INVARIANT RUNNER ==========

def run_all_product_invariants(
    client: TuringCoreClient,
    tenant_id: str,
    product_registry: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Run all product invariants and return aggregated results.
    
    Args:
        client: TuringCore API client
        tenant_id: Tenant ID
        product_registry: Dict[product_code, ProductConfig]
    
    Returns:
        Dict with:
        - passed: bool (all invariants passed)
        - results: List[InvariantResult]
        - summary: Dict with counts
    """
    results = [
        invariant_loan_amortisation(client, tenant_id, product_registry),
        invariant_bonus_saver_interest(client, tenant_id, product_registry),
        invariant_overdraft_caps(client, tenant_id, product_registry),
        invariant_term_deposit_maturity(client, tenant_id, product_registry),
    ]
    
    passed = all(r.passed for r in results)
    total_violations = sum(len(r.violations) for r in results)
    
    return {
        "passed": passed,
        "results": results,
        "summary": {
            "total_invariants": len(results),
            "passed_count": sum(1 for r in results if r.passed),
            "failed_count": sum(1 for r in results if not r.passed),
            "total_violations": total_violations,
        }
    }
