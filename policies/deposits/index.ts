/**
 * Deposits Policy Layer - Public Surface
 * 
 * CRITICAL RULE:
 * Policies may RECOMMEND postings.
 * They may NEVER apply them.
 * 
 * Versioning:
 * - One version = one file
 * - No edits after release
 * - New behaviour = new version
 */

// Policy Interface
export {
  DepositPolicy,
  PolicyContext,
  PolicyRecommendation,
  PolicyRegistry,
  InMemoryPolicyRegistry,
  evaluatePolicies,
  aggregatePostings,
} from "./PolicyInterface";

// Fee Policy v1
export { FeePolicyV1, feePolicyV1 } from "./FeePolicy.v1";

// Interest Policy v1
export { InterestPolicyV1, interestPolicyV1 } from "./InterestPolicy.v1";

// Hold Policy v1
export { HoldPolicyV1, holdPolicyV1, HoldType, HoldRequest } from "./HoldPolicy.v1";
