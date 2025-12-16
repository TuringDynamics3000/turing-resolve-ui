/**
 * Shadow Comparator
 * 
 * Compares results from Legacy Python and TS Core v1 adapters,
 * detecting and classifying divergences.
 * 
 * CRITICAL: This is the heart of confidence building.
 * Every divergence must be logged, classified, and tracked.
 */

import type {
  ShadowAdapter,
  ShadowOperation,
  ShadowResult,
  ShadowAccountState,
  ShadowComparisonResult,
  Divergence,
  DivergenceType,
} from '../types';

export class ShadowComparator {
  private readonly legacyAdapter: ShadowAdapter;
  private readonly coreV1Adapter: ShadowAdapter;
  private readonly tolerancePercent: number;

  constructor(
    legacyAdapter: ShadowAdapter,
    coreV1Adapter: ShadowAdapter,
    tolerancePercent: number = 0.01 // 0.01% tolerance for rounding
  ) {
    this.legacyAdapter = legacyAdapter;
    this.coreV1Adapter = coreV1Adapter;
    this.tolerancePercent = tolerancePercent;
  }

  /**
   * Execute operation on both adapters and compare results.
   */
  async compare(operation: ShadowOperation): Promise<ShadowComparisonResult> {
    // Execute on both adapters in parallel
    const [legacyResult, coreV1Result] = await Promise.all([
      this.legacyAdapter.executeOperation(operation),
      this.coreV1Adapter.executeOperation(operation),
    ]);

    // Detect divergences
    const divergences = this.detectDivergences(
      operation,
      legacyResult,
      coreV1Result
    );

    return {
      operationId: operation.operationId,
      accountId: operation.accountId,
      comparedAt: new Date().toISOString(),
      legacyResult,
      coreV1Result,
      match: divergences.length === 0,
      divergences,
    };
  }

  /**
   * Detect all divergences between legacy and Core v1 results.
   */
  private detectDivergences(
    operation: ShadowOperation,
    legacy: ShadowResult,
    coreV1: ShadowResult
  ): Divergence[] {
    const divergences: Divergence[] = [];
    const now = new Date().toISOString();

    // Check success/failure divergence
    if (legacy.success !== coreV1.success) {
      divergences.push({
        divergenceId: this.generateId(),
        operationId: operation.operationId,
        accountId: operation.accountId,
        detectedAt: now,
        type: this.classifySuccessDivergence(legacy, coreV1),
        field: 'success',
        legacyValue: String(legacy.success),
        coreV1Value: String(coreV1.success),
        severity: 'CRITICAL',
        notes: `Legacy: ${legacy.error || 'success'}, Core v1: ${coreV1.error || 'success'}`,
      });
      return divergences; // If success differs, don't compare states
    }

    // If both failed, compare error messages
    if (!legacy.success && !coreV1.success) {
      if (legacy.error !== coreV1.error) {
        divergences.push({
          divergenceId: this.generateId(),
          operationId: operation.operationId,
          accountId: operation.accountId,
          detectedAt: now,
          type: 'POLICY_DIFFERENCE',
          field: 'error',
          legacyValue: legacy.error || '',
          coreV1Value: coreV1.error || '',
          severity: 'MEDIUM',
        });
      }
      return divergences;
    }

    // Compare state after
    if (legacy.stateAfter && coreV1.stateAfter) {
      this.compareStates(
        operation,
        legacy.stateAfter,
        coreV1.stateAfter,
        divergences
      );
    }

    return divergences;
  }

