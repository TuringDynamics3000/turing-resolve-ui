"""
Shadow Card Transaction Poster

Posts mapped debit card transactions to TuringCore shadow tenant.
Maintains parallel UltraData → TuringCore card transaction flow.
"""

from __future__ import annotations

from typing import Dict, Any, List
from datetime import datetime

from api_client import TuringCoreClient
from cards_shadow.ultradata_card_mapper import TuringCoreDebitEvent


class ShadowCardPoster:
    """Posts debit card transactions to TuringCore shadow tenant."""
    
    def __init__(self, client: TuringCoreClient, tenant_id: str):
        """
        Initialize shadow card poster.
        
        Args:
            client: TuringCore API client
            tenant_id: Shadow tenant ID
        """
        self.client = client
        self.tenant_id = tenant_id
    
    def post_debit_event(self, event: TuringCoreDebitEvent) -> Dict[str, Any]:
        """
        Post a single debit card event to TuringCore.
        
        Args:
            event: Mapped debit card event
        
        Returns:
            API response
        """
        # TODO: Implement once TuringCore API has post_event endpoint
        # return self.client.post_event(
        #     tenant_id=self.tenant_id,
        #     event_type="DebitAuthorised" if event.was_approved else "DebitDeclined",
        #     payload={
        #         "card_id": event.card_id,
        #         "amount": event.amount,
        #         "mcc": event.mcc,
        #         "merchant_name": event.merchant_name,
        #         "merchant_country": event.merchant_country,
        #         "timestamp": event.timestamp,
        #         "auth_id": event.auth_id,
        #         "transaction_type": event.transaction_type,
        #         "currency": event.currency,
        #     }
        # )
        
        # Placeholder
        return {
            "status": "posted",
            "event_id": f"evt_{event.auth_id}",
            "tenant_id": self.tenant_id,
        }
    
    def post_batch(self, events: List[TuringCoreDebitEvent]) -> Dict[str, Any]:
        """
        Post a batch of debit card events.
        
        Args:
            events: List of mapped debit card events
        
        Returns:
            Batch posting summary
        """
        posted_count = 0
        failed_count = 0
        errors = []
        
        for event in events:
            try:
                self.post_debit_event(event)
                posted_count += 1
            except Exception as e:
                failed_count += 1
                errors.append({
                    "auth_id": event.auth_id,
                    "error": str(e),
                })
        
        return {
            "total": len(events),
            "posted": posted_count,
            "failed": failed_count,
            "errors": errors,
        }
    
    def post_shadow_card_tx(
        self,
        card_id: str,
        amount: float,
        mcc: str,
        merchant_country: str,
        auth_id: str
    ) -> Dict[str, Any]:
        """
        Simplified posting interface for shadow transactions.
        
        Args:
            card_id: Card ID
            amount: Transaction amount
            mcc: Merchant category code
            merchant_country: Merchant country code
            auth_id: Authorization ID
        
        Returns:
            API response
        """
        event = TuringCoreDebitEvent(
            card_id=card_id,
            amount=amount,
            mcc=mcc,
            merchant_name="Shadow Merchant",
            merchant_country=merchant_country,
            timestamp=datetime.utcnow().isoformat() + "Z",
            auth_id=auth_id,
            transaction_type="PURCHASE",
            currency="AUD",
            was_approved=True,
        )
        
        return self.post_debit_event(event)


# Example usage
if __name__ == "__main__":
    from ultradata_card_mapper import map_ultra_card_tx
    
    # Sample UltraData transaction
    ultra_tx = {
        "pan_last4": "1234",
        "amount": 45.50,
        "mcc": "5411",
        "merchant_name": "WOOLWORTHS",
        "merchant_country": "AU",
        "timestamp": "2025-12-08T14:32:15Z",
        "auth_code": "AUTH123456",
        "response_code": "00",
        "transaction_type": "PURCHASE",
        "currency": "AUD",
    }
    
    # Map and post to shadow
    turing_event = map_ultra_card_tx(ultra_tx)
    
    # poster = ShadowCardPoster(client, "CU_ALPHA_SHADOW")
    # result = poster.post_debit_event(turing_event)
    
    print("Shadow card transaction posted:")
    print(f"  Card ID: {turing_event.card_id}")
    print(f"  Amount: ${turing_event.amount}")
    print(f"  MCC: {turing_event.mcc}")
