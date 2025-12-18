/**
 * PayID Registration and Payment Scheduling Tests
 */

import { describe, it, expect } from "vitest";
import { payIdRegistrationService } from "./core/payments/PayIdRegistrationService";
import { paymentSchedulingService } from "./core/payments/PaymentSchedulingService";

// ============================================
// PAYID REGISTRATION TESTS
// ============================================

describe("PayID Registration Service", () => {
  describe("Registration", () => {
    it("registers email PayID", async () => {
      const result = await payIdRegistrationService.register({
        customerId: "CUST-001",
        payIdType: "EMAIL",
        payIdValue: `test-${Date.now()}@example.com`,
        accountId: "ACC-001",
        accountName: "TEST USER",
        bsb: "062-000",
        accountNumber: "12345678",
      });
      
      expect(result.success).toBe(true);
      expect(result.payId).toBeDefined();
      expect(result.payId?.status).toBe("PENDING");
      expect(result.verificationRequired).toBe(true);
    });

    it("registers phone PayID", async () => {
      const result = await payIdRegistrationService.register({
        customerId: "CUST-002",
        payIdType: "PHONE",
        payIdValue: `+614${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`,
        accountId: "ACC-002",
        accountName: "PHONE USER",
        bsb: "063-001",
        accountNumber: "87654321",
      });
      
      expect(result.success).toBe(true);
      expect(result.verificationMethod).toBe("SMS_OTP");
    });

    it("rejects invalid email format", async () => {
      const result = await payIdRegistrationService.register({
        customerId: "CUST-004",
        payIdType: "EMAIL",
        payIdValue: "invalid-email",
        accountId: "ACC-004",
        accountName: "INVALID",
        bsb: "062-000",
        accountNumber: "99999999",
      });
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("INVALID_FORMAT");
    });

    it("rejects duplicate PayID", async () => {
      const email = `dup-${Date.now()}@example.com`;
      
      await payIdRegistrationService.register({
        customerId: "CUST-005",
        payIdType: "EMAIL",
        payIdValue: email,
        accountId: "ACC-005",
        accountName: "FIRST USER",
        bsb: "062-000",
        accountNumber: "11111111",
      });
      
      const result = await payIdRegistrationService.register({
        customerId: "CUST-006",
        payIdType: "EMAIL",
        payIdValue: email,
        accountId: "ACC-006",
        accountName: "SECOND USER",
        bsb: "063-001",
        accountNumber: "22222222",
      });
      
      expect(result.success).toBe(false);
      expect(result.errorCode).toBe("ALREADY_REGISTERED");
    });
  });

  describe("Management", () => {
    it("gets customer PayIDs", async () => {
      const customerId = `CUST-MGMT-${Date.now()}`;
      
      await payIdRegistrationService.register({
        customerId,
        payIdType: "EMAIL",
        payIdValue: `mgmt1-${Date.now()}@example.com`,
        accountId: "ACC-M1",
        accountName: "MGMT USER",
        bsb: "062-000",
        accountNumber: "55555555",
      });
      
      const payIds = payIdRegistrationService.getCustomerPayIds(customerId);
      expect(payIds.length).toBeGreaterThanOrEqual(1);
    });

    it("checks PayID availability", () => {
      const available = payIdRegistrationService.isAvailable("EMAIL", `avail-${Date.now()}@example.com`);
      expect(available).toBe(true);
    });

    it("gets statistics", () => {
      const stats = payIdRegistrationService.getStatistics();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byStatus).toBeDefined();
      expect(stats.byType).toBeDefined();
    });
  });
});

// ============================================
// PAYMENT SCHEDULING TESTS
// ============================================

