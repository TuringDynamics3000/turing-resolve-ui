"""
Steady-State Scenario

Implements the four-phase steady-state scenario:
1) Bootstrap tenant + products
2) Seed customers + accounts
3) Simulate N days of activity
4) Inspect invariants

This is where we wire config + generators + client together.
"""

from __future__ import annotations

from dataclasses import dataclass
from random import Random
from typing import Dict, List, Optional

from api_client import TuringCoreClient
from generators.accounts import (
    plan_accounts_for_customers,
    build_open_account_payloads,
)
from generators.customers import generate_customer_seeds
from generators.timewarp import TimeWarpClock
from generators.transactions import (
    iter_all_transactions,
    map_planned_transactions_to_postentry_payloads,
)
from models.account import AccountHandle, AccountPlan
from models.customer import CustomerHandle, CustomerSeed
from models.scenario import SteadyStateScenarioConfig
from models.tenant import TenantConfig


@dataclass
class SteadyStateScenarioResult:
    """Result of running the steady-state scenario."""
    
    tenant_id: str
    num_customers: int
    num_accounts: int
    num_transactions: int
    invariants_passed: bool
    invariant_failures: List[str]


class SteadyStateScenario:
    """
    Implements the four-phase steady-state scenario:

    1) Bootstrap tenant + products
    2) Seed customers + accounts
    3) Simulate N days of activity
    4) Inspect invariants
    """

    def __init__(
        self,
        client: TuringCoreClient,
        tenant_cfg: TenantConfig,
        scenario_cfg: SteadyStateScenarioConfig,
    ) -> None:
        self.client = client
        self.tenant_cfg = tenant_cfg
        self.scenario_cfg = scenario_cfg
        self.rng = Random(scenario_cfg.seed)
        self.tenant_id = tenant_cfg.tenant_code

        self._customer_seeds: List[CustomerSeed] = []
        self._customer_handles: Dict[str, CustomerHandle] = {}
        self._account_handles: List[AccountHandle] = []

    # ---------- Phase 1: Bootstrap ----------

    def bootstrap_tenant_and_products(self) -> None:
        """
        Create CU_DIGITAL tenant (if not exists) and upsert product catalog.
        Uses CreateTenant and UpsertProduct commands via TuringCoreClient.
        
        Implementation will:
        1. Build CreateTenant payload from tenant_cfg
        2. Call client.create_tenant(payload, idem_key=...)
        3. For each product in tenant_cfg.products:
           - Build UpsertProduct payload
           - Call client.upsert_product(tenant_id, payload, idem_key=...)
        """
        # TODO: build payloads from tenant_cfg and call client
        raise NotImplementedError

    # ---------- Phase 2: Seed Customers & Accounts ----------

    def seed_customers_and_accounts(self) -> None:
        """
        Generate customer seeds, create them in TuringCore, and open accounts.
        
        Implementation will:
        1. Generate customer seeds using generators.customers
        2. Create customers in TuringCore via CreateCustomer commands
        3. Plan accounts for customers using generators.accounts
        4. Open accounts in TuringCore via OpenAccount commands
        """
        # 1) generate customer seeds
        self._customer_seeds = generate_customer_seeds(
            self.tenant_cfg,
            self.scenario_cfg,
            self.rng,
        )

        # 2) create customers via commands
        self._customer_handles = self._create_customers_in_core(self._customer_seeds)

        # 3) plan accounts
        account_plans: List[AccountPlan] = plan_accounts_for_customers(
            self.tenant_cfg,
            self._customer_seeds,
            self.rng,
        )

        # 4) build OpenAccount payloads and call TuringCore
        open_payloads = build_open_account_payloads(
            self.tenant_cfg,
            account_plans,
            customer_handles={h.external_ref: h.customer_id for h in self._customer_handles.values()},
        )
        self._account_handles = self._create_accounts_in_core(open_payloads)

    def _create_customers_in_core(
        self,
        seeds: List[CustomerSeed],
    ) -> Dict[str, CustomerHandle]:
        """
        For each CustomerSeed, call CreateCustomer and return mapping external_ref -> CustomerHandle.
        
        Implementation will:
        1. For each seed:
           - Build CreateCustomer payload
           - Generate idempotency key (e.g., f"create-customer-{external_ref}")
           - Call client.create_customer(tenant_id, payload, idem_key=...)
           - Extract customer_id from response
           - Create CustomerHandle(external_ref, customer_id)
        2. Return dict mapping external_ref -> CustomerHandle
        """
        # TODO: implement using client.create_customer(...)
        raise NotImplementedError

    def _create_accounts_in_core(
        self,
        open_payloads: List[dict],
    ) -> List[AccountHandle]:
        """
        For each OpenAccount payload, call OpenAccount and capture AccountHandle.
        
        Implementation will:
        1. For each payload:
           - Generate idempotency key (e.g., f"open-account-{customer_id}-{product_code}")
           - Call client.open_account(tenant_id, payload, idem_key=...)
           - Extract account_id from response
           - Create AccountHandle(customer_id, account_id, product_code)
        2. Return list of AccountHandle objects
        """
        # TODO: implement using client.open_account(...)
        raise NotImplementedError

    # ---------- Phase 3: Simulate Transactions ----------

    def simulate_activity(self) -> int:
        """
        Run simulated transactions over N days, posting to TuringCore via PostEntry.

        Returns the number of transactions successfully posted.
        
        Implementation will:
        1. Create TimeWarpClock
        2. Generate planned transactions using generators.transactions
        3. Build account resolution map (customer/GL aliases -> accountIds)
        4. Convert planned transactions to PostEntry payloads
        5. For each payload:
           - Generate idempotency key
           - Call client.post_entry(tenant_id, payload, idem_key=...)
           - Count successful posts
        6. Return count
        """
        clock = TimeWarpClock(
            simulation_days=self.scenario_cfg.simulation_days,
            target_runtime_seconds=self.scenario_cfg.target_runtime_seconds,
        )
        clock.start()

        # 1) generate planned transactions
        planned_tx_iter = iter_all_transactions(
            self.tenant_cfg,
            self.scenario_cfg,
            self._customer_seeds,
            self.rng,
        )

        # 2) resolve planned transactions to PostEntry payloads
        account_resolution = self._build_account_resolution_map()
        postentry_payloads = map_planned_transactions_to_postentry_payloads(
            planned_tx_iter,
            account_resolution=account_resolution,
        )

        count = 0
        for payload in postentry_payloads:
            # TODO: call client.post_entry(self.tenant_id, payload, idem_key=...)
            count += 1

        return count

    def _build_account_resolution_map(self) -> Dict[str, Dict[str, str]]:
        """
        Build a map from customer_external_ref and GL aliases to concrete accountIds,
        based on self._account_handles and CU GL config.
        
        Returns a dict like:
        {
            "CUST-000001": {
                "TXN_MAIN": "ACC_abc123",
                "SAVINGS_MAIN": "ACC_def456",
            },
            "GL": {
                "GL_SALARY_CLEARING": "GL_ACC_001",
                "GL_CARD_CLEARING": "GL_ACC_002",
            }
        }
        
        Implementation will:
        1. Create empty resolution dict
        2. For each AccountHandle:
           - Get customer's external_ref from _customer_handles
           - Add mapping: resolution[external_ref][product_code] = account_id
        3. Add GL account mappings from tenant_cfg.raw["gl_accounts"]
        4. Return resolution dict
        """
        # TODO: implement
        raise NotImplementedError

    # ---------- Phase 4: Inspect / Invariants ----------

    def inspect_invariants(self) -> SteadyStateScenarioResult:
        """
        Run invariants against TuringCore projections and event streams.
        
        Implementation will:
        1. Query TuringCore for:
           - All customers (count)
           - All accounts (count)
           - All transactions (count)
           - Account balances
           - Event stream
        2. Run invariants from invariants/ledger_invariants.py:
           - Conservation of value
           - Double-entry balance
           - No negative balances (unless overdraft)
           - Event-projection consistency
           - Idempotency (no duplicate events)
        3. Run invariants from invariants/cu_invariants.py:
           - Customer count matches expected
           - Account count matches expected
           - Transaction count matches expected
        4. Aggregate results into SteadyStateScenarioResult
        5. Return result
        """
        # TODO: call invariants/ledger_invariants + invariants/cu_invariants
        # and aggregate results into SteadyStateScenarioResult
        raise NotImplementedError

    # ---------- One-shot convenience ----------

    def run_all(self) -> SteadyStateScenarioResult:
        """
        Execute all four phases in order and return the final result.
        
        This is the main entry point for running the scenario.
        """
        self.bootstrap_tenant_and_products()
        self.seed_customers_and_accounts()
        num_tx = self.simulate_activity()
        result = self.inspect_invariants()
        result.num_transactions = num_tx
        return result
