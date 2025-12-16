#!/usr/bin/env node
/**
 * Deposit Operations Stress Test
 * 
 * Hammers the deposit system with concurrent account operations:
 * - Account creation
 * - Balance queries
 * - Postings (debits/credits)
 * - Hold placements
 */

import { nanoid } from "nanoid";

const API_URL = process.env.API_URL || "http://localhost:3000";
const DURATION_MS = 180000; // 3 minutes
const TARGET_RPS = 5000; // Start aggressive
const OPERATION_MIX = {
  createAccount: 0.10,  // 10%
  queryBalance: 0.40,   // 40%
  posting: 0.30,        // 30%
  placeHold: 0.20,      // 20%
};

let stats = {
  createAccount: { total: 0, success: 0, failed: 0, latencies: [] },
  queryBalance: { total: 0, success: 0, failed: 0, latencies: [] },
  posting: { total: 0, success: 0, failed: 0, latencies: [] },
  placeHold: { total: 0, success: 0, failed: 0, latencies: [] },
};

const createdAccounts = [];

async function createAccount() {
  const start = Date.now();
  const accountId = `ACC-STRESS-${nanoid(8)}`;
  
  try {
    const response = await fetch(`${API_URL}/api/trpc/deposits.createAccount`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        customerId: `CUS-${nanoid(6)}`,
        accountType: "SAVINGS",
        currency: "AUD",
      }),
    });

    const latency = Date.now() - start;
    stats.createAccount.latencies.push(latency);

    if (response.ok) {
      stats.createAccount.success++;
      createdAccounts.push(accountId);
    } else {
      stats.createAccount.failed++;
    }
  } catch (error) {
    stats.createAccount.failed++;
    stats.createAccount.latencies.push(Date.now() - start);
  }

  stats.createAccount.total++;
}

async function queryBalance() {
  if (createdAccounts.length === 0) return;
  
  const start = Date.now();
  const accountId = createdAccounts[Math.floor(Math.random() * createdAccounts.length)];
  
  try {
    const response = await fetch(`${API_URL}/api/trpc/deposits.getAccount?input=${encodeURIComponent(JSON.stringify({ accountId }))}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    const latency = Date.now() - start;
    stats.queryBalance.latencies.push(latency);

    if (response.ok) {
      stats.queryBalance.success++;
    } else {
      stats.queryBalance.failed++;
    }
  } catch (error) {
    stats.queryBalance.failed++;
    stats.queryBalance.latencies.push(Date.now() - start);
  }

  stats.queryBalance.total++;
}

async function createPosting() {
  if (createdAccounts.length === 0) return;
  
  const start = Date.now();
  const accountId = createdAccounts[Math.floor(Math.random() * createdAccounts.length)];
  
  try {
    const response = await fetch(`${API_URL}/api/trpc/deposits.deposit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        amount: "50.00",
        idempotencyKey: nanoid(),
      }),
    });

    const latency = Date.now() - start;
    stats.posting.latencies.push(latency);

    if (response.ok) {
      stats.posting.success++;
    } else {
      stats.posting.failed++;
    }
  } catch (error) {
    stats.posting.failed++;
    stats.posting.latencies.push(Date.now() - start);
  }

  stats.posting.total++;
}

