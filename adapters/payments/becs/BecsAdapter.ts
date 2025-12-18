/**
 * BECS Adapter
 * 
 * Stateless adapter for the Bulk Electronic Clearing System (BECS).
 * Handles batch payment processing with ABA file generation.
 */

import { nanoid } from "nanoid";
import type {
  BecsBatch,
  BecsTransaction,
  BecsCallback,
  BecsAdapterConfig,
  BecsSettlementCycle,
  BecsTransactionCode,
} from "./BecsTypes";
import { DEFAULT_BECS_CONFIG } from "./BecsTypes";
import { becsAbaGenerator } from "./BecsAbaGenerator";
import type { Payment } from "../../../server/core/payments/PaymentsSpine";

// ============================================
// BECS ADAPTER
// ============================================

class BecsAdapter {
  private config: BecsAdapterConfig;
  private batches: Map<string, BecsBatch> = new Map();
  private currentBatch: BecsBatch | null = null;

  constructor(config: BecsAdapterConfig = DEFAULT_BECS_CONFIG) {
    this.config = config;
  }

  /**
   * Add payment to current batch.
   */
  async addToBatch(payment: Payment): Promise<{
    success: boolean;
    batchId?: string;
    transactionId?: string;
    error?: string;
  }> {
    // Determine settlement cycle
    const settlementCycle = this.determineSettlementCycle(payment);
    
    // Get or create batch for this settlement cycle
    const batch = this.getOrCreateBatch(settlementCycle);
    
    // Validate payment for BECS
    const validation = this.validatePayment(payment);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    
    // Create BECS transaction
    const transaction: BecsTransaction = {
      transactionId: `BECS-${nanoid(10)}`,
      transactionCode: this.determineTransactionCode(payment),
      amount: Math.round(payment.instruction.amount * 100), // Convert to cents
      beneficiaryBsb: payment.instruction.creditor.bsb || "",
      beneficiaryAccountNumber: payment.instruction.creditor.accountNumber,
      beneficiaryName: payment.instruction.creditor.name.toUpperCase(),
      lodgementReference: payment.instruction.endToEndId.substring(0, 18),
      remitterName: payment.instruction.debtor.name.substring(0, 16).toUpperCase(),
      indicator: " ",
      status: "PENDING",
      paymentId: payment.paymentId,
    };
    
    // Add to batch
    batch.transactions.push(transaction);
    this.updateBatchTotals(batch);
    
    return {
      success: true,
      batchId: batch.batchId,
      transactionId: transaction.transactionId,
    };
  }

  /**
   * Submit payment directly (creates single-transaction batch).
   */
  async submitPayment(payment: Payment): Promise<{
    success: boolean;
    batchId?: string;
    schemeReference?: string;
    error?: string;
  }> {
    // Create a new batch for this payment
    const settlementCycle = this.determineSettlementCycle(payment);
    const batch = this.createBatch(settlementCycle);
    
    // Add payment to batch
    const addResult = await this.addToBatch(payment);
    if (!addResult.success) {
      return { success: false, error: addResult.error };
    }
    
    // Finalize and submit batch
    return this.finalizeBatch(batch.batchId);
  }

  /**
   * Finalize and submit a batch.
   */
  async finalizeBatch(batchId: string): Promise<{
    success: boolean;
    schemeReference?: string;
    abaFileContent?: string;
    error?: string;
  }> {
    const batch = this.batches.get(batchId);
    if (!batch) {
      return { success: false, error: "Batch not found" };
    }
    
    if (batch.status !== "DRAFT") {
      return { success: false, error: `Cannot finalize batch in ${batch.status} status` };
    }
    
    // Validate batch
    const validation = this.validateBatch(batch);
    if (!validation.valid) {
      batch.validationErrors = validation.errors;
      return { success: false, error: validation.errors.join("; ") };
    }
    
    // Mark transactions as included
    for (const tx of batch.transactions) {
      if (tx.status === "PENDING") {
        tx.status = "INCLUDED";
      }
    }
    
    // Generate ABA file
    const abaContent = becsAbaGenerator.generateAbaFile(batch);
    const abaValidation = becsAbaGenerator.validateAbaFile(abaContent);
    
    if (!abaValidation.valid) {
      return { success: false, error: `ABA validation failed: ${abaValidation.errors.join("; ")}` };
    }
    
    // Store ABA file reference
    const abaFileReference = `ABA-${batch.batchId}-${Date.now()}`;
    batch.abaFileReference = abaFileReference;
    batch.abaFileContent = abaContent;
    batch.status = "VALIDATED";
    
    // Simulate submission (in production, this would send to clearing house)
    batch.status = "SUBMITTED";
    batch.submittedAt = new Date().toISOString();
    batch.updatedAt = new Date().toISOString();
    
    // Clear current batch if this was it
    if (this.currentBatch?.batchId === batchId) {
      this.currentBatch = null;
    }
    
    return {
      success: true,
      schemeReference: abaFileReference,
      abaFileContent: abaContent,
    };
  }

