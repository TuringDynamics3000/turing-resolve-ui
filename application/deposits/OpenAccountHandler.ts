/**
 * OpenAccountHandler.ts - Account Opening Handler
 * 
 * Orchestrates the account opening process.
 * 
 * Responsibilities:
 * - Validate command shape
 * - Emit ACCOUNT_OPENED fact
 * - Create initial DepositAccount state
 * 
 * NOT Allowed:
 * - Decide business rules (that's policy)
 * - Mutate balances (that's core)
 * - Encode product logic (that's policy)
 */

import { DepositAccount } from "../../core/deposits/aggregate/DepositAccount";
import { Facts, DepositFact } from "../../core/deposits/events/DepositFact";
import {
  Command,
  DepositHandler,
  HandlerContext,
  HandlerResult,
  successResult,
  failureResult,
} from "./HandlerInterface";

/**
 * Open account command.
 */
export interface OpenAccountCommand extends Command {
  /** Account ID to create */
  readonly accountId: string;
  
  /** Currency for the account */
  readonly currency: string;
  
  /** Product type (e.g., "savings", "checking") */
  readonly productType: string;
  
  /** Customer ID */
  readonly customerId: string;
  
  /** Customer segment (optional) */
  readonly customerSegment?: string;
}

/**
 * Open account result.
 */
export interface OpenAccountResult {
  readonly account: DepositAccount;
  readonly accountId: string;
}

/**
 * OpenAccountHandler
 * 
 * Orchestrates account opening. Does not decide - only orchestrates.
 */
export class OpenAccountHandler implements DepositHandler<OpenAccountCommand, OpenAccountResult> {
  readonly handlerName = "OpenAccountHandler";
  
  /**
   * Validate command shape.
   * Pure validation - no business logic.
   */
  validate(command: OpenAccountCommand): string[] {
    const errors: string[] = [];
    
    // Required fields
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
    if (!command.currency) {
      errors.push("currency is required");
    }
    if (!command.productType) {
      errors.push("productType is required");
    }
    if (!command.customerId) {
      errors.push("customerId is required");
    }
    
    // Format validation
    if (command.currency && command.currency.length !== 3) {
      errors.push("currency must be 3 characters");
    }
    if (command.accountId && command.accountId.length < 5) {
      errors.push("accountId must be at least 5 characters");
    }
    
    return errors;
  }
  
  /**
   * Execute the open account command.
   */
  async execute(
    command: OpenAccountCommand,
    context: HandlerContext
  ): Promise<HandlerResult<OpenAccountResult>> {
    // 1. Validate command shape
    const validationErrors = this.validate(command);
    if (validationErrors.length > 0) {
      return failureResult(
        command.commandId,
        validationErrors.join("; "),
        "VALIDATION_ERROR"
      );
    }
    
    // 2. Check if account already exists
    const existingFacts = await context.factStore.loadFacts(command.accountId);
    if (existingFacts.length > 0) {
      return failureResult(
        command.commandId,
        `Account ${command.accountId} already exists`,
        "ACCOUNT_EXISTS"
      );
    }
    
    // 3. Emit ACCOUNT_OPENED fact
    const fact: DepositFact = Facts.accountOpened(
      command.accountId,
      command.currency,
      context.asOf
    );
    
    // 4. Persist fact
    const persisted = await context.factStore.appendFacts([fact]);
    if (!persisted) {
      return failureResult(
        command.commandId,
        "Failed to persist account opened fact",
        "PERSISTENCE_ERROR"
      );
    }
    
    // 5. Create initial account state
    const account = DepositAccount.create(command.accountId, command.currency);
    
    // 6. Return success
    return successResult(
      command.commandId,
      [fact],
      [], // No policy recommendations for account opening
      [], // No postings applied
      {
        account,
        accountId: command.accountId,
      }
    );
  }
}

/**
 * Export singleton instance.
 */
export const openAccountHandler = new OpenAccountHandler();
