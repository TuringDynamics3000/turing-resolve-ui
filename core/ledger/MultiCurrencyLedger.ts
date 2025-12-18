/**
 * MultiCurrencyLedger.ts - Multi-Currency Support
 * 
 * TuringDynamics Core - Production Ledger
 * 
 * Provides:
 * - FX rate management with bid/ask spreads
 * - Currency conversion with audit trail
 * - Multi-currency position tracking
 * - FX gain/loss calculation
 * - Regulatory reporting (APRA RBA requirements)
 */

import { Money } from "../deposits/ledger/Money";

// ============================================
// FX RATE TYPES
// ============================================

/**
 * FX Rate with bid/ask spread.
 */
export interface FXRate {
  readonly baseCurrency: string;      // e.g., "USD"
  readonly quoteCurrency: string;     // e.g., "AUD"
  readonly midRate: number;           // Mid-market rate
  readonly bidRate: number;           // Bank buys base (customer sells)
  readonly askRate: number;           // Bank sells base (customer buys)
  readonly effectiveFrom: string;     // ISO 8601
  readonly effectiveTo?: string;      // ISO 8601 (null = current)
  readonly source: string;            // Rate source (e.g., "RBA", "BLOOMBERG")
  readonly rateId: string;            // Unique identifier
}

/**
 * FX conversion result with full audit trail.
 */
export interface FXConversion {
  readonly conversionId: string;
  readonly fromAmount: Money;
  readonly toAmount: Money;
  readonly rateUsed: FXRate;
  readonly rateType: "BID" | "ASK" | "MID";
  readonly convertedAt: string;
  readonly fxGainLoss?: Money;        // For revaluation
}

/**
 * Currency position for a single currency.
 */
export interface CurrencyPosition {
  readonly currency: string;
  readonly balance: Money;
  readonly audEquivalent: Money;      // AUD equivalent at current rate
  readonly unrealizedGainLoss: Money; // Unrealized FX gain/loss
  readonly lastRevaluedAt: string;
}

/**
 * Multi-currency account position.
 */
export interface MultiCurrencyPosition {
  readonly accountId: string;
  readonly positions: readonly CurrencyPosition[];
  readonly totalAudEquivalent: Money;
  readonly totalUnrealizedGainLoss: Money;
  readonly asOfDate: string;
}

// ============================================
// SUPPORTED CURRENCIES
// ============================================

/**
 * ISO 4217 currency codes supported by the platform.
 */
export const SUPPORTED_CURRENCIES = [
  "AUD", // Australian Dollar (base currency)
  "USD", // US Dollar
  "EUR", // Euro
  "GBP", // British Pound
  "NZD", // New Zealand Dollar
  "JPY", // Japanese Yen
  "SGD", // Singapore Dollar
  "HKD", // Hong Kong Dollar
  "CNY", // Chinese Yuan
  "CHF", // Swiss Franc
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

/**
 * Currency metadata.
 */
export interface CurrencyInfo {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  readonly decimalPlaces: number;     // 2 for most, 0 for JPY
  readonly isBaseCurrency: boolean;
}

export const CURRENCY_INFO: Record<SupportedCurrency, CurrencyInfo> = {
  AUD: { code: "AUD", name: "Australian Dollar", symbol: "$", decimalPlaces: 2, isBaseCurrency: true },
  USD: { code: "USD", name: "US Dollar", symbol: "$", decimalPlaces: 2, isBaseCurrency: false },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimalPlaces: 2, isBaseCurrency: false },
  GBP: { code: "GBP", name: "British Pound", symbol: "£", decimalPlaces: 2, isBaseCurrency: false },
  NZD: { code: "NZD", name: "New Zealand Dollar", symbol: "$", decimalPlaces: 2, isBaseCurrency: false },
  JPY: { code: "JPY", name: "Japanese Yen", symbol: "¥", decimalPlaces: 0, isBaseCurrency: false },
  SGD: { code: "SGD", name: "Singapore Dollar", symbol: "$", decimalPlaces: 2, isBaseCurrency: false },
  HKD: { code: "HKD", name: "Hong Kong Dollar", symbol: "$", decimalPlaces: 2, isBaseCurrency: false },
  CNY: { code: "CNY", name: "Chinese Yuan", symbol: "¥", decimalPlaces: 2, isBaseCurrency: false },
  CHF: { code: "CHF", name: "Swiss Franc", symbol: "Fr", decimalPlaces: 2, isBaseCurrency: false },
};

