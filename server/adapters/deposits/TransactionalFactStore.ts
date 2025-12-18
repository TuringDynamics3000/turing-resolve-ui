/**
 * TransactionalFactStore.ts - Transaction-Safe Fact Store
 * 
 * TuringDynamics Core - Production-Grade Fact Store
 * 
 * This adapter wraps fact operations in database transactions
 * to ensure atomicity and prevent partial writes.
 * 
 * CRITICAL: All multi-fact operations MUST be atomic.
 * If any fact fails to persist, ALL facts in the batch must be rolled back.
 */

import { eq, asc, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { getDb } from "../../db";
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

// ============================================
// TYPES
// ============================================

export interface TransactionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  rollbackPerformed?: boolean;
}

export interface AppendFactsResult {
  success: boolean;
  factsAppended: number;
  error?: string;
}

// ============================================
// TRANSACTIONAL FACT STORE
// ============================================

/**
 * TransactionalFactStore - Atomic fact persistence.
 * 
 * All multi-fact operations are wrapped in transactions.
 * Partial writes are impossible - either all facts persist or none do.
 */
export class TransactionalFactStore implements FactStore {
  
  /**
   * Load all facts for an account, ordered by sequence.
   */
  async loadFacts(accountId: string): Promise<DepositFact[]> {
    const conn = await getDb();
    if (!conn) return [];
    
    const rows = await conn
      .select()
      .from(depositFacts)
      .where(eq(depositFacts.accountId, accountId))
      .orderBy(asc(depositFacts.sequence));
    
    return rows.map(row => this.rowToFact(row));
  }
  
  /**
   * Append facts to the store atomically.
   * 
   * CRITICAL: This method uses a transaction to ensure all-or-nothing semantics.
   * If any fact fails to persist, all facts in the batch are rolled back.
   * 
   * @param facts - Facts to append
   * @returns true if all facts were persisted, false if rolled back
   */
  async appendFacts(facts: DepositFact[]): Promise<boolean> {
    if (facts.length === 0) return true;
    
    const conn = await getDb();
    if (!conn) {
      console.error("[TransactionalFactStore] Database connection not available");
      return false;
    }
    
    // Track what we've inserted for potential rollback
    const insertedFactIds: string[] = [];
    let transactionSuccessful = false;
    
    try {
      // Start transaction by setting autocommit off
      await conn.execute(sql`SET autocommit = 0`);
      await conn.execute(sql`START TRANSACTION`);
      
      for (const fact of facts) {
        const factId = `FACT-${nanoid(12)}`;
        insertedFactIds.push(factId);
        
        // Determine sequence
        let sequence: number;
        if (isPostingApplied(fact)) {
          sequence = fact.sequence;
        } else {
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
        
        await conn.insert(depositFacts).values(values);
        
        // Update account metadata
        await this.updateAccountFromFact(fact, conn);
      }
      
      // All inserts successful - commit transaction
      await conn.execute(sql`COMMIT`);
      await conn.execute(sql`SET autocommit = 1`);
      transactionSuccessful = true;
      
      console.log(`[TransactionalFactStore] Successfully appended ${facts.length} facts`);
      return true;
      
    } catch (error) {
      // Rollback on any error
      console.error("[TransactionalFactStore] Transaction failed, rolling back:", error);
      
      try {
        await conn.execute(sql`ROLLBACK`);
        await conn.execute(sql`SET autocommit = 1`);
        console.log("[TransactionalFactStore] Rollback successful");
      } catch (rollbackError) {
        console.error("[TransactionalFactStore] Rollback failed:", rollbackError);
      }
      
      return false;
    }
  }
  
  /**
   * Append facts with detailed result.
   */
  async appendFactsWithResult(facts: DepositFact[]): Promise<AppendFactsResult> {
    if (facts.length === 0) {
      return { success: true, factsAppended: 0 };
    }
    
    const success = await this.appendFacts(facts);
    
    return {
      success,
      factsAppended: success ? facts.length : 0,
      error: success ? undefined : "Transaction rolled back due to error",
    };
  }
  
  /**
   * Get the next sequence number for an account.
   */
  async nextSequence(accountId: string): Promise<number> {
    const conn = await getDb();
    if (!conn) return 1;
    
    const result = await conn
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
  private async updateAccountFromFact(
    fact: DepositFact, 
    conn: NonNullable<Awaited<ReturnType<typeof getDb>>>
  ): Promise<void> {
    if (isAccountOpened(fact)) {
      const values: InsertDepositAccount = {
        accountId: fact.accountId,
        customerId: "UNKNOWN",
        productType: "savings",
        currency: fact.currency,
        status: "OPEN",
        openedAt: new Date(fact.occurredAt),
      };
      
      await conn.insert(depositAccounts).values(values)
        .onDuplicateKeyUpdate({ set: { status: "OPEN" } });
    }
    
    if (isAccountClosed(fact)) {
      await conn
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
        await conn
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
          
          await conn.insert(depositHolds).values(holdValues)
            .onDuplicateKeyUpdate({ set: { status: "ACTIVE" } });
        }
        
        if (isHoldReleasedPosting(posting)) {
          await conn
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

// Export singleton instance
export const transactionalFactStore = new TransactionalFactStore();

export default transactionalFactStore;
