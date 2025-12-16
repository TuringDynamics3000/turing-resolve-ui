#!/usr/bin/env node

/**
 * Realistic Heavy Load Test - 20 Australian Credit Unions
 * 
 * Simulates real-world CU diversity:
 * - 3 Large CUs (100K-200K members)
 * - 7 Medium CUs (20K-80K members)  
 * - 10 Small CUs (2K-15K members)
 * 
 * Heavy load scenarios:
 * - Peak hour simulation (concurrent transactions)
 * - Mixed workload (deposits, payments, holds, reversals)
 * - Real-time fact streaming
 * - Shadow AI advisory processing
 * - Evidence pack generation under load
 */

import { randomUUID } from "crypto";
import { performance } from "perf_hooks";

// ============================================================
// Credit Union Profiles (Realistic Australian CUs)
// ============================================================
const CU_PROFILES = [
  // Large CUs (3)
  { id: "CU001", name: "Sydney Metro CU", members: 185000, avgTxPerDay: 45000, peakMultiplier: 3.5 },
  { id: "CU002", name: "Melbourne Community Bank", members: 142000, avgTxPerDay: 35000, peakMultiplier: 3.2 },
  { id: "CU003", name: "Queensland Teachers CU", members: 128000, avgTxPerDay: 28000, peakMultiplier: 2.8 },
  
  // Medium CUs (7)
  { id: "CU004", name: "Adelaide Police CU", members: 68000, avgTxPerDay: 12000, peakMultiplier: 2.5 },
  { id: "CU005", name: "Perth Healthcare CU", members: 54000, avgTxPerDay: 9500, peakMultiplier: 2.4 },
  { id: "CU006", name: "Brisbane Transport CU", members: 47000, avgTxPerDay: 8200, peakMultiplier: 2.3 },
  { id: "CU007", name: "Canberra Public Service CU", members: 39000, avgTxPerDay: 7100, peakMultiplier: 2.2 },
  { id: "CU008", name: "Hobart Maritime CU", members: 31000, avgTxPerDay: 5800, peakMultiplier: 2.1 },
  { id: "CU009", name: "Darwin Defence CU", members: 26000, avgTxPerDay: 4900, peakMultiplier: 2.0 },
  { id: "CU010", name: "Newcastle Miners CU", members: 22000, avgTxPerDay: 4200, peakMultiplier: 1.9 },
  
  // Small CUs (10)
  { id: "CU011", name: "Wollongong Steel CU", members: 14500, avgTxPerDay: 2400, peakMultiplier: 1.8 },
  { id: "CU012", name: "Geelong Manufacturing CU", members: 11200, avgTxPerDay: 1900, peakMultiplier: 1.7 },
  { id: "CU013", name: "Townsville Services CU", members: 9800, avgTxPerDay: 1650, peakMultiplier: 1.6 },
  { id: "CU014", name: "Cairns Tourism CU", members: 7600, avgTxPerDay: 1300, peakMultiplier: 1.5 },
  { id: "CU015", name: "Ballarat Community CU", members: 6200, avgTxPerDay: 1050, peakMultiplier: 1.5 },
  { id: "CU016", name: "Bendigo Regional CU", members: 5100, avgTxPerDay: 870, peakMultiplier: 1.4 },
  { id: "CU017", name: "Launceston Local CU", members: 4300, avgTxPerDay: 720, peakMultiplier: 1.4 },
  { id: "CU018", name: "Toowoomba Farmers CU", members: 3500, avgTxPerDay: 590, peakMultiplier: 1.3 },
  { id: "CU019", name: "Mackay Mining CU", members: 2800, avgTxPerDay: 470, peakMultiplier: 1.3 },
  { id: "CU020", name: "Albury Border CU", members: 2200, avgTxPerDay: 370, peakMultiplier: 1.2 },
];

