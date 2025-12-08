"""
TuringCore API Client

Thin, protocol-faithful client for TuringCore Command + Query APIs.
This lives in the twin repo and ONLY speaks over HTTP to TuringCore.

No imports from turingcore_v3 source. No direct database access.
All interactions via public APIs.
"""

from __future__ import annotations

import os
import time
import uuid
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx

from metrics.latency_recorder import LatencyRecorder


@dataclass
class Actor:
    """Actor issuing a command."""

    actorType: str  # "SYSTEM" | "USER" | "SERVICE"
    actorId: str


@dataclass
class CommandEnvelope:
    """
    Standard command envelope for Turing Protocol Gateway.

    All commands are wrapped in this envelope to enable:
    - Authentication and authorization
    - Tenant and actor context enforcement
    - Routing to domain handlers
    - Invariant checking
    - Event emission
    """

    commandId: str
    tenantId: str
    commandType: str
    actor: Actor
    timestamp: str
    payload: Dict[str, Any]
    idempotencyKey: Optional[str] = None

    @classmethod
    def create(
        cls,
        tenant_id: str,
        command_type: str,
        payload: Dict[str, Any],
        actor_id: str = "TWIN_ORCHESTRATOR",
        idempotency_key: Optional[str] = None,
    ) -> "CommandEnvelope":
        """
        Create a command envelope with automatic ID and timestamp generation.

        Args:
            tenant_id: Tenant context for this command
            command_type: Type of command (e.g., "CreateCustomer", "PostEntry")
            payload: Domain-specific command payload
            actor_id: ID of the actor issuing this command
            idempotency_key: Optional key for idempotent retries

        Returns:
            CommandEnvelope ready to submit
        """
        now = datetime.now(timezone.utc).isoformat()
        return cls(
            commandId=str(uuid.uuid4()),
            tenantId=tenant_id,
            commandType=command_type,
            actor=Actor(actorType="SYSTEM", actorId=actor_id),
            timestamp=now,
            payload=payload,
            idempotencyKey=idempotency_key,
        )

    def to_dict(self) -> Dict[str, Any]:
        """Convert envelope to dictionary for JSON serialization."""
        d = asdict(self)
        # Flatten actor nested dataclass
        d["actor"] = asdict(self.actor)
        # Drop None idempotencyKey to keep payload clean
        if d.get("idempotencyKey") is None:
            d.pop("idempotencyKey", None)
        return d


