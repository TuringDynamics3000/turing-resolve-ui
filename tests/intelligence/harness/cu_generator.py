import uuid
import random


def generate_cu_tenant():
    return {
        "tenant_id": f"CU-{uuid.uuid4().hex[:6]}",
        "fraud_policy": {"auto_block_enabled": False},
        "treasury_policy": {"min_confidence": 0.80},
    }


def generate_customer(tenant_id):
    return {
        "customer_id": f"CUST-{uuid.uuid4().hex[:8]}",
        "tenant_id": tenant_id,
        "account_id": f"ACCT-{uuid.uuid4().hex[:8]}",
        "base_income": random.randint(40_000, 120_000),
    }
