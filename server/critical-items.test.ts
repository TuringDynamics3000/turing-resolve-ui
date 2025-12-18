/**
 * Critical Items Tests
 * 
 * Tests for:
 * - AUSTRAC Reporting Service
 * - Payments Spine v1.0.0
 * - NPP Scheme Adapter
 */

import { describe, it, expect, beforeEach } from "vitest";
import { austracReportingService } from "./core/reporting/AUSTRACReportingService";
import { paymentsSpine } from "./core/payments/PaymentsSpine";

// ============================================
// AUSTRAC REPORTING SERVICE TESTS
// ============================================

describe("AUSTRACReportingService", () => {
  describe("Transaction Recording", () => {
    it("records transaction with risk score", () => {
      const tx = austracReportingService.recordTransaction({
        reportingEntityId: "TURING-001",
        transactionDate: "2024-12-18",
        transactionTime: "10:30:00",
        transactionType: "DEPOSIT",
        amount: 15000,
        currency: "AUD",
        amountAUD: 15000,
        originatorName: "John Smith",
        originatorAccountNumber: "123456789",
        originatorBSB: "062-000",
        originatorCountry: "AU",
        beneficiaryName: "TuringDynamics",
        beneficiaryAccountNumber: "987654321",
        beneficiaryBSB: "062-000",
        beneficiaryCountry: "AU",
        paymentMethod: "CASH",
        narrative: "Cash deposit",
        isCashTransaction: true,
        isInternational: false,
        capturedBy: "TELLER-001",
      });

      expect(tx.transactionId).toMatch(/^TXN-/);
      expect(tx.riskScore).toBeGreaterThan(0);
      expect(tx.capturedAt).toBeDefined();
    });

    it("calculates high risk score for cash + high value", () => {
      const tx = austracReportingService.recordTransaction({
        reportingEntityId: "TURING-001",
        transactionDate: "2024-12-18",
        transactionTime: "11:00:00",
        transactionType: "DEPOSIT",
        amount: 50000,
        currency: "AUD",
        amountAUD: 50000,
        originatorName: "Jane Doe",
        originatorAccountNumber: "111222333",
        originatorCountry: "AU",
        beneficiaryName: "TuringDynamics",
        beneficiaryAccountNumber: "987654321",
        beneficiaryCountry: "AU",
        paymentMethod: "CASH",
        narrative: "Large cash deposit",
        isCashTransaction: true,
        isInternational: false,
        capturedBy: "TELLER-002",
      });

      // Cash (25) + >=10k (20) + >=50k (15) = 60+
      expect(tx.riskScore).toBeGreaterThanOrEqual(60);
    });

    it("detects high-risk jurisdiction", () => {
      const tx = austracReportingService.recordTransaction({
        reportingEntityId: "TURING-001",
        transactionDate: "2024-12-18",
        transactionTime: "12:00:00",
        transactionType: "TRANSFER_OUT",
        amount: 25000,
        currency: "AUD",
        amountAUD: 25000,
        originatorName: "Test User",
        originatorAccountNumber: "444555666",
        originatorCountry: "AU",
        beneficiaryName: "Foreign Recipient",
        beneficiaryAccountNumber: "999888777",
        beneficiaryCountry: "IR", // Iran - high risk
        paymentMethod: "ELECTRONIC",
        narrative: "International transfer",
        isCashTransaction: false,
        isInternational: true,
        capturedBy: "SYSTEM",
      });

      expect(tx.suspicionIndicators).toContain("HIGH_RISK_JURISDICTION");
      expect(tx.riskScore).toBeGreaterThanOrEqual(30);
    });
  });

  describe("Report Generation", () => {
    it("auto-generates TTR for cash >= $10,000", () => {
      // Record a cash transaction over threshold
      austracReportingService.recordTransaction({
        reportingEntityId: "TURING-001",
        transactionDate: "2024-12-18",
        transactionTime: "14:00:00",
        transactionType: "DEPOSIT",
        amount: 12000,
        currency: "AUD",
        amountAUD: 12000,
        originatorName: "TTR Test User",
        originatorAccountNumber: "TTR123456",
        originatorCountry: "AU",
        beneficiaryName: "TuringDynamics",
        beneficiaryAccountNumber: "987654321",
        beneficiaryCountry: "AU",
        paymentMethod: "CASH",
        narrative: "Cash deposit for TTR",
        isCashTransaction: true,
        isInternational: false,
        capturedBy: "TELLER-003",
      });

      const ttrReports = austracReportingService.getReportsByType("TTR");
      expect(ttrReports.length).toBeGreaterThan(0);
      
      const latestTTR = ttrReports[ttrReports.length - 1];
      expect(latestTTR.reportType).toBe("TTR");
      expect(latestTTR.status).toBe("DRAFT");
    });

    it("auto-generates IFTI for international transfers", () => {
      austracReportingService.recordTransaction({
        reportingEntityId: "TURING-001",
        transactionDate: "2024-12-18",
        transactionTime: "15:00:00",
        transactionType: "TRANSFER_OUT",
        amount: 5000,
        currency: "USD",
        amountAUD: 7500,
        originatorName: "IFTI Test User",
        originatorAccountNumber: "IFTI123456",
        originatorCountry: "AU",
        beneficiaryName: "US Recipient",
        beneficiaryAccountNumber: "US987654",
        beneficiaryCountry: "US",
        paymentMethod: "ELECTRONIC",
        narrative: "International wire",
        isCashTransaction: false,
        isInternational: true,
        capturedBy: "SYSTEM",
      });

      const iftiReports = austracReportingService.getReportsByType("IFTI");
      expect(iftiReports.length).toBeGreaterThan(0);
    });
  });

  describe("Transaction Dataset Export", () => {
    it("exports AUSTRAC-ready dataset", () => {
      const dataset = austracReportingService.getTransactionDataset();

      expect(dataset.exportFormat).toBe("AUSTRAC_V2");
      expect(dataset.exportedAt).toBeDefined();
      expect(dataset.summary).toBeDefined();
      expect(dataset.summary.totalCount).toBeGreaterThanOrEqual(0);
    });

    it("filters by date range", () => {
      const dataset = austracReportingService.getTransactionDataset({
        fromDate: "2024-12-01",
        toDate: "2024-12-31",
      });

      expect(dataset.transactions).toBeDefined();
    });

    it("filters by minimum amount", () => {
      const dataset = austracReportingService.getTransactionDataset({
        minAmount: 10000,
      });

      for (const tx of dataset.transactions) {
        expect(tx.amountAUD).toBeGreaterThanOrEqual(10000);
      }
    });
  });

  describe("Compliance Metrics", () => {
    it("returns compliance dashboard metrics", () => {
      const metrics = austracReportingService.getComplianceMetrics();

      expect(metrics.pendingReports).toBeDefined();
      expect(metrics.pendingReports.ttr).toBeGreaterThanOrEqual(0);
      expect(metrics.pendingReports.ifti).toBeGreaterThanOrEqual(0);
      expect(metrics.pendingReports.smr).toBeGreaterThanOrEqual(0);
      expect(metrics.complianceRate).toBeGreaterThanOrEqual(0);
      expect(metrics.complianceRate).toBeLessThanOrEqual(100);
    });
  });
});

