from intelligence_bus.consumers._base import IntelligenceConsumerBase
from domains.hardship.policy_gateway import apply_policy as hardship_policy


class HardshipConsumer(IntelligenceConsumerBase):
    def __init__(self):
        super().__init__(hardship_policy)

    def process(self, event: dict, current_state: dict | None = None):
        return self.handle(event, current_state)
