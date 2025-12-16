/**
 * CloseAccountHandler.ts - Account Closure Handler
 * 
 * Orchestrates the account closure process.
 * 
 * Responsibilities:
 * - Validate closure conditions (via core)
 * - Emit ACCOUNT_CLOSED fact
 * 
 * NOT Allowed:
 * - Decide business rules (that's policy)
 * - Mutate balances (that's core)
 * - Force close with balance (that violates invariants)
 */

import { DepositAccount } from "../../core/deposits/aggregate/DepositAccount";
import { rebuildFromFacts, Facts, DepositFact } from "../../core/deposits/events/DepositFact";
import {
  Command,
  DepositHandler,
  HandlerContext,
  HandlerResult,
  successResult,
  failureResult,
} from "./HandlerInterface";

/**
 * Close account command.
 */
export interface CloseAccountCommand extends Command {
  /** Account ID to close */
  readonly accountId: string;
  
  /** Reason for closure */
  readonly reason: string;
  
  /** Whether this is a customer-initiated closure */
  readonly customerInitiated: boolean;
}

/**
 * Close account result.
 */
export interface CloseAccountResult {
  readonly account: DepositAccount;
  readonly closedAt: string;
}

/**
 * CloseAccountHandler
 * 
 * Orchestrates account closure. Does not decide - only orchestrates.
 */
export class CloseAccountHandler implements DepositHandler<CloseAccountCommand, CloseAccountResult> {
  readonly handlerName = "CloseAccountHandler";
  
  /**
   * Validate command shape.
   */
  validate(command: CloseAccountCommand): string[] {
    const errors: string[] = [];
    
    if (!command.commandId) {
      errors.push("commandId is required");
    }
    if (!command.issuedAt) {
      errors.push("issuedAt is required");
    }
    if (!command.issuedBy) {
      errors.push("issuedBy is required");
    }
    if (!command.accountId) {
      errors.push("accountId is required");
    }
    if (!command.reason) {
      errors.push("reason is required");
    }
    if (command.customerInitiated === undefined) {
      errors.push("customerInitiated is required");
    }
    
    return errors;
  }
  
  /**
   * Execute the close account command.
   */
  async execute(
    command: CloseAccountCommand,
    context: HandlerContext
  ): Promise<HandlerResult<CloseAccountResult>> {
    // 1. Validate command shape
    const validationErrors = this.validate(command);
    if (validationErrors.length > 0) {
      return failureResult<CloseAccountResult>(
        command.commandId,
        validationErrors.join("; "),
        "VALIDATION_ERROR"
      );
    }
    
    // 2. Load facts for account
    const facts = await context.factStore.loadFacts(command.accountId);
    if (facts.length === 0) {
      return failureResult<CloseAccountResult>(
        command.commandId,
        `Account ${command.accountId} not found`,
        "ACCOUNT_NOT_FOUND"
      );
    }
    
    // 3. Rebuild account state from facts
    const account = rebuildFromFacts(facts);
    if (!account) {
      return failureResult<CloseAccountResult>(
        command.commandId,
        `Failed to rebuild account ${command.accountId}`,
        "REBUILD_ERROR"
      );
    }
    
    // 4. Check if already closed
    if (account.isClosed()) {
      return failureResult<CloseAccountResult>(
        command.commandId,
        `Account ${command.accountId} is already closed`,
        "ALREADY_CLOSED"
      );
    }
    
    // 5. Attempt to close via core (this enforces invariants)
    let closedAccount: DepositAccount;
    try {
      closedAccount = account.close();
    } catch (error) {
      // Core will throw if balance > 0 or holds exist
      return failureResult<CloseAccountResult>(
        command.commandId,
        error instanceof Error ? error.message : "Unknown error",
        "CLOSURE_REJECTED"
      );
    }
    
    // 6. Emit ACCOUNT_CLOSED fact
    const fact: DepositFact = Facts.accountClosed(
      command.accountId,
      context.asOf
    );
    
    // 7. Persist fact
    const persisted = await context.factStore.appendFacts([fact]);
    if (!persisted) {
      return failureResult<CloseAccountResult>(
        command.commandId,
        "Failed to persist account closed fact",
        "PERSISTENCE_ERROR"
      );
    }
    
    // 8. Return success
    return successResult(
      command.commandId,
      [fact],
      [], // No policy recommendations for closure
      [], // No postings applied
      {
        account: closedAccount,
        closedAt: context.asOf,
      }
    );
  }
}

/**
 * Export singleton instance.
 */
export const closeAccountHandler = new CloseAccountHandler();
