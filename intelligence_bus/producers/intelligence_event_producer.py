class CoreCommandDispatcher:
    """
    This is the only bridge into A-side execution.
    No intelligence code may call domain services directly.
    
    This enforces the final handoff from intelligence bus to TuringCore domain command bus.
    """

    def dispatch(self, command: dict):
        """
        Dispatch core command to TuringCore domain command bus.
        
        Args:
            command: Core command dict with command_type and payload
        
        Raises:
            ValueError: If command missing command_type
        """
        if not command:
            return

        command_type = command.get("command_type")
        payload = command.get("payload")

        if not command_type:
            raise ValueError("Command missing command_type")

        # === ROUTE TO YOUR EXISTING DOMAIN COMMAND BUS HERE ===
        # Example:
        # domain_command_bus.publish(command_type, payload)

        print(f"[CORE COMMAND DISPATCH] {command_type} :: {payload}")