// ============================================
// PAYMENTS SPINE TESTS
// ============================================

describe("PaymentsSpine", () => {
  describe("Payment Initiation", () => {
    it("initiates payment successfully", async () => {
      const result = await paymentsSpine.initiatePayment({
        idempotencyKey: `test-${Date.now()}-1`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 1000,
        currency: "AUD",
        debtor: {
          name: "John Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Jane Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-${Date.now()}`,
        remittanceInfo: "Test payment",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(result.success).toBe(true);
      expect(result.payment).toBeDefined();
      expect(result.payment?.status).toBe("INITIATED");
      expect(result.payment?.paymentId).toMatch(/^PAY-/);
    });

    it("handles idempotent submission", async () => {
      const idempotencyKey = `idem-${Date.now()}`;
      
      const first = await paymentsSpine.initiatePayment({
        idempotencyKey,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 500,
        currency: "AUD",
        debtor: {
          name: "Idem Debtor",
          accountNumber: "111222333",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Idem Creditor",
          accountNumber: "444555666",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-IDEM-${Date.now()}`,
        remittanceInfo: "Idempotent test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      const second = await paymentsSpine.initiatePayment({
        idempotencyKey,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 500,
        currency: "AUD",
        debtor: {
          name: "Idem Debtor",
          accountNumber: "111222333",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Idem Creditor",
          accountNumber: "444555666",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-IDEM-${Date.now()}`,
        remittanceInfo: "Idempotent test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(first.payment?.paymentId).toBe(second.payment?.paymentId);
    });

    it("validates payment instruction", async () => {
      const result = await paymentsSpine.initiatePayment({
        idempotencyKey: `invalid-${Date.now()}`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: -100, // Invalid
        currency: "AUD",
        debtor: {
          name: "Invalid Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Invalid Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-INVALID`,
        remittanceInfo: "Invalid test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid amount");
    });
  });

  describe("Scheme Routing", () => {
    it("routes immediate AUD to NPP", async () => {
      const result = await paymentsSpine.initiatePayment({
        idempotencyKey: `route-npp-${Date.now()}`,
        scheme: "BECS", // Will be overridden
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 1000,
        currency: "AUD",
        debtor: {
          name: "Route Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Route Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-ROUTE-${Date.now()}`,
        remittanceInfo: "Routing test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(result.success).toBe(true);
      expect(result.payment?.instruction.scheme).toBe("NPP");
    });

    it("routes same-bank to INTERNAL", async () => {
      const result = await paymentsSpine.initiatePayment({
        idempotencyKey: `route-internal-${Date.now()}`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 1000,
        currency: "AUD",
        debtor: {
          name: "Internal Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Internal Creditor",
          accountNumber: "987654321",
          bsb: "062-000", // Same BSB
          country: "AU",
        },
        endToEndId: `E2E-INTERNAL-${Date.now()}`,
        remittanceInfo: "Internal transfer",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(result.success).toBe(true);
      expect(result.payment?.instruction.scheme).toBe("INTERNAL");
    });
  });

  describe("Resolve Integration", () => {
    it("requests Resolve decision", async () => {
      const initResult = await paymentsSpine.initiatePayment({
        idempotencyKey: `resolve-${Date.now()}`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 1000,
        currency: "AUD",
        debtor: {
          name: "Resolve Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Resolve Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-RESOLVE-${Date.now()}`,
        remittanceInfo: "Resolve test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      expect(initResult.success).toBe(true);

      const decisionResult = await paymentsSpine.requestResolveDecision(initResult.payment!.paymentId);

      expect(decisionResult.success).toBe(true);
      expect(decisionResult.decisionId).toMatch(/^DEC-/);
      expect(["ALLOW", "REVIEW", "DECLINE"]).toContain(decisionResult.outcome);
    });

    it("requires REVIEW for high-value payments", async () => {
      const initResult = await paymentsSpine.initiatePayment({
        idempotencyKey: `highvalue-${Date.now()}`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 100000, // High value
        currency: "AUD",
        debtor: {
          name: "HighValue Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "HighValue Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-HIGHVALUE-${Date.now()}`,
        remittanceInfo: "High value test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      const decisionResult = await paymentsSpine.requestResolveDecision(initResult.payment!.paymentId);

      expect(decisionResult.outcome).toBe("REVIEW");
    });
  });

  describe("Event Chain Integrity", () => {
    it("maintains hash chain for events", async () => {
      const initResult = await paymentsSpine.initiatePayment({
        idempotencyKey: `chain-${Date.now()}`,
        scheme: "NPP",
        type: "CREDIT_TRANSFER",
        priority: "IMMEDIATE",
        amount: 1000,
        currency: "AUD",
        debtor: {
          name: "Chain Debtor",
          accountNumber: "123456789",
          bsb: "062-000",
          country: "AU",
        },
        creditor: {
          name: "Chain Creditor",
          accountNumber: "987654321",
          bsb: "062-001",
          country: "AU",
        },
        endToEndId: `E2E-CHAIN-${Date.now()}`,
        remittanceInfo: "Chain test",
        requestedExecutionDate: new Date().toISOString().split("T")[0],
        createdBy: "TEST",
      });

      await paymentsSpine.requestResolveDecision(initResult.payment!.paymentId);

      const verifyResult = paymentsSpine.verifyEventChain(initResult.payment!.paymentId);

      expect(verifyResult.valid).toBe(true);
    });
  });

  describe("Statistics", () => {
    it("returns payment statistics", () => {
      const stats = paymentsSpine.getStatistics();

      expect(stats.total).toBeGreaterThanOrEqual(0);
      expect(stats.byStatus).toBeDefined();
      expect(stats.byScheme).toBeDefined();
    });
  });
});
