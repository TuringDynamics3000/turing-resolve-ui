from intelligence_bus.consumers._base import IntelligenceConsumerBase
from domains.treasury.policy_gateway import apply_policy as treasury_policy


class TreasuryRlConsumer(IntelligenceConsumerBase):
    def __init__(self):
        super().__init__(treasury_policy)

    def process(self, event: dict, current_state: dict | None = None):
        return self.handle(event, current_state)