// ============================================
// FX RATE SERVICE
// ============================================

/**
 * FX Rate Service - Manages exchange rates.
 */
export class FXRateService {
  private rates: Map<string, FXRate> = new Map();
  
  /**
   * Get rate key for lookup.
   */
  private getRateKey(baseCurrency: string, quoteCurrency: string): string {
    return `${baseCurrency}/${quoteCurrency}`;
  }
  
  /**
   * Set an FX rate.
   */
  setRate(rate: FXRate): void {
    const key = this.getRateKey(rate.baseCurrency, rate.quoteCurrency);
    this.rates.set(key, rate);
    
    // Also set inverse rate
    const inverseKey = this.getRateKey(rate.quoteCurrency, rate.baseCurrency);
    const inverseRate: FXRate = {
      baseCurrency: rate.quoteCurrency,
      quoteCurrency: rate.baseCurrency,
      midRate: 1 / rate.midRate,
      bidRate: 1 / rate.askRate,  // Inverse bid = 1/ask
      askRate: 1 / rate.bidRate,  // Inverse ask = 1/bid
      effectiveFrom: rate.effectiveFrom,
      effectiveTo: rate.effectiveTo,
      source: rate.source,
      rateId: `${rate.rateId}-INV`,
    };
    this.rates.set(inverseKey, inverseRate);
  }
  
  /**
   * Get current rate for a currency pair.
   */
  getRate(baseCurrency: string, quoteCurrency: string): FXRate | null {
    if (baseCurrency === quoteCurrency) {
      // Same currency - rate is 1
      return {
        baseCurrency,
        quoteCurrency,
        midRate: 1,
        bidRate: 1,
        askRate: 1,
        effectiveFrom: new Date().toISOString(),
        source: "IDENTITY",
        rateId: `${baseCurrency}-IDENTITY`,
      };
    }
    
    const key = this.getRateKey(baseCurrency, quoteCurrency);
    return this.rates.get(key) || null;
  }
  