describe("Payment Scheduling Service", () => {
  describe("One-Time Schedules", () => {
    it("creates one-time scheduled payment", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const result = await paymentSchedulingService.createSchedule({
        customerId: "CUST-SCHED-001",
        scheduleType: "ONE_TIME",
        scheme: "NPP",
        amount: 1000,
        debtorAccountId: "ACC-D1",
        debtorName: "DEBTOR ONE",
        debtorBsb: "062-000",
        debtorAccountNumber: "11111111",
        creditorName: "CREDITOR ONE",
        creditorBsb: "063-001",
        creditorAccountNumber: "22222222",
        reference: "SCHED-TEST-001",
        startDate: tomorrow.toISOString().split("T")[0],
      });
      
      expect(result.success).toBe(true);
      expect(result.schedule?.scheduleType).toBe("ONE_TIME");
      expect(result.schedule?.status).toBe("ACTIVE");
    });

    it("rejects past start date", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const result = await paymentSchedulingService.createSchedule({
        customerId: "CUST-SCHED-002",
        scheduleType: "ONE_TIME",
        scheme: "NPP",
        amount: 500,
        debtorAccountId: "ACC-D2",
        debtorName: "DEBTOR TWO",
        debtorBsb: "062-000",
        debtorAccountNumber: "33333333",
        creditorName: "CREDITOR TWO",
        creditorBsb: "063-001",
        creditorAccountNumber: "44444444",
        reference: "SCHED-TEST-002",
        startDate: yesterday.toISOString().split("T")[0],
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("past");
    });
  });

  describe("Recurring Schedules", () => {
    it("creates weekly recurring payment", async () => {
      const nextWeek = new Date();
      nextWeek.setDate(nextWeek.getDate() + 7);
      
      const result = await paymentSchedulingService.createSchedule({
        customerId: "CUST-SCHED-003",
        scheduleType: "RECURRING",
        scheme: "BECS",
        amount: 250,
        debtorAccountId: "ACC-D3",
        debtorName: "DEBTOR THREE",
        debtorBsb: "062-000",
        debtorAccountNumber: "55555555",
        creditorName: "CREDITOR THREE",
        creditorBsb: "063-001",
        creditorAccountNumber: "66666666",
        reference: "WEEKLY-RENT",
        startDate: nextWeek.toISOString().split("T")[0],
        frequency: "WEEKLY",
        dayOfWeek: 1,
      });
      
      expect(result.success).toBe(true);
      expect(result.schedule?.frequency).toBe("WEEKLY");
    });

    it("creates monthly recurring payment", async () => {
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      
      const result = await paymentSchedulingService.createSchedule({
        customerId: "CUST-SCHED-004",
        scheduleType: "RECURRING",
        scheme: "BECS",
        amount: 1500,
        debtorAccountId: "ACC-D4",
        debtorName: "DEBTOR FOUR",
        debtorBsb: "062-000",
        debtorAccountNumber: "77777777",
        creditorName: "LANDLORD PTY LTD",
        creditorBsb: "063-001",
        creditorAccountNumber: "88888888",
        reference: "MONTHLY-RENT",
        startDate: nextMonth.toISOString().split("T")[0],
        frequency: "MONTHLY",
        dayOfMonth: 1,
        maxExecutions: 12,
      });
      
      expect(result.success).toBe(true);
      expect(result.schedule?.frequency).toBe("MONTHLY");
    });

    it("rejects recurring without frequency", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const result = await paymentSchedulingService.createSchedule({
        customerId: "CUST-SCHED-005",
        scheduleType: "RECURRING",
        scheme: "NPP",
        amount: 100,
        debtorAccountId: "ACC-D5",
        debtorName: "DEBTOR FIVE",
        debtorBsb: "062-000",
        debtorAccountNumber: "99999999",
        creditorName: "CREDITOR FIVE",
        creditorBsb: "063-001",
        creditorAccountNumber: "00000000",
        reference: "NO-FREQ",
        startDate: tomorrow.toISOString().split("T")[0],
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("Frequency");
    });
  });

  describe("Schedule Management", () => {
    it("pauses and resumes schedule", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const createResult = await paymentSchedulingService.createSchedule({
        customerId: "CUST-SCHED-006",
        scheduleType: "RECURRING",
        scheme: "NPP",
        amount: 50,
        debtorAccountId: "ACC-D6",
        debtorName: "DEBTOR SIX",
        debtorBsb: "062-000",
        debtorAccountNumber: "11112222",
        creditorName: "CREDITOR SIX",
        creditorBsb: "063-001",
        creditorAccountNumber: "33334444",
        reference: "PAUSE-TEST",
        startDate: tomorrow.toISOString().split("T")[0],
        frequency: "DAILY",
      });
      
      const scheduleId = createResult.schedule!.scheduleId;
      
      const pauseResult = paymentSchedulingService.pause(scheduleId);
      expect(pauseResult.success).toBe(true);
      
      let schedule = paymentSchedulingService.getSchedule(scheduleId);
      expect(schedule?.status).toBe("PAUSED");
      
      const resumeResult = paymentSchedulingService.resume(scheduleId);
      expect(resumeResult.success).toBe(true);
      
      schedule = paymentSchedulingService.getSchedule(scheduleId);
      expect(schedule?.status).toBe("ACTIVE");
    });

    it("cancels schedule", async () => {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const createResult = await paymentSchedulingService.createSchedule({
        customerId: "CUST-SCHED-007",
        scheduleType: "ONE_TIME",
        scheme: "NPP",
        amount: 75,
        debtorAccountId: "ACC-D7",
        debtorName: "DEBTOR SEVEN",
        debtorBsb: "062-000",
        debtorAccountNumber: "55556666",
        creditorName: "CREDITOR SEVEN",
        creditorBsb: "063-001",
        creditorAccountNumber: "77778888",
        reference: "CANCEL-TEST",
        startDate: tomorrow.toISOString().split("T")[0],
      });
      
      const cancelResult = paymentSchedulingService.cancel(createResult.schedule!.scheduleId);
      expect(cancelResult.success).toBe(true);
      
      const schedule = paymentSchedulingService.getSchedule(createResult.schedule!.scheduleId);
      expect(schedule?.status).toBe("CANCELLED");
    });
  });

  describe("Statistics", () => {
    it("gets scheduling statistics", () => {
      const stats = paymentSchedulingService.getStatistics();
      expect(stats.total).toBeGreaterThan(0);
      expect(stats.byStatus).toBeDefined();
      expect(stats.byType).toBeDefined();
    });
  });
});
