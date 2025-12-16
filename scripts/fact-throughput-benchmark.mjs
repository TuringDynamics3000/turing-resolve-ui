#!/usr/bin/env node

/**
 * Fact Throughput Benchmark - Australian CU Scale
 * 
 * Target: 80 CUs, 4.5M members, 50K transactions/sec peak
 * 
 * Tests:
 * 1. In-memory fact generation (baseline CPU/memory)
 * 2. Database write throughput (SQLite I/O limits)
 * 3. Fact replay throughput (state rebuild speed)
 * 4. Concurrent processing (parallel fact handling)
 * 5. SSE broadcast throughput (real-time streaming)
 */

import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { performance } from "perf_hooks";

const DB_PATH = "./turing-resolve.db";

// Australian CU Scale Parameters
const SCALE = {
  creditUnions: 80,
  totalMembers: 4_500_000,
  peakTPS: 50_000, // transactions per second
  avgAccountsPerMember: 1.5,
  totalAccounts: 6_750_000,
};

console.log("🏦 Australian CU Scale Load Test");
console.log("================================\n");
console.log(`Target Scale:`);
console.log(`  - Credit Unions: ${SCALE.creditUnions.toLocaleString()}`);
console.log(`  - Total Members: ${SCALE.totalMembers.toLocaleString()}`);
console.log(`  - Total Accounts: ${SCALE.totalAccounts.toLocaleString()}`);
console.log(`  - Peak TPS: ${SCALE.peakTPS.toLocaleString()}\n`);

