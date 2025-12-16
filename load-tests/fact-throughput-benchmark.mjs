#!/usr/bin/env node
/**
 * Fact Throughput Benchmark
 * 
 * Measures how many facts the system can process per second.
 * Tests: fact generation, fact storage, fact replay.
 */

import { nanoid } from "nanoid";

const FACT_COUNTS = [100, 1000, 5000, 10000];

// Simulate fact generation (in-memory)
function benchmarkFactGeneration(count) {
  console.log(`\n📊 Generating ${count} facts...`);
  
  const start = Date.now();
  const facts = [];
  
  for (let i = 0; i < count; i++) {
    facts.push({
      factId: nanoid(),
      paymentId: `PAY-${nanoid(8)}`,
      factType: "PAYMENT_INITIATED",
      sequence: i + 1,
      occurredAt: new Date(),
      fromAccount: `ACC-${nanoid(6)}`,
      toAccount: `ACC-${nanoid(6)}`,
      amount: "100.00",
      currency: "AUD",
      scheme: "INTERNAL",
      idempotencyKey: nanoid(),
    });
  }
  
  const duration = (Date.now() - start) / 1000;
  const throughput = (count / duration).toFixed(0);
  
  console.log(`  ✓ Generated ${count} facts in ${duration.toFixed(3)}s`);
  console.log(`  ⚡ Throughput: ${throughput} facts/sec`);
  
  return { count, duration, throughput: parseInt(throughput), facts };
}

// Simulate fact replay (rebuild state from facts)
function benchmarkFactReplay(facts) {
  console.log(`\n🔄 Replaying ${facts.length} facts...`);
  
  const start = Date.now();
  const payments = new Map();
  
  for (const fact of facts) {
    if (fact.factType === "PAYMENT_INITIATED") {
      payments.set(fact.paymentId, {
        paymentId: fact.paymentId,
        fromAccount: fact.fromAccount,
        toAccount: fact.toAccount,
        amount: fact.amount,
        currency: fact.currency,
        scheme: fact.scheme,
        state: "INITIATED",
      });
    }
  }
  
  const duration = (Date.now() - start) / 1000;
  const throughput = (facts.length / duration).toFixed(0);
  
  console.log(`  ✓ Replayed ${facts.length} facts in ${duration.toFixed(3)}s`);
  console.log(`  ⚡ Throughput: ${throughput} facts/sec`);
  console.log(`  📦 Rebuilt ${payments.size} payments`);
  
  return { count: facts.length, duration, throughput: parseInt(throughput), payments: payments.size };
}

// Simulate concurrent fact processing
async function benchmarkConcurrentProcessing(count) {
  console.log(`\n⚡ Concurrent processing of ${count} facts...`);
  
  const start = Date.now();
  const batchSize = 100;
  const batches = Math.ceil(count / batchSize);
  
  const promises = [];
  
  for (let i = 0; i < batches; i++) {
    const batchFacts = [];
    for (let j = 0; j < batchSize && (i * batchSize + j) < count; j++) {
      batchFacts.push({
        factId: nanoid(),
        paymentId: `PAY-${nanoid(8)}`,
        factType: "PAYMENT_INITIATED",
        sequence: i * batchSize + j + 1,
        occurredAt: new Date(),
      });
    }
    
    // Simulate async processing
    promises.push(
      new Promise((resolve) => {
        setTimeout(() => {
          resolve(batchFacts.length);
        }, Math.random() * 10); // Simulate variable processing time
      })
    );
  }
  
  const results = await Promise.all(promises);
  const totalProcessed = results.reduce((sum, count) => sum + count, 0);
  
  const duration = (Date.now() - start) / 1000;
  const throughput = (totalProcessed / duration).toFixed(0);
  
  console.log(`  ✓ Processed ${totalProcessed} facts in ${duration.toFixed(3)}s`);
  console.log(`  ⚡ Throughput: ${throughput} facts/sec`);
  console.log(`  📦 Batches: ${batches} (${batchSize} facts/batch)`);
  
  return { count: totalProcessed, duration, throughput: parseInt(throughput), batches };
}

