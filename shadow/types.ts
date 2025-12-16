/**
 * Shadow Mode Types
 * 
 * These types define the contract for shadow mode comparison between
 * legacy Python deposits and TS Core v1 deposits.
 * 
 * CRITICAL: This is read-only, non-blocking infrastructure.
 * Shadow runs NEVER affect production state.
 */

// Standardized output format for comparison
export interface ShadowAccountState {
  readonly accountId: string;
  readonly ledgerBalance: string;      // Decimal string, e.g. "1000.00"
  readonly availableBalance: string;   // Decimal string
  readonly currency: string;           // ISO currency code
  readonly status: 'OPEN' | 'FROZEN' | 'CLOSED' | 'LEGAL_HOLD' | 'DORMANT';
  readonly holds: readonly ShadowHold[];
  readonly factCount: number;          // Number of facts/events
  readonly lastFactSequence: number;   // Last applied fact sequence
}

export interface ShadowHold {
  readonly holdId: string;
  readonly amount: string;             // Decimal string
  readonly type: 'PAYMENT' | 'DEPOSIT' | 'REGULATORY' | 'LEGAL';
  readonly placedAt: string;           // ISO timestamp
  readonly expiresAt?: string;         // ISO timestamp, optional
}

// Operation to shadow-run
export interface ShadowOperation {
  readonly operationId: string;        // Unique ID for this shadow run
  readonly operationType: 'CREDIT' | 'DEBIT' | 'HOLD_PLACE' | 'HOLD_RELEASE' | 'INTEREST' | 'CLOSE';
  readonly accountId: string;
  readonly amount?: string;            // For credit/debit/hold operations
  readonly holdId?: string;            // For hold operations
  readonly timestamp: string;          // ISO timestamp
  readonly metadata?: Record<string, unknown>;
}

// Result from a shadow adapter
export interface ShadowResult {
  readonly source: 'LEGACY_PYTHON' | 'CORE_V1_TS';
  readonly accountId: string;
  readonly operationId: string;
  readonly success: boolean;
  readonly error?: string;
  readonly stateBefore: ShadowAccountState | null;
  readonly stateAfter: ShadowAccountState | null;
  readonly executionTimeMs: number;
}

// Divergence classification
export type DivergenceType = 
  | 'BUG'                    // Core v1 is wrong, needs fix
  | 'POLICY_DIFFERENCE'      // Intentional behavior change
  | 'ROUNDING_ARTEFACT'      // Floating point vs bigint difference
  | 'TIMING'                 // Race condition or sequence difference
  | 'MISSING_FEATURE'        // Core v1 doesn't support this yet
  | 'UNKNOWN';               // Needs investigation

// Detected divergence between legacy and Core v1
export interface Divergence {
  readonly divergenceId: string;
  readonly operationId: string;
  readonly accountId: string;
  readonly detectedAt: string;         // ISO timestamp
  readonly type: DivergenceType;
  readonly field: string;              // Which field diverged
  readonly legacyValue: string;
  readonly coreV1Value: string;
  readonly delta?: string;             // For numeric differences
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly notes?: string;
}

// Shadow comparison result
export interface ShadowComparisonResult {
  readonly operationId: string;
  readonly accountId: string;
  readonly comparedAt: string;
  readonly legacyResult: ShadowResult;
  readonly coreV1Result: ShadowResult;
  readonly match: boolean;
  readonly divergences: readonly Divergence[];
}

// Shadow adapter interface - both Python and TS adapters implement this
export interface ShadowAdapter {
  readonly source: 'LEGACY_PYTHON' | 'CORE_V1_TS';
  
  // Get current account state
  getAccountState(accountId: string): Promise<ShadowAccountState | null>;
  
  // Execute operation and return result
  executeOperation(operation: ShadowOperation): Promise<ShadowResult>;
}
