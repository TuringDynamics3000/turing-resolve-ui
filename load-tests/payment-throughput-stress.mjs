#!/usr/bin/env node
/**
 * Payment Throughput Stress Test
 * 
 * Ramps up payment creation until the system breaks.
 * Finds the maximum sustainable throughput.
 */

import { nanoid } from "nanoid";

const API_URL = process.env.API_URL || "http://localhost:3000";
const RAMP_DURATION_MS = 60000; // 1 minute ramp
const SUSTAINED_DURATION_MS = 120000; // 2 minutes sustained
const INITIAL_RPS = 10; // Start at 10 req/sec
const MAX_RPS = 10000; // Try to reach 10K req/sec
const RAMP_STEP_MS = 5000; // Increase every 5 seconds

let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let totalLatency = 0;
let latencies = [];

async function initiatePayment() {
  const start = Date.now();
  
  try {
    const response = await fetch(`${API_URL}/api/trpc/payments.initiatePayment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        fromAccount: `ACC-LOAD-${nanoid(6)}`,
        toAccount: `ACC-LOAD-${nanoid(6)}`,
        amount: "100.00",
        currency: "AUD",
        scheme: "INTERNAL",
        idempotencyKey: nanoid(),
      }),
    });

    const latency = Date.now() - start;
    totalLatency += latency;
    latencies.push(latency);

    if (response.ok) {
      successfulRequests++;
    } else {
      failedRequests++;
    }
  } catch (error) {
    failedRequests++;
    const latency = Date.now() - start;
    totalLatency += latency;
    latencies.push(latency);
  }

  totalRequests++;
}

function calculatePercentile(arr, percentile) {
  const sorted = arr.slice().sort((a, b) => a - b);
  const index = Math.ceil((percentile / 100) * sorted.length) - 1;
  return sorted[index] || 0;
}

function printStats() {
  const avgLatency = totalRequests > 0 ? (totalLatency / totalRequests).toFixed(2) : 0;
  const p50 = calculatePercentile(latencies, 50);
  const p95 = calculatePercentile(latencies, 95);
  const p99 = calculatePercentile(latencies, 99);
  const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : 0;

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Total Requests: ${totalRequests}`);
  console.log(`Successful: ${successfulRequests}`);
  console.log(`Failed: ${failedRequests}`);
  console.log(`Error Rate: ${errorRate}%`);
  console.log(`Avg Latency: ${avgLatency}ms`);
  console.log(`p50 Latency: ${p50}ms`);
  console.log(`p95 Latency: ${p95}ms`);
  console.log(`p99 Latency: ${p99}ms`);
  console.log(`${"=".repeat(60)}\n`);
}

async function runStressTest() {
  console.log("=".repeat(60));
  console.log("PAYMENT THROUGHPUT STRESS TEST");
  console.log("=".repeat(60));
  console.log(`Target: Ramp from ${INITIAL_RPS} to ${MAX_RPS} req/sec`);
  console.log(`Ramp Duration: ${RAMP_DURATION_MS / 1000}s`);
  console.log(`Sustained Duration: ${SUSTAINED_DURATION_MS / 1000}s`);
  console.log(`API URL: ${API_URL}`);
  console.log("=".repeat(60));
  console.log("\nStarting in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const startTime = Date.now();
  let currentRPS = INITIAL_RPS;
  let intervalId;

  // Ramp phase
  console.log("RAMP PHASE: Increasing load...\n");
  
  const rampInterval = setInterval(() => {
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= RAMP_DURATION_MS) {
      clearInterval(rampInterval);
      console.log("\nRAMP PHASE COMPLETE");
      printStats();
      
      // Sustained phase
      console.log("SUSTAINED PHASE: Holding max load...\n");
      
      const sustainedStart = Date.now();
      const sustainedInterval = setInterval(() => {
        const sustainedElapsed = Date.now() - sustainedStart;
        
        if (sustainedElapsed >= SUSTAINED_DURATION_MS) {
          clearInterval(sustainedInterval);
          clearInterval(intervalId);
          
          console.log("\nSUSTAINED PHASE COMPLETE");
          printStats();
          
          console.log("\n" + "=".repeat(60));
          console.log("STRESS TEST COMPLETE");
          console.log("=".repeat(60));
          console.log(`\nMax Sustainable RPS: ${currentRPS}`);
          console.log(`Total Test Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
          printStats();
          
          process.exit(0);
        }
      }, 1000);
      
      return;
    }

    // Increase RPS
    if (elapsed % RAMP_STEP_MS === 0 && elapsed > 0) {
      currentRPS = Math.min(currentRPS * 1.5, MAX_RPS);
      console.log(`[${(elapsed / 1000).toFixed(0)}s] Ramping to ${currentRPS.toFixed(0)} req/sec`);
    }
  }, 100);

  // Fire requests at current RPS
  intervalId = setInterval(async () => {
    const requestsThisSecond = currentRPS;
    const delayBetweenRequests = 1000 / requestsThisSecond;

    for (let i = 0; i < requestsThisSecond; i++) {
      setTimeout(() => initiatePayment(), i * delayBetweenRequests);
    }

    // Print progress every 5 seconds
    if (totalRequests % (currentRPS * 5) < currentRPS) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      const rps = (totalRequests / (elapsed || 1)).toFixed(0);
      const errorRate = totalRequests > 0 ? ((failedRequests / totalRequests) * 100).toFixed(2) : 0;
      console.log(`[${elapsed}s] ${totalRequests} requests | ${rps} req/sec | ${errorRate}% errors`);
    }
  }, 1000);
}

runStressTest();
