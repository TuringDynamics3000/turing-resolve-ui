/**
 * HandlerInterface.ts - Deposit Handler Contract
 * 
 * CRITICAL RULE:
 * Handlers ORCHESTRATE. They do NOT decide.
 * 
 * Handler Responsibilities:
 * | Allowed               | Not Allowed           |
 * |-----------------------|-----------------------|
 * | Load facts            | Decide business rules |
 * | Validate command shape| Mutate balances       |
 * | Call policies         | Encode product logic  |
 * | Emit facts            |                       |
 * | Apply postings via core|                      |
 * 
 * If a handler contains an `if` that isn't about control flow,
 * that's a smell. Move the logic to a policy.
 */

import { DepositAccount } from "../../core/deposits/aggregate/DepositAccount";
import { DepositFact } from "../../core/deposits/events/DepositFact";
import { Posting } from "../../core/deposits/ledger/Posting";
import { PolicyRecommendation } from "../../policies/deposits/PolicyInterface";

/**
 * Command base interface.
 * All commands must have an ID and timestamp.
 */
export interface Command {
  /** Unique command ID for idempotency */
  readonly commandId: string;
  
  /** Command timestamp (ISO 8601) */
  readonly issuedAt: string;
  
  /** Who issued this command */
  readonly issuedBy: string;
}

/**
 * Handler result - what the handler produces.
 */
export interface HandlerResult<T = unknown> {
  /** Whether the operation succeeded */
  readonly success: boolean;
  
  /** The command that was processed */
  readonly commandId: string;
  
  /** Facts emitted by this operation */
  readonly facts: DepositFact[];
  
  /** Policy recommendations that were evaluated */
  readonly recommendations: PolicyRecommendation[];
  
  /** Postings that were applied */
  readonly appliedPostings: Posting[];
  
  /** The resulting state (if applicable) */
  readonly result?: T;
  
  /** Error message if failed */
  readonly error?: string;
  
  /** Error code if failed */
  readonly errorCode?: string;
}

/**
 * Fact store interface.
 * Handlers use this to load and persist facts.
 * 
 * NOTE: This is an interface - actual implementation
 * is in the infrastructure layer (DB, event store, etc.)
 */
export interface FactStore {
  /**
   * Load all facts for an account.
   * @param accountId - Account ID
   * @returns Facts in chronological order
   */
  loadFacts(accountId: string): Promise<DepositFact[]>;
  
  /**
   * Append facts to the store.
   * @param facts - Facts to append
   * @returns Success indicator
   */
  appendFacts(facts: DepositFact[]): Promise<boolean>;
  
  /**
   * Get the next sequence number for an account.
   * @param accountId - Account ID
   * @returns Next sequence number
   */
  nextSequence(accountId: string): Promise<number>;
}

/**
 * Handler context - everything a handler needs.
 */
export interface HandlerContext {
  /** Fact store for loading/persisting facts */
  readonly factStore: FactStore;
  
  /** Current timestamp for the operation */
  readonly asOf: string;
  
  /** Correlation ID for tracing */
  readonly correlationId: string;
}

/**
 * Base handler interface.
 * All deposit handlers must implement this.
 */
export interface DepositHandler<TCommand extends Command, TResult = unknown> {
  /** Handler name for logging/tracing */
  readonly handlerName: string;
  
  /**
   * Validate the command shape.
   * This is pure validation - no business logic.
   * 
   * @param command - Command to validate
   * @returns Validation errors (empty if valid)
   */
  validate(command: TCommand): string[];
  
  /**
   * Execute the command.
   * 
   * @param command - Command to execute
   * @param context - Handler context
   * @returns Handler result
   */
  execute(command: TCommand, context: HandlerContext): Promise<HandlerResult<TResult>>;
}

/**
 * Create a successful handler result.
 */
export function successResult<T>(
  commandId: string,
  facts: DepositFact[],
  recommendations: PolicyRecommendation[],
  appliedPostings: Posting[],
  result?: T
): HandlerResult<T> {
  return {
    success: true,
    commandId,
    facts,
    recommendations,
    appliedPostings,
    result,
  };
}

/**
 * Create a failed handler result.
 */
export function failureResult<T = unknown>(
  commandId: string,
  error: string,
  errorCode: string
): HandlerResult<T> {
  return {
    success: false,
    commandId,
    facts: [],
    recommendations: [],
    appliedPostings: [],
    error,
    errorCode,
  };
}

/**
 * In-memory fact store for testing.
 * NOT for production use.
 */
export class InMemoryFactStore implements FactStore {
  private facts: Map<string, DepositFact[]> = new Map();
  private sequences: Map<string, number> = new Map();
  
  async loadFacts(accountId: string): Promise<DepositFact[]> {
    return this.facts.get(accountId) ?? [];
  }
  
  async appendFacts(facts: DepositFact[]): Promise<boolean> {
    for (const fact of facts) {
      const accountId = fact.accountId;
      const existing = this.facts.get(accountId) ?? [];
      existing.push(fact);
      this.facts.set(accountId, existing);
    }
    return true;
  }
  
  async nextSequence(accountId: string): Promise<number> {
    const current = this.sequences.get(accountId) ?? 0;
    const next = current + 1;
    this.sequences.set(accountId, next);
    return next;
  }
  
  // Test helpers
  clear(): void {
    this.facts.clear();
    this.sequences.clear();
  }
  
  getAllFacts(): DepositFact[] {
    return Array.from(this.facts.values()).flat();
  }
}
