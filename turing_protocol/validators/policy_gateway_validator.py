# ==========================================================
# POLICY GATEWAY VALIDATOR
# Forces all intelligence outputs through deterministic
# domain-owned policy gateways.
# ==========================================================

class PolicyGatewayViolation(Exception):
    pass


def enforce_policy_gateway(
    event: dict,
    policy_gateway_fn,
    current_state: dict | None = None
) -> dict | None:
    """
    Executes a deterministic domain policy gateway.
    
    Args:
        event: Intelligence event
        policy_gateway_fn: Domain policy gateway function
        current_state: Current state dict (optional)

    Returns:
        Domain command dict OR None

    Raises:
        PolicyGatewayViolation if:
        - Gateway missing
        - Gateway returns invalid command
    
    This ensures:
    - No side effects inside policy
    - No hidden execution
    - No ML shortcuts into core command handlers
    """

    if not callable(policy_gateway_fn):
        raise PolicyGatewayViolation("Domain policy gateway is not callable")

    proposed_command = policy_gateway_fn(event, current_state)

    if proposed_command is None:
        return None

    if not isinstance(proposed_command, dict):
        raise PolicyGatewayViolation(
            "Policy gateway must return dict or None"
        )

    if "command_type" not in proposed_command:
        raise PolicyGatewayViolation(
            "Returned command missing command_type"
        )

    return proposed_command
