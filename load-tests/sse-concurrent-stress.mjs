#!/usr/bin/env node
/**
 * SSE Concurrent Connections Stress Test
 * 
 * Tests the system's ability to handle many concurrent SSE fact stream connections.
 * Simulates multiple operator consoles watching fact streams in real-time.
 */

import EventSource from "eventsource";

const API_URL = process.env.API_URL || "http://localhost:3000";
const TARGET_CONNECTIONS = 1000;
const RAMP_DURATION_MS = 60000; // 1 minute ramp
const SUSTAINED_DURATION_MS = 120000; // 2 minutes sustained
const CONNECTIONS_PER_STEP = 50;
const STEP_INTERVAL_MS = 3000; // Add 50 connections every 3 seconds

let activeConnections = [];
let totalEventsReceived = 0;
let connectionErrors = 0;
let successfulConnections = 0;

function createSSEConnection(id) {
  return new Promise((resolve, reject) => {
    try {
      const eventSource = new EventSource(`${API_URL}/api/facts/stream`);
      
      eventSource.onopen = () => {
        successfulConnections++;
        console.log(`[Connection ${id}] Opened (${successfulConnections}/${TARGET_CONNECTIONS})`);
      };

      eventSource.onmessage = (event) => {
        totalEventsReceived++;
        
        // Log first event from each connection
        if (totalEventsReceived % 100 === 0) {
          console.log(`[Connection ${id}] Received event (total: ${totalEventsReceived})`);
        }
      };

      eventSource.onerror = (error) => {
        connectionErrors++;
        console.error(`[Connection ${id}] Error:`, error.message);
        eventSource.close();
        reject(error);
      };

      activeConnections.push({ id, eventSource });
      resolve(eventSource);
    } catch (error) {
      connectionErrors++;
      reject(error);
    }
  });
}

function closeAllConnections() {
  console.log(`\nClosing ${activeConnections.length} connections...`);
  
  for (const conn of activeConnections) {
    try {
      conn.eventSource.close();
    } catch (error) {
      console.error(`Error closing connection ${conn.id}:`, error.message);
    }
  }
  
  activeConnections = [];
  console.log("✓ All connections closed");
}

function printStats() {
  console.log(`\n${"=".repeat(70)}`);
  console.log("SSE CONCURRENT CONNECTIONS STRESS TEST RESULTS");
  console.log("=".repeat(70));
  console.log(`Active Connections: ${activeConnections.length}`);
  console.log(`Successful Connections: ${successfulConnections}`);
  console.log(`Connection Errors: ${connectionErrors}`);
  console.log(`Total Events Received: ${totalEventsReceived}`);
  console.log(`Avg Events per Connection: ${activeConnections.length > 0 ? (totalEventsReceived / activeConnections.length).toFixed(2) : 0}`);
  console.log("=".repeat(70));
}

async function runStressTest() {
  console.log("=".repeat(70));
  console.log("SSE CONCURRENT CONNECTIONS STRESS TEST");
  console.log("=".repeat(70));
  console.log(`Target Connections: ${TARGET_CONNECTIONS}`);
  console.log(`Ramp Duration: ${RAMP_DURATION_MS / 1000}s`);
  console.log(`Sustained Duration: ${SUSTAINED_DURATION_MS / 1000}s`);
  console.log(`Connections per Step: ${CONNECTIONS_PER_STEP}`);
  console.log(`Step Interval: ${STEP_INTERVAL_MS / 1000}s`);
  console.log("=".repeat(70));
  console.log("\nStarting in 3 seconds...\n");

  await new Promise((resolve) => setTimeout(resolve, 3000));

  const startTime = Date.now();
  let connectionId = 0;

  // Ramp phase: Gradually add connections
  console.log("RAMP PHASE: Adding connections...\n");
  
  const rampInterval = setInterval(async () => {
    const elapsed = Date.now() - startTime;
    
    if (elapsed >= RAMP_DURATION_MS || activeConnections.length >= TARGET_CONNECTIONS) {
      clearInterval(rampInterval);
      console.log("\nRAMP PHASE COMPLETE");
      printStats();
      
      // Sustained phase: Hold connections open
      console.log("\nSUSTAINED PHASE: Holding connections...\n");
      
      const sustainedStart = Date.now();
      const sustainedInterval = setInterval(() => {
        const sustainedElapsed = Date.now() - sustainedStart;
        
        if (sustainedElapsed >= SUSTAINED_DURATION_MS) {
          clearInterval(sustainedInterval);
          
          console.log("\nSUSTAINED PHASE COMPLETE");
          printStats();
          
          closeAllConnections();
          
          console.log("\n" + "=".repeat(70));
          console.log("SSE STRESS TEST COMPLETE");
          console.log("=".repeat(70));
          console.log(`Total Test Duration: ${((Date.now() - startTime) / 1000).toFixed(2)}s`);
          console.log(`Max Concurrent Connections: ${successfulConnections}`);
          console.log(`Total Events Received: ${totalEventsReceived}`);
          console.log(`Connection Error Rate: ${successfulConnections > 0 ? ((connectionErrors / successfulConnections) * 100).toFixed(2) : 0}%`);
          console.log("=".repeat(70));
          
          process.exit(0);
        }
        
        // Print progress every 10 seconds
        if (sustainedElapsed % 10000 < 1000) {
          console.log(`[${(sustainedElapsed / 1000).toFixed(0)}s] ${activeConnections.length} active | ${totalEventsReceived} events received`);
        }
      }, 1000);
      
      return;
    }

    // Add batch of connections
    const connectionsToAdd = Math.min(CONNECTIONS_PER_STEP, TARGET_CONNECTIONS - activeConnections.length);
    
    console.log(`[${(elapsed / 1000).toFixed(0)}s] Adding ${connectionsToAdd} connections...`);
    
    const promises = [];
    for (let i = 0; i < connectionsToAdd; i++) {
      connectionId++;
      promises.push(createSSEConnection(connectionId).catch((error) => {
        console.error(`Failed to create connection ${connectionId}:`, error.message);
      }));
    }
    
    await Promise.allSettled(promises);
    
  }, STEP_INTERVAL_MS);

  // Handle process termination
  process.on("SIGINT", () => {
    console.log("\n\nReceived SIGINT, cleaning up...");
    closeAllConnections();
    printStats();
    process.exit(0);
  });
}

runStressTest();