async function placeHold() {
  if (createdAccounts.length === 0) return;
  
  const start = Date.now();
  const accountId = createdAccounts[Math.floor(Math.random() * createdAccounts.length)];
  const paymentId = `PAY-${nanoid(8)}`;
  
  try {
    const response = await fetch(`${API_URL}/api/trpc/deposits.placeHold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accountId,
        amount: "25.00",
        paymentId,
        idempotencyKey: nanoid(),
      }),
    });

    const latency = Date.now() - start;
    stats.placeHold.latencies.push(latency);

    if (response.ok) {
      stats.placeHold.success++;
    } else {
      stats.placeHold.failed++;
    }
  } catch (error) {
    stats.placeHold.failed++;
    stats.placeHold.latencies.push(Date.now() - start);
  }

  stats.placeHold.total++;
}

function selectOperation() {
  const rand = Math.random();
  let cumulative = 0;
  
  for (const [op, probability] of Object.entries(OPERATION_MIX)) {
    cumulative += probability;
    if (rand <= cumulative) {
      return op;
    }
  }
  
  return "queryBalance"; // fallback
}

async function executeOperation() {
  const operation = selectOperation();
  
  switch (operation) {
    case "createAccount":
      await createAccount();
      break;
    case "queryBalance":
      await queryBalance();
      break;
    case "posting":
      await createPosting();
      break;
    case "placeHold":
      await placeHold();
      break;
  }
}

function calculatePercentile(arr, percentile) {
  if (arr.length === 0) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

function printStats() {
  console.log(`\n${"=".repeat(70)}`);
  console.log("DEPOSIT OPERATIONS STRESS TEST RESULTS");
  console.log("=".repeat(70));
  
  for (const [op, data] of Object.entries(stats)) {
    const errorRate = data.total > 0 ? ((data.failed / data.total) * 100).toFixed(2) : 0;
    const avgLatency = data.latencies.length > 0 ? (data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length).toFixed(2) : 0;
    const p95 = calculatePercentile(data.latencies, 95);
    const p99 = calculatePercentile(data.latencies, 99);
    
    console.log(`\n${op.toUpperCase()}:`);
    console.log(`  Total: ${data.total} | Success: ${data.success} | Failed: ${data.failed}`);
    console.log(`  Error Rate: ${errorRate}%`);
    console.log(`  Avg Latency: ${avgLatency}ms | p95: ${p95}ms | p99: ${p99}ms`);
  }
  
  const totalOps = Object.values(stats).reduce((sum, data) => sum + data.total, 0);
  const totalSuccess = Object.values(stats).reduce((sum, data) => sum + data.success, 0);
  const totalFailed = Object.values(stats).reduce((sum, data) => sum + data.failed, 0);
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`TOTAL OPERATIONS: ${totalOps}`);
  console.log(`SUCCESS: ${totalSuccess} | FAILED: ${totalFailed}`);
  console.log(`OVERALL ERROR RATE: ${totalOps > 0 ? ((totalFailed / totalOps) * 100).toFixed(2) : 0}%`);
  console.log(`ACCOUNTS CREATED: ${createdAccounts.length}`);
  console.log("=".repeat(70));
}

async function runStressTest() {
  console.log("=".repeat(70));
  console.log("DEPOSIT OPERATIONS STRESS TEST");
  console.log("=".repeat(70));
  console.log(`Target RPS: ${TARGET_RPS}`);
  console.log(`Duration: ${DURATION_MS / 1000}s`);
  console.log(`Operation Mix:`);
  for (const [op, prob] of Object.entries(OPERATION_MIX)) {
    console.log(`  ${op}: ${(prob * 100).toFixed(0)}%`);
  }
  console.log("=".repeat(70));
  console.log("\nStarting in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const startTime = Date.now();
  let operationCount = 0;

  const intervalId = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= DURATION_MS) {
      clearInterval(intervalId);
      console.log("\n\nSTRESS TEST COMPLETE");
      printStats();
      process.exit(0);
    }

    // Fire operations at target RPS
    const opsThisSecond = TARGET_RPS;
    const delayBetweenOps = 1000 / opsThisSecond;

    for (let i = 0; i < opsThisSecond; i++) {
      setTimeout(() => executeOperation(), i * delayBetweenOps);
    }

    operationCount += opsThisSecond;

    // Print progress every 10 seconds
    if (elapsed % 10000 < 1000) {
      const rps = (operationCount / (elapsed / 1000)).toFixed(0);
      const totalOps = Object.values(stats).reduce((sum, data) => sum + data.total, 0);
      const totalFailed = Object.values(stats).reduce((sum, data) => sum + data.failed, 0);
      const errorRate = totalOps > 0 ? ((totalFailed / totalOps) * 100).toFixed(2) : 0;
      console.log(`[${(elapsed / 1000).toFixed(0)}s] ${totalOps} ops | ${rps} ops/sec | ${errorRate}% errors | ${createdAccounts.length} accounts`);
    }
  }, 1000);
}

runStressTest();
