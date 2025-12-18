/**
 * FX Revaluation Service
 * 
 * TuringDynamics Core - Bank-Grade FX Revaluation Engine
 * 
 * Implements:
 * - Automated month-end FX revaluation
 * - Unrealized gain/loss calculation
 * - GL posting generation for FX adjustments
 * - Multi-currency position tracking
 */

import { Money } from "../../../core/deposits/ledger/Money";

// ============================================
// FX REVALUATION TYPES
// ============================================

export interface CurrencyPosition {
  readonly accountId: string;
  readonly accountName: string;
  readonly currency: string;
  readonly balanceCents: bigint;
  readonly originalAudCostCents: bigint;
  readonly currentAudValueCents: bigint;
  readonly unrealizedGainLossCents: bigint;
  readonly lastRevaluedAt: string;
}

export interface RevaluationResult {
  readonly positionId: string;
  readonly accountId: string;
  readonly currency: string;
  readonly revaluationDate: string;
  readonly openingAudValueCents: bigint;
  readonly closingAudValueCents: bigint;
  readonly movementCents: bigint;
  readonly unrealizedGainLossCents: bigint;
  readonly fxRateMid: number;
  readonly glPostings: FXGLPosting[];
}

export interface FXGLPosting {
  readonly postingId: string;
  readonly debitAccount: string;
  readonly creditAccount: string;
  readonly amountCents: bigint;
  readonly description: string;
  readonly effectiveDate: string;
}

export interface RevaluationRun {
  readonly runId: string;
  readonly periodEnd: string;
  readonly status: "PENDING" | "RUNNING" | "COMPLETED" | "FAILED";
  readonly startedAt: string;
  readonly completedAt?: string;
  readonly positionsProcessed: number;
  readonly totalUnrealizedGainLossCents: bigint;
  readonly results: RevaluationResult[];
}

// GL Accounts
const FX_GL_ACCOUNTS = {
  ASSET_FX_GAIN: "4300",
  ASSET_FX_LOSS: "5300",
  UNREALIZED_FX: "1290",
};

// Default FX rates (AUD base)
const DEFAULT_FX_RATES: Record<string, number> = {
  USD: 1.55,
  EUR: 1.68,
  GBP: 1.95,
  NZD: 0.92,
  JPY: 0.0103,
  SGD: 1.15,
  HKD: 0.20,
  CNY: 0.22,
  CHF: 1.72,
};

// ============================================
// FX REVALUATION SERVICE
// ============================================

export class FXRevaluationService {
  private positions: Map<string, CurrencyPosition> = new Map();
  private revaluationRuns: Map<string, RevaluationRun> = new Map();
  
  registerPosition(position: CurrencyPosition): void {
    const key = `${position.accountId}-${position.currency}`;
    this.positions.set(key, position);
  }
  
  getPositions(): CurrencyPosition[] {
    return Array.from(this.positions.values());
  }
  
  revaluePosition(position: CurrencyPosition, revaluationDate: string): RevaluationResult {
    const fxRate = DEFAULT_FX_RATES[position.currency] || 1.0;
    const balanceAud = Number(position.balanceCents) * fxRate;
    const closingAudValueCents = BigInt(Math.round(balanceAud));
    const movementCents = closingAudValueCents - position.currentAudValueCents;
    const unrealizedGainLossCents = closingAudValueCents - position.originalAudCostCents;
    
    const glPostings = this.generateGLPostings(position, movementCents, revaluationDate);
    
    return {
      positionId: `REVAL-${position.accountId}-${Date.now()}`,
      accountId: position.accountId,
      currency: position.currency,
      revaluationDate,
      openingAudValueCents: position.currentAudValueCents,
      closingAudValueCents,
      movementCents,
      unrealizedGainLossCents,
      fxRateMid: fxRate,
      glPostings,
    };
  }
  
  private generateGLPostings(position: CurrencyPosition, movementCents: bigint, effectiveDate: string): FXGLPosting[] {
    if (movementCents === BigInt(0)) return [];
    
    const isGain = movementCents > BigInt(0);
    const absMovement = isGain ? movementCents : -movementCents;
    
    return [{
      postingId: `FX-REVAL-${position.accountId}-${effectiveDate}`,
      debitAccount: isGain ? FX_GL_ACCOUNTS.UNREALIZED_FX : FX_GL_ACCOUNTS.ASSET_FX_LOSS,
      creditAccount: isGain ? FX_GL_ACCOUNTS.ASSET_FX_GAIN : FX_GL_ACCOUNTS.UNREALIZED_FX,
      amountCents: absMovement,
      description: `FX revaluation ${isGain ? "gain" : "loss"} - ${position.currency}`,
      effectiveDate,
    }];
  }
  
  runMonthEndRevaluation(periodEnd: string): RevaluationRun {
    const runId = `REVAL-RUN-${periodEnd}-${Date.now()}`;
    const results: RevaluationResult[] = [];
    let totalGainLoss = BigInt(0);
    
    for (const position of this.positions.values()) {
      if (position.currency === "AUD") continue;
      
      const result = this.revaluePosition(position, periodEnd);
      results.push(result);
      totalGainLoss += result.unrealizedGainLossCents;
      
      // Update position
      const key = `${position.accountId}-${position.currency}`;
      this.positions.set(key, {
        ...position,
        currentAudValueCents: result.closingAudValueCents,
        unrealizedGainLossCents: result.unrealizedGainLossCents,
        lastRevaluedAt: periodEnd,
      });
    }
    
    const run: RevaluationRun = {
      runId,
      periodEnd,
      status: "COMPLETED",
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      positionsProcessed: results.length,
      totalUnrealizedGainLossCents: totalGainLoss,
      results,
    };
    
    this.revaluationRuns.set(runId, run);
    return run;
  }
  
  getRevaluationRuns(): RevaluationRun[] {
    return Array.from(this.revaluationRuns.values());
  }
  
  loadSamplePositions(): void {
    const now = new Date().toISOString();
    const samples: CurrencyPosition[] = [
      { accountId: "ACC-USD-001", accountName: "USD Operating", currency: "USD", balanceCents: BigInt(10000000), originalAudCostCents: BigInt(15000000), currentAudValueCents: BigInt(15500000), unrealizedGainLossCents: BigInt(500000), lastRevaluedAt: now },
      { accountId: "ACC-EUR-001", accountName: "EUR Trading", currency: "EUR", balanceCents: BigInt(5000000), originalAudCostCents: BigInt(8000000), currentAudValueCents: BigInt(8400000), unrealizedGainLossCents: BigInt(400000), lastRevaluedAt: now },
      { accountId: "ACC-GBP-001", accountName: "GBP Settlement", currency: "GBP", balanceCents: BigInt(2500000), originalAudCostCents: BigInt(5000000), currentAudValueCents: BigInt(4875000), unrealizedGainLossCents: BigInt(-125000), lastRevaluedAt: now },
      { accountId: "ACC-NZD-001", accountName: "NZD Nostro", currency: "NZD", balanceCents: BigInt(20000000), originalAudCostCents: BigInt(18000000), currentAudValueCents: BigInt(18400000), unrealizedGainLossCents: BigInt(400000), lastRevaluedAt: now },
    ];
    samples.forEach(p => this.registerPosition(p));
  }
}

export const fxRevaluationService = new FXRevaluationService();
fxRevaluationService.loadSamplePositions();

export default { FXRevaluationService, fxRevaluationService, FX_GL_ACCOUNTS };