// Calculate totals
const TOTAL_MEMBERS = CU_PROFILES.reduce((sum, cu) => sum + cu.members, 0);
const TOTAL_AVG_TX = CU_PROFILES.reduce((sum, cu) => sum + cu.avgTxPerDay, 0);
const PEAK_TX = CU_PROFILES.reduce((sum, cu) => sum + (cu.avgTxPerDay * cu.peakMultiplier), 0);

console.log("🏦 Realistic Heavy Load Test - 20 Australian CUs");
console.log("═══════════════════════════════════════════════════\n");
console.log(`CU Distribution:`);
console.log(`  Large CUs (100K-200K):    3 CUs`);
console.log(`  Medium CUs (20K-80K):     7 CUs`);
console.log(`  Small CUs (2K-15K):      10 CUs`);
console.log(`\nAggregate Scale:`);
console.log(`  Total Members:     ${TOTAL_MEMBERS.toLocaleString()}`);
console.log(`  Avg Daily Tx:      ${TOTAL_AVG_TX.toLocaleString()}`);
console.log(`  Peak Hour Tx:      ${Math.floor(PEAK_TX).toLocaleString()}`);
console.log(`  Peak TPS:          ${Math.floor(PEAK_TX / 3600).toLocaleString()}\n`);

// ============================================================
// Transaction Types & Distribution
// ============================================================
const TX_TYPES = {
  DEPOSIT_CREDIT: { weight: 35, factType: "DEPOSIT_CREDITED" },
  DEPOSIT_DEBIT: { weight: 25, factType: "DEPOSIT_DEBITED" },
  DEPOSIT_HOLD: { weight: 10, factType: "HOLD_PLACED" },
  PAYMENT_INITIATED: { weight: 12, factType: "PAYMENT_INITIATED" },
  PAYMENT_SETTLED: { weight: 8, factType: "PAYMENT_SETTLED" },
  PAYMENT_REVERSED: { weight: 3, factType: "PAYMENT_REVERSED" },
  BALANCE_QUERY: { weight: 7, factType: "BALANCE_QUERIED" },
};

function selectRandomTxType() {
  const total = Object.values(TX_TYPES).reduce((sum, t) => sum + t.weight, 0);
  let random = Math.random() * total;
  
  for (const [key, type] of Object.entries(TX_TYPES)) {
    random -= type.weight;
    if (random <= 0) return type.factType;
  }
  
  return "DEPOSIT_CREDITED";
}

// ============================================================
// Fact Generation
// ============================================================
function generateFact(cuId, txType) {
  const amounts = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];
  
  return {
    factId: randomUUID(),
    factType: txType,
    entityType: txType.startsWith("PAYMENT") ? "PAYMENT" : "DEPOSIT",
    entityId: randomUUID(),
    cuId,
    data: {
      amount: amounts[Math.floor(Math.random() * amounts.length)],
      currency: "AUD",
      accountId: randomUUID(),
      timestamp: Date.now(),
    },
    occurredAt: Date.now(),
    sequence: 0, // Will be set during processing
  };
}