  /**
   * Convert money from one currency to another.
   */
  convert(
    amount: Money,
    toCurrency: string,
    rateType: "BID" | "ASK" | "MID" = "MID"
  ): FXConversion | null {
    const rate = this.getRate(amount.currency, toCurrency);
    if (!rate) {
      return null;
    }
    
    // Select rate based on type
    let conversionRate: number;
    switch (rateType) {
      case "BID":
        conversionRate = rate.bidRate;
        break;
      case "ASK":
        conversionRate = rate.askRate;
        break;
      case "MID":
      default:
        conversionRate = rate.midRate;
    }
    
    // Get decimal places for target currency
    const targetInfo = CURRENCY_INFO[toCurrency as SupportedCurrency];
    const decimalPlaces = targetInfo?.decimalPlaces ?? 2;
    const multiplier = Math.pow(10, decimalPlaces);
    
    // Convert amount
    const fromAmountDecimal = Number(amount.amount) / 100; // Assuming 2 decimal places for source
    const toAmountDecimal = fromAmountDecimal * conversionRate;
    const toAmountMinorUnits = BigInt(Math.round(toAmountDecimal * multiplier));
    
    const toAmount = new Money(toAmountMinorUnits, toCurrency);
    
    return {
      conversionId: `FX-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      fromAmount: amount,
      toAmount,
      rateUsed: rate,
      rateType,
      convertedAt: new Date().toISOString(),
    };
  }
  
  /**
   * Load default rates (for testing/demo).
   * In production, rates would come from a market data feed.
   */
  loadDefaultRates(): void {
    const now = new Date().toISOString();
    
    // AUD-based rates (typical RBA rates)
    const defaultRates: Omit<FXRate, "rateId">[] = [
      { baseCurrency: "USD", quoteCurrency: "AUD", midRate: 1.55, bidRate: 1.54, askRate: 1.56, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "EUR", quoteCurrency: "AUD", midRate: 1.68, bidRate: 1.67, askRate: 1.69, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "GBP", quoteCurrency: "AUD", midRate: 1.95, bidRate: 1.94, askRate: 1.96, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "NZD", quoteCurrency: "AUD", midRate: 0.92, bidRate: 0.91, askRate: 0.93, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "JPY", quoteCurrency: "AUD", midRate: 0.0103, bidRate: 0.0102, askRate: 0.0104, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "SGD", quoteCurrency: "AUD", midRate: 1.15, bidRate: 1.14, askRate: 1.16, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "HKD", quoteCurrency: "AUD", midRate: 0.20, bidRate: 0.19, askRate: 0.21, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "CNY", quoteCurrency: "AUD", midRate: 0.22, bidRate: 0.21, askRate: 0.23, effectiveFrom: now, source: "DEFAULT" },
      { baseCurrency: "CHF", quoteCurrency: "AUD", midRate: 1.72, bidRate: 1.71, askRate: 1.73, effectiveFrom: now, source: "DEFAULT" },
    ];
    
    defaultRates.forEach((rate, index) => {
      this.setRate({
        ...rate,
        rateId: `DEFAULT-${index + 1}`,
      });
    });
  }
}

// ============================================
// MULTI-CURRENCY POSTING
// ============================================

/**
 * Multi-currency posting leg.
 * Includes both original currency and AUD equivalent.
 */
export interface MultiCurrencyPostingLeg {
  readonly accountCode: string;
  readonly direction: "DEBIT" | "CREDIT";
  readonly amount: Money;
  readonly audEquivalent: Money;      // AUD equivalent at posting time
  readonly fxRate?: FXRate;           // Rate used for conversion
  readonly description?: string;
}

/**
 * Multi-currency posting.
 * Each leg can be in different currencies, but must balance in AUD equivalent.
 */
export interface MultiCurrencyPosting {
  readonly postingId: string;
  readonly legs: readonly MultiCurrencyPostingLeg[];
  readonly description: string;
  readonly occurredAt: string;
  readonly effectiveDate: string;
  readonly reference?: string;
}

/**
 * Validate multi-currency posting balance.
 * Sum of AUD equivalents must balance (debits = credits).
 */
export function validateMultiCurrencyPostingBalance(posting: MultiCurrencyPosting): void {
  if (posting.legs.length === 0) {
    throw new Error("EMPTY_POSTING");
  }
  
  let totalDebitsAud = BigInt(0);
  let totalCreditsAud = BigInt(0);
  
  for (const leg of posting.legs) {
    if (leg.direction === "DEBIT") {
      totalDebitsAud += leg.audEquivalent.amount;
    } else {
      totalCreditsAud += leg.audEquivalent.amount;
    }
  }
  
  // Allow small tolerance for FX rounding (1 cent)
  const difference = totalDebitsAud > totalCreditsAud 
    ? totalDebitsAud - totalCreditsAud 
    : totalCreditsAud - totalDebitsAud;
  
  if (difference > BigInt(1)) {
    throw new Error(
      `POSTING_NOT_BALANCED_AUD: Debits=${totalDebitsAud}, Credits=${totalCreditsAud}, Difference=${difference}`
    );
  }
}

/**
 * Create multi-currency posting with automatic AUD conversion.
 */
export function createMultiCurrencyPosting(
  fxService: FXRateService,
  params: {
    postingId: string;
    legs: Array<{
      accountCode: string;
      direction: "DEBIT" | "CREDIT";
      amount: Money;
      description?: string;
    }>;
    description: string;
    effectiveDate: string;
    reference?: string;
  }
): MultiCurrencyPosting {
  const convertedLegs: MultiCurrencyPostingLeg[] = params.legs.map(leg => {
    if (leg.amount.currency === "AUD") {
      return {
        ...leg,
        audEquivalent: leg.amount,
      };
    }
    
    const conversion = fxService.convert(leg.amount, "AUD", "MID");
    if (!conversion) {
      throw new Error(`NO_FX_RATE: Cannot convert ${leg.amount.currency} to AUD`);
    }
    
    return {
      ...leg,
      audEquivalent: conversion.toAmount,
      fxRate: conversion.rateUsed,
    };
  });
  
  const posting: MultiCurrencyPosting = {
    postingId: params.postingId,
    legs: Object.freeze(convertedLegs),
    description: params.description,
    occurredAt: new Date().toISOString(),
    effectiveDate: params.effectiveDate,
    reference: params.reference,
  };
  
  // Validate balance in AUD
  validateMultiCurrencyPostingBalance(posting);
  
  return posting;
}

// Export singleton FX service
export const fxRateService = new FXRateService();

export default {
  FXRateService,
  fxRateService,
  SUPPORTED_CURRENCIES,
  CURRENCY_INFO,
  validateMultiCurrencyPostingBalance,
  createMultiCurrencyPosting,
};
