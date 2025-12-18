/**
 * MultiCurrencyWalletService.ts - Customer Multi-Currency Wallet
 * 
 * TuringDynamics Core - Bank-Grade FX Wallet
 * 
 * Features:
 * - Customer-level multi-currency balances
 * - Real-time FX rate quotes with configurable spread
 * - Currency conversion with GL posting integration
 * - Regulatory disclosures for FX transactions
 * 
 * APRA Compliance: APS 117 Interest Rate Risk, APS 116 Capital Adequacy
 */

import { Money } from "../../../core/deposits/ledger/Money";
import { nanoid } from "nanoid";

// ============================================
// SUPPORTED CURRENCIES
// ============================================

export const SUPPORTED_CURRENCIES = [
  "AUD", "USD", "EUR", "GBP", "NZD", "JPY", "SGD", "HKD", "CNY", "CHF"
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

// ============================================
// FX RATE TYPES
// ============================================

export interface FXRate {
  baseCurrency: SupportedCurrency;
  quoteCurrency: SupportedCurrency;
  bidRate: number;    // Bank buys base currency
  askRate: number;    // Bank sells base currency
  midRate: number;    // Mid-market rate
  source: string;
  timestamp: string;
  validUntil: string;
}

export interface FXQuote {
  quoteId: string;
  customerId: string;
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  fromAmount: Money;
  toAmount: Money;
  spotRate: number;
  customerRate: number;
  spreadPercent: number;
  spreadAmount: Money;
  expiresAt: string;
  disclosures: FXDisclosure[];
}

export interface FXDisclosure {
  code: string;
  message: string;
}

// ============================================
// WALLET TYPES
// ============================================

export interface CurrencyBalance {
  currency: SupportedCurrency;
  balance: Money;
  availableBalance: Money;
  holdAmount: Money;
  isActive: boolean;
  lastUpdated: string;
}

export interface CustomerWallet {
  customerId: string;
  customerName: string;
  balances: CurrencyBalance[];
  totalValueAUD: Money;
  lastUpdated: string;
}

export interface FXConversionResult {
  transactionId: string;
  customerId: string;
  fromCurrency: SupportedCurrency;
  toCurrency: SupportedCurrency;
  fromAmount: Money;
  toAmount: Money;
  spotRate: number;
  customerRate: number;
  spreadPercent: number;
  postingId: string;
  status: "COMPLETED" | "FAILED";
  executedAt: string;
  glPostings: GLPosting[];
}

export interface GLPosting {
  accountCode: string;
  accountName: string;
  direction: "DEBIT" | "CREDIT";
  amount: string;
  currency: string;
}

// ============================================
// SPREAD CONFIGURATION
// ============================================

/**
 * FX spread configuration by currency pair and customer tier.
 * Spread is applied on top of mid-market rate.
 */
export interface SpreadConfig {
  currencyPair: string;  // e.g., "AUD/USD"
  retailSpread: number;  // Percentage for retail customers
  premiumSpread: number; // Percentage for premium customers
  corporateSpread: number; // Percentage for corporate customers
}

const DEFAULT_SPREADS: SpreadConfig[] = [
  { currencyPair: "AUD/USD", retailSpread: 0.50, premiumSpread: 0.25, corporateSpread: 0.10 },
  { currencyPair: "AUD/EUR", retailSpread: 0.60, premiumSpread: 0.30, corporateSpread: 0.12 },
  { currencyPair: "AUD/GBP", retailSpread: 0.55, premiumSpread: 0.28, corporateSpread: 0.11 },
  { currencyPair: "AUD/NZD", retailSpread: 0.40, premiumSpread: 0.20, corporateSpread: 0.08 },
  { currencyPair: "AUD/JPY", retailSpread: 0.65, premiumSpread: 0.32, corporateSpread: 0.13 },
  { currencyPair: "AUD/SGD", retailSpread: 0.55, premiumSpread: 0.28, corporateSpread: 0.11 },
  { currencyPair: "AUD/HKD", retailSpread: 0.60, premiumSpread: 0.30, corporateSpread: 0.12 },
  { currencyPair: "AUD/CNY", retailSpread: 0.80, premiumSpread: 0.40, corporateSpread: 0.16 },
  { currencyPair: "AUD/CHF", retailSpread: 0.55, premiumSpread: 0.28, corporateSpread: 0.11 },
];

// ============================================
// SIMULATED FX RATES (Production would use live feed)
// ============================================

const SIMULATED_RATES: Record<string, { bid: number; ask: number; mid: number }> = {
  "AUD/USD": { bid: 0.6520, ask: 0.6540, mid: 0.6530 },
  "AUD/EUR": { bid: 0.6180, ask: 0.6200, mid: 0.6190 },
  "AUD/GBP": { bid: 0.5280, ask: 0.5300, mid: 0.5290 },
  "AUD/NZD": { bid: 1.0850, ask: 1.0870, mid: 1.0860 },
  "AUD/JPY": { bid: 97.80, ask: 98.00, mid: 97.90 },
  "AUD/SGD": { bid: 0.8780, ask: 0.8800, mid: 0.8790 },
  "AUD/HKD": { bid: 5.0900, ask: 5.1100, mid: 5.1000 },
  "AUD/CNY": { bid: 4.7200, ask: 4.7400, mid: 4.7300 },
  "AUD/CHF": { bid: 0.5780, ask: 0.5800, mid: 0.5790 },
};

// ============================================
// SAMPLE CUSTOMER DATA
// ============================================

interface CustomerData {
  customerId: string;
  customerName: string;
  tier: "RETAIL" | "PREMIUM" | "CORPORATE";
  balances: Map<SupportedCurrency, { balance: bigint; available: bigint; hold: bigint }>;
}

const sampleCustomers: CustomerData[] = [
  {
    customerId: "CUST-001",
    customerName: "Sarah Mitchell",
    tier: "PREMIUM",
    balances: new Map([
      ["AUD", { balance: BigInt(2500000), available: BigInt(2500000), hold: BigInt(0) }],
      ["USD", { balance: BigInt(150000), available: BigInt(150000), hold: BigInt(0) }],
      ["EUR", { balance: BigInt(75000), available: BigInt(75000), hold: BigInt(0) }],
    ]),
  },
  {
    customerId: "CUST-002",
    customerName: "James Chen",
    tier: "RETAIL",
    balances: new Map([
      ["AUD", { balance: BigInt(850000), available: BigInt(800000), hold: BigInt(50000) }],
      ["GBP", { balance: BigInt(25000), available: BigInt(25000), hold: BigInt(0) }],
    ]),
  },
  {
    customerId: "CUST-003",
    customerName: "TechCorp Pty Ltd",
    tier: "CORPORATE",
    balances: new Map([
      ["AUD", { balance: BigInt(15000000), available: BigInt(14500000), hold: BigInt(500000) }],
      ["USD", { balance: BigInt(5000000), available: BigInt(5000000), hold: BigInt(0) }],
      ["EUR", { balance: BigInt(2500000), available: BigInt(2500000), hold: BigInt(0) }],
      ["GBP", { balance: BigInt(1500000), available: BigInt(1500000), hold: BigInt(0) }],
      ["JPY", { balance: BigInt(50000000), available: BigInt(50000000), hold: BigInt(0) }],
    ]),
  },
  {
    customerId: "CUST-004",
    customerName: "Emma Wilson",
    tier: "RETAIL",
    balances: new Map([
      ["AUD", { balance: BigInt(320000), available: BigInt(320000), hold: BigInt(0) }],
      ["NZD", { balance: BigInt(45000), available: BigInt(45000), hold: BigInt(0) }],
    ]),
  },
  {
    customerId: "CUST-005",
    customerName: "Global Trade Ltd",
    tier: "CORPORATE",
    balances: new Map([
      ["AUD", { balance: BigInt(8500000), available: BigInt(8000000), hold: BigInt(500000) }],
      ["USD", { balance: BigInt(3200000), available: BigInt(3200000), hold: BigInt(0) }],
      ["CNY", { balance: BigInt(12000000), available: BigInt(12000000), hold: BigInt(0) }],
      ["SGD", { balance: BigInt(800000), available: BigInt(800000), hold: BigInt(0) }],
    ]),
  },
];

// ============================================
// MULTI-CURRENCY WALLET SERVICE
// ============================================

class MultiCurrencyWalletService {
  private customers: Map<string, CustomerData> = new Map();
  private transactions: FXConversionResult[] = [];
  private quotes: Map<string, FXQuote> = new Map();

  constructor() {
    // Initialize with sample data
    for (const customer of sampleCustomers) {
      this.customers.set(customer.customerId, customer);
    }
  }

  // ============================================
  // FX RATE OPERATIONS
  // ============================================

  /**
   * Get current FX rate for a currency pair.
   */
  getRate(baseCurrency: SupportedCurrency, quoteCurrency: SupportedCurrency): FXRate | null {
    if (baseCurrency === quoteCurrency) {
      return {
        baseCurrency,
        quoteCurrency,
        bidRate: 1,
        askRate: 1,
        midRate: 1,
        source: "INTERNAL",
        timestamp: new Date().toISOString(),
        validUntil: new Date(Date.now() + 60000).toISOString(),
      };
    }

    // Try direct rate
    const directKey = `${baseCurrency}/${quoteCurrency}`;
    if (SIMULATED_RATES[directKey]) {
      const rate = SIMULATED_RATES[directKey];
      return {
        baseCurrency,
        quoteCurrency,
        bidRate: rate.bid,
        askRate: rate.ask,
        midRate: rate.mid,
        source: "REUTERS",
        timestamp: new Date().toISOString(),
        validUntil: new Date(Date.now() + 60000).toISOString(),
      };
    }

    // Try inverse rate
    const inverseKey = `${quoteCurrency}/${baseCurrency}`;
    if (SIMULATED_RATES[inverseKey]) {
      const rate = SIMULATED_RATES[inverseKey];
      return {
        baseCurrency,
        quoteCurrency,
        bidRate: 1 / rate.ask,  // Inverse of ask becomes bid
        askRate: 1 / rate.bid,  // Inverse of bid becomes ask
        midRate: 1 / rate.mid,
        source: "REUTERS",
        timestamp: new Date().toISOString(),
        validUntil: new Date(Date.now() + 60000).toISOString(),
      };
    }

    // Cross rate via AUD
    if (baseCurrency !== "AUD" && quoteCurrency !== "AUD") {
      const baseToAUD = this.getRate(baseCurrency, "AUD");
      const audToQuote = this.getRate("AUD", quoteCurrency);
      
      if (baseToAUD && audToQuote) {
        return {
          baseCurrency,
          quoteCurrency,
          bidRate: baseToAUD.bidRate * audToQuote.bidRate,
          askRate: baseToAUD.askRate * audToQuote.askRate,
          midRate: baseToAUD.midRate * audToQuote.midRate,
          source: "CROSS_RATE",
          timestamp: new Date().toISOString(),
          validUntil: new Date(Date.now() + 60000).toISOString(),
        };
      }
    }

    return null;
  }

  /**
   * Get all available FX rates.
   */
  getAllRates(): FXRate[] {
    const rates: FXRate[] = [];
    
    for (const currency of SUPPORTED_CURRENCIES) {
      if (currency !== "AUD") {
        const rate = this.getRate("AUD", currency);
        if (rate) {
          rates.push(rate);
        }
      }
    }
    
    return rates;
  }

  // ============================================
  // QUOTE OPERATIONS
  // ============================================

  /**
   * Get FX quote for a conversion.
   */
  getQuote(
    customerId: string,
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency,
    fromAmount: Money
  ): FXQuote | null {
    const customer = this.customers.get(customerId);
    if (!customer) return null;

    const rate = this.getRate(fromCurrency, toCurrency);
    if (!rate) return null;

    // Get spread based on customer tier
    const spreadConfig = this.getSpreadConfig(fromCurrency, toCurrency);
    const spreadPercent = this.getSpreadForTier(spreadConfig, customer.tier);

    // Calculate customer rate (worse than mid-market by spread)
    const customerRate = rate.midRate * (1 - spreadPercent / 100);
    
    // Calculate to amount
    const toAmountValue = BigInt(Math.floor(Number(fromAmount.amount) * customerRate));
    const toAmount = new Money(toAmountValue, toCurrency);

    // Calculate spread amount in from currency
    const spreadAmountValue = BigInt(Math.floor(Number(fromAmount.amount) * spreadPercent / 100));
    const spreadAmount = new Money(spreadAmountValue, fromCurrency);

    const quoteId = `FXQ-${nanoid(12)}`;
    const quote: FXQuote = {
      quoteId,
      customerId,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount,
      spotRate: rate.midRate,
      customerRate,
      spreadPercent,
      spreadAmount,
      expiresAt: new Date(Date.now() + 30000).toISOString(), // 30 second validity
      disclosures: this.getDisclosures(fromCurrency, toCurrency, spreadPercent),
    };

    this.quotes.set(quoteId, quote);
    return quote;
  }

  /**
   * Get regulatory disclosures for FX transaction.
   */
  private getDisclosures(
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency,
    spreadPercent: number
  ): FXDisclosure[] {
    return [
      {
        code: "FX_SPREAD",
        message: `This rate includes a ${spreadPercent.toFixed(2)}% margin above the wholesale exchange rate.`,
      },
      {
        code: "FX_RISK",
        message: "Exchange rates fluctuate. The final amount may differ if the rate changes before settlement.",
      },
      {
        code: "FX_FEES",
        message: "No additional fees apply to this conversion. The margin is included in the exchange rate.",
      },
      {
        code: "FX_SETTLEMENT",
        message: "Conversions are settled immediately. Funds will be available in your account instantly.",
      },
    ];
  }

  private getSpreadConfig(
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency
  ): SpreadConfig {
    const pair1 = `${fromCurrency}/${toCurrency}`;
    const pair2 = `${toCurrency}/${fromCurrency}`;
    
    const config = DEFAULT_SPREADS.find(s => s.currencyPair === pair1 || s.currencyPair === pair2);
    
    return config || { currencyPair: pair1, retailSpread: 0.75, premiumSpread: 0.40, corporateSpread: 0.15 };
  }

  private getSpreadForTier(config: SpreadConfig, tier: "RETAIL" | "PREMIUM" | "CORPORATE"): number {
    switch (tier) {
      case "RETAIL": return config.retailSpread;
      case "PREMIUM": return config.premiumSpread;
      case "CORPORATE": return config.corporateSpread;
    }
  }

  // ============================================
  // WALLET OPERATIONS
  // ============================================

  /**
   * Get customer wallet with all currency balances.
   */
  getWallet(customerId: string): CustomerWallet | null {
    const customer = this.customers.get(customerId);
    if (!customer) return null;

    const balances: CurrencyBalance[] = [];
    let totalValueAUDCents = BigInt(0);

    for (const [currency, bal] of customer.balances) {
      const balance = new Money(bal.balance, currency);
      const availableBalance = new Money(bal.available, currency);
      const holdAmount = new Money(bal.hold, currency);

      balances.push({
        currency,
        balance,
        availableBalance,
        holdAmount,
        isActive: true,
        lastUpdated: new Date().toISOString(),
      });

      // Convert to AUD for total
      if (currency === "AUD") {
        totalValueAUDCents += bal.balance;
      } else {
        const rate = this.getRate(currency, "AUD");
        if (rate) {
          totalValueAUDCents += BigInt(Math.floor(Number(bal.balance) * rate.midRate));
        }
      }
    }

    return {
      customerId,
      customerName: customer.customerName,
      balances,
      totalValueAUD: new Money(totalValueAUDCents, "AUD"),
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get all customer wallets.
   */
  getAllWallets(): CustomerWallet[] {
    const wallets: CustomerWallet[] = [];
    
    for (const customerId of this.customers.keys()) {
      const wallet = this.getWallet(customerId);
      if (wallet) {
        wallets.push(wallet);
      }
    }
    
    return wallets;
  }

  /**
   * Add a new currency to customer wallet.
   */
  addCurrencyToWallet(customerId: string, currency: SupportedCurrency): boolean {
    const customer = this.customers.get(customerId);
    if (!customer) return false;

    if (customer.balances.has(currency)) {
      return true; // Already exists
    }

    customer.balances.set(currency, {
      balance: BigInt(0),
      available: BigInt(0),
      hold: BigInt(0),
    });

    return true;
  }

  // ============================================
  // CONVERSION OPERATIONS
  // ============================================

  /**
   * Execute currency conversion.
   */
  executeConversion(
    customerId: string,
    fromCurrency: SupportedCurrency,
    toCurrency: SupportedCurrency,
    fromAmount: Money,
    quoteId?: string
  ): FXConversionResult | null {
    const customer = this.customers.get(customerId);
    if (!customer) return null;

    // Validate from currency balance
    const fromBalance = customer.balances.get(fromCurrency);
    if (!fromBalance || fromBalance.available < fromAmount.amount) {
      return null; // Insufficient balance
    }

    // Get or validate quote
    let quote: FXQuote | null = null;
    if (quoteId) {
      quote = this.quotes.get(quoteId) || null;
      if (!quote || new Date(quote.expiresAt) < new Date()) {
        quote = null; // Quote expired or invalid
      }
    }

    if (!quote) {
      quote = this.getQuote(customerId, fromCurrency, toCurrency, fromAmount);
    }

    if (!quote) return null;

    // Ensure to currency exists in wallet
    this.addCurrencyToWallet(customerId, toCurrency);

    // Execute the conversion
    const transactionId = `FXT-${nanoid(12)}`;
    const postingId = `POST-${nanoid(12)}`;

    // Update balances
    fromBalance.balance -= fromAmount.amount;
    fromBalance.available -= fromAmount.amount;

    const toBalance = customer.balances.get(toCurrency)!;
    toBalance.balance += quote.toAmount.amount;
    toBalance.available += quote.toAmount.amount;

    // Generate GL postings
    const glPostings: GLPosting[] = [
      {
        accountCode: `2000-${fromCurrency}`,
        accountName: `Customer Deposits - ${fromCurrency}`,
        direction: "DEBIT",
        amount: fromAmount.toDisplayString(),
        currency: fromCurrency,
      },
      {
        accountCode: `2000-${toCurrency}`,
        accountName: `Customer Deposits - ${toCurrency}`,
        direction: "CREDIT",
        amount: quote.toAmount.toDisplayString(),
        currency: toCurrency,
      },
      {
        accountCode: "4300",
        accountName: "FX Trading Revenue",
        direction: "CREDIT",
        amount: quote.spreadAmount.toDisplayString(),
        currency: fromCurrency,
      },
    ];

    const result: FXConversionResult = {
      transactionId,
      customerId,
      fromCurrency,
      toCurrency,
      fromAmount,
      toAmount: quote.toAmount,
      spotRate: quote.spotRate,
      customerRate: quote.customerRate,
      spreadPercent: quote.spreadPercent,
      postingId,
      status: "COMPLETED",
      executedAt: new Date().toISOString(),
      glPostings,
    };

    this.transactions.push(result);
    
    // Remove used quote
    if (quoteId) {
      this.quotes.delete(quoteId);
    }

    return result;
  }

  /**
   * Get transaction history for customer.
   */
  getTransactionHistory(customerId: string): FXConversionResult[] {
    return this.transactions.filter(t => t.customerId === customerId);
  }

  /**
   * Get all transactions.
   */
  getAllTransactions(): FXConversionResult[] {
    return [...this.transactions];
  }
}

export const multiCurrencyWalletService = new MultiCurrencyWalletService();