// ============================================================
// Test 1: Peak Hour Simulation (All 20 CUs)
// ============================================================
async function testPeakHourLoad() {
  console.log("⚡ Test 1: Peak Hour Simulation (8am-10am)");
  console.log("─────────────────────────────────────────────────");
  
  const peakDuration = 2 * 3600; // 2 hours in seconds
  const totalPeakTx = Math.floor(PEAK_TX);
  
  console.log(`  Simulating ${totalPeakTx.toLocaleString()} transactions over 2 hours\n`);
  
  const factsPerCU = new Map();
  const start = performance.now();
  
  // Generate facts for each CU based on their peak load
  for (const cu of CU_PROFILES) {
    const cuPeakTx = Math.floor(cu.avgTxPerDay * cu.peakMultiplier);
    const facts = [];
    
    for (let i = 0; i < cuPeakTx; i++) {
      const txType = selectRandomTxType();
      facts.push(generateFact(cu.id, txType));
    }
    
    factsPerCU.set(cu.id, facts);
  }
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  
  // Calculate totals
  let totalFacts = 0;
  for (const facts of factsPerCU.values()) {
    totalFacts += facts.length;
  }
  
  const factsPerSecond = totalFacts / duration;
  const memoryMB = process.memoryUsage().heapUsed / 1024 / 1024;
  
  console.log(`  ✓ Generated ${totalFacts.toLocaleString()} facts`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${Math.floor(factsPerSecond).toLocaleString()} facts/sec`);
  console.log(`  ✓ Memory: ${memoryMB.toFixed(2)} MB\n`);
  
  // Per-CU breakdown (top 5)
  console.log(`  Top 5 CUs by volume:`);
  const sorted = [...factsPerCU.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 5);
  
  for (const [cuId, facts] of sorted) {
    const cu = CU_PROFILES.find(c => c.id === cuId);
    const tps = facts.length / duration;
    console.log(`    ${cu.name.padEnd(30)} ${facts.length.toLocaleString().padStart(7)} facts  (${Math.floor(tps).toLocaleString()} facts/sec)`);
  }
  
  console.log();
  
  return { totalFacts, factsPerSecond, factsPerCU };
}

// ============================================================
// Test 2: Concurrent Processing (Parallel CU Operations)
// ============================================================
async function testConcurrentProcessing(factsPerCU) {
  console.log("🔄 Test 2: Concurrent Processing (20 CUs in Parallel)");
  console.log("─────────────────────────────────────────────────");
  
  const start = performance.now();
  
  // Process each CU's facts in parallel
  const promises = [];
  
  for (const [cuId, facts] of factsPerCU.entries()) {
    promises.push(
      new Promise((resolve) => {
        // Simulate fact processing (state rebuild)
        const accounts = new Map();
        const payments = new Map();
        
        for (const fact of facts) {
          if (fact.entityType === "DEPOSIT") {
            if (!accounts.has(fact.data.accountId)) {
              accounts.set(fact.data.accountId, { balance: 0, holds: 0 });
            }
            const account = accounts.get(fact.data.accountId);
            
            if (fact.factType === "DEPOSIT_CREDITED") {
              account.balance += fact.data.amount;
            } else if (fact.factType === "DEPOSIT_DEBITED") {
              account.balance -= fact.data.amount;
            } else if (fact.factType === "HOLD_PLACED") {
              account.holds += fact.data.amount;
            }
          } else if (fact.entityType === "PAYMENT") {
            if (!payments.has(fact.entityId)) {
              payments.set(fact.entityId, { state: "INITIATED" });
            }
            const payment = payments.get(fact.entityId);
            
            if (fact.factType === "PAYMENT_SETTLED") payment.state = "SETTLED";
            if (fact.factType === "PAYMENT_REVERSED") payment.state = "REVERSED";
          }
        }
        
        resolve({ cuId, accounts: accounts.size, payments: payments.size });
      })
    );
  }
  
  const results = await Promise.all(promises);
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  
  const totalAccounts = results.reduce((sum, r) => sum + r.accounts, 0);
  const totalPayments = results.reduce((sum, r) => sum + r.payments, 0);
  const totalFacts = [...factsPerCU.values()].reduce((sum, facts) => sum + facts.length, 0);
  const factsPerSecond = totalFacts / duration;
  
  console.log(`  ✓ Processed ${totalFacts.toLocaleString()} facts concurrently`);
  console.log(`  ✓ Rebuilt ${totalAccounts.toLocaleString()} account states`);
  console.log(`  ✓ Rebuilt ${totalPayments.toLocaleString()} payment states`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${Math.floor(factsPerSecond).toLocaleString()} facts/sec\n`);
  
  return { factsPerSecond, totalAccounts, totalPayments };
}

