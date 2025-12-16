/**
 * DrizzleFactStore.ts - Drizzle-backed FactStore Implementation
 * 
 * This adapter connects Deposits Core v1 to the database.
 * It implements the FactStore interface from the application layer.
 * 
 * Design:
 * - Facts are immutable (append-only)
 * - Sequence numbers are per-account
 * - All operations use transactions for consistency
 */

import { eq, and, asc, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { nanoid } from "nanoid";
import { 
  depositFacts, 
  depositAccounts, 
  depositHolds,
  InsertDepositFact,
  InsertDepositAccount,
  InsertDepositHold,
} from "../../../drizzle/schema";
import { FactStore } from "../../../application/deposits/HandlerInterface";
import { 
  DepositFact, 
  isAccountOpened, 
  isPostingApplied, 
  isAccountClosed 
} from "../../../core/deposits/events/DepositFact";
import { isHoldPlacedPosting, isHoldReleasedPosting } from "../../../core/deposits/ledger/Posting";
import { rebuildFromFacts } from "../../../core/deposits/events/DepositFact";

/**
 * DrizzleFactStore - Database-backed fact store.
 */
export class DrizzleFactStore implements FactStore {
  private db: ReturnType<typeof drizzle>;
  
  constructor(db: ReturnType<typeof drizzle>) {
    this.db = db;
  }
  
  /**
   * Load all facts for an account, ordered by sequence.
   */
  async loadFacts(accountId: string): Promise<DepositFact[]> {
    const rows = await this.db
      .select()
      .from(depositFacts)
      .where(eq(depositFacts.accountId, accountId))
      .orderBy(asc(depositFacts.sequence));
    
    return rows.map(row => this.rowToFact(row));
  }
  
  /**
   * Append facts to the store.
   * Also updates the account metadata and holds tables.
   */
  async appendFacts(facts: DepositFact[]): Promise<boolean> {
    if (facts.length === 0) return true;
    
    try {
      for (const fact of facts) {
        const factId = `FACT-${nanoid(12)}`;
        
        // Determine sequence
        let sequence: number;
        if (isPostingApplied(fact)) {
          sequence = fact.sequence;
        } else {
          // For non-posting facts, get next sequence
          sequence = await this.nextSequence(fact.accountId);
        }
        
        // Insert fact
        const values: InsertDepositFact = {
          factId,
          accountId: fact.accountId,
          sequence,
          factType: fact.type,
          factData: fact as unknown as Record<string, unknown>,
          occurredAt: new Date(fact.occurredAt),
          commandId: null,
          decisionId: null,
        };
        
        await this.db.insert(depositFacts).values(values);
        
        // Update account metadata based on fact type
        await this.updateAccountFromFact(fact);
      }
      
      return true;
    } catch (error) {
      console.error("[DrizzleFactStore] Failed to append facts:", error);
      return false;
    }
  }
  
  /**
   * Get the next sequence number for an account.
   */
  async nextSequence(accountId: string): Promise<number> {
    const result = await this.db
      .select({ maxSeq: sql<number>`COALESCE(MAX(${depositFacts.sequence}), 0)` })
      .from(depositFacts)
      .where(eq(depositFacts.accountId, accountId));
    
    return (result[0]?.maxSeq ?? 0) + 1;
  }
  
  /**
   * Convert database row to DepositFact.
   */
  private rowToFact(row: typeof depositFacts.$inferSelect): DepositFact {
    const factData = row.factData as Record<string, unknown>;
    return factData as unknown as DepositFact;
  }
  
  /**
   * Update account metadata based on a fact.
   */
  private async updateAccountFromFact(fact: DepositFact): Promise<void> {
    if (isAccountOpened(fact)) {
      // Create account record
      const values: InsertDepositAccount = {
        accountId: fact.accountId,
        customerId: "UNKNOWN", // Will be set by handler
        productType: "savings", // Will be set by handler
        currency: fact.currency,
        status: "OPEN",
        openedAt: new Date(fact.occurredAt),
      };
      
      await this.db.insert(depositAccounts).values(values)
        .onDuplicateKeyUpdate({ set: { status: "OPEN" } });
    }
    
    if (isAccountClosed(fact)) {
      await this.db
        .update(depositAccounts)
        .set({ 
          status: "CLOSED",
          closedAt: new Date(fact.occurredAt),
        })
        .where(eq(depositAccounts.accountId, fact.accountId));
    }
    
    if (isPostingApplied(fact)) {
      // Rebuild account state and update cached balances
      const facts = await this.loadFacts(fact.accountId);
      const account = rebuildFromFacts(facts);
      
      if (account) {
        await this.db
          .update(depositAccounts)
          .set({
            ledgerBalance: (Number(account.ledgerBalance.amount) / 100).toFixed(2),
            availableBalance: (Number(account.availableBalance.amount) / 100).toFixed(2),
            holdCount: account.holds.length,
          })
          .where(eq(depositAccounts.accountId, fact.accountId));
        
        // Update holds table
        const posting = fact.posting;
        if (isHoldPlacedPosting(posting)) {
          const holdValues: InsertDepositHold = {
            holdId: posting.holdId,
            accountId: fact.accountId,
            amount: (Number(posting.amount.amount) / 100).toFixed(2),
            currency: posting.amount.currency,
            holdType: this.extractHoldType(posting.holdId),
            reason: posting.reason || null,
            status: "ACTIVE",
            placedAt: new Date(fact.occurredAt),
          };
          
          await this.db.insert(depositHolds).values(holdValues)
            .onDuplicateKeyUpdate({ set: { status: "ACTIVE" } });
        }
        
        if (isHoldReleasedPosting(posting)) {
          await this.db
            .update(depositHolds)
            .set({ 
              status: "RELEASED",
              releasedAt: new Date(fact.occurredAt),
            })
            .where(eq(depositHolds.holdId, posting.holdId));
        }
      }
    }
  }
  
  /**
   * Extract hold type from hold ID.
   */
  private extractHoldType(holdId: string): string {
    if (holdId.includes("PAYMENT")) return "PAYMENT";
    if (holdId.includes("DEPOSIT")) return "DEPOSIT";
    if (holdId.includes("REGULATORY")) return "REGULATORY";
    if (holdId.includes("LEGAL")) return "LEGAL";
    return "UNKNOWN";
  }
}

/**
 * Extended operations for deposits (beyond FactStore interface).
 */
export class DepositsRepository {
  private db: ReturnType<typeof drizzle>;
  private factStore: DrizzleFactStore;
  
  constructor(db: ReturnType<typeof drizzle>) {
    this.db = db;
    this.factStore = new DrizzleFactStore(db);
  }
  
  getFactStore(): DrizzleFactStore {
    return this.factStore;
  }
  
  /**
   * List all deposit accounts.
   */
  async listAccounts(options?: {
    status?: "OPEN" | "CLOSED";
    limit?: number;
    offset?: number;
  }): Promise<typeof depositAccounts.$inferSelect[]> {
    let query = this.db.select().from(depositAccounts);
    
    if (options?.status) {
      query = query.where(eq(depositAccounts.status, options.status)) as typeof query;
    }
    
    query = query.orderBy(desc(depositAccounts.createdAt)) as typeof query;
    
    if (options?.limit) {
      query = query.limit(options.limit) as typeof query;
    }
    
    if (options?.offset) {
      query = query.offset(options.offset) as typeof query;
    }
    
    return await query;
  }
  
  /**
   * Get account by ID.
   */
  async getAccount(accountId: string): Promise<typeof depositAccounts.$inferSelect | null> {
    const result = await this.db
      .select()
      .from(depositAccounts)
      .where(eq(depositAccounts.accountId, accountId))
      .limit(1);
    
    return result[0] || null;
  }
  
  /**
   * Get account with full state rebuilt from facts.
   */
  async getAccountWithState(accountId: string) {
    const [accountRow, facts] = await Promise.all([
      this.getAccount(accountId),
      this.factStore.loadFacts(accountId),
    ]);
    
    if (!accountRow) return null;
    
    const account = rebuildFromFacts(facts);
    
    return {
      metadata: accountRow,
      state: account,
      facts,
    };
  }
  
  /**
   * Get active holds for an account.
   */
  async getActiveHolds(accountId: string): Promise<typeof depositHolds.$inferSelect[]> {
    return await this.db
      .select()
      .from(depositHolds)
      .where(
        and(
          eq(depositHolds.accountId, accountId),
          eq(depositHolds.status, "ACTIVE")
        )
      );
  }
  
  /**
   * Get recent facts across all accounts (for dashboard).
   */
  async getRecentFacts(limit = 50): Promise<typeof depositFacts.$inferSelect[]> {
    return await this.db
      .select()
      .from(depositFacts)
      .orderBy(desc(depositFacts.createdAt))
      .limit(limit);
  }
  
  /**
   * Update account metadata (customer ID, product type, segment).
   */
  async updateAccountMetadata(
    accountId: string,
    metadata: {
      customerId?: string;
      productType?: string;
      customerSegment?: string;
    }
  ): Promise<boolean> {
    try {
      await this.db
        .update(depositAccounts)
        .set(metadata)
        .where(eq(depositAccounts.accountId, accountId));
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Get account statistics.
   */
  async getStats(): Promise<{
    totalAccounts: number;
    openAccounts: number;
    closedAccounts: number;
    totalLedgerBalance: string;
    totalAvailableBalance: string;
    totalHolds: number;
  }> {
    const accounts = await this.db.select().from(depositAccounts);
    
    let totalLedger = 0;
    let totalAvailable = 0;
    let totalHolds = 0;
    let openCount = 0;
    let closedCount = 0;
    
    for (const acc of accounts) {
      totalLedger += parseFloat(acc.ledgerBalance);
      totalAvailable += parseFloat(acc.availableBalance);
      totalHolds += acc.holdCount;
      if (acc.status === "OPEN") openCount++;
      else closedCount++;
    }
    
    return {
      totalAccounts: accounts.length,
      openAccounts: openCount,
      closedAccounts: closedCount,
      totalLedgerBalance: totalLedger.toFixed(2),
      totalAvailableBalance: totalAvailable.toFixed(2),
      totalHolds,
    };
  }
}
