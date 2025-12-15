import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

/**
 * Ledger API Tests
 * 
 * These tests verify the double-entry accounting system:
 * 1. Account creation
 * 2. Balanced posting creation
 * 3. Posting commitment (balance updates)
 * 4. Transfer convenience method
 */

function createTestContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("ledger.createAccount", () => {
  it("creates an ASSET account with correct properties", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const account = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Test Customer Wallet",
      currency: "AUD",
    });

    expect(account).toBeDefined();
    expect(account.accountId).toMatch(/^ACC-/);
    expect(account.accountType).toBe("ASSET");
    expect(account.name).toBe("Test Customer Wallet");
    expect(account.currency).toBe("AUD");
    expect(account.balance).toBe("0.00");
    expect(account.frozen).toBe("false");
  });

  it("creates a LIABILITY account", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const account = await caller.ledger.createAccount({
      accountType: "LIABILITY",
      name: "Test Loan Principal",
    });

    expect(account.accountType).toBe("LIABILITY");
  });
});

describe("ledger.createPosting", () => {
  it("creates a balanced posting with two entries", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create two accounts
    const sourceAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Source Account",
    });
    const destAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Destination Account",
    });

    // Create a balanced posting
    const posting = await caller.ledger.createPosting({
      entries: [
        { accountId: sourceAccount.accountId, direction: "CREDIT", amount: "100.00" },
        { accountId: destAccount.accountId, direction: "DEBIT", amount: "100.00" },
      ],
      description: "Test transfer",
    });

    expect(posting.postingId).toMatch(/^POST-/);
    expect(posting.entries).toHaveLength(2);
  });

  it("rejects unbalanced postings", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const account1 = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Account 1",
    });
    const account2 = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Account 2",
    });

    // Try to create an unbalanced posting
    await expect(
      caller.ledger.createPosting({
        entries: [
          { accountId: account1.accountId, direction: "CREDIT", amount: "100.00" },
          { accountId: account2.accountId, direction: "DEBIT", amount: "50.00" }, // Unbalanced!
        ],
      })
    ).rejects.toThrow(/not balanced/i);
  });

  it("respects idempotency key", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const account1 = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Idempotency Test 1",
    });
    const account2 = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Idempotency Test 2",
    });

    const idempotencyKey = `test-${Date.now()}`;

    // First call
    const posting1 = await caller.ledger.createPosting({
      entries: [
        { accountId: account1.accountId, direction: "CREDIT", amount: "25.00" },
        { accountId: account2.accountId, direction: "DEBIT", amount: "25.00" },
      ],
      idempotencyKey,
    });

    // Second call with same key should return same posting
    const posting2 = await caller.ledger.createPosting({
      entries: [
        { accountId: account1.accountId, direction: "CREDIT", amount: "25.00" },
        { accountId: account2.accountId, direction: "DEBIT", amount: "25.00" },
      ],
      idempotencyKey,
    });

    expect(posting1.postingId).toBe(posting2.postingId);
  });
});

describe("ledger.commitPosting", () => {
  it("updates account balances when posting is committed", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    // Create accounts
    const sourceAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Commit Test Source",
    });
    const destAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Commit Test Dest",
    });

    // Create posting
    const posting = await caller.ledger.createPosting({
      entries: [
        { accountId: sourceAccount.accountId, direction: "CREDIT", amount: "50.00" },
        { accountId: destAccount.accountId, direction: "DEBIT", amount: "50.00" },
      ],
    });

    // Commit posting
    const result = await caller.ledger.commitPosting({ postingId: posting.postingId });
    expect(result.success).toBe(true);

    // Check balances
    const updatedSource = await caller.ledger.getAccount({ accountId: sourceAccount.accountId });
    const updatedDest = await caller.ledger.getAccount({ accountId: destAccount.accountId });

    // CREDIT decreases ASSET, DEBIT increases ASSET
    expect(parseFloat(updatedSource!.balance)).toBe(-50.00);
    expect(parseFloat(updatedDest!.balance)).toBe(50.00);
  });

  it("is idempotent (committing twice has no additional effect)", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const account1 = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Idempotent Commit 1",
    });
    const account2 = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Idempotent Commit 2",
    });

    const posting = await caller.ledger.createPosting({
      entries: [
        { accountId: account1.accountId, direction: "CREDIT", amount: "10.00" },
        { accountId: account2.accountId, direction: "DEBIT", amount: "10.00" },
      ],
    });

    // Commit twice
    await caller.ledger.commitPosting({ postingId: posting.postingId });
    await caller.ledger.commitPosting({ postingId: posting.postingId });

    // Balance should only reflect one commit
    const updated = await caller.ledger.getAccount({ accountId: account2.accountId });
    expect(parseFloat(updated!.balance)).toBe(10.00);
  });
});

describe("ledger.transfer", () => {
  it("creates and commits a transfer in one call", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const fromAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Transfer From",
    });
    const toAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Transfer To",
    });

    const result = await caller.ledger.transfer({
      fromAccountId: fromAccount.accountId,
      toAccountId: toAccount.accountId,
      amount: "75.00",
      description: "Test transfer",
    });

    expect(result.success).toBe(true);
    expect(result.postingId).toMatch(/^POST-/);

    // Verify balances
    const updatedFrom = await caller.ledger.getAccount({ accountId: fromAccount.accountId });
    const updatedTo = await caller.ledger.getAccount({ accountId: toAccount.accountId });

    expect(parseFloat(updatedFrom!.balance)).toBe(-75.00);
    expect(parseFloat(updatedTo!.balance)).toBe(75.00);
  });

  it("links transfer to decisionId for governance", async () => {
    const ctx = createTestContext();
    const caller = appRouter.createCaller(ctx);

    const fromAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Governed From",
    });
    const toAccount = await caller.ledger.createAccount({
      accountType: "ASSET",
      name: "Governed To",
    });

    const result = await caller.ledger.transfer({
      fromAccountId: fromAccount.accountId,
      toAccountId: toAccount.accountId,
      amount: "100.00",
      decisionId: "DEC-TEST-123",
      loanId: "LOAN-TEST-456",
    });

    // Verify the posting has governance links
    const posting = await caller.ledger.getPosting({ postingId: result.postingId });
    expect(posting?.posting.decisionId).toBe("DEC-TEST-123");
    expect(posting?.posting.loanId).toBe("LOAN-TEST-456");
  });
});
