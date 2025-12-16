/**
 * ApplyPostingHandler.ts - Posting Application Handler
 * 
 * Orchestrates the posting application process.
 * 
 * Responsibilities:
 * - Load facts for account
 * - Evaluate policies
 * - Apply postings via core
 * - Emit POSTING_APPLIED facts
 * 
 * NOT Allowed:
 * - Decide business rules (that's policy)
 * - Mutate balances directly (that's core)
 * - Encode product logic (that's policy)
 * 
 * Note: If this handler contains an `if` that isn't about
 * control flow, that's a smell. Move the logic to a policy.
 */

import { DepositAccount } from "../../core/deposits/aggregate/DepositAccount";
import { rebuildFromFacts, Facts, DepositFact } from "../../core/deposits/events/DepositFact";
import { Posting } from "../../core/deposits/ledger/Posting";
import { canApplyPosting } from "../../core/deposits/invariants/DepositInvariants";
import {
  DepositPolicy,
  PolicyContext,
  PolicyRecommendation,
  evaluatePolicies,
  aggregatePostings,
} from "../../policies/deposits/PolicyInterface";
import {
  Command,
  DepositHandler,
  HandlerContext,
  HandlerResult,
  successResult,
  failureResult,
} from "./HandlerInterface";

/**
 * Apply posting command.
 */
export interface ApplyPostingCommand extends Command {
  /** Account ID */
  readonly accountId: string;
  
  /** Posting to apply */
  readonly posting: Posting;
  
  /** Product type for policy evaluation */
  readonly productType: string;
  
  /** Customer segment for policy evaluation */
  readonly customerSegment?: string;
  
  /** Whether to also apply policy-recommended postings */
  readonly applyPolicyRecommendations?: boolean;
}

/**
 * Apply posting result.
 */
export interface ApplyPostingResult {
  readonly account: DepositAccount;
  readonly appliedPostings: Posting[];
  readonly policyRecommendations: PolicyRecommendation[];
}

/**
 * ApplyPostingHandler
 * 
 * Orchestrates posting application. Does not decide - only orchestrates.
 */
export class ApplyPostingHandler implements DepositHandler<ApplyPostingCommand, ApplyPostingResult> {
  readonly handlerName = "ApplyPostingHandler";
  
  private policies: DepositPolicy[] = [];
  
  /**
   * Register policies to evaluate.
   */
  registerPolicy(policy: DepositPolicy): void {
    this.policies.push(policy);
  }
  
  /**
   * Register multiple policies.
   */
  registerPolicies(policies: DepositPolicy[]): void {
    this.policies.push(...policies);
  }
  
  /**
   * Validate command shape.
   */
  validate(command: ApplyPostingCommand): string[] {
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
    if (!command.posting) {
      errors.push("posting is required");
    }
    if (!command.productType) {
      errors.push("productType is required");
    }
    
    return errors;
  }
  
  /**
   * Execute the apply posting command.
   */
  async execute(
    command: ApplyPostingCommand,
    context: HandlerContext
  ): Promise<HandlerResult<ApplyPostingResult>> {
    // 1. Validate command shape
    const validationErrors = this.validate(command);
    if (validationErrors.length > 0) {
      return failureResult(
        command.commandId,
        validationErrors.join("; "),
        "VALIDATION_ERROR"
      );
    }
    
    // 2. Load facts for account
    const facts = await context.factStore.loadFacts(command.accountId);
    if (facts.length === 0) {
      return failureResult(
        command.commandId,
        `Account ${command.accountId} not found`,
        "ACCOUNT_NOT_FOUND"
      );
    }
    
    // 3. Rebuild account state from facts
    const account = rebuildFromFacts(facts);
    if (!account) {
      return failureResult(
        command.commandId,
        `Failed to rebuild account ${command.accountId}`,
        "REBUILD_ERROR"
      );
    }
    
    // 4. Check if posting can be applied
    if (!canApplyPosting(account, command.posting)) {
      return failureResult(
        command.commandId,
        `Posting cannot be applied to account ${command.accountId}`,
        "POSTING_REJECTED"
      );
    }
    
    // 5. Apply the posting via core
    let updatedAccount: DepositAccount;
    try {
      updatedAccount = account.apply(command.posting);
    } catch (error) {
      return failureResult(
        command.commandId,
        error instanceof Error ? error.message : "Unknown error",
        "APPLY_ERROR"
      );
    }
    
    // 6. Emit POSTING_APPLIED fact
    const sequence = await context.factStore.nextSequence(command.accountId);
    const postingFact = Facts.postingApplied(
      command.accountId,
      command.posting,
      sequence,
      context.asOf
    );
    
    const newFacts: DepositFact[] = [postingFact];
    const appliedPostings: Posting[] = [command.posting];
    
    // 7. Evaluate policies (but don't decide - just collect recommendations)
    const policyContext: PolicyContext = {
      asOf: context.asOf,
      accountId: command.accountId,
      productType: command.productType,
      currency: command.posting.type === "HOLD_RELEASED" 
        ? "AUD" // Default for hold release
        : command.posting.amount.currency,
      customerSegment: command.customerSegment,
    };
    
    const recommendations = evaluatePolicies(
      this.policies,
      [...facts, postingFact],
      policyContext
    );
    
    // 8. Optionally apply policy-recommended postings
    if (command.applyPolicyRecommendations) {
      const recommendedPostings = aggregatePostings(recommendations);
      
      for (const posting of recommendedPostings) {
        // Check if can apply
        if (canApplyPosting(updatedAccount, posting)) {
          try {
            updatedAccount = updatedAccount.apply(posting);
            appliedPostings.push(posting);
            
            // Emit fact for each applied posting
            const seq = await context.factStore.nextSequence(command.accountId);
            newFacts.push(Facts.postingApplied(
              command.accountId,
              posting,
              seq,
              context.asOf
            ));
          } catch {
            // Skip postings that fail - they're recommendations, not mandatory
            // (unless marked mandatory in the recommendation)
          }
        }
      }
    }
    
    // 9. Persist facts
    const persisted = await context.factStore.appendFacts(newFacts);
    if (!persisted) {
      return failureResult(
        command.commandId,
        "Failed to persist facts",
        "PERSISTENCE_ERROR"
      );
    }
    
    // 10. Return success
    return successResult(
      command.commandId,
      newFacts,
      recommendations,
      appliedPostings,
      {
        account: updatedAccount,
        appliedPostings,
        policyRecommendations: recommendations,
      }
    );
  }
}

/**
 * Export singleton instance.
 */
export const applyPostingHandler = new ApplyPostingHandler();
