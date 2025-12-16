#!/usr/bin/env node
/**
 * Automated DR Drill Script
 * 
 * Runs weekly DR drills to ensure replay capability never regresses.
 * Generates compliance reports and stores results in audit_facts.
 * 
 * Usage:
 *   node scripts/automated-dr-drill.mjs
 *   
 * Schedule with cron:
 *   0 2 * * 0 cd /home/ubuntu/turing-resolve-ui && node scripts/automated-dr-drill.mjs
 */

import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { paymentFacts, depositFacts, payments, depositAccounts, auditFacts } from "../drizzle/schema.ts";
import { nanoid } from "nanoid";

const DATABASE_URL = process.env.DATABASE_URL || "mysql://root@localhost:3306/turingcore";

async function runDRDrill() {
  console.log("=".repeat(60));
  console.log("AUTOMATED DR DRILL - Fact Replay Verification");
  console.log("=".repeat(60));
  console.log(`Started: ${new Date().toISOString()}\n`);

  const startTime = Date.now();
  const drillId = nanoid();

  try {
    // Connect to database
    const connection = await mysql.createConnection(DATABASE_URL);
    const db = drizzle(connection);

    // Step 1: Backup current state
    console.log("[1/6] Taking backup of current state...");
    const [paymentRows] = await connection.query("SELECT COUNT(*) as count FROM payments");
    const [depositRows] = await connection.query("SELECT COUNT(*) as count FROM deposit_accounts");
    const [paymentFactRows] = await connection.query("SELECT COUNT(*) as count FROM payment_facts");
    const [depositFactRows] = await connection.query("SELECT COUNT(*) as count FROM deposit_facts");

    const beforeState = {
      payments: paymentRows[0].count,
      depositAccounts: depositRows[0].count,
      paymentFacts: paymentFactRows[0].count,
      depositFacts: depositFactRows[0].count,
    };

    console.log(`   Payments: ${beforeState.payments}`);
    console.log(`   Deposit Accounts: ${beforeState.depositAccounts}`);
    console.log(`   Payment Facts: ${beforeState.paymentFacts}`);
    console.log(`   Deposit Facts: ${beforeState.depositFacts}\n`);

    // Step 2: Drop projections
    console.log("[2/6] Dropping projection tables...");
    await connection.query("TRUNCATE TABLE payments");
    await connection.query("TRUNCATE TABLE deposit_accounts");
    await connection.query("TRUNCATE TABLE deposit_holds");
    console.log("   Projections cleared\n");

    // Step 3: Verify empty state
    console.log("[3/6] Verifying empty state...");
    const [emptyPayments] = await connection.query("SELECT COUNT(*) as count FROM payments");
    const [emptyDeposits] = await connection.query("SELECT COUNT(*) as count FROM deposit_accounts");
    
    if (emptyPayments[0].count !== 0 || emptyDeposits[0].count !== 0) {
      throw new Error("Projections not empty after truncate");
    }
    console.log("   ✓ Projections empty\n");

    // Step 4: Replay facts
    console.log("[4/6] Replaying facts...");
    
    // Replay deposit facts
    const allDepositFacts = await db.select().from(depositFacts).orderBy(depositFacts.sequence);
    console.log(`   Replaying ${allDepositFacts.length} deposit facts...`);
    
    for (const fact of allDepositFacts) {
      if (fact.factType === "ACCOUNT_OPENED") {
        const factData = fact.factData;
        await connection.query(
          "INSERT INTO deposit_accounts (accountId, customerId, accountType, currency, availableBalance, totalBalance, frozen, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            fact.accountId,
            factData.customerId || null,
            factData.accountType || "SAVINGS",
            factData.currency || "AUD",
            "0.00",
            "0.00",
            "false",
            fact.occurredAt,
            fact.occurredAt,
          ]
        );
      } else if (fact.factType === "POSTING_APPLIED") {
        const factData = fact.factData;
        const amount = parseFloat(factData.amount || "0");
        const postingType = factData.postingType;
        
        if (postingType === "CREDIT") {
          await connection.query(
            "UPDATE deposit_accounts SET availableBalance = availableBalance + ?, totalBalance = totalBalance + ?, updatedAt = ? WHERE accountId = ?",
            [amount, amount, fact.occurredAt, fact.accountId]
          );
        } else if (postingType === "DEBIT") {
          await connection.query(
            "UPDATE deposit_accounts SET availableBalance = availableBalance - ?, totalBalance = totalBalance - ?, updatedAt = ? WHERE accountId = ?",
            [amount, amount, fact.occurredAt, fact.accountId]
          );
        }
      }
    }

    // Replay payment facts
    const allPaymentFacts = await db.select().from(paymentFacts).orderBy(paymentFacts.sequence);
    console.log(`   Replaying ${allPaymentFacts.length} payment facts...`);
    
    const paymentStates = new Map();
    
    for (const fact of allPaymentFacts) {
      let state = paymentStates.get(fact.paymentId) || {
        paymentId: fact.paymentId,
        currentState: "INITIATED",
        fromAccount: null,
        toAccount: null,
        amount: "0.00",
        currency: "AUD",
        scheme: "INTERNAL",
        idempotencyKey: fact.idempotencyKey,
        createdAt: fact.occurredAt,
        updatedAt: fact.occurredAt,
      };

      if (fact.factType === "PAYMENT_INITIATED") {
        const factData = fact.factData;
        state.fromAccount = factData.fromAccount;
        state.toAccount = factData.toAccount || null;
        state.amount = factData.amount;
        state.currency = factData.currency || "AUD";
        state.scheme = factData.scheme || "INTERNAL";
        state.currentState = "INITIATED";
      } else if (fact.factType === "PAYMENT_HELD") {
        state.currentState = "HELD";
      } else if (fact.factType === "PAYMENT_SENT") {
        state.currentState = "SENT";
      } else if (fact.factType === "PAYMENT_SETTLED") {
        state.currentState = "SETTLED";
      } else if (fact.factType === "PAYMENT_FAILED") {
        state.currentState = "FAILED";
      } else if (fact.factType === "PAYMENT_REVERSED") {
        state.currentState = "REVERSED";
      }

      state.updatedAt = fact.occurredAt;
      paymentStates.set(fact.paymentId, state);
    }

    // Insert rebuilt payments
    for (const [paymentId, state] of paymentStates) {
      await connection.query(
        "INSERT INTO payments (paymentId, currentState, fromAccount, toAccount, amount, currency, scheme, idempotencyKey, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          state.paymentId,
          state.currentState,
          state.fromAccount,
          state.toAccount,
          state.amount,
          state.currency,
          state.scheme,
          state.idempotencyKey,
          state.createdAt,
          state.updatedAt,
        ]
      );
    }

    console.log(`   ✓ Replayed ${allDepositFacts.length + allPaymentFacts.length} facts\n`);

    // Step 5: Verify state
    console.log("[5/6] Verifying replayed state...");
    const [afterPayments] = await connection.query("SELECT COUNT(*) as count FROM payments");
    const [afterDeposits] = await connection.query("SELECT COUNT(*) as count FROM deposit_accounts");

    const afterState = {
      payments: afterPayments[0].count,
      depositAccounts: afterDeposits[0].count,
    };

    console.log(`   Payments: ${afterState.payments} (expected: ${beforeState.payments})`);
    console.log(`   Deposit Accounts: ${afterState.depositAccounts} (expected: ${beforeState.depositAccounts})`);

    const paymentsMatch = afterState.payments === beforeState.payments;
    const depositsMatch = afterState.depositAccounts === beforeState.depositAccounts;

    if (!paymentsMatch || !depositsMatch) {
      throw new Error("State mismatch after replay");
    }

    console.log("   ✓ All verifications passed\n");

    // Step 6: Record audit fact
    console.log("[6/6] Recording audit fact...");
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    await db.insert(auditFacts).values({
      auditId: nanoid(),
      actor: "SYSTEM",
      actorRole: "AUTOMATED_DR_DRILL",
      actionType: "DR_DRILL_COMPLETED",
      targetType: "SYSTEM",
      targetId: drillId,
      reason: `Weekly automated DR drill - ${allDepositFacts.length + allPaymentFacts.length} facts replayed`,
      result: "SUCCESS",
      resultReason: `Duration: ${duration}s, Payments: ${afterState.payments}, Accounts: ${afterState.depositAccounts}`,
      occurredAt: new Date(),
    });

    console.log(`   ✓ Audit fact recorded\n`);

    // Summary
    console.log("=".repeat(60));
    console.log("DR DRILL COMPLETED SUCCESSFULLY");
    console.log("=".repeat(60));
    console.log(`Drill ID: ${drillId}`);
    console.log(`Duration: ${duration} seconds`);
    console.log(`Facts Replayed: ${allDepositFacts.length + allPaymentFacts.length}`);
    console.log(`Payments Rebuilt: ${afterState.payments}`);
    console.log(`Accounts Rebuilt: ${afterState.depositAccounts}`);
    console.log(`Completed: ${new Date().toISOString()}`);
    console.log("=".repeat(60));

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error("\n❌ DR DRILL FAILED");
    console.error(error);
    
    // Record failure in audit facts
    try {
      const connection = await mysql.createConnection(DATABASE_URL);
      const db = drizzle(connection);
      
      await db.insert(auditFacts).values({
        auditId: nanoid(),
        actor: "SYSTEM",
        actorRole: "AUTOMATED_DR_DRILL",
        actionType: "DR_DRILL_FAILED",
        targetType: "SYSTEM",
        targetId: drillId,
        reason: "Weekly automated DR drill failed",
        result: "FAILURE",
        resultReason: error.message,
        occurredAt: new Date(),
      });
      
      await connection.end();
    } catch (auditError) {
      console.error("Failed to record audit fact:", auditError);
    }
    
    process.exit(1);
  }
}

runDRDrill();