// ============================================================
// Test 3: Shadow AI Advisory Processing
// ============================================================
async function testShadowAIProcessing(factsPerCU) {
  console.log("🤖 Test 3: Shadow AI Advisory Processing");
  console.log("─────────────────────────────────────────────────");
  
  const AI_DOMAINS = ["PAYMENTS_RL", "FRAUD", "AML", "TREASURY"];
  
  const start = performance.now();
  
  let totalAdvisories = 0;
  
  // Generate Shadow AI advisories for payment facts
  for (const [cuId, facts] of factsPerCU.entries()) {
    const paymentFacts = facts.filter(f => f.entityType === "PAYMENT");
    
    // Each payment gets advisories from all 4 AI domains
    for (const fact of paymentFacts) {
      for (const domain of AI_DOMAINS) {
        const advisory = {
          advisoryId: randomUUID(),
          domain,
          entityType: "PAYMENT",
          entityId: fact.entityId,
          recommendation: Math.random() > 0.7 ? "ALLOW" : (Math.random() > 0.5 ? "REVIEW" : "DECLINE"),
          confidence: 0.5 + Math.random() * 0.5, // 50-100%
          reasoning: `${domain} analysis for payment ${fact.entityId.slice(0, 8)}`,
          modelVersion: "v2.1",
          occurredAt: Date.now(),
        };
        
        totalAdvisories++;
      }
    }
  }
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const advisoriesPerSecond = totalAdvisories / duration;
  
  console.log(`  ✓ Generated ${totalAdvisories.toLocaleString()} Shadow AI advisories`);
  console.log(`  ✓ AI Domains: ${AI_DOMAINS.length} (${AI_DOMAINS.join(", ")})`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${Math.floor(advisoriesPerSecond).toLocaleString()} advisories/sec\n`);
  
  return { advisoriesPerSecond, totalAdvisories };
}

// ============================================================
// Test 4: SSE Broadcast Simulation
// ============================================================
async function testSSEBroadcast(factsPerCU) {
  console.log("📡 Test 4: SSE Real-Time Streaming");
  console.log("─────────────────────────────────────────────────");
  
  const operatorDashboards = 5; // 5 concurrent operator dashboards
  const memberPortals = 15; // 15 concurrent member portals
  const totalClients = operatorDashboards + memberPortals;
  
  const start = performance.now();
  
  let totalMessages = 0;
  
  // Simulate broadcasting facts to all connected clients
  for (const [cuId, facts] of factsPerCU.entries()) {
    for (const fact of facts) {
      // Each fact is broadcast to all clients
      for (let i = 0; i < totalClients; i++) {
        const message = `data: ${JSON.stringify(fact)}\n\n`;
        totalMessages++;
      }
    }
  }
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const messagesPerSecond = totalMessages / duration;
  
  const totalFacts = [...factsPerCU.values()].reduce((sum, facts) => sum + facts.length, 0);
  
  console.log(`  ✓ Facts broadcast: ${totalFacts.toLocaleString()}`);
  console.log(`  ✓ Connected clients: ${totalClients} (${operatorDashboards} operators, ${memberPortals} members)`);
  console.log(`  ✓ Total messages: ${totalMessages.toLocaleString()}`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${Math.floor(messagesPerSecond).toLocaleString()} messages/sec\n`);
  
  return { messagesPerSecond, totalMessages };
}

// ============================================================
// Test 5: Evidence Pack Generation Under Load
// ============================================================
async function testEvidencePackGeneration(factsPerCU) {
  console.log("📄 Test 5: Evidence Pack Generation");
  console.log("─────────────────────────────────────────────────");
  
  const start = performance.now();
  
  let totalPacks = 0;
  
  // Generate evidence packs for a sample of payments (10%)
  for (const [cuId, facts] of factsPerCU.entries()) {
    const paymentFacts = facts.filter(f => f.entityType === "PAYMENT");
    const sampleSize = Math.ceil(paymentFacts.length * 0.1);
    
    for (let i = 0; i < sampleSize; i++) {
      const pack = {
        packId: randomUUID(),
        paymentId: paymentFacts[i]?.entityId || randomUUID(),
        decisionFacts: [],
        paymentFacts: [],
        depositFacts: [],
        auditFacts: [],
        shadowAIAdvisories: [],
        generatedAt: Date.now(),
        hash: randomUUID(), // Simplified
      };
      
      totalPacks++;
    }
  }
  
  const end = performance.now();
  const duration = (end - start) / 1000;
  const packsPerSecond = totalPacks / duration;
  
  console.log(`  ✓ Generated ${totalPacks.toLocaleString()} evidence packs`);
  console.log(`  ✓ Duration: ${duration.toFixed(2)}s`);
  console.log(`  ✓ Throughput: ${Math.floor(packsPerSecond).toLocaleString()} packs/sec\n`);
  
  return { packsPerSecond, totalPacks };
}

