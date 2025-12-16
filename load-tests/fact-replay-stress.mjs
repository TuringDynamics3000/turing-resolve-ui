#!/usr/bin/env node
/**
 * Fact Replay Stress Test
 * 
 * Tests the system's ability to rebuild state from large volumes of facts.
 * Simulates DR scenario with 10K+ facts.
 */

import { nanoid } from "nanoid";
import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "turingcore",
};

const TARGET_FACTS = 10000;
const BATCH_SIZE = 100;

async function generateFacts(connection) {
  console.log(`\nGenerating ${TARGET_FACTS} facts...`);
  
  const startTime = Date.now();
  let factsGenerated = 0;

  // Generate payment facts
  for (let i = 0; i < TARGET_FACTS / 2; i += BATCH_SIZE) {
    const batch = [];
    
    for (let j = 0; j < BATCH_SIZE && factsGenerated < TARGET_FACTS / 2; j++) {
      const paymentId = `PAY-STRESS-${nanoid(8)}`;
      
      // PAYMENT_INITIATED
      batch.push([
        nanoid(),
        paymentId,
        "PAYMENT_INITIATED",
        factsGenerated + 1,
        new Date(),
        `ACC-${nanoid(6)}`,
        `ACC-${nanoid(6)}`,
        "100.00",
        "AUD",
        "INTERNAL",
        nanoid(),
        null,
        null,
      ]);
      
      factsGenerated++;
    }

    await connection.query(
      `INSERT INTO payment_facts (factId, paymentId, factType, sequence, occurredAt, fromAccount, toAccount, amount, currency, scheme, idempotencyKey, externalRef, hash) VALUES ?`,
      [batch]
    );

    if (factsGenerated % 1000 === 0) {
      console.log(`  Generated ${factsGenerated} payment facts...`);
    }
  }

  // Generate deposit facts
  for (let i = 0; i < TARGET_FACTS / 2; i += BATCH_SIZE) {
    const batch = [];
    
    for (let j = 0; j < BATCH_SIZE && factsGenerated < TARGET_FACTS; j++) {
      const accountId = `ACC-STRESS-${nanoid(8)}`;
      
      // ACCOUNT_OPENED
      batch.push([
        nanoid(),
        accountId,
        "ACCOUNT_OPENED",
        factsGenerated + 1,
        new Date(),
        "SAVINGS",
        "AUD",
        nanoid(),
        null,
        null,
        null,
      ]);
      
      factsGenerated++;
    }

    await connection.query(
      `INSERT INTO deposit_facts (factId, accountId, factType, sequence, occurredAt, accountType, currency, idempotencyKey, postingType, amount, hash) VALUES ?`,
      [batch]
    );

    if (factsGenerated % 1000 === 0) {
      console.log(`  Generated ${factsGenerated} total facts...`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n✓ Generated ${factsGenerated} facts in ${duration}s`);
  console.log(`  Throughput: ${(factsGenerated / (duration || 1)).toFixed(0)} facts/sec`);
  
  return factsGenerated;
}

async function dropProjections(connection) {
  console.log("\nDropping projection tables...");
  
  await connection.query("DELETE FROM payments");
  await connection.query("DELETE FROM deposit_accounts");
  await connection.query("DELETE FROM deposit_holds");
  
  console.log("✓ Projections dropped");
}

async function replayFacts(connection, totalFacts) {
  console.log(`\nReplaying ${totalFacts} facts to rebuild state...`);
  
  const startTime = Date.now();

  // Replay deposit facts → rebuild accounts
  const [depositFacts] = await connection.query(
    "SELECT * FROM deposit_facts ORDER BY sequence ASC"
  );

  const accounts = new Map();
  
  for (const fact of depositFacts) {
    if (fact.factType === "ACCOUNT_OPENED") {
      accounts.set(fact.accountId, {
        accountId: fact.accountId,
        accountType: fact.accountType,
        currency: fact.currency,
        balance: "0.00",
        availableBalance: "0.00",
        heldBalance: "0.00",
      });
    }
  }

  // Insert rebuilt accounts
  if (accounts.size > 0) {
    const accountBatch = Array.from(accounts.values()).map((acc) => [
      acc.accountId,
      acc.accountType,
      acc.currency,
      acc.balance,
      acc.availableBalance,
      acc.heldBalance,
    ]);

    await connection.query(
      "INSERT INTO deposit_accounts (accountId, accountType, currency, balance, availableBalance, heldBalance) VALUES ?",
      [accountBatch]
    );
  }

  console.log(`  Rebuilt ${accounts.size} accounts from deposit facts`);

  // Replay payment facts → rebuild payments
  const [paymentFacts] = await connection.query(
    "SELECT * FROM payment_facts ORDER BY sequence ASC"
  );

  const payments = new Map();
  
  for (const fact of paymentFacts) {
    if (fact.factType === "PAYMENT_INITIATED") {
      payments.set(fact.paymentId, {
        paymentId: fact.paymentId,
        fromAccount: fact.fromAccount,
        toAccount: fact.toAccount,
        amount: fact.amount,
        currency: fact.currency,
        scheme: fact.scheme,
        state: "INITIATED",
        idempotencyKey: fact.idempotencyKey,
      });
    }
  }

  // Insert rebuilt payments
  if (payments.size > 0) {
    const paymentBatch = Array.from(payments.values()).map((pay) => [
      pay.paymentId,
      pay.fromAccount,
      pay.toAccount,
      pay.amount,
      pay.currency,
      pay.scheme,
      pay.state,
      pay.idempotencyKey,
    ]);

    await connection.query(
      "INSERT INTO payments (paymentId, fromAccount, toAccount, amount, currency, scheme, state, idempotencyKey) VALUES ?",
      [paymentBatch]
    );
  }

  console.log(`  Rebuilt ${payments.size} payments from payment facts`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  const throughput = (totalFacts / (duration || 1)).toFixed(0);
  
  console.log(`\n✓ Replay complete in ${duration}s`);
  console.log(`  Throughput: ${throughput} facts/sec`);
  console.log(`  Accounts: ${accounts.size}`);
  console.log(`  Payments: ${payments.size}`);
  
  return { duration, throughput, accounts: accounts.size, payments: payments.size };
}

async function verifyState(connection) {
  console.log("\nVerifying rebuilt state...");
  
  const [accounts] = await connection.query("SELECT COUNT(*) as count FROM deposit_accounts");
  const [payments] = await connection.query("SELECT COUNT(*) as count FROM payments");
  
  console.log(`  Accounts in DB: ${accounts[0].count}`);
  console.log(`  Payments in DB: ${payments[0].count}`);
  
  return { accounts: accounts[0].count, payments: payments[0].count };
}

async function runStressTest() {
  console.log("=".repeat(70));
  console.log("FACT REPLAY STRESS TEST");
  console.log("=".repeat(70));
  console.log(`Target Facts: ${TARGET_FACTS}`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log("=".repeat(70));
  console.log("\nStarting in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  let connection;
  
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log("✓ Connected to database");

    // Phase 1: Generate facts
    const totalFacts = await generateFacts(connection);

    // Phase 2: Drop projections
    await dropProjections(connection);

    // Phase 3: Replay facts
    const replayResults = await replayFacts(connection, totalFacts);

    // Phase 4: Verify state
    const verifyResults = await verifyState(connection);

    // Final report
    console.log("\n" + "=".repeat(70));
    console.log("FACT REPLAY STRESS TEST COMPLETE");
    console.log("=".repeat(70));
    console.log(`Total Facts: ${totalFacts}`);
    console.log(`Replay Duration: ${replayResults.duration}s`);
    console.log(`Replay Throughput: ${replayResults.throughput} facts/sec`);
    console.log(`Accounts Rebuilt: ${verifyResults.accounts}`);
    console.log(`Payments Rebuilt: ${verifyResults.payments}`);
    console.log("=".repeat(70));

  } catch (error) {
    console.error("\n❌ Stress test failed:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

runStressTest();
