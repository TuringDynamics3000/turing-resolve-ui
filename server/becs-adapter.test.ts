/**
 * BECS Adapter Tests
 */

import { describe, it, expect, beforeEach } from "vitest";
import { becsAdapter } from "../adapters/payments/becs/BecsAdapter";
import { becsAbaGenerator } from "../adapters/payments/becs/BecsAbaGenerator";
import type { Payment } from "./core/payments/PaymentsSpine";
import type { BecsBatch } from "../adapters/payments/becs/BecsTypes";

// ============================================
// TEST DATA
// ============================================

function createTestPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    paymentId: `PAY-${Date.now()}`,
    instruction: {
      instructionId: `INS-${Date.now()}`,
      scheme: "BECS",
      type: "CREDIT_TRANSFER",
      priority: "NEXT_DAY",
      amount: 1000,
      currency: "AUD",
      debtor: {
        name: "Test Debtor",
        accountNumber: "123456789",
        bsb: "062-000",
        country: "AU",
      },
      creditor: {
        name: "Test Creditor",
        accountNumber: "987654321",
        bsb: "063-001",
        country: "AU",
      },
      endToEndId: `E2E-${Date.now()}`,
      remittanceInfo: "Test payment",
      requestedExecutionDate: new Date().toISOString().split("T")[0],
      createdAt: new Date().toISOString(),
      createdBy: "TEST",
    },
    status: "AUTHORIZED",
    events: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  } as Payment;
}

// ============================================
// BECS ADAPTER TESTS
// ============================================

describe("BECS Adapter", () => {
  describe("Batch Management", () => {
    it("adds payment to batch", async () => {
      const payment = createTestPayment();
      const result = await becsAdapter.addToBatch(payment);
      
      expect(result.success).toBe(true);
      expect(result.batchId).toBeDefined();
      expect(result.transactionId).toBeDefined();
    });

    it("creates batch with correct settlement cycle", async () => {
      const payment = createTestPayment();
      const result = await becsAdapter.addToBatch(payment);
      
      const batch = becsAdapter.getBatch(result.batchId!);
      expect(batch).toBeDefined();
      expect(batch?.settlementCycle).toBe("NEXT_DAY");
    });

    it("rejects non-AUD payments", async () => {
      const payment = createTestPayment();
      payment.instruction.currency = "USD";
      
      const result = await becsAdapter.addToBatch(payment);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("AUD");
    });

    it("rejects payments without BSB", async () => {
      const payment = createTestPayment();
      payment.instruction.creditor.bsb = "";
      
      const result = await becsAdapter.addToBatch(payment);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("BSB");
    });
  });

  describe("Batch Finalization", () => {
    it("finalizes batch and generates ABA file", async () => {
      const payment = createTestPayment();
      const addResult = await becsAdapter.addToBatch(payment);
      
      const finalizeResult = await becsAdapter.finalizeBatch(addResult.batchId!);
      
      expect(finalizeResult.success).toBe(true);
      expect(finalizeResult.schemeReference).toBeDefined();
      expect(finalizeResult.abaFileContent).toBeDefined();
    });

    it("validates ABA file format", async () => {
      const payment = createTestPayment();
      const addResult = await becsAdapter.addToBatch(payment);
      const finalizeResult = await becsAdapter.finalizeBatch(addResult.batchId!);
      
      const validation = becsAbaGenerator.validateAbaFile(finalizeResult.abaFileContent!);
      expect(validation.valid).toBe(true);
    });

    it("updates batch status after finalization", async () => {
      const payment = createTestPayment();
      const addResult = await becsAdapter.addToBatch(payment);
      await becsAdapter.finalizeBatch(addResult.batchId!);
      
      const batch = becsAdapter.getBatch(addResult.batchId!);
      expect(batch?.status).toBe("SUBMITTED");
    });
  });

  describe("Direct Payment Submission", () => {
    it("submits single payment as batch", async () => {
      const payment = createTestPayment();
      const result = await becsAdapter.submitPayment(payment);
      
      expect(result.success).toBe(true);
      expect(result.schemeReference).toBeDefined();
    });
  });

  describe("Health Check", () => {
    it("returns healthy status", async () => {
      const health = await becsAdapter.healthCheck();
      
      expect(health.healthy).toBe(true);
      expect(health.latencyMs).toBeDefined();
    });
  });

  describe("Statistics", () => {
    it("returns batch statistics", () => {
      const stats = becsAdapter.getStatistics();
      
      expect(stats).toBeDefined();
      expect(stats.totalBatches).toBeGreaterThanOrEqual(0);
      expect(stats.byStatus).toBeDefined();
    });
  });
});

