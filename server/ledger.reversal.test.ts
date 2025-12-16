import { describe, it, expect, beforeAll } from "vitest";

// Increase timeout for database operations
const TEST_TIMEOUT = 15000;
import {
  createLedgerAccount,
  createPosting,
  commitPosting,
  reversePosting,
  getPosting,
} from "./db";

describe("ledger.reversePosting", () => {
  let sourceAccountId: string;
  let targetAccountId: string;

  beforeAll(async () => {
    // Create test accounts
    const sourceResult = await createLedgerAccount({
      accountType: "ASSET",
      name: "Reversal Test Source",
      currency: "AUD",
    });
    sourceAccountId = sourceResult.accountId;

    const targetResult = await createLedgerAccount({
      accountType: "LIABILITY",
      name: "Reversal Test Target",
      currency: "AUD",
    });
    targetAccountId = targetResult.accountId;
  });

  it("should reverse a committed posting", { timeout: TEST_TIMEOUT }, async () => {
    // Create and commit a posting
    const postingResult = await createPosting({
      entries: [
        { accountId: sourceAccountId, direction: "CREDIT", amount: "500.00" },
        { accountId: targetAccountId, direction: "DEBIT", amount: "500.00" },
      ],
      description: "Original posting to reverse",
    });
    expect(postingResult).not.toHaveProperty("error");
    const postingId = (postingResult as { postingId: string }).postingId;

    // Commit the posting
    const commitResult = await commitPosting(postingId);
    expect(commitResult.success).toBe(true);

    // Reverse the posting
    const reversalResult = await reversePosting({
      postingId,
      reason: "Test reversal - incorrect amount",
    });
    expect(reversalResult.success).toBe(true);
    expect(reversalResult.reversalPostingId).toBeDefined();
    expect(reversalResult.reversalPostingId).toMatch(/^POST-REV-/);

    // Verify original posting is marked as REVERSED
    const originalPosting = await getPosting(postingId);
    expect(originalPosting?.posting.status).toBe("REVERSED");
    expect(originalPosting?.posting.reversedBy).toBe(reversalResult.reversalPostingId);

    // Verify reversal posting exists and is COMMITTED
    const reversalPosting = await getPosting(reversalResult.reversalPostingId!);
    expect(reversalPosting?.posting.status).toBe("COMMITTED");
    expect(reversalPosting?.posting.reversesPostingId).toBe(postingId);
    expect(reversalPosting?.posting.description).toContain("REVERSAL:");
    expect(reversalPosting?.posting.description).toContain("Test reversal - incorrect amount");

    // Verify reversal entries have opposite directions
    const originalEntries = originalPosting?.entries || [];
    const reversalEntries = reversalPosting?.entries || [];
    
    expect(reversalEntries.length).toBe(originalEntries.length);
    
    for (const originalEntry of originalEntries) {
      const matchingReversal = reversalEntries.find(
        (e) => e.accountId === originalEntry.accountId
      );
      expect(matchingReversal).toBeDefined();
      expect(matchingReversal?.direction).toBe(
        originalEntry.direction === "DEBIT" ? "CREDIT" : "DEBIT"
      );
      expect(matchingReversal?.amount).toBe(originalEntry.amount);
    }
  });

  it("should prevent reversing a pending posting", { timeout: TEST_TIMEOUT }, async () => {
    // Create a posting but don't commit it
    const postingResult = await createPosting({
      entries: [
        { accountId: sourceAccountId, direction: "CREDIT", amount: "100.00" },
        { accountId: targetAccountId, direction: "DEBIT", amount: "100.00" },
      ],
      description: "Pending posting - should not be reversible",
    });
    const postingId = (postingResult as { postingId: string }).postingId;

    // Try to reverse it
    const reversalResult = await reversePosting({
      postingId,
      reason: "Should fail",
    });
    expect(reversalResult.success).toBe(false);
    expect(reversalResult.error).toContain("Only COMMITTED postings can be reversed");
  });

  it("should prevent double reversal", { timeout: TEST_TIMEOUT }, async () => {
    // Create and commit a posting
    const postingResult = await createPosting({
      entries: [
        { accountId: sourceAccountId, direction: "CREDIT", amount: "200.00" },
        { accountId: targetAccountId, direction: "DEBIT", amount: "200.00" },
      ],
      description: "Posting for double reversal test",
    });
    const postingId = (postingResult as { postingId: string }).postingId;
    await commitPosting(postingId);

    // First reversal should succeed
    const firstReversal = await reversePosting({
      postingId,
      reason: "First reversal",
    });
    expect(firstReversal.success).toBe(true);

    // Second reversal should fail
    const secondReversal = await reversePosting({
      postingId,
      reason: "Second reversal - should fail",
    });
    expect(secondReversal.success).toBe(false);
    expect(secondReversal.error).toContain("REVERSED");
  });

  it("should fail for non-existent posting", { timeout: TEST_TIMEOUT }, async () => {
    const reversalResult = await reversePosting({
      postingId: "POST-NONEXISTENT-12345",
      reason: "Should fail",
    });
    expect(reversalResult.success).toBe(false);
    expect(reversalResult.error).toContain("Posting not found");
  });

  it("should preserve governance links in reversal", { timeout: TEST_TIMEOUT }, async () => {
    // Create posting with governance links
    const postingResult = await createPosting({
      entries: [
        { accountId: sourceAccountId, direction: "CREDIT", amount: "300.00" },
        { accountId: targetAccountId, direction: "DEBIT", amount: "300.00" },
      ],
      description: "Posting with governance links",
      decisionId: "DEC-GOV-TEST-001",
      loanId: "LOAN-GOV-TEST-001",
    });
    const postingId = (postingResult as { postingId: string }).postingId;
    await commitPosting(postingId);

    // Reverse it
    const reversalResult = await reversePosting({
      postingId,
      reason: "Governance link preservation test",
    });
    expect(reversalResult.success).toBe(true);

    // Verify governance links are preserved in reversal
    const reversalPosting = await getPosting(reversalResult.reversalPostingId!);
    expect(reversalPosting?.posting.decisionId).toBe("DEC-GOV-TEST-001");
    expect(reversalPosting?.posting.loanId).toBe("LOAN-GOV-TEST-001");
  });
});