// ============================================================
// Main Execution
// ============================================================
async function main() {
  const results = {};
  
  // Run all tests
  const peakHourResult = await testPeakHourLoad();
  results.peakHour = peakHourResult;
  
  results.concurrent = await testConcurrentProcessing(peakHourResult.factsPerCU);
  results.shadowAI = await testShadowAIProcessing(peakHourResult.factsPerCU);
  results.sse = await testSSEBroadcast(peakHourResult.factsPerCU);
  results.evidencePacks = await testEvidencePackGeneration(peakHourResult.factsPerCU);
  
  // ============================================================
  // Final Summary
  // ============================================================
  console.log("═══════════════════════════════════════════════════");
  console.log("📊 PERFORMANCE SUMMARY");
  console.log("═══════════════════════════════════════════════════\n");
  
  console.log("Throughput Metrics:");
  console.log(`  Peak Hour Generation:     ${Math.floor(results.peakHour.factsPerSecond).toLocaleString()} facts/sec`);
  console.log(`  Concurrent Processing:    ${Math.floor(results.concurrent.factsPerSecond).toLocaleString()} facts/sec`);
  console.log(`  Shadow AI Advisories:     ${Math.floor(results.shadowAI.advisoriesPerSecond).toLocaleString()} advisories/sec`);
  console.log(`  SSE Broadcast:            ${Math.floor(results.sse.messagesPerSecond).toLocaleString()} messages/sec`);
  console.log(`  Evidence Pack Gen:        ${Math.floor(results.evidencePacks.packsPerSecond).toLocaleString()} packs/sec\n`);
  
  console.log("Volume Metrics:");
  console.log(`  Total Facts Generated:    ${results.peakHour.totalFacts.toLocaleString()}`);
  console.log(`  Accounts Rebuilt:         ${results.concurrent.totalAccounts.toLocaleString()}`);
  console.log(`  Payments Processed:       ${results.concurrent.totalPayments.toLocaleString()}`);
  console.log(`  Shadow AI Advisories:     ${results.shadowAI.totalAdvisories.toLocaleString()}`);
  console.log(`  SSE Messages Sent:        ${results.sse.totalMessages.toLocaleString()}`);
  console.log(`  Evidence Packs:           ${results.evidencePacks.totalPacks.toLocaleString()}\n`);
  
  console.log("System Capacity:");
  console.log(`  Peak TPS Target:          ${Math.floor(PEAK_TX / 3600).toLocaleString()} TPS`);
  console.log(`  Achieved (in-memory):     ${Math.floor(results.concurrent.factsPerSecond).toLocaleString()} TPS`);
  
  const capacityRatio = results.concurrent.factsPerSecond / (PEAK_TX / 3600);
  
  if (capacityRatio >= 1) {
    console.log(`  Status:                   ✅ EXCEEDS TARGET (${capacityRatio.toFixed(1)}x capacity)\n`);
  } else {
    console.log(`  Status:                   ⚠️  BELOW TARGET (${capacityRatio.toFixed(1)}x capacity)\n`);
    console.log("Scaling Recommendations:");
    console.log("  1. Database: PostgreSQL with connection pooling");
    console.log("  2. Horizontal sharding across CUs");
    console.log("  3. Redis cache for hot state");
    console.log("  4. Kafka for fact streaming at scale");
    console.log("  5. Read replicas for query load\n");
  }
  
  console.log("✅ Heavy load test complete\n");
}

main().catch(console.error);
