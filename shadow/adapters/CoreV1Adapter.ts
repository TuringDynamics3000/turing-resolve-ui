/**
 * Core v1 Shadow Adapter
 * 
 * Wraps the TS Deposits Core v1 logic for shadow mode comparison.
 * This adapter is READ-ONLY in shadow mode - it computes what the
 * state WOULD be without persisting anything.
 */

import type {
  ShadowAdapter,
  ShadowAccountState,
  ShadowOperation,
  ShadowResult,
  ShadowHold,
} from '../types';

// Import Core v1 types (dynamic import to avoid build issues)
type Money = { amount: bigint; currency: string };
type Posting = { type: string; amount?: Money; holdId?: string; occurredAt: Date };

export class CoreV1ShadowAdapter implements ShadowAdapter {
  readonly source = 'CORE_V1_TS' as const;

  private facts: Map<string, Array<{ type: string; data: unknown; sequence: number }>> = new Map();

  constructor() {
    // Initialize with empty state - shadow mode doesn't read from DB
  }

  async getAccountState(accountId: string): Promise<ShadowAccountState | null> {
    const accountFacts = this.facts.get(accountId);
    if (!accountFacts || accountFacts.length === 0) {
      return null;
    }

    // Rebuild state from facts
    return this.rebuildFromFacts(accountId, accountFacts);
  }

  async executeOperation(operation: ShadowOperation): Promise<ShadowResult> {
    const startTime = Date.now();
    const operationId = operation.operationId;
    const accountId = operation.accountId;

    try {
      // Get state before
      const stateBefore = await this.getAccountState(accountId);

      // Execute operation by adding fact
      const newFact = this.operationToFact(operation);
      
      if (!this.facts.has(accountId)) {
        this.facts.set(accountId, []);
      }
      const accountFacts = this.facts.get(accountId)!;
      const sequence = accountFacts.length + 1;
      accountFacts.push({ ...newFact, sequence });

      // Get state after
      const stateAfter = await this.getAccountState(accountId);

      return {
        source: 'CORE_V1_TS',
        accountId,
        operationId,
        success: true,
        stateBefore,
        stateAfter,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        source: 'CORE_V1_TS',
        accountId,
        operationId,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        stateBefore: null,
        stateAfter: null,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  private operationToFact(operation: ShadowOperation): { type: string; data: unknown } {
    const timestamp = operation.timestamp;
    
    switch (operation.operationType) {
      case 'CREDIT':
        return {
          type: 'POSTING_APPLIED',
          data: {
            postingType: 'CREDIT',
            amount: operation.amount,
            currency: 'AUD',
            occurredAt: timestamp,
          },
        };
      case 'DEBIT':
        return {
          type: 'POSTING_APPLIED',
          data: {
            postingType: 'DEBIT',
            amount: operation.amount,
            currency: 'AUD',
            occurredAt: timestamp,
          },
        };
      case 'HOLD_PLACE':
        return {
          type: 'POSTING_APPLIED',
          data: {
            postingType: 'HOLD_PLACED',
            holdId: operation.holdId,
            amount: operation.amount,
            currency: 'AUD',
            occurredAt: timestamp,
          },
        };
      case 'HOLD_RELEASE':
        return {
          type: 'POSTING_APPLIED',
          data: {
            postingType: 'HOLD_RELEASED',
            holdId: operation.holdId,
            occurredAt: timestamp,
          },
        };
      case 'INTEREST':
        return {
          type: 'POSTING_APPLIED',
          data: {
            postingType: 'INTEREST_ACCRUED',
            amount: operation.amount,
            currency: 'AUD',
            occurredAt: timestamp,
          },
        };
      case 'CLOSE':
        return {
          type: 'ACCOUNT_CLOSED',
          data: {
            closedAt: timestamp,
            reason: 'CUSTOMER_REQUEST',
          },
        };
      default:
        throw new Error(`Unknown operation type: ${operation.operationType}`);
    }
  }

  private rebuildFromFacts(
    accountId: string,
    facts: Array<{ type: string; data: unknown; sequence: number }>
  ): ShadowAccountState {
    // Start with zero state
    let ledgerBalance = BigInt(0);
    let availableBalance = BigInt(0);
    let status: ShadowAccountState['status'] = 'OPEN';
    const holds: ShadowHold[] = [];

    for (const fact of facts) {
      const data = fact.data as Record<string, unknown>;

      if (fact.type === 'ACCOUNT_OPENED') {
        status = 'OPEN';
      } else if (fact.type === 'ACCOUNT_CLOSED') {
        status = 'CLOSED';
      } else if (fact.type === 'POSTING_APPLIED') {
        const postingType = data.postingType as string;
        const amountStr = data.amount as string | undefined;
        const amount = amountStr ? this.parseAmount(amountStr) : BigInt(0);

        switch (postingType) {
          case 'CREDIT':
            ledgerBalance += amount;
            availableBalance += amount;
            break;
          case 'DEBIT':
            ledgerBalance -= amount;
            availableBalance -= amount;
            break;
          case 'HOLD_PLACED':
            availableBalance -= amount;
            holds.push({
              holdId: data.holdId as string,
              amount: amountStr || '0.00',
              type: 'PAYMENT',
              placedAt: data.occurredAt as string,
            });
            break;
          case 'HOLD_RELEASED': {
            const holdId = data.holdId as string;
            const holdIndex = holds.findIndex(h => h.holdId === holdId);
            if (holdIndex >= 0) {
              const hold = holds[holdIndex];
              availableBalance += this.parseAmount(hold.amount);
              holds.splice(holdIndex, 1);
            }
            break;
          }
          case 'INTEREST_ACCRUED':
            ledgerBalance += amount;
            availableBalance += amount;
            break;
        }
      }
    }

    return {
      accountId,
      ledgerBalance: this.formatAmount(ledgerBalance),
      availableBalance: this.formatAmount(availableBalance),
      currency: 'AUD',
      status,
      holds,
      factCount: facts.length,
      lastFactSequence: facts[facts.length - 1]?.sequence || 0,
    };
  }

  private parseAmount(amountStr: string): bigint {
    // Parse "1000.00" to bigint cents (100000)
    const parts = amountStr.split('.');
    const dollars = BigInt(parts[0] || '0');
    const cents = BigInt((parts[1] || '00').padEnd(2, '0').slice(0, 2));
    return dollars * BigInt(100) + cents;
  }

  private formatAmount(cents: bigint): string {
    // Format bigint cents to "1000.00"
    const isNegative = cents < BigInt(0);
    const absCents = isNegative ? -cents : cents;
    const dollars = absCents / BigInt(100);
    const remainingCents = absCents % BigInt(100);
    const formatted = `${dollars}.${remainingCents.toString().padStart(2, '0')}`;
    return isNegative ? `-${formatted}` : formatted;
  }

  // Load facts from external source (for testing with real data)
  loadFacts(accountId: string, facts: Array<{ type: string; data: unknown; sequence: number }>): void {
    this.facts.set(accountId, facts);
  }

  // Clear all facts (for testing)
  clear(): void {
    this.facts.clear();
  }
}
