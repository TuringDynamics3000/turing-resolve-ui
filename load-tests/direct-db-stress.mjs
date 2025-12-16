#!/usr/bin/env node
/**
 * Direct Database Load Test
 * 
 * Bypasses HTTP/tRPC and tests core database throughput directly.
 * Simulates maximum fact ingestion rate.
 */

import { nanoid } from "nanoid";
import mysql from "mysql2/promise";

const DB_CONFIG = {
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "turingcore",
  connectionLimit: 100, // Max connections
};

const DURATION_MS = 60000; // 1 minute
const BATCH_SIZE = 100;
const TARGET_FACTS_PER_SEC = 10000;

let stats = {
  paymentFacts: 0,
  depositFacts: 0,
  auditFacts: 0,
  shadowAIFacts: 0,
  errors: 0,
  totalLatency: 0,
  latencies: [],
};

async function insertPaymentFactBatch(connection, count) {
  const start = Date.now();
  const batch = [];
  
  for (let i = 0; i < count; i++) {
    const paymentId = `PAY-STRESS-${nanoid(8)}`;
    batch.push([
      nanoid(),
      paymentId,
      "PAYMENT_INITIATED",
      stats.paymentFacts + i + 1,
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
  }

  try {
    await connection.query(
      `INSERT INTO payment_facts (factId, paymentId, factType, sequence, occurredAt, fromAccount, toAccount, amount, currency, scheme, idempotencyKey, externalRef, hash) VALUES ?`,
      [batch]
    );
    
    stats.paymentFacts += count;
    const latency = Date.now() - start;
    stats.totalLatency += latency;
    stats.latencies.push(latency);
  } catch (error) {
    stats.errors++;
  }
}

async function insertDepositFactBatch(connection, count) {
  const start = Date.now();
  const batch = [];
  
  for (let i = 0; i < count; i++) {
    const accountId = `ACC-STRESS-${nanoid(8)}`;
    batch.push([
      nanoid(),
      accountId,
      "ACCOUNT_OPENED",
      stats.depositFacts + i + 1,
      new Date(),
      "SAVINGS",
      "AUD",
      nanoid(),
      null,
      null,
      null,
    ]);
  }

  try {
    await connection.query(
      `INSERT INTO deposit_facts (factId, accountId, factType, sequence, occurredAt, accountType, currency, idempotencyKey, postingType, amount, hash) VALUES ?`,
      [batch]
    );
    
    stats.depositFacts += count;
    const latency = Date.now() - start;
    stats.totalLatency += latency;
    stats.latencies.push(latency);
  } catch (error) {
    stats.errors++;
  }
}

async function insertAuditFactBatch(connection, count) {
  const start = Date.now();
  const batch = [];
  
  for (let i = 0; i < count; i++) {
    batch.push([
      nanoid(),
      `operator-${nanoid(4)}`,
      "OPERATOR",
      "PAYMENT_RETRY",
      "PAYMENT",
      `PAY-${nanoid(8)}`,
      "Retry failed payment",
      "SUCCESS",
      null,
      new Date(),
    ]);
  }

  try {
    await connection.query(
      `INSERT INTO audit_facts (auditId, actor, actorRole, actionType, targetType, targetId, reason, result, resultReason, occurredAt) VALUES ?`,
      [batch]
    );
    
    stats.auditFacts += count;
    const latency = Date.now() - start;
    stats.totalLatency += latency;
    stats.latencies.push(latency);
  } catch (error) {
    stats.errors++;
  }
}

async function insertShadowAIFactBatch(connection, count) {
  const start = Date.now();
  const batch = [];
  
  const domains = ["PAYMENTS_RL", "FRAUD", "AML", "TREASURY"];
  const recommendations = ["APPROVE", "DECLINE", "REVIEW", "HOLD"];
  
  for (let i = 0; i < count; i++) {
    batch.push([
      nanoid(),
      domains[Math.floor(Math.random() * domains.length)],
      "PAYMENT",
      `PAY-${nanoid(8)}`,
      recommendations[Math.floor(Math.random() * recommendations.length)],
      Math.random(),
      "AI model reasoning",
      "model-v1.0",
      "RL",
      new Date(),
    ]);
  }

  try {
    await connection.query(
      `INSERT INTO shadow_ai_advisory_facts (advisoryId, domain, entityType, entityId, recommendation, confidence, reasoning, modelVersion, modelType, occurredAt) VALUES ?`,
      [batch]
    );
    
    stats.shadowAIFacts += count;
    const latency = Date.now() - start;
    stats.totalLatency += latency;
    stats.latencies.push(latency);
  } catch (error) {
    stats.errors++;
  }
}

function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

function printStats(elapsed) {
  const totalFacts = stats.paymentFacts + stats.depositFacts + stats.auditFacts + stats.shadowAIFacts;
  const factsPerSec = (totalFacts / (elapsed / 1000)).toFixed(0);
  const avgLatency = stats.latencies.length > 0 ? (stats.totalLatency / stats.latencies.length).toFixed(2) : 0;
  const p95 = calculatePercentile(stats.latencies, 95);
  const p99 = calculatePercentile(stats.latencies, 99);
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`[${(elapsed / 1000).toFixed(0)}s] DIRECT DATABASE LOAD TEST`);
  console.log("=".repeat(70));
  console.log(`Payment Facts: ${stats.paymentFacts}`);
  console.log(`Deposit Facts: ${stats.depositFacts}`);
  console.log(`Audit Facts: ${stats.auditFacts}`);
  console.log(`Shadow AI Facts: ${stats.shadowAIFacts}`);
  console.log(`Total Facts: ${totalFacts}`);
  console.log(`Errors: ${stats.errors}`);
  console.log(`Facts/sec: ${factsPerSec}`);
  console.log(`Avg Batch Latency: ${avgLatency}ms`);
  console.log(`p95 Batch Latency: ${p95}ms`);
  console.log(`p99 Batch Latency: ${p99}ms`);
  console.log("=".repeat(70));
}

async function runStressTest() {
  console.log("=".repeat(70));
  console.log("DIRECT DATABASE LOAD TEST");
  console.log("=".repeat(70));
  console.log(`Target: ${TARGET_FACTS_PER_SEC} facts/sec`);
  console.log(`Duration: ${DURATION_MS / 1000}s`);
  console.log(`Batch Size: ${BATCH_SIZE}`);
  console.log("=".repeat(70));
  console.log("\nStarting in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  let connection;
  
  try {
    connection = await mysql.createConnection(DB_CONFIG);
    console.log("✓ Connected to database\n");

    const startTime = Date.now();
    const batchesPerSec = Math.ceil(TARGET_FACTS_PER_SEC / BATCH_SIZE);
    const delayBetweenBatches = 1000 / batchesPerSec;

    const intervalId = setInterval(async () => {
      const elapsed = Date.now() - startTime;
      
      if (elapsed >= DURATION_MS) {
        clearInterval(intervalId);
        
        console.log("\n\nLOAD TEST COMPLETE");
        printStats(elapsed);
        
        process.exit(0);
      }

      // Fire batches
      const factTypes = ["payment", "deposit", "audit", "shadowAI"];
      const factType = factTypes[Math.floor(Math.random() * factTypes.length)];
      
      switch (factType) {
        case "payment":
          await insertPaymentFactBatch(connection, BATCH_SIZE);
          break;
        case "deposit":
          await insertDepositFactBatch(connection, BATCH_SIZE);
          break;
        case "audit":
          await insertAuditFactBatch(connection, BATCH_SIZE);
          break;
        case "shadowAI":
          await insertShadowAIFactBatch(connection, BATCH_SIZE);
          break;
      }

      // Print progress every 5 seconds
      if (elapsed % 5000 < delayBetweenBatches) {
        printStats(elapsed);
      }
    }, delayBetweenBatches);

  } catch (error) {
    console.error("\n❌ Load test failed:", error.message);
    process.exit(1);
  }
}

runStressTest();
