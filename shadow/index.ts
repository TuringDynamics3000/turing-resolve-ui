/**
 * Shadow Mode - Deposits Comparison Harness
 * 
 * This module provides infrastructure for comparing Legacy Python deposits
 * logic against the new TS Core v1 implementation.
 * 
 * CRITICAL RULES:
 * 1. Shadow mode is READ-ONLY - never affects production state
 * 2. Shadow mode is NON-BLOCKING - failures don't stop operations
 * 3. All divergences are LOGGED - no silent failures
 * 4. Divergences are CLASSIFIED - bug, policy, rounding, timing
 */

// Types
export type {
  ShadowAccountState,
  ShadowHold,
  ShadowOperation,
  ShadowResult,
  ShadowComparisonResult,
  Divergence,
  DivergenceType,
  ShadowAdapter,
} from './types';

// Adapters
export { CoreV1ShadowAdapter } from './adapters/CoreV1Adapter';

// Comparison
export { ShadowComparator } from './comparison/ShadowComparator';

// Logging
export { DivergenceLogger } from './logging/DivergenceLogger';
export type { DivergenceStats, DivergenceTrend } from './logging/DivergenceLogger';