  /**
   * Compare two account states and add divergences.
   */
  private compareStates(
    operation: ShadowOperation,
    legacy: ShadowAccountState,
    coreV1: ShadowAccountState,
    divergences: Divergence[]
  ): void {
    const now = new Date().toISOString();

    // Compare ledger balance
    const ledgerDiff = this.compareAmounts(
      legacy.ledgerBalance,
      coreV1.ledgerBalance
    );
    if (ledgerDiff) {
      divergences.push({
        divergenceId: this.generateId(),
        operationId: operation.operationId,
        accountId: operation.accountId,
        detectedAt: now,
        type: ledgerDiff.type,
        field: 'ledgerBalance',
        legacyValue: legacy.ledgerBalance,
        coreV1Value: coreV1.ledgerBalance,
        delta: ledgerDiff.delta,
        severity: ledgerDiff.severity,
      });
    }

    // Compare available balance
    const availableDiff = this.compareAmounts(
      legacy.availableBalance,
      coreV1.availableBalance
    );
    if (availableDiff) {
      divergences.push({
        divergenceId: this.generateId(),
        operationId: operation.operationId,
        accountId: operation.accountId,
        detectedAt: now,
        type: availableDiff.type,
        field: 'availableBalance',
        legacyValue: legacy.availableBalance,
        coreV1Value: coreV1.availableBalance,
        delta: availableDiff.delta,
        severity: availableDiff.severity,
      });
    }

    // Compare status
    if (legacy.status !== coreV1.status) {
      divergences.push({
        divergenceId: this.generateId(),
        operationId: operation.operationId,
        accountId: operation.accountId,
        detectedAt: now,
        type: 'POLICY_DIFFERENCE',
        field: 'status',
        legacyValue: legacy.status,
        coreV1Value: coreV1.status,
        severity: 'HIGH',
      });
    }

    // Compare holds count
    if (legacy.holds.length !== coreV1.holds.length) {
      divergences.push({
        divergenceId: this.generateId(),
        operationId: operation.operationId,
        accountId: operation.accountId,
        detectedAt: now,
        type: 'BUG',
        field: 'holds.length',
        legacyValue: String(legacy.holds.length),
        coreV1Value: String(coreV1.holds.length),
        severity: 'HIGH',
      });
    }

    // Compare individual holds
    for (let i = 0; i < Math.min(legacy.holds.length, coreV1.holds.length); i++) {
      const legacyHold = legacy.holds[i];
      const coreV1Hold = coreV1.holds[i];

      if (legacyHold.holdId !== coreV1Hold.holdId) {
        divergences.push({
          divergenceId: this.generateId(),
          operationId: operation.operationId,
          accountId: operation.accountId,
          detectedAt: now,
          type: 'TIMING',
          field: `holds[${i}].holdId`,
          legacyValue: legacyHold.holdId,
          coreV1Value: coreV1Hold.holdId,
          severity: 'MEDIUM',
        });
      }

      const holdAmountDiff = this.compareAmounts(
        legacyHold.amount,
        coreV1Hold.amount
      );
      if (holdAmountDiff) {
        divergences.push({
          divergenceId: this.generateId(),
          operationId: operation.operationId,
          accountId: operation.accountId,
          detectedAt: now,
          type: holdAmountDiff.type,
          field: `holds[${i}].amount`,
          legacyValue: legacyHold.amount,
          coreV1Value: coreV1Hold.amount,
          delta: holdAmountDiff.delta,
          severity: holdAmountDiff.severity,
        });
      }
    }
  }

  /**
   * Compare two amount strings and return divergence info if different.
   */
  private compareAmounts(
    legacy: string,
    coreV1: string
  ): { type: DivergenceType; delta: string; severity: Divergence['severity'] } | null {
    const legacyNum = parseFloat(legacy);
    const coreV1Num = parseFloat(coreV1);

    if (legacyNum === coreV1Num) {
      return null;
    }

    const delta = coreV1Num - legacyNum;
    const deltaAbs = Math.abs(delta);
    const percentDiff = legacyNum !== 0 ? (deltaAbs / Math.abs(legacyNum)) * 100 : 100;

    // Check if within rounding tolerance
    if (percentDiff <= this.tolerancePercent && deltaAbs < 0.01) {
      return {
        type: 'ROUNDING_ARTEFACT',
        delta: delta.toFixed(4),
        severity: 'LOW',
      };
    }

    // Significant difference
    return {
      type: 'BUG',
      delta: delta.toFixed(2),
      severity: deltaAbs > 100 ? 'CRITICAL' : deltaAbs > 1 ? 'HIGH' : 'MEDIUM',
    };
  }

  /**
   * Classify success/failure divergence.
   */
  private classifySuccessDivergence(
    legacy: ShadowResult,
    coreV1: ShadowResult
  ): DivergenceType {
    // If legacy succeeded but Core v1 failed, likely a bug in Core v1
    if (legacy.success && !coreV1.success) {
      // Check if it's a missing feature
      if (coreV1.error?.includes('not implemented') || 
          coreV1.error?.includes('not supported')) {
        return 'MISSING_FEATURE';
      }
      return 'BUG';
    }

    // If legacy failed but Core v1 succeeded, might be intentional policy change
    if (!legacy.success && coreV1.success) {
      return 'POLICY_DIFFERENCE';
    }

    return 'UNKNOWN';
  }

  private generateId(): string {
    return `DIV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
}
