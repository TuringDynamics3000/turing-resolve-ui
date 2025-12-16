/**
 * Shadow Mode Tests
 * 
 * Tests for the shadow mode comparison harness.
 * Validates that divergences are correctly detected and classified.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type {
  ShadowAdapter,
  ShadowAccountState,
  ShadowOperation,
  ShadowResult,
} from '../types';
import { CoreV1ShadowAdapter } from '../adapters/CoreV1Adapter';
import { ShadowComparator } from '../comparison/ShadowComparator';
import { DivergenceLogger } from '../logging/DivergenceLogger';

// Mock Legacy Python adapter for testing
class MockLegacyAdapter implements ShadowAdapter {
  readonly source = 'LEGACY_PYTHON' as const;
  private state: Map<string, ShadowAccountState> = new Map();
  private shouldFail = false;
  private failError = '';

  async getAccountState(accountId: string): Promise<ShadowAccountState | null> {
    return this.state.get(accountId) || null;
  }

  async executeOperation(operation: ShadowOperation): Promise<ShadowResult> {
    if (this.shouldFail) {
      return {
        source: 'LEGACY_PYTHON',
        accountId: operation.accountId,
        operationId: operation.operationId,
        success: false,
        error: this.failError,
        stateBefore: null,
        stateAfter: null,
        executionTimeMs: 1,
      };
    }

    const stateBefore = await this.getAccountState(operation.accountId);
    
    // Simulate operation
    let stateAfter: ShadowAccountState;
    if (operation.operationType === 'CREDIT') {
      const currentLedger = parseFloat(stateBefore?.ledgerBalance || '0');
      const amount = parseFloat(operation.amount || '0');
      stateAfter = {
        accountId: operation.accountId,
        ledgerBalance: (currentLedger + amount).toFixed(2),
        availableBalance: (currentLedger + amount).toFixed(2),
        currency: 'AUD',
        status: 'OPEN',
        holds: [],
        factCount: (stateBefore?.factCount || 0) + 1,
        lastFactSequence: (stateBefore?.lastFactSequence || 0) + 1,
      };
    } else {
      stateAfter = stateBefore || {
        accountId: operation.accountId,
        ledgerBalance: '0.00',
        availableBalance: '0.00',
        currency: 'AUD',
        status: 'OPEN',
        holds: [],
        factCount: 1,
        lastFactSequence: 1,
      };
    }

    this.state.set(operation.accountId, stateAfter);

    return {
      source: 'LEGACY_PYTHON',
      accountId: operation.accountId,
      operationId: operation.operationId,
      success: true,
      stateBefore,
      stateAfter,
      executionTimeMs: 1,
    };
  }

  setFailure(error: string): void {
    this.shouldFail = true;
    this.failError = error;
  }

  clearFailure(): void {
    this.shouldFail = false;
    this.failError = '';
  }

  setState(accountId: string, state: ShadowAccountState): void {
    this.state.set(accountId, state);
  }

  clear(): void {
    this.state.clear();
    this.shouldFail = false;
    this.failError = '';
  }
}

describe('Shadow Mode', () => {
  let legacyAdapter: MockLegacyAdapter;
  let coreV1Adapter: CoreV1ShadowAdapter;
  let comparator: ShadowComparator;
  let logger: DivergenceLogger;

  beforeEach(() => {
    legacyAdapter = new MockLegacyAdapter();
    coreV1Adapter = new CoreV1ShadowAdapter();
    comparator = new ShadowComparator(legacyAdapter, coreV1Adapter);
    logger = new DivergenceLogger();
  });

  describe('CoreV1ShadowAdapter', () => {
    it('should return null for non-existent account', async () => {
      const state = await coreV1Adapter.getAccountState('NON-EXISTENT');
      expect(state).toBeNull();
    });

    it('should execute credit operation', async () => {
      const operation: ShadowOperation = {
        operationId: 'OP-001',
        operationType: 'CREDIT',
        accountId: 'ACC-001',
        amount: '1000.00',
        timestamp: new Date().toISOString(),
      };

      const result = await coreV1Adapter.executeOperation(operation);
      
      expect(result.success).toBe(true);
      expect(result.stateAfter).not.toBeNull();
      expect(result.stateAfter?.ledgerBalance).toBe('1000.00');
      expect(result.stateAfter?.availableBalance).toBe('1000.00');
    });

    it('should execute debit operation', async () => {
      // First credit
      await coreV1Adapter.executeOperation({
        operationId: 'OP-001',
        operationType: 'CREDIT',
        accountId: 'ACC-001',
        amount: '1000.00',
        timestamp: new Date().toISOString(),
      });

      // Then debit
      const result = await coreV1Adapter.executeOperation({
        operationId: 'OP-002',
        operationType: 'DEBIT',
        accountId: 'ACC-001',
        amount: '300.00',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.stateAfter?.ledgerBalance).toBe('700.00');
    });

    it('should execute hold placement', async () => {
      // First credit
      await coreV1Adapter.executeOperation({
        operationId: 'OP-001',
        operationType: 'CREDIT',
        accountId: 'ACC-001',
        amount: '1000.00',
        timestamp: new Date().toISOString(),
      });

      // Place hold
      const result = await coreV1Adapter.executeOperation({
        operationId: 'OP-002',
        operationType: 'HOLD_PLACE',
        accountId: 'ACC-001',
        amount: '200.00',
        holdId: 'HOLD-001',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.stateAfter?.ledgerBalance).toBe('1000.00');
      expect(result.stateAfter?.availableBalance).toBe('800.00');
      expect(result.stateAfter?.holds.length).toBe(1);
    });

    it('should execute hold release', async () => {
      // Credit and place hold
      await coreV1Adapter.executeOperation({
        operationId: 'OP-001',
        operationType: 'CREDIT',
        accountId: 'ACC-001',
        amount: '1000.00',
        timestamp: new Date().toISOString(),
      });

      await coreV1Adapter.executeOperation({
        operationId: 'OP-002',
        operationType: 'HOLD_PLACE',
        accountId: 'ACC-001',
        amount: '200.00',
        holdId: 'HOLD-001',
        timestamp: new Date().toISOString(),
      });

      // Release hold
      const result = await coreV1Adapter.executeOperation({
        operationId: 'OP-003',
        operationType: 'HOLD_RELEASE',
        accountId: 'ACC-001',
        holdId: 'HOLD-001',
        timestamp: new Date().toISOString(),
      });

      expect(result.success).toBe(true);
      expect(result.stateAfter?.availableBalance).toBe('1000.00');
      expect(result.stateAfter?.holds.length).toBe(0);
    });
  });

  describe('ShadowComparator', () => {
    it('should detect matching results', async () => {
      const operation: ShadowOperation = {
        operationId: 'OP-001',
        operationType: 'CREDIT',
        accountId: 'ACC-001',
        amount: '1000.00',
        timestamp: new Date().toISOString(),
      };

      const result = await comparator.compare(operation);

      expect(result.match).toBe(true);
      expect(result.divergences.length).toBe(0);
    });

    it('should detect success/failure divergence', async () => {
      legacyAdapter.setFailure('INSUFFICIENT_FUNDS');

      const operation: ShadowOperation = {
        operationId: 'OP-001',
        operationType: 'CREDIT',
        accountId: 'ACC-001',
        amount: '1000.00',
        timestamp: new Date().toISOString(),
      };

      const result = await comparator.compare(operation);

      expect(result.match).toBe(false);
      expect(result.divergences.length).toBe(1);
      expect(result.divergences[0].field).toBe('success');
      expect(result.divergences[0].severity).toBe('CRITICAL');
    });

    it('should detect balance divergence', async () => {
      // Set up legacy with different balance
      legacyAdapter.setState('ACC-001', {
        accountId: 'ACC-001',
        ledgerBalance: '999.99', // Slightly different
        availableBalance: '999.99',
        currency: 'AUD',
        status: 'OPEN',
        holds: [],
        factCount: 1,
        lastFactSequence: 1,
      });

      // Core v1 will compute 1000.00
      coreV1Adapter.loadFacts('ACC-001', [
        { type: 'ACCOUNT_OPENED', data: {}, sequence: 1 },
        { type: 'POSTING_APPLIED', data: { postingType: 'CREDIT', amount: '1000.00' }, sequence: 2 },
      ]);

      const operation: ShadowOperation = {
        operationId: 'OP-001',
        operationType: 'CREDIT',
        accountId: 'ACC-001',
        amount: '100.00',
        timestamp: new Date().toISOString(),
      };

      const result = await comparator.compare(operation);

      // Should detect divergence in balances
      expect(result.match).toBe(false);
    });
  });

  describe('DivergenceLogger', () => {
    it('should log divergences', () => {
      const result = {
        operationId: 'OP-001',
        accountId: 'ACC-001',
        comparedAt: new Date().toISOString(),
        legacyResult: {} as ShadowResult,
        coreV1Result: {} as ShadowResult,
        match: false,
        divergences: [
          {
            divergenceId: 'DIV-001',
            operationId: 'OP-001',
            accountId: 'ACC-001',
            detectedAt: new Date().toISOString(),
            type: 'BUG' as const,
            field: 'ledgerBalance',
            legacyValue: '1000.00',
            coreV1Value: '999.99',
            delta: '-0.01',
            severity: 'HIGH' as const,
          },
        ],
      };

      logger.log(result);
      const stats = logger.getStats();

      expect(stats.total).toBe(1);
      expect(stats.byType.BUG).toBe(1);
      expect(stats.bySeverity.HIGH).toBe(1);
    });

    it('should calculate match rate', () => {
      // Log 3 matches and 1 divergence
      for (let i = 0; i < 3; i++) {
        logger.log({
          operationId: `OP-${i}`,
          accountId: 'ACC-001',
          comparedAt: new Date().toISOString(),
          legacyResult: {} as ShadowResult,
          coreV1Result: {} as ShadowResult,
          match: true,
          divergences: [],
        });
      }

      logger.log({
        operationId: 'OP-3',
        accountId: 'ACC-001',
        comparedAt: new Date().toISOString(),
        legacyResult: {} as ShadowResult,
        coreV1Result: {} as ShadowResult,
        match: false,
        divergences: [
          {
            divergenceId: 'DIV-001',
            operationId: 'OP-3',
            accountId: 'ACC-001',
            detectedAt: new Date().toISOString(),
            type: 'BUG' as const,
            field: 'ledgerBalance',
            legacyValue: '1000.00',
            coreV1Value: '999.99',
            severity: 'HIGH' as const,
          },
        ],
      });

      const stats = logger.getStats();
      expect(stats.matchRate).toBe(75); // 3/4 = 75%
    });

    it('should filter by type', () => {
      logger.log({
        operationId: 'OP-001',
        accountId: 'ACC-001',
        comparedAt: new Date().toISOString(),
        legacyResult: {} as ShadowResult,
        coreV1Result: {} as ShadowResult,
        match: false,
        divergences: [
          {
            divergenceId: 'DIV-001',
            operationId: 'OP-001',
            accountId: 'ACC-001',
            detectedAt: new Date().toISOString(),
            type: 'BUG' as const,
            field: 'ledgerBalance',
            legacyValue: '1000.00',
            coreV1Value: '999.99',
            severity: 'HIGH' as const,
          },
          {
            divergenceId: 'DIV-002',
            operationId: 'OP-001',
            accountId: 'ACC-001',
            detectedAt: new Date().toISOString(),
            type: 'ROUNDING_ARTEFACT' as const,
            field: 'availableBalance',
            legacyValue: '1000.001',
            coreV1Value: '1000.00',
            severity: 'LOW' as const,
          },
        ],
      });

      const bugs = logger.getByType('BUG');
      const rounding = logger.getByType('ROUNDING_ARTEFACT');

      expect(bugs.length).toBe(1);
      expect(rounding.length).toBe(1);
    });

    it('should generate report', () => {
      logger.log({
        operationId: 'OP-001',
        accountId: 'ACC-001',
        comparedAt: new Date().toISOString(),
        legacyResult: {} as ShadowResult,
        coreV1Result: {} as ShadowResult,
        match: false,
        divergences: [
          {
            divergenceId: 'DIV-001',
            operationId: 'OP-001',
            accountId: 'ACC-001',
            detectedAt: new Date().toISOString(),
            type: 'BUG' as const,
            field: 'ledgerBalance',
            legacyValue: '1000.00',
            coreV1Value: '999.99',
            severity: 'HIGH' as const,
          },
        ],
      });

      const report = logger.generateReport();

      expect(report).toContain('Shadow Mode Divergence Report');
      expect(report).toContain('Total Divergences: 1');
      expect(report).toContain('BUG');
      expect(report).toContain('ledgerBalance');
    });
  });

  describe('Integration', () => {
    it('should run full shadow comparison workflow', async () => {
      // Only test credit operations since mock adapter doesn't fully implement debit
      const operations: ShadowOperation[] = [
        {
          operationId: 'OP-001',
          operationType: 'CREDIT',
          accountId: 'ACC-001',
          amount: '1000.00',
          timestamp: new Date().toISOString(),
        },
        {
          operationId: 'OP-002',
          operationType: 'CREDIT',
          accountId: 'ACC-001',
          amount: '500.00',
          timestamp: new Date().toISOString(),
        },
      ];

      for (const op of operations) {
        const result = await comparator.compare(op);
        logger.log(result);
      }

      const stats = logger.getStats();
      
      // Both adapters should produce matching results for credit operations
      expect(stats.matchRate).toBe(100);
      expect(stats.total).toBe(0);
    });
  });
});
