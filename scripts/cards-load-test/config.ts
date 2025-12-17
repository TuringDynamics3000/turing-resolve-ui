/**
 * Cards Load-Test Configuration
 * 
 * Deliberately harder than reality to break weak card implementations.
 * Based on production-grade stress testing for card processors.
 */

export const CARD_LOAD_CONFIG = {
  /**
   * Scenario A: Authorisation Storm (Peak Retail)
   * 
   * Goal: Break auth logic, not throughput.
   * Profile: Salary day / Black Friday / retail peak
   */
  authStorm: {
    totalAuths: 100_000,
    durationSeconds: 60,
    declineRate: 0.12, // 12% insufficient funds
    minAmount: 500n, // $5.00 in cents
    maxAmount: 50000n, // $500.00 in cents
    merchantMix: ["grocery", "fuel", "ecommerce", "restaurant", "hotel"],
  },

  /**
   * Scenario B: Partial Capture Chaos
   * 
   * Goal: Prove capture logic correctness.
   * Profile: Hotels, fuel stations, pre-auth scenarios
   */
  capture: {
    partialRate: 0.4, // 40% of auths partially captured
    multiCaptureRate: 0.2, // 20% captured in multiple steps
    minCaptureDelaySeconds: 1,
    maxCaptureDelayDays: 3,
  },

  /**
   * Scenario C: Clearing & Settlement Delay
   * 
   * Goal: Prove delayed truth handling.
   * Profile: Scheme processing delays
   */
  settlement: {
    minClearingDelayDays: 1,
    maxClearingDelayDays: 3,
    minSettlementDelayDays: 2,
    maxSettlementDelayDays: 5,
    outOfOrderRate: 0.15, // 15% arrive out of order
  },

  /**
   * Scenario D: Chargeback Wave (90-Day Shock)
   * 
   * Goal: Prove reversibility and evidence.
   * Profile: Customer disputes months later
   */
  chargebacks: {
    rate: 0.05, // 5% of settled txns chargebacked
    minDelayDays: 30,
    maxDelayDays: 120,
    reasonMix: {
      fraud: 0.4,
      goodsNotReceived: 0.3,
      notAsDescribed: 0.2,
      duplicate: 0.1,
    },
    representmentRate: 0.3, // 30% of chargebacks represented
  },

  /**
   * Performance Thresholds
   */
  thresholds: {
    maxMemoryMB: 512,
    minAuthTPS: 1000,
    maxDeclineErrorRate: 0.01, // 1% false positives
    maxHoldLeakage: 0, // Must be zero
    maxReplayDurationMs: 5000,
  },
};

/**
 * Test Account Profiles
 */
export interface TestAccount {
  accountId: string;
  balance: bigint;
  cardToken: string;
  merchantId: string;
}

/**
 * Generate test accounts with realistic balance distribution
 */
export function generateTestAccounts(count: number): TestAccount[] {
  const accounts: TestAccount[] = [];
  
  for (let i = 0; i < count; i++) {
    // Realistic balance distribution
    let balance: bigint;
    const rand = Math.random();
    
    if (rand < 0.1) {
      // 10% low balance (< $50)
      balance = BigInt(Math.floor(Math.random() * 5000));
    } else if (rand < 0.3) {
      // 20% medium balance ($50-$500)
      balance = BigInt(Math.floor(Math.random() * 45000) + 5000);
    } else if (rand < 0.7) {
      // 40% good balance ($500-$5000)
      balance = BigInt(Math.floor(Math.random() * 450000) + 50000);
    } else {
      // 30% high balance (> $5000)
      balance = BigInt(Math.floor(Math.random() * 500000) + 500000);
    }
    
    accounts.push({
      accountId: `acc-${i.toString().padStart(6, "0")}`,
      balance,
      cardToken: `tok_${i.toString().padStart(6, "0")}`,
      merchantId: CARD_LOAD_CONFIG.authStorm.merchantMix[
        i % CARD_LOAD_CONFIG.authStorm.merchantMix.length
      ],
    });
  }
  
  return accounts;
}

/**
 * Random amount generator
 */
export function randomAmount(min: bigint, max: bigint): bigint {
  const range = Number(max - min);
  return min + BigInt(Math.floor(Math.random() * range));
}

/**
 * Random merchant type
 */
export function randomMerchant(): string {
  const merchants = CARD_LOAD_CONFIG.authStorm.merchantMix;
  return merchants[Math.floor(Math.random() * merchants.length)];
}

/**
 * Random chargeback reason
 */
export function randomChargebackReason(): string {
  const rand = Math.random();
  const mix = CARD_LOAD_CONFIG.chargebacks.reasonMix;
  
  if (rand < mix.fraud) return "FRAUD";
  if (rand < mix.fraud + mix.goodsNotReceived) return "GOODS_NOT_RECEIVED";
  if (rand < mix.fraud + mix.goodsNotReceived + mix.notAsDescribed) return "NOT_AS_DESCRIBED";
  return "DUPLICATE";
}

/**
 * Shuffle array (Fisher-Yates)
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