  /**
   * Handle BECS callback (acknowledgment, settlement, return).
   */
  async handleCallback(callback: BecsCallback): Promise<{
    processed: boolean;
    fact?: {
      factType: string;
      factData: Record<string, unknown>;
    };
    error?: string;
  }> {
    const batch = this.batches.get(callback.batchId);
    if (!batch) {
      return { processed: false, error: "Batch not found" };
    }
    
    switch (callback.callbackType) {
      case "ACKNOWLEDGMENT":
        if (callback.status === "ACCEPTED") {
          batch.status = "PROCESSING";
        } else {
          batch.status = "REJECTED";
          batch.rejectionReason = callback.rejectionReason;
        }
        break;
        
      case "SETTLEMENT":
        if (callback.status === "SETTLED") {
          batch.status = "SETTLED";
          batch.settledAt = new Date().toISOString();
          
          // Mark all transactions as settled
          for (const tx of batch.transactions) {
            if (tx.status === "INCLUDED") {
              tx.status = "SETTLED";
            }
          }
          
          return {
            processed: true,
            fact: {
              factType: "BATCH_SETTLED",
              factData: {
                batchId: batch.batchId,
                settledAt: batch.settledAt,
                transactionCount: batch.transactions.length,
                totalAmount: batch.creditTotal,
              },
            },
          };
        } else if (callback.status === "PARTIALLY_SETTLED") {
          batch.status = "PARTIALLY_SETTLED";
          
          // Process returns
          if (callback.returnedTransactions) {
            for (const ret of callback.returnedTransactions) {
              const tx = batch.transactions.find(t => t.transactionId === ret.transactionId);
              if (tx) {
                tx.status = "RETURNED";
                tx.returnReason = ret.returnReason;
              }
            }
          }
        }
        break;
        
      case "RETURN":
        // Process individual returns
        if (callback.returnedTransactions) {
          for (const ret of callback.returnedTransactions) {
            const tx = batch.transactions.find(t => t.transactionId === ret.transactionId);
            if (tx) {
              tx.status = "RETURNED";
              tx.returnReason = ret.returnReason;
            }
          }
        }
        break;
    }
    
    batch.updatedAt = new Date().toISOString();
    
    return { processed: true };
  }

  /**
   * Get batch by ID.
   */
  getBatch(batchId: string): BecsBatch | undefined {
    return this.batches.get(batchId);
  }

  /**
   * Get all batches by status.
   */
  getBatchesByStatus(status: BecsBatch["status"]): BecsBatch[] {
    return Array.from(this.batches.values()).filter(b => b.status === status);
  }

  /**
   * Health check.
   */
  async healthCheck(): Promise<{
    healthy: boolean;
    latencyMs?: number;
    error?: string;
  }> {
    const start = Date.now();
    
    // Simulate health check
    await new Promise(resolve => setTimeout(resolve, 20));
    
    return {
      healthy: true,
      latencyMs: Date.now() - start,
    };
  }

  /**
   * Get statistics.
   */
  getStatistics(): Record<string, unknown> {
    const batches = Array.from(this.batches.values());
    
    return {
      totalBatches: batches.length,
      byStatus: {
        DRAFT: batches.filter(b => b.status === "DRAFT").length,
        SUBMITTED: batches.filter(b => b.status === "SUBMITTED").length,
        SETTLED: batches.filter(b => b.status === "SETTLED").length,
        FAILED: batches.filter(b => b.status === "FAILED").length,
      },
      totalTransactions: batches.reduce((sum, b) => sum + b.transactions.length, 0),
      totalAmount: batches.reduce((sum, b) => sum + b.creditTotal, 0),
      currentBatchId: this.currentBatch?.batchId,
    };
  }

