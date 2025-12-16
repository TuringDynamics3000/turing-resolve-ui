/**
 * PolicyInterface.ts - Deposit Policy Contract
 * 
 * CRITICAL RULE:
 * Policies may RECOMMEND postings.
 * They may NEVER apply them.
 * 
 * Design Principles:
 * - Policies consume facts
 * - Policies emit posting recommendations
 * - Policies are PURE (no side effects)
 * - No DB access
 * - No clocks (time is passed explicitly)
 * - No external dependencies
 * 
 * Versioning Rules:
 * - One version = one file
 * - No edits after release
 * - New behaviour = new version
 * 
 * This is regulator and PE gold.
 */

import { DepositFact } from "../../core/deposits/events/DepositFact";
import { Posting } from "../../core/deposits/ledger/Posting";

/**
 * Policy evaluation context.
 * 
 * Contains all external information needed by policies.
 * Time is explicit - no Date.now() calls inside policies.
 */
export interface PolicyContext {
  /** Current evaluation timestamp (ISO 8601) */
  readonly asOf: string;
  
  /** Account ID being evaluated */
  readonly accountId: string;
  
  /** Product type (e.g., "savings", "checking", "term_deposit") */
  readonly productType: string;
  
  /** Currency code */
  readonly currency: string;
  
  /** Customer segment (e.g., "standard", "premium", "business") */
  readonly customerSegment?: string;
  
  /** Additional context (product-specific) */
  readonly metadata?: Record<string, unknown>;
}

/**
 * Policy recommendation result.
 * 
 * Contains the recommended postings and explanation.
 */
export interface PolicyRecommendation {
  /** Policy that generated this recommendation */
  readonly policyId: string;
  
  /** Policy version */
  readonly policyVersion: string;
  
  /** Recommended postings (may be empty) */
  readonly postings: Posting[];
  
  /** Human-readable explanation of why these postings were recommended */
  readonly explanation: string;
  
  /** Whether this recommendation is mandatory or optional */
  readonly mandatory: boolean;
  
  /** Evaluation timestamp */
  readonly evaluatedAt: string;
}

/**
 * Deposit Policy Interface.
 * 
 * All deposit policies MUST implement this interface.
 * 
 * CRITICAL: evaluate() must be PURE.
 * - Same inputs = same outputs
 * - No side effects
 * - No external calls
 */
export interface DepositPolicy {
  /** Unique policy identifier */
  readonly policyId: string;
  
  /** Policy version (e.g., "v1", "v2") */
  readonly version: string;
  
  /** Human-readable description */
  readonly description: string;
  
  /**
   * Evaluate the policy against facts and context.
   * 
   * @param facts - Historical facts for the account
   * @param context - Evaluation context with time and metadata
   * @returns Recommended postings (never applied directly)
   */
  evaluate(facts: DepositFact[], context: PolicyContext): PolicyRecommendation;
}

/**
 * Policy registry for managing multiple policies.
 */
export interface PolicyRegistry {
  /** Register a policy */
  register(policy: DepositPolicy): void;
  
  /** Get a policy by ID and version */
  get(policyId: string, version: string): DepositPolicy | undefined;
  
  /** Get all registered policies */
  all(): DepositPolicy[];
  
  /** Get all versions of a policy */
  versions(policyId: string): DepositPolicy[];
}

/**
 * Simple in-memory policy registry.
 */
export class InMemoryPolicyRegistry implements PolicyRegistry {
  private policies: Map<string, DepositPolicy> = new Map();
  
  private key(policyId: string, version: string): string {
    return `${policyId}@${version}`;
  }
  
  register(policy: DepositPolicy): void {
    const key = this.key(policy.policyId, policy.version);
    if (this.policies.has(key)) {
      throw new Error(`Policy ${key} already registered. No edits after release.`);
    }
    this.policies.set(key, policy);
  }
  
  get(policyId: string, version: string): DepositPolicy | undefined {
    return this.policies.get(this.key(policyId, version));
  }
  
  all(): DepositPolicy[] {
    return Array.from(this.policies.values());
  }
  
  versions(policyId: string): DepositPolicy[] {
    return Array.from(this.policies.values())
      .filter(p => p.policyId === policyId);
  }
}

/**
 * Evaluate multiple policies and aggregate recommendations.
 * 
 * @param policies - Policies to evaluate
 * @param facts - Account facts
 * @param context - Evaluation context
 * @returns All recommendations from all policies
 */
export function evaluatePolicies(
  policies: DepositPolicy[],
  facts: DepositFact[],
  context: PolicyContext
): PolicyRecommendation[] {
  return policies.map(policy => policy.evaluate(facts, context));
}

/**
 * Aggregate all recommended postings from multiple recommendations.
 * 
 * @param recommendations - Policy recommendations
 * @returns All postings in order
 */
export function aggregatePostings(recommendations: PolicyRecommendation[]): Posting[] {
  return recommendations.flatMap(r => r.postings);
}
