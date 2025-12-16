FORBIDDEN_COMMANDS = {
    "TransactionPosted",
    "PaymentSubmittedToRail",
    "TreasuryTransferInitiated",
    "AccountRestrictionAuthorised",
}

def assert_no_ai_money_write(commands):
    for cmd in commands:
        if not cmd:
            continue
        if cmd["command_type"] in FORBIDDEN_COMMANDS:
            raise AssertionError(
                f"❌ AI illegally attempted money write: {cmd['command_type']}"
            )


def assert_policy_fired(commands):
    if not any(commands):
        raise AssertionError("❌ No policy fired for any intelligence event")