  // ============================================
  // PRIVATE METHODS
  // ============================================

  private determineSettlementCycle(payment: Payment): BecsSettlementCycle {
    if (payment.instruction.priority === "SAME_DAY") {
      // Check if before cutoff
      const now = new Date();
      const [cutoffHour, cutoffMin] = this.config.sameDayCutoffTime.split(":").map(Number);
      const cutoff = new Date();
      cutoff.setHours(cutoffHour, cutoffMin, 0, 0);
      
      if (now < cutoff) {
        return "SAME_DAY";
      }
    }
    return "NEXT_DAY";
  }

  private determineTransactionCode(payment: Payment): BecsTransactionCode {
    // Default to credit transfer
    return "50";
  }

  private getOrCreateBatch(settlementCycle: BecsSettlementCycle): BecsBatch {
    // Check if current batch matches settlement cycle
    if (this.currentBatch && this.currentBatch.settlementCycle === settlementCycle) {
      return this.currentBatch;
    }
    
    // Create new batch
    return this.createBatch(settlementCycle);
  }

  private createBatch(settlementCycle: BecsSettlementCycle): BecsBatch {
    const now = new Date();
    const processingDate = settlementCycle === "SAME_DAY"
      ? now.toISOString().split("T")[0]
      : new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    
    const batch: BecsBatch = {
      batchId: `BATCH-${nanoid(10)}`,
      description: `DE ${settlementCycle}`,
      settlementCycle,
      processingDate,
      originatorBsb: this.config.originatorBsb,
      originatorAccountNumber: this.config.originatorAccountNumber,
      originatorName: this.config.originatorName,
      userIdentificationNumber: this.config.userIdentificationNumber,
      transactions: [],
      creditCount: 0,
      debitCount: 0,
      creditTotal: 0,
      debitTotal: 0,
      netTotal: 0,
      status: "DRAFT",
      createdAt: now.toISOString(),
      createdBy: "SYSTEM",
      updatedAt: now.toISOString(),
    };
    
    this.batches.set(batch.batchId, batch);
    this.currentBatch = batch;
    
    return batch;
  }

  private updateBatchTotals(batch: BecsBatch): void {
    let creditTotal = 0;
    let debitTotal = 0;
    let creditCount = 0;
    let debitCount = 0;
    
    for (const tx of batch.transactions) {
      if (tx.transactionCode === "13") {
        debitTotal += tx.amount;
        debitCount++;
      } else {
        creditTotal += tx.amount;
        creditCount++;
      }
    }
    
    batch.creditTotal = creditTotal;
    batch.debitTotal = debitTotal;
    batch.creditCount = creditCount;
    batch.debitCount = debitCount;
    batch.netTotal = creditTotal - debitTotal;
    batch.updatedAt = new Date().toISOString();
  }

  private validatePayment(payment: Payment): { valid: boolean; error?: string } {
    if (!payment.instruction.creditor.bsb) {
      return { valid: false, error: "Creditor BSB required for BECS" };
    }
    
    if (!payment.instruction.creditor.accountNumber) {
      return { valid: false, error: "Creditor account number required" };
    }
    
    if (payment.instruction.currency !== "AUD") {
      return { valid: false, error: "BECS only supports AUD" };
    }
    
    return { valid: true };
  }

  private validateBatch(batch: BecsBatch): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (batch.transactions.length === 0) {
      errors.push("Batch has no transactions");
    }
    
    if (batch.transactions.length > this.config.maxTransactionsPerBatch) {
      errors.push(`Batch exceeds max transactions (${this.config.maxTransactionsPerBatch})`);
    }
    
    if (batch.creditTotal > this.config.maxBatchAmount) {
      errors.push(`Batch exceeds max amount ($${this.config.maxBatchAmount / 100})`);
    }
    
    return { valid: errors.length === 0, errors };
  }
}

export const becsAdapter = new BecsAdapter();
export default becsAdapter;