// ============================================
// ABA FILE GENERATOR TESTS
// ============================================

describe("ABA File Generator", () => {
  describe("File Generation", () => {
    it("generates valid ABA file", () => {
      const batch: BecsBatch = {
        batchId: "TEST-BATCH",
        description: "Test Batch",
        settlementCycle: "NEXT_DAY",
        processingDate: "2024-12-18",
        originatorBsb: "062-000",
        originatorAccountNumber: "123456789",
        originatorName: "TEST ORIGINATOR",
        userIdentificationNumber: "123456",
        transactions: [
          {
            transactionId: "TX-001",
            transactionCode: "50",
            amount: 100000, // $1000 in cents
            beneficiaryBsb: "063-001",
            beneficiaryAccountNumber: "987654321",
            beneficiaryName: "TEST BENEFICIARY",
            lodgementReference: "REF-001",
            remitterName: "TEST REMITTER",
            indicator: " ",
            status: "INCLUDED",
          },
        ],
        creditCount: 1,
        debitCount: 0,
        creditTotal: 100000,
        debitTotal: 0,
        netTotal: 100000,
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        createdBy: "TEST",
        updatedAt: new Date().toISOString(),
      };
      
      const abaContent = becsAbaGenerator.generateAbaFile(batch);
      
      expect(abaContent).toBeDefined();
      expect(abaContent.length).toBeGreaterThan(0);
    });

    it("generates 120-character records", () => {
      const batch: BecsBatch = {
        batchId: "TEST-BATCH-2",
        description: "Test",
        settlementCycle: "NEXT_DAY",
        processingDate: "2024-12-18",
        originatorBsb: "062-000",
        originatorAccountNumber: "123456789",
        originatorName: "ORIGINATOR",
        userIdentificationNumber: "123456",
        transactions: [
          {
            transactionId: "TX-002",
            transactionCode: "50",
            amount: 50000,
            beneficiaryBsb: "063-001",
            beneficiaryAccountNumber: "111222333",
            beneficiaryName: "BENEFICIARY",
            lodgementReference: "REF-002",
            remitterName: "REMITTER",
            indicator: " ",
            status: "INCLUDED",
          },
        ],
        creditCount: 1,
        debitCount: 0,
        creditTotal: 50000,
        debitTotal: 0,
        netTotal: 50000,
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        createdBy: "TEST",
        updatedAt: new Date().toISOString(),
      };
      
      const abaContent = becsAbaGenerator.generateAbaFile(batch);
      const lines = abaContent.split(/\r?\n/).filter(l => l.length > 0);
      
      for (const line of lines) {
        expect(line.length).toBe(120);
      }
    });

    it("starts with Type 0 record", () => {
      const batch: BecsBatch = {
        batchId: "TEST-BATCH-3",
        description: "Test",
        settlementCycle: "NEXT_DAY",
        processingDate: "2024-12-18",
        originatorBsb: "062-000",
        originatorAccountNumber: "123456789",
        originatorName: "ORIGINATOR",
        userIdentificationNumber: "123456",
        transactions: [{
          transactionId: "TX-003",
          transactionCode: "50",
          amount: 10000,
          beneficiaryBsb: "063-001",
          beneficiaryAccountNumber: "444555666",
          beneficiaryName: "BENEFICIARY",
          lodgementReference: "REF-003",
          remitterName: "REMITTER",
          indicator: " ",
          status: "INCLUDED",
        }],
        creditCount: 1,
        debitCount: 0,
        creditTotal: 10000,
        debitTotal: 0,
        netTotal: 10000,
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        createdBy: "TEST",
        updatedAt: new Date().toISOString(),
      };
      
      const abaContent = becsAbaGenerator.generateAbaFile(batch);
      const lines = abaContent.split(/\r?\n/).filter(l => l.length > 0);
      
      expect(lines[0].charAt(0)).toBe("0");
    });

    it("ends with Type 7 record", () => {
      const batch: BecsBatch = {
        batchId: "TEST-BATCH-4",
        description: "Test",
        settlementCycle: "NEXT_DAY",
        processingDate: "2024-12-18",
        originatorBsb: "062-000",
        originatorAccountNumber: "123456789",
        originatorName: "ORIGINATOR",
        userIdentificationNumber: "123456",
        transactions: [{
          transactionId: "TX-004",
          transactionCode: "50",
          amount: 20000,
          beneficiaryBsb: "063-001",
          beneficiaryAccountNumber: "777888999",
          beneficiaryName: "BENEFICIARY",
          lodgementReference: "REF-004",
          remitterName: "REMITTER",
          indicator: " ",
          status: "INCLUDED",
        }],
        creditCount: 1,
        debitCount: 0,
        creditTotal: 20000,
        debitTotal: 0,
        netTotal: 20000,
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        createdBy: "TEST",
        updatedAt: new Date().toISOString(),
      };
      
      const abaContent = becsAbaGenerator.generateAbaFile(batch);
      const lines = abaContent.split(/\r?\n/).filter(l => l.length > 0);
      
      expect(lines[lines.length - 1].charAt(0)).toBe("7");
    });
  });

  describe("File Validation", () => {
    it("validates correct ABA file", () => {
      // Create a minimal valid ABA file
      const header = "0" + " ".repeat(7) + "01" + "TUR" + " ".repeat(7) + " ".repeat(6) + "123456" + "Test Batch  " + "181224" + " ".repeat(4) + " ".repeat(66);
      const detail = "1" + "063-001" + " 12345678" + " " + "50" + "0000100000" + "BENEFICIARY NAME                " + "REF-001           " + "062-000" + " 98765432" + "REMITTER        " + "00000000";
      const trailer = "7" + "999-999" + " ".repeat(12) + "0000100000" + "0000100000" + "0000000000" + " ".repeat(6) + "000001" + " ".repeat(58);
      
      const abaContent = [header, detail, trailer].join("\r\n") + "\r\n";
      
      const validation = becsAbaGenerator.validateAbaFile(abaContent);
      expect(validation.valid).toBe(true);
    });

    it("rejects file without header", () => {
      const detail = "1" + "063-001" + " 12345678" + " " + "50" + "0000100000" + "BENEFICIARY NAME                " + "REF-001           " + "062-000" + " 98765432" + "REMITTER        " + "00000000";
      const trailer = "7" + "999-999" + " ".repeat(12) + "0000100000" + "0000100000" + "0000000000" + " ".repeat(6) + "000001" + " ".repeat(58);
      
      const abaContent = [detail, trailer].join("\r\n") + "\r\n";
      
      const validation = becsAbaGenerator.validateAbaFile(abaContent);
      expect(validation.valid).toBe(false);
    });
  });

  describe("File Parsing", () => {
    it("parses ABA file correctly", () => {
      const header = "0" + " ".repeat(7) + "01" + "TUR" + " ".repeat(7) + " ".repeat(6) + "123456" + "Test Batch  " + "181224" + " ".repeat(4) + " ".repeat(66);
      const detail = "1" + "063-001" + " 12345678" + " " + "50" + "0000100000" + "BENEFICIARY NAME                " + "REF-001           " + "062-000" + " 98765432" + "REMITTER        " + "00000000";
      const trailer = "7" + "999-999" + " ".repeat(12) + "0000100000" + "0000100000" + "0000000000" + " ".repeat(6) + "000001" + " ".repeat(58);
      
      const abaContent = [header, detail, trailer].join("\r\n") + "\r\n";
      
      const parsed = becsAbaGenerator.parseAbaFile(abaContent);
      
      expect(parsed.header).toBeDefined();
      expect(parsed.transactions.length).toBe(1);
      expect(parsed.trailer).toBeDefined();
      expect(parsed.errors.length).toBe(0);
    });
  });
});
