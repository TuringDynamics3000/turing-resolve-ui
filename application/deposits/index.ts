/**
 * Deposits Application Layer - Public Surface
 * 
 * CRITICAL RULE:
 * Handlers ORCHESTRATE. They do NOT decide.
 * 
 * If a handler contains an `if` that isn't about control flow,
 * that's a smell. Move the logic to a policy.
 */

// Handler Interface
export {
  Command,
  HandlerResult,
  FactStore,
  HandlerContext,
  DepositHandler,
  successResult,
  failureResult,
  InMemoryFactStore,
} from "./HandlerInterface";

// Open Account Handler
export {
  OpenAccountCommand,
  OpenAccountResult,
  OpenAccountHandler,
  openAccountHandler,
} from "./OpenAccountHandler";

// Apply Posting Handler
export {
  ApplyPostingCommand,
  ApplyPostingResult,
  ApplyPostingHandler,
  applyPostingHandler,
} from "./ApplyPostingHandler";

// Close Account Handler
export {
  CloseAccountCommand,
  CloseAccountResult,
  CloseAccountHandler,
  closeAccountHandler,
} from "./CloseAccountHandler";
