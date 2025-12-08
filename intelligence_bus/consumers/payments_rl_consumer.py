from intelligence_bus.consumers._base import IntelligenceConsumerBase
from domains.payments.policy_gateway import apply_policy as payments_policy


class PaymentsRlConsumer(IntelligenceConsumerBase):
    def __init__(self):
        super().__init__(payments_policy)

    def process(self, event: dict, current_state: dict | None = None):
        return self.handle(event, current_state)
