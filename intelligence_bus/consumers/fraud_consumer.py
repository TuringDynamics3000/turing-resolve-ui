from intelligence_bus.consumers._base import IntelligenceConsumerBase
from domains.fraud.policy_gateway import apply_policy as fraud_policy


class FraudConsumer(IntelligenceConsumerBase):
    def __init__(self):
        super().__init__(fraud_policy)

    def process(self, event: dict, current_state: dict | None = None):
        return self.handle(event, current_state)
