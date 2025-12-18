/**
 * Multi-Currency Wallet Service Tests
 * 
 * Tests for customer multi-currency wallets with FX conversion.
 */

import { describe, it, expect } from "vitest";
import { Money } from "../core/deposits/ledger/Money";

// Import the service
import { 
  multiCurrencyWalletService,
  SUPPORTED_CURRENCIES,
} from "./core/ledger/MultiCurrencyWalletService";

describe("Multi-Currency Wallet Service", () => {
  describe("FX Rates", () => {
    it("returns all supported FX rates", () => {
      const rates = multiCurrencyWalletService.getAllRates();
      
      expect(rates.length).toBeGreaterThan(0);
      expect(rates.length).toBe(SUPPORTED_CURRENCIES.length - 1); // All except AUD
    });

    it("returns rate for AUD/USD pair", () => {
      const rate = multiCurrencyWalletService.getRate("AUD", "USD");
      
      expect(rate).not.toBeNull();
      expect(rate!.baseCurrency).toBe("AUD");
      expect(rate!.quoteCurrency).toBe("USD");
      expect(rate!.bidRate).toBeGreaterThan(0);
      expect(rate!.askRate).toBeGreaterThan(rate!.bidRate);
      expect(rate!.midRate).toBeGreaterThan(rate!.bidRate);
      expect(rate!.midRate).toBeLessThan(rate!.askRate);
    });

    it("returns inverse rate for USD/AUD pair", () => {
      const rate = multiCurrencyWalletService.getRate("USD", "AUD");
      
      expect(rate).not.toBeNull();
      expect(rate!.baseCurrency).toBe("USD");
      expect(rate!.quoteCurrency).toBe("AUD");
      expect(rate!.midRate).toBeGreaterThan(1); // USD/AUD should be > 1
    });

    it("returns cross rate for EUR/GBP via AUD", () => {
      const rate = multiCurrencyWalletService.getRate("EUR", "GBP");
      
      expect(rate).not.toBeNull();
      expect(rate!.source).toBe("CROSS_RATE");
    });

    it("returns 1:1 rate for same currency", () => {
      const rate = multiCurrencyWalletService.getRate("AUD", "AUD");
      
      expect(rate).not.toBeNull();
      expect(rate!.bidRate).toBe(1);
      expect(rate!.askRate).toBe(1);
      expect(rate!.midRate).toBe(1);
    });
  });

  describe("Customer Wallets", () => {
    it("returns all customer wallets", () => {
      const wallets = multiCurrencyWalletService.getAllWallets();
      
      expect(wallets.length).toBeGreaterThan(0);
      expect(wallets.length).toBe(5); // 5 sample customers
    });

    it("returns wallet for specific customer", () => {
      const wallet = multiCurrencyWalletService.getWallet("CUST-001");
      
      expect(wallet).not.toBeNull();
      expect(wallet!.customerId).toBe("CUST-001");
      expect(wallet!.customerName).toBe("Sarah Mitchell");
      expect(wallet!.balances.length).toBeGreaterThan(0);
    });

    it("returns null for non-existent customer", () => {
      const wallet = multiCurrencyWalletService.getWallet("CUST-999");
      
      expect(wallet).toBeNull();
    });

    it("calculates total AUD value across currencies", () => {
      const wallet = multiCurrencyWalletService.getWallet("CUST-001");
      
      expect(wallet).not.toBeNull();
      expect(wallet!.totalValueAUD.amount).toBeGreaterThan(BigInt(0));
    });

    it("tracks hold amounts separately from available balance", () => {
      const wallet = multiCurrencyWalletService.getWallet("CUST-002");
      
      expect(wallet).not.toBeNull();
      const audBalance = wallet!.balances.find(b => b.currency === "AUD");
      expect(audBalance).toBeDefined();
      expect(audBalance!.holdAmount.amount).toBeGreaterThan(BigInt(0));
      expect(audBalance!.availableBalance.amount).toBeLessThan(audBalance!.balance.amount);
    });
  });

  describe("FX Quotes", () => {
    it("generates quote for AUD to USD conversion", () => {
      const fromAmount = new Money(BigInt(100000), "AUD"); // $1,000 AUD
      const quote = multiCurrencyWalletService.getQuote("CUST-001", "AUD", "USD", fromAmount);
      
      expect(quote).not.toBeNull();
      expect(quote!.fromCurrency).toBe("AUD");
      expect(quote!.toCurrency).toBe("USD");
      expect(quote!.fromAmount.amount).toBe(BigInt(100000));
      expect(quote!.toAmount.amount).toBeGreaterThan(BigInt(0));
    });

    it("applies spread based on customer tier", () => {
      const fromAmount = new Money(BigInt(100000), "AUD");
      
      // Premium customer (CUST-001) should get better rate than retail (CUST-002)
      const premiumQuote = multiCurrencyWalletService.getQuote("CUST-001", "AUD", "USD", fromAmount);
      const retailQuote = multiCurrencyWalletService.getQuote("CUST-002", "AUD", "USD", fromAmount);
      
      expect(premiumQuote).not.toBeNull();
      expect(retailQuote).not.toBeNull();
      expect(premiumQuote!.spreadPercent).toBeLessThan(retailQuote!.spreadPercent);
      expect(premiumQuote!.toAmount.amount).toBeGreaterThan(retailQuote!.toAmount.amount);
    });

    it("includes regulatory disclosures", () => {
      const fromAmount = new Money(BigInt(100000), "AUD");
      const quote = multiCurrencyWalletService.getQuote("CUST-001", "AUD", "USD", fromAmount);
      
      expect(quote).not.toBeNull();
      expect(quote!.disclosures.length).toBeGreaterThan(0);
      expect(quote!.disclosures.some(d => d.code === "FX_SPREAD")).toBe(true);
      expect(quote!.disclosures.some(d => d.code === "FX_RISK")).toBe(true);
    });

    it("sets quote expiration time", () => {
      const fromAmount = new Money(BigInt(100000), "AUD");
      const quote = multiCurrencyWalletService.getQuote("CUST-001", "AUD", "USD", fromAmount);
      
      expect(quote).not.toBeNull();
      const expiresAt = new Date(quote!.expiresAt);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    });

    it("returns null for non-existent customer", () => {
      const fromAmount = new Money(BigInt(100000), "AUD");
      const quote = multiCurrencyWalletService.getQuote("CUST-999", "AUD", "USD", fromAmount);
      
      expect(quote).toBeNull();
    });
  });

  describe("Currency Conversion", () => {
    it("executes AUD to USD conversion", () => {
      const fromAmount = new Money(BigInt(10000), "AUD"); // $100 AUD
      const result = multiCurrencyWalletService.executeConversion(
        "CUST-001",
        "AUD",
        "USD",
        fromAmount
      );
      
      expect(result).not.toBeNull();
      expect(result!.status).toBe("COMPLETED");
      expect(result!.fromCurrency).toBe("AUD");
      expect(result!.toCurrency).toBe("USD");
      expect(result!.transactionId).toMatch(/^FXT-/);
      expect(result!.postingId).toMatch(/^POST-/);
    });

    it("generates GL postings for conversion", () => {
      const fromAmount = new Money(BigInt(10000), "AUD");
      const result = multiCurrencyWalletService.executeConversion(
        "CUST-001",
        "AUD",
        "EUR",
        fromAmount
      );
      
      expect(result).not.toBeNull();
      expect(result!.glPostings.length).toBe(3);
      
      // Debit from currency
      const debitPosting = result!.glPostings.find(p => p.direction === "DEBIT");
      expect(debitPosting).toBeDefined();
      expect(debitPosting!.currency).toBe("AUD");
      
      // Credit to currency
      const creditPostings = result!.glPostings.filter(p => p.direction === "CREDIT");
      expect(creditPostings.length).toBe(2);
    });

    it("updates customer balances after conversion", () => {
      const walletBefore = multiCurrencyWalletService.getWallet("CUST-003");
      const audBefore = walletBefore!.balances.find(b => b.currency === "AUD")!.balance.amount;
      
      const fromAmount = new Money(BigInt(100000), "AUD"); // $1,000 AUD
      multiCurrencyWalletService.executeConversion("CUST-003", "AUD", "SGD", fromAmount);
      
      const walletAfter = multiCurrencyWalletService.getWallet("CUST-003");
      const audAfter = walletAfter!.balances.find(b => b.currency === "AUD")!.balance.amount;
      
      expect(audAfter).toBeLessThan(audBefore);
      expect(audBefore - audAfter).toBe(BigInt(100000));
    });

    it("creates new currency balance if not exists", () => {
      // CUST-004 only has AUD and NZD
      const walletBefore = multiCurrencyWalletService.getWallet("CUST-004");
      const hasCHF = walletBefore!.balances.some(b => b.currency === "CHF");
      expect(hasCHF).toBe(false);
      
      const fromAmount = new Money(BigInt(10000), "AUD");
      multiCurrencyWalletService.executeConversion("CUST-004", "AUD", "CHF", fromAmount);
      
      const walletAfter = multiCurrencyWalletService.getWallet("CUST-004");
      const chfBalance = walletAfter!.balances.find(b => b.currency === "CHF");
      expect(chfBalance).toBeDefined();
      expect(chfBalance!.balance.amount).toBeGreaterThan(BigInt(0));
    });

    it("returns null for insufficient balance", () => {
      const fromAmount = new Money(BigInt(999999999999), "AUD"); // More than available
      const result = multiCurrencyWalletService.executeConversion(
        "CUST-004",
        "AUD",
        "USD",
        fromAmount
      );
      
      expect(result).toBeNull();
    });

    it("returns null for non-existent customer", () => {
      const fromAmount = new Money(BigInt(10000), "AUD");
      const result = multiCurrencyWalletService.executeConversion(
        "CUST-999",
        "AUD",
        "USD",
        fromAmount
      );
      
      expect(result).toBeNull();
    });
  });

  describe("Transaction History", () => {
    it("returns transaction history for customer", () => {
      // Execute a conversion first
      const fromAmount = new Money(BigInt(5000), "AUD");
      multiCurrencyWalletService.executeConversion("CUST-005", "AUD", "USD", fromAmount);
      
      const history = multiCurrencyWalletService.getTransactionHistory("CUST-005");
      
      expect(history.length).toBeGreaterThan(0);
      expect(history[0].customerId).toBe("CUST-005");
    });

    it("returns empty array for customer with no transactions", () => {
      // Create a new service instance to test fresh state
      const history = multiCurrencyWalletService.getTransactionHistory("CUST-999");
      
      expect(history).toEqual([]);
    });
  });

  describe("Add Currency to Wallet", () => {
    it("adds new currency to customer wallet", () => {
      const success = multiCurrencyWalletService.addCurrencyToWallet("CUST-001", "JPY");
      
      expect(success).toBe(true);
      
      const wallet = multiCurrencyWalletService.getWallet("CUST-001");
      const jpyBalance = wallet!.balances.find(b => b.currency === "JPY");
      expect(jpyBalance).toBeDefined();
    });

    it("returns true for already existing currency", () => {
      const success = multiCurrencyWalletService.addCurrencyToWallet("CUST-001", "AUD");
      
      expect(success).toBe(true);
    });

    it("returns false for non-existent customer", () => {
      const success = multiCurrencyWalletService.addCurrencyToWallet("CUST-999", "USD");
      
      expect(success).toBe(false);
    });
  });

  describe("Supported Currencies", () => {
    it("supports 10 currencies", () => {
      expect(SUPPORTED_CURRENCIES.length).toBe(10);
    });

    it("includes major currencies", () => {
      expect(SUPPORTED_CURRENCIES).toContain("AUD");
      expect(SUPPORTED_CURRENCIES).toContain("USD");
      expect(SUPPORTED_CURRENCIES).toContain("EUR");
      expect(SUPPORTED_CURRENCIES).toContain("GBP");
      expect(SUPPORTED_CURRENCIES).toContain("JPY");
    });

    it("includes APAC currencies", () => {
      expect(SUPPORTED_CURRENCIES).toContain("NZD");
      expect(SUPPORTED_CURRENCIES).toContain("SGD");
      expect(SUPPORTED_CURRENCIES).toContain("HKD");
      expect(SUPPORTED_CURRENCIES).toContain("CNY");
    });
  });
});
