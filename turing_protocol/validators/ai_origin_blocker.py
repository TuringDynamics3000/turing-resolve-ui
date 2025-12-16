# ==========================================================
# AI ORIGIN BLOCKER
# Hard guarantee: AI can NEVER write money, move liquidity,
# restrict accounts, or execute settlements.
# ==========================================================

FORBIDDEN_AI_COMMAND_TYPES = {
    "TransactionPosted",
    "PaymentSubmittedToRail",
    "TreasuryTransferInitiated",
    "AccountRestrictionAuthorised",
    "AccountFrozen",
    "PostingCreated",
}

class AiOriginViolation(Exception):
    pass


def enforce_ai_origin_block(event: dict, proposed_command: dict | None) -> None:
    """
    Enforces the non-negotiable rule:
    If origin == AI, it may NEVER produce a money-affecting command.
    
    Args:
        event: Intelligence event with base.origin field
        proposed_command: Command proposed by policy gateway (or None)
    
    Raises:
        AiOriginViolation: If AI-originated event attempts forbidden command
    
    This is court-defensible.
    This cannot be bypassed by accident.
    If this throws, the pipeline must stop immediately.
    """

    origin = event.get("base", {}).get("origin")

    if origin != "AI":
        return

    if not proposed_command:
        return

    command_type = proposed_command.get("command_type")

    if command_type in FORBIDDEN_AI_COMMAND_TYPES:
        raise AiOriginViolation(
            f"AI-originated event attempted forbidden command: {command_type}"
        )