class TuringCoreClient:
    """
    Thin, protocol-faithful client for TuringCore Command + Query APIs.

    This client enforces the strict separation between TuringCore-v3 and
    the digital twin by:
    - Only communicating via HTTP APIs
    - Never importing turingcore_v3 source modules
    - Never accessing TuringCore database directly
    - Using only public, customer-facing endpoints

    All state changes go through the Command Gateway with proper
    envelope structure, tenant context, and idempotency support.

    Environment Variables:
        TURINGCORE_BASE_URL: Base URL for TuringCore API (required)
        TURINGCORE_API_KEY: API key for authentication (required)
        TURINGCORE_TENANT_ID: Default tenant ID (optional)

    Example:
        >>> client = TuringCoreClient()
        >>> result = client.create_tenant({
        ...     "tenantCode": "CU_DIGITAL",
        ...     "displayName": "CU Digital Twin",
        ...     "region": "AU",
        ...     "baseCurrency": "AUD",
        ...     "timeZone": "Australia/Sydney"
        ... })
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        default_tenant: str | None = None,
        timeout: float = 10.0,
        latency_recorder: LatencyRecorder | None = None,
    ) -> None:
        """
        Initialize TuringCore API client.

        Args:
            base_url: Base URL for TuringCore API (or TURINGCORE_BASE_URL env var)
            api_key: API key for authentication (or TURINGCORE_API_KEY env var)
            default_tenant: Default tenant ID (or TURINGCORE_TENANT_ID env var)
            timeout: Request timeout in seconds
            latency_recorder: Optional latency recorder for performance tracking

        Raises:
            ValueError: If base_url or api_key not provided
        """
        self.base_url = base_url or os.environ.get("TURINGCORE_BASE_URL", "").rstrip("/")
        self.api_key = api_key or os.environ.get("TURINGCORE_API_KEY", "")
        self.default_tenant = default_tenant or os.environ.get("TURINGCORE_TENANT_ID", "")
        self.latency_recorder = latency_recorder

        if not self.base_url:
            raise ValueError("TURINGCORE_BASE_URL must be set")
        if not self.api_key:
            raise ValueError("TURINGCORE_API_KEY must be set")

        self._client = httpx.Client(base_url=self.base_url, timeout=timeout)

    def __enter__(self) -> "TuringCoreClient":
        """Context manager entry."""
        return self

    def __exit__(self, *args: Any) -> None:
        """Context manager exit."""
        self.close()

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    # ---------- Low-level helpers ----------

    def _headers(self) -> Dict[str, str]:
        """Generate headers for API requests."""
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def _timed_request(
        self,
        method: str,
        url: str,
        *,
        op_type: str,
        **kwargs: Any,
    ) -> httpx.Response:
        """
        Perform an HTTP request and record latency for the given op_type.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            url: URL path (relative to base_url)
            op_type: Operation type for latency tracking (e.g., "command:PostEntry")
            **kwargs: Additional arguments passed to httpx.Client.request
            
        Returns:
            httpx.Response object
        """
        start = time.perf_counter()
        try:
            resp = self._client.request(method, url, headers=self._headers(), **kwargs)
        finally:
            duration = time.perf_counter() - start
            if self.latency_recorder is not None:
                self.latency_recorder.record(op_type, duration)
        return resp

    def submit_command(self, envelope: CommandEnvelope) -> Dict[str, Any]:
        """
        Submit a command to the Turing Protocol Gateway.

        This is the ONLY way to mutate state in TuringCore. All commands
        go through this gateway which:
        - Validates the envelope and payload
        - Authenticates and authorizes the actor
        - Routes to the appropriate domain handler
        - Runs invariant checks
        - Emits canonical events if invariants pass
        - Returns command result

        Args:
            envelope: Command envelope with tenant, actor, and payload

        Returns:
            Command result from TuringCore

        Raises:
            RuntimeError: If command is rejected (4xx or 5xx status)
        """
        tenant_id = envelope.tenantId
        url = f"/tenants/{tenant_id}/commands"
        op_type = f"command:{envelope.commandType}"
        resp = self._timed_request("POST", url, op_type=op_type, json=envelope.to_dict())

        # For v0.1, raise on non-2xx
        # You can handle 422 (invariant breach) separately for better error messages
        if resp.status_code >= 400:
            raise RuntimeError(f"Command rejected ({resp.status_code}): {resp.text}")

        return resp.json()

    # ---------- Convenience wrappers over command types ----------

    def create_tenant(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a new tenant on the TuringCore platform.

        Args:
            payload: Tenant configuration
                - tenantCode (str): Unique tenant identifier
                - displayName (str): Human-readable name
                - region (str): ISO 3166-1 alpha-2 country code
                - baseCurrency (str): ISO 4217 currency code
                - timeZone (str): IANA time zone identifier

        Returns:
            Command result with tenant details

        Example:
            >>> client.create_tenant({
            ...     "tenantCode": "CU_DIGITAL",
            ...     "displayName": "CU Digital Twin",
            ...     "region": "AU",
            ...     "baseCurrency": "AUD",
            ...     "timeZone": "Australia/Sydney"
            ... })
        """
        env = CommandEnvelope.create(
            tenant_id=payload["tenantCode"],  # tenantId = code for bootstrap
            command_type="CreateTenant",
            payload=payload,
            idempotency_key=f"CreateTenant:{payload['tenantCode']}",
        )
        return self.submit_command(env)

    def upsert_product(self, tenant_id: str, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create or update a product (idempotent by productCode).

        Args:
            tenant_id: Tenant context
            payload: Product configuration
                - productCode (str): Unique product identifier
                - name (str): Human-readable product name
                - productType (str): DEPOSIT, LOAN, TERM_DEPOSIT, CREDIT_CARD
                - interest (dict): Interest rate configuration
                - fees (dict): Fee structure
                - constraints (dict): Product limits and rules

        Returns:
            Command result with product details

        Example:
            >>> client.upsert_product("CU_DIGITAL", {
            ...     "productCode": "TXN_ACCOUNT_BASIC",
            ...     "name": "Everyday Transaction Account",
            ...     "productType": "DEPOSIT",
            ...     "interest": {"rate": 0.0},
            ...     "fees": {"monthlyFee": 0.0},
            ...     "constraints": {"minBalance": 0, "allowOverdraft": False}
            ... })
        """
        env = CommandEnvelope.create(
            tenant_id=tenant_id,
            command_type="UpsertProduct",
            payload=payload,
            idempotency_key=f"UpsertProduct:{tenant_id}:{payload['productCode']}",
        )
        return self.submit_command(env)

    def create_customer(
        self, tenant_id: str, payload: Dict[str, Any], idem_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a new customer.

        Args:
            tenant_id: Tenant context
            payload: Customer details
                - externalRef (str, optional): External customer reference
                - person (dict): Personal details (firstName, lastName, dateOfBirth, email, mobile)
                - address (dict): Residential address
                - employment (dict, optional): Employment details
                - riskProfile (dict, optional): Risk and compliance information
            idem_key: Optional idempotency key for safe retries

        Returns:
            Command result with customer details (including customerId)

        Example:
            >>> client.create_customer("CU_DIGITAL", {
            ...     "externalRef": "CUST-000123",
            ...     "person": {
            ...         "firstName": "Jane",
            ...         "lastName": "Smith",
            ...         "dateOfBirth": "1988-05-17",
            ...         "email": "jane.smith@example.com",
            ...         "mobile": "+61400111222"
            ...     },
            ...     "address": {
            ...         "line1": "10 Example Street",
            ...         "suburb": "Newtown",
            ...         "state": "NSW",
            ...         "postcode": "2042",
            ...         "country": "AU"
            ...     },
            ...     "riskProfile": {
            ...         "segment": "RETAIL",
            ...         "kycStatus": "SIMULATED_PASSED"
            ...     }
            ... })
        """
        env = CommandEnvelope.create(
            tenant_id=tenant_id,
            command_type="CreateCustomer",
            payload=payload,
            idempotency_key=idem_key,
        )
        return self.submit_command(env)

    def open_account(
        self, tenant_id: str, payload: Dict[str, Any], idem_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Open a new account for a customer.

        Args:
            tenant_id: Tenant context
            payload: Account details
                - customerId (str): ID of the customer opening the account
                - productCode (str): Product code to use for this account
                - accountAlias (str, optional): Customer-friendly name
                - initialDeposit (float, optional): Initial deposit amount
                - currency (str): ISO 4217 currency code
            idem_key: Optional idempotency key for safe retries

        Returns:
            Command result with account details (including accountId)

        Example:
            >>> client.open_account("CU_DIGITAL", {
            ...     "customerId": "cust_123456",
            ...     "productCode": "TXN_ACCOUNT_BASIC",
            ...     "accountAlias": "Everyday Account",
            ...     "initialDeposit": 1000.00,
            ...     "currency": "AUD"
            ... })
        """
        env = CommandEnvelope.create(
            tenant_id=tenant_id,
            command_type="OpenAccount",
            payload=payload,
            idempotency_key=idem_key,
        )
        return self.submit_command(env)

    def post_entry(
        self, tenant_id: str, payload: Dict[str, Any], idem_key: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Post a multi-leg accounting entry to the ledger.

        This is the ONLY way to move money in TuringCore. The scenario engine
        never thinks in terms of "update balance"; it only ever posts entries.

        Args:
            tenant_id: Tenant context
            payload: Posting details
                - bookingDate (str): ISO 8601 date when entry is recorded
                - valueDate (str): ISO 8601 date when entry takes effect
                - currency (str): ISO 4217 currency code
                - legs (list): Array of posting legs (must balance)
                    - accountId (str): Account to post to
                    - direction (str): DEBIT or CREDIT
                    - amount (float): Positive amount
                - narrative (str): Human-readable description
                - tags (dict, optional): Structured metadata
                - metadata (dict, optional): Additional context
            idem_key: Optional idempotency key for safe retries

        Returns:
            Command result with posting details

        Example (salary deposit):
            >>> client.post_entry("CU_DIGITAL", {
            ...     "bookingDate": "2025-01-03",
            ...     "valueDate": "2025-01-03",
            ...     "currency": "AUD",
            ...     "legs": [
            ...         {"accountId": "GL_SALARY_CLEARING", "direction": "CREDIT", "amount": 3000.00},
            ...         {"accountId": "ACC_123_TXN", "direction": "DEBIT", "amount": 3000.00}
            ...     ],
            ...     "narrative": "Salary - EMPLOYER XYZ",
            ...     "tags": {"category": "INCOME", "source": "PAYROLL_SIM"}
            ... })
        """
        env = CommandEnvelope.create(
            tenant_id=tenant_id,
            command_type="PostEntry",
            payload=payload,
            idempotency_key=idem_key,
        )
        return self.submit_command(env)

    # ---------- Read-only projection APIs (queries) ----------

    def list_customers(
        self, tenant_id: Optional[str] = None, limit: int = 50, offset: int = 0
    ) -> Dict[str, Any]:
        """
        List customers for a tenant.

        Args:
            tenant_id: Tenant context (or default_tenant if not provided)
            limit: Maximum number of customers to return
            offset: Number of customers to skip (for pagination)

        Returns:
            Dictionary with customers list and pagination info

        Example:
            >>> result = client.list_customers("CU_DIGITAL", limit=100)
            >>> for customer in result["customers"]:
            ...     print(customer["customerId"], customer["fullName"])
        """
        t = tenant_id or self.default_tenant
        resp = self._client.get(
            f"/tenants/{t}/customers",
            params={"limit": limit, "offset": offset},
            headers=self._headers(),
        )
        resp.raise_for_status()
        return resp.json()

    def list_accounts(
        self,
        tenant_id: Optional[str] = None,
        customer_id: Optional[str] = None,
        limit: int = 50,
        offset: int = 0,
    ) -> Dict[str, Any]:
        """
        List accounts for a tenant (optionally filtered by customer).

        Args:
            tenant_id: Tenant context (or default_tenant if not provided)
            customer_id: Optional customer ID to filter by
            limit: Maximum number of accounts to return
            offset: Number of accounts to skip (for pagination)

        Returns:
            Dictionary with accounts list and pagination info

        Example:
            >>> result = client.list_accounts("CU_DIGITAL", customer_id="cust_123")
            >>> for account in result["accounts"]:
            ...     print(account["accountId"], account["balance"])
        """
        t = tenant_id or self.default_tenant
        params: Dict[str, Any] = {"limit": limit, "offset": offset}
        if customer_id:
            params["customerId"] = customer_id

        resp = self._timed_request(
            "GET",
            f"/tenants/{t}/accounts",
            op_type="read:list_accounts",
            params=params,
        )
        resp.raise_for_status()
        return resp.json()

    def get_account_events(
        self, tenant_id: str, account_id: str, limit: int = 100
    ) -> Dict[str, Any]:
        """
        Get event stream for an account.

        This is useful for debugging and validation. The twin can consume
        events to verify that all state changes went through the proper
        command pipeline and that balances are derivable from the event stream.

        Args:
            tenant_id: Tenant context
            account_id: Account ID to get events for
            limit: Maximum number of events to return

        Returns:
            Dictionary with events list

        Example:
            >>> result = client.get_account_events("CU_DIGITAL", "acc_123")
            >>> for event in result["events"]:
            ...     print(event["eventType"], event["occurredAt"])
        """
        resp = self._timed_request(
            "GET",
            f"/tenants/{tenant_id}/accounts/{account_id}/events",
            op_type="read:get_account_events",
            params={"limit": limit},
        )
        resp.raise_for_status()
        return resp.json()