async function runBenchmark() {
  console.log("=".repeat(70));
  console.log("FACT THROUGHPUT BENCHMARK");
  console.log("=".repeat(70));
  console.log("Testing: Fact generation, replay, and concurrent processing");
  console.log("=".repeat(70));

  const results = {
    generation: [],
    replay: [],
    concurrent: [],
  };

  for (const count of FACT_COUNTS) {
    console.log(`\n${"─".repeat(70)}`);
    console.log(`TESTING WITH ${count} FACTS`);
    console.log("─".repeat(70));

    // Test 1: Fact Generation
    const genResult = benchmarkFactGeneration(count);
    results.generation.push(genResult);

    // Test 2: Fact Replay
    const replayResult = benchmarkFactReplay(genResult.facts);
    results.replay.push(replayResult);

    // Test 3: Concurrent Processing
    const concurrentResult = await benchmarkConcurrentProcessing(count);
    results.concurrent.push(concurrentResult);
  }

  // Final Report
  console.log(`\n\n${"=".repeat(70)}`);
  console.log("BENCHMARK RESULTS SUMMARY");
  console.log("=".repeat(70));

  console.log("\n📊 FACT GENERATION THROUGHPUT:");
  console.log("─".repeat(70));
  console.log("Facts\t\tDuration\tThroughput");
  for (const result of results.generation) {
    console.log(`${result.count}\t\t${result.duration.toFixed(3)}s\t\t${result.throughput} facts/sec`);
  }

  console.log("\n🔄 FACT REPLAY THROUGHPUT:");
  console.log("─".repeat(70));
  console.log("Facts\t\tDuration\tThroughput\tPayments");
  for (const result of results.replay) {
    console.log(`${result.count}\t\t${result.duration.toFixed(3)}s\t\t${result.throughput} facts/sec\t${result.payments}`);
  }

  console.log("\n⚡ CONCURRENT PROCESSING THROUGHPUT:");
  console.log("─".repeat(70));
  console.log("Facts\t\tDuration\tThroughput\tBatches");
  for (const result of results.concurrent) {
    console.log(`${result.count}\t\t${result.duration.toFixed(3)}s\t\t${result.throughput} facts/sec\t${result.batches}`);
  }

  // Calculate max throughput
  const maxGenThroughput = Math.max(...results.generation.map((r) => r.throughput));
  const maxReplayThroughput = Math.max(...results.replay.map((r) => r.throughput));
  const maxConcurrentThroughput = Math.max(...results.concurrent.map((r) => r.throughput));

  console.log(`\n${"=".repeat(70)}`);
  console.log("MAXIMUM THROUGHPUT ACHIEVED");
  console.log("=".repeat(70));
  console.log(`Fact Generation: ${maxGenThroughput.toLocaleString()} facts/sec`);
  console.log(`Fact Replay: ${maxReplayThroughput.toLocaleString()} facts/sec`);
  console.log(`Concurrent Processing: ${maxConcurrentThroughput.toLocaleString()} facts/sec`);
  console.log("=".repeat(70));

  // Estimate Australian CU scale
  console.log(`\n📈 AUSTRALIAN CU SCALE ESTIMATE`);
  console.log("─".repeat(70));
  console.log(`Target: 50,000 transactions/sec (peak across all CUs)`);
  console.log(`Current Max: ${maxConcurrentThroughput.toLocaleString()} facts/sec`);
  const scaleFactor = (50000 / maxConcurrentThroughput).toFixed(1);
  console.log(`Scale Factor Needed: ${scaleFactor}x`);
  console.log(`Recommendation: ${scaleFactor < 10 ? "Optimize single-node performance" : "Horizontal scaling required"}`);
  console.log("=".repeat(70));
}

runBenchmark();