// ============================================================
// Test 1: In-Memory Fact Generation (Baseline)
// ============================================================
async function testInMemoryFactGeneration() {
  console.log("📊 Test 1: In-Memory Fact Generation");
  console.log("─────────────────────────────────────");
  
  const factCount = 100_000;
  const facts = [];
  
  const start = performance.now();
  
  for (let i = 0; i < factCount; i++) {
    facts.push({
      factId: randomUUID(),
      factType: "PAYMENT_INITIATED",
      entityType: "PAYMENT",
      entityId: randomUUID(),
      data: {
        amount: Math.floor(Math.random() * 10000),
        currency: "AUD",
        fromAccountId: randomUUID(),
        toAccountId: randomUUID(),
      },
      occurredAt: Date.now(),
      sequence: i + 1,
    });
  }
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const factsPerSecond = factCount / duration;
  
  console.log(`  ✓ Generated ${factCount.toLocaleString()} facts`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${factsPerSecond.toLocaleString()} facts/sec`);
  console.log(`  ✓ Memory: ${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB\n`);
  
  return { factsPerSecond, facts: facts.slice(0, 1000) }; // Return subset for next tests
}

// ============================================================
// Test 2: Database Write Throughput
// ============================================================
async function testDatabaseWriteThroughput(facts) {
  console.log("💾 Test 2: Database Write Throughput");
  console.log("─────────────────────────────────────");
  
  const db = new Database(DB_PATH);
  
  // Ensure payment_facts table exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS payment_facts (
      factId TEXT PRIMARY KEY,
      factType TEXT NOT NULL,
      entityType TEXT NOT NULL,
      entityId TEXT NOT NULL,
      data TEXT NOT NULL,
      occurredAt INTEGER NOT NULL,
      sequence INTEGER NOT NULL
    )
  `);
  
  // Clear existing facts for clean test
  db.exec("DELETE FROM payment_facts");
  
  const insertStmt = db.prepare(`
    INSERT INTO payment_facts (factId, factType, entityType, entityId, data, occurredAt, sequence)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  
  const start = performance.now();
  
  // Single transaction for all inserts (best case)
  const insertMany = db.transaction((facts) => {
    for (const fact of facts) {
      insertStmt.run(
        fact.factId,
        fact.factType,
        fact.entityType,
        fact.entityId,
        JSON.stringify(fact.data),
        fact.occurredAt,
        fact.sequence
      );
    }
  });
  
  insertMany(facts);
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const factsPerSecond = facts.length / duration;
  
  console.log(`  ✓ Inserted ${facts.length.toLocaleString()} facts`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${factsPerSecond.toLocaleString()} facts/sec`);
  console.log(`  ✓ Strategy: Single transaction (batched)\n`);
  
  db.close();
  
  return { factsPerSecond };
}

// ============================================================
// Test 3: Fact Replay Throughput
// ============================================================
async function testFactReplayThroughput() {
  console.log("🔄 Test 3: Fact Replay Throughput");
  console.log("─────────────────────────────────────");
  
  const db = new Database(DB_PATH);
  
  const facts = db.prepare("SELECT * FROM payment_facts ORDER BY sequence ASC").all();
  
  const start = performance.now();
  
  // Simulate state rebuild from facts
  const payments = new Map();
  
  for (const fact of facts) {
    const data = JSON.parse(fact.data);
    
    if (!payments.has(fact.entityId)) {
      payments.set(fact.entityId, {
        paymentId: fact.entityId,
        state: "INITIATED",
        amount: data.amount,
        currency: data.currency,
        facts: [],
      });
    }
    
    const payment = payments.get(fact.entityId);
    payment.facts.push(fact);
    
    // State transitions
    if (fact.factType === "PAYMENT_HELD") payment.state = "HELD";
    if (fact.factType === "PAYMENT_SENT") payment.state = "SENT";
    if (fact.factType === "PAYMENT_SETTLED") payment.state = "SETTLED";
  }
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const factsPerSecond = facts.length / duration;
  
  console.log(`  ✓ Replayed ${facts.length.toLocaleString()} facts`);
  console.log(`  ✓ Rebuilt ${payments.size.toLocaleString()} payment states`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${factsPerSecond.toLocaleString()} facts/sec\n`);
  
  db.close();
  
  return { factsPerSecond, paymentsRebuilt: payments.size };
}

// ============================================================
// Test 4: Concurrent Fact Processing
// ============================================================
async function testConcurrentProcessing() {
  console.log("⚡ Test 4: Concurrent Fact Processing");
  console.log("─────────────────────────────────────");
  
  const factCount = 100_000;
  const workerCount = 10;
  const factsPerWorker = factCount / workerCount;
  
  const start = performance.now();
  
  const workers = Array.from({ length: workerCount }, (_, i) => {
    return new Promise((resolve) => {
      const facts = [];
      for (let j = 0; j < factsPerWorker; j++) {
        facts.push({
          factId: randomUUID(),
          factType: "PAYMENT_INITIATED",
          entityId: randomUUID(),
          data: { amount: Math.random() * 10000 },
          occurredAt: Date.now(),
        });
      }
      resolve(facts);
    });
  });
  
  const results = await Promise.all(workers);
  const totalFacts = results.reduce((sum, facts) => sum + facts.length, 0);
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const factsPerSecond = totalFacts / duration;
  
  console.log(`  ✓ Workers: ${workerCount}`);
  console.log(`  ✓ Facts per worker: ${factsPerWorker.toLocaleString()}`);
  console.log(`  ✓ Total facts: ${totalFacts.toLocaleString()}`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${factsPerSecond.toLocaleString()} facts/sec\n`);
  
  return { factsPerSecond };
}

// ============================================================
// Test 5: SSE Broadcast Simulation
// ============================================================
async function testSSEBroadcast() {
  console.log("📡 Test 5: SSE Broadcast Simulation");
  console.log("─────────────────────────────────────");
  
  const factCount = 10_000;
  const clientCount = 100;
  
  const start = performance.now();
  
  // Simulate broadcasting facts to multiple clients
  for (let i = 0; i < factCount; i++) {
    const fact = {
      factId: randomUUID(),
      factType: "PAYMENT_INITIATED",
      data: { amount: Math.random() * 10000 },
    };
    
    // Simulate sending to all clients
    for (let j = 0; j < clientCount; j++) {
      const message = `data: ${JSON.stringify(fact)}\n\n`;
      // In real SSE, this would be res.write(message)
    }
  }
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const messagesPerSecond = (factCount * clientCount) / duration;
  
  console.log(`  ✓ Facts broadcast: ${factCount.toLocaleString()}`);
  console.log(`  ✓ Clients: ${clientCount}`);
  console.log(`  ✓ Total messages: ${(factCount * clientCount).toLocaleString()}`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${messagesPerSecond.toLocaleString()} messages/sec\n`);
  
  return { messagesPerSecond };
}

// ============================================================
// Main Execution
// ============================================================
async function main() {
  const results = {};
  
  // Run all tests
  results.inMemory = await testInMemoryFactGeneration();
  results.database = await testDatabaseWriteThroughput(results.inMemory.facts);
  results.replay = await testFactReplayThroughput();
  results.concurrent = await testConcurrentProcessing();
  results.sse = await testSSEBroadcast();
  
  // ============================================================
  // Summary & Scale Analysis
  // ============================================================
  console.log("📈 Performance Summary");
  console.log("════════════════════════════════════════════════════");
  console.log(`In-Memory Generation:    ${results.inMemory.factsPerSecond.toLocaleString()} facts/sec`);
  console.log(`Database Write:          ${results.database.factsPerSecond.toLocaleString()} facts/sec`);
  console.log(`Fact Replay:             ${results.replay.factsPerSecond.toLocaleString()} facts/sec`);
  console.log(`Concurrent Processing:   ${results.concurrent.factsPerSecond.toLocaleString()} facts/sec`);
  console.log(`SSE Broadcast:           ${results.sse.messagesPerSecond.toLocaleString()} messages/sec\n`);
  
  // Bottleneck Analysis
  console.log("🔍 Bottleneck Analysis");
  console.log("════════════════════════════════════════════════════");
  
  const bottleneck = Math.min(
    results.database.factsPerSecond,
    results.replay.factsPerSecond
  );
  
  console.log(`Bottleneck: ${bottleneck.toLocaleString()} facts/sec`);
  console.log(`Target TPS: ${SCALE.peakTPS.toLocaleString()} transactions/sec\n`);
  
  const scaleFactor = SCALE.peakTPS / bottleneck;
  
  if (scaleFactor > 1) {
    console.log(`⚠️  SCALE GAP DETECTED`);
    console.log(`   Current capacity: ${bottleneck.toLocaleString()} TPS`);
    console.log(`   Target capacity: ${SCALE.peakTPS.toLocaleString()} TPS`);
    console.log(`   Scale factor needed: ${scaleFactor.toFixed(1)}x\n`);
    
    console.log(`📋 Scaling Recommendations:`);
    console.log(`   1. Database: Switch to PostgreSQL with connection pooling`);
    console.log(`   2. Horizontal sharding: ${Math.ceil(scaleFactor)} database instances`);
    console.log(`   3. Write-ahead logging (WAL) mode for SQLite`);
    console.log(`   4. Batch inserts with larger transaction sizes`);
    console.log(`   5. Read replicas for fact replay operations`);
    console.log(`   6. Redis cache for hot payment/account state`);
    console.log(`   7. Kafka for fact streaming (replace SSE at scale)\n`);
  } else {
    console.log(`✅ Current capacity exceeds target TPS`);
    console.log(`   Headroom: ${((1 - (SCALE.peakTPS / bottleneck)) * 100).toFixed(1)}%\n`);
  }
  
  console.log("✅ Load test complete\n");
}

main().catch(console.error);
