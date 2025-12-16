/**
 * Full Restore + Replay Drill
 * 
 * Purpose:
 * - Prove DR is not "on paper"
 * - Prove replay is not "best effort"
 * - Prove ops does not need heroics
 * 
 * Steps:
 * 1. Take backup (record current state)
 * 2. Drop projections (not facts - they're immutable)
 * 3. Replay all facts to rebuild projections
 * 4. Verify state matches pre-drill
 */

import mysql from 'mysql2/promise';
import 'dotenv/config';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL not set');
  process.exit(1);
}

// Parse DATABASE_URL
const url = new URL(DATABASE_URL);
const config = {
  host: url.hostname,
  port: parseInt(url.port) || 3306,
  user: url.username,
  password: url.password,
  database: url.pathname.slice(1),
  ssl: { rejectUnauthorized: false },
};

async function runDrill() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  FULL RESTORE + REPLAY DRILL');
  console.log('  Proving DR is not "on paper"');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  
  const startTime = Date.now();
  const connection = await mysql.createConnection(config);
  
  try {
    // ============================================
    // PHASE 1: TAKE BACKUP (Record current state)
    // ============================================
    console.log('📸 PHASE 1: TAKING BACKUP');
    console.log('─────────────────────────────────────────────────────────────');
    
    // Count facts (source of truth)
    const [paymentFactsCount] = await connection.query('SELECT COUNT(*) as count FROM payment_facts');
    const [depositFactsCount] = await connection.query('SELECT COUNT(*) as count FROM deposit_facts');
    
    // Count projections
    const [paymentsCount] = await connection.query('SELECT COUNT(*) as count FROM payments');
    const [depositAccountsCount] = await connection.query('SELECT COUNT(*) as count FROM deposit_accounts');
    const [depositHoldsCount] = await connection.query('SELECT COUNT(*) as count FROM deposit_holds');
    
    // Capture projection state for verification
    const [paymentsBefore] = await connection.query('SELECT paymentId, state, amount FROM payments ORDER BY paymentId');
    const [accountsBefore] = await connection.query('SELECT accountId, ledgerBalance, availableBalance FROM deposit_accounts ORDER BY accountId');
    
    console.log(`  Payment Facts: ${paymentFactsCount[0].count} (immutable)`);
    console.log(`  Deposit Facts: ${depositFactsCount[0].count} (immutable)`);
    console.log(`  Payments Projection: ${paymentsCount[0].count}`);
    console.log(`  Deposit Accounts Projection: ${depositAccountsCount[0].count}`);
    console.log(`  Deposit Holds Projection: ${depositHoldsCount[0].count}`);
    console.log('');
    
    // ============================================
    // PHASE 2: DROP PROJECTIONS
    // ============================================
    console.log('🗑️  PHASE 2: DROPPING PROJECTIONS');
    console.log('─────────────────────────────────────────────────────────────');
    console.log('  ⚠️  Facts tables remain intact (append-only source of truth)');
    console.log('');
    
    // Delete projection data (not facts!)
    await connection.query('DELETE FROM deposit_holds');
    console.log('  ✓ deposit_holds cleared');
    
    await connection.query('DELETE FROM payments');
    console.log('  ✓ payments cleared');
    
    await connection.query('DELETE FROM deposit_accounts');
    console.log('  ✓ deposit_accounts cleared');
    
    // Verify projections are empty
    const [paymentsEmpty] = await connection.query('SELECT COUNT(*) as count FROM payments');
    const [accountsEmpty] = await connection.query('SELECT COUNT(*) as count FROM deposit_accounts');
    
    console.log('');
    console.log(`  Payments after drop: ${paymentsEmpty[0].count} (should be 0)`);
    console.log(`  Accounts after drop: ${accountsEmpty[0].count} (should be 0)`);
    console.log('');
    
    // ============================================
    // PHASE 3: REPLAY DEPOSIT FACTS
    // ============================================
    console.log('🔄 PHASE 3: REPLAYING DEPOSIT FACTS');
    console.log('─────────────────────────────────────────────────────────────');
    
    // Get all deposit facts ordered by accountId and sequence
    const [depositFacts] = await connection.query(
      'SELECT * FROM deposit_facts ORDER BY accountId, sequence'
    );
    
    console.log(`  Replaying ${depositFacts.length} deposit facts...`);
    
    // Group facts by account
    const accountFacts = {};
    for (const fact of depositFacts) {
      if (!accountFacts[fact.accountId]) {
        accountFacts[fact.accountId] = [];
      }
      accountFacts[fact.accountId].push(fact);
    }
    
    // Replay each account
    let accountsReplayed = 0;
    for (const [accountId, facts] of Object.entries(accountFacts)) {
      let ledgerBalance = 0;
      let availableBalance = 0;
      let customerId = null;
      let productType = null;
      let currency = 'AUD';
      let status = 'OPEN';
      let openedAt = new Date();
      const holds = [];
      
      for (const fact of facts) {
        const factData = typeof fact.factData === 'string' 
          ? JSON.parse(fact.factData) 
          : fact.factData;
        
        if (fact.factType === 'ACCOUNT_OPENED') {
          // Extract customerId from factData or derive from accountId
          customerId = factData.customerId || `CUS-${accountId.slice(4, 16)}`;
          productType = factData.productType || 'SAVINGS';
          currency = factData.currency || 'AUD';
          openedAt = fact.occurredAt;
        } else if (fact.factType === 'POSTING_APPLIED') {
          const posting = factData.posting || factData;
          
          if (posting.type === 'CREDIT') {
            const amt = parseFloat(posting.amount?.amount || 0) / 100;
            ledgerBalance += amt;
            availableBalance += amt;
          } else if (posting.type === 'DEBIT') {
            const amt = parseFloat(posting.amount?.amount || 0) / 100;
            ledgerBalance -= amt;
            availableBalance -= amt;
          } else if (posting.type === 'HOLD_PLACED') {
            const amt = parseFloat(posting.amount?.amount || 0) / 100;
            availableBalance -= amt;
            holds.push({ id: posting.holdId, amount: amt });
          } else if (posting.type === 'HOLD_RELEASED') {
            const holdIndex = holds.findIndex(h => h.id === posting.holdId);
            if (holdIndex >= 0) {
              availableBalance += holds[holdIndex].amount;
              holds.splice(holdIndex, 1);
            }
          }
        } else if (fact.factType === 'ACCOUNT_CLOSED') {
          status = 'CLOSED';
        }
      }
      
      // Insert rebuilt account
      await connection.query(
        `INSERT INTO deposit_accounts 
         (accountId, customerId, productType, currency, status, ledgerBalance, availableBalance, holdCount, openedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [accountId, customerId, productType, currency, status, 
         ledgerBalance.toFixed(2), availableBalance.toFixed(2), holds.length, openedAt]
      );
      
      // Insert active holds
      for (const hold of holds) {
        // Find the hold fact to get details
        const holdFact = facts.find(f => {
          const fd = typeof f.factData === 'string' ? JSON.parse(f.factData) : f.factData;
          return (fd.posting?.holdId === hold.id || fd.holdId === hold.id);
        });
        
        if (holdFact) {
          await connection.query(
            `INSERT INTO deposit_holds 
             (holdId, accountId, amount, currency, holdType, status, placedAt)
             VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)`,
            [hold.id, accountId, hold.amount.toFixed(2), currency, 'PAYMENT', holdFact.occurredAt]
          );
        }
      }
      
      accountsReplayed++;
    }
    
    console.log(`  ✓ Replayed ${accountsReplayed} accounts from facts`);
    console.log('');
    
    // ============================================
    // PHASE 4: REPLAY PAYMENT FACTS
    // ============================================
    console.log('🔄 PHASE 4: REPLAYING PAYMENT FACTS');
    console.log('─────────────────────────────────────────────────────────────');
    
    // Get all payment facts ordered by paymentId and sequence
    const [paymentFacts] = await connection.query(
      'SELECT * FROM payment_facts ORDER BY paymentId, sequence'
    );
    
    console.log(`  Replaying ${paymentFacts.length} payment facts...`);
    
    // Group facts by payment
    const paymentFactsMap = {};
    for (const fact of paymentFacts) {
      if (!paymentFactsMap[fact.paymentId]) {
        paymentFactsMap[fact.paymentId] = [];
      }
      paymentFactsMap[fact.paymentId].push(fact);
    }
    
    // Replay each payment
    let paymentsReplayed = 0;
    for (const [paymentId, facts] of Object.entries(paymentFactsMap)) {
      let state = 'INITIATED';
      let fromAccount = null;
      let toAccount = null;
      let toExternal = null;
      let amount = '0.00';
      let currency = 'AUD';
      let reference = null;
      let description = null;
      let activeHoldId = null;
      let initiatedAt = new Date();
      let settledAt = null;
      let failedAt = null;
      let reversedAt = null;
      let failureReason = null;
      let reversalReason = null;
      
      for (const fact of facts) {
        const factData = typeof fact.factData === 'string' 
          ? JSON.parse(fact.factData) 
          : fact.factData;
        
        if (fact.factType === 'PAYMENT_INITIATED') {
          fromAccount = factData.fromAccount;
          toAccount = factData.toAccount;
          toExternal = factData.toExternal;
          amount = factData.amount;
          currency = factData.currency || 'AUD';
          reference = factData.reference;
          description = factData.description;
          initiatedAt = fact.occurredAt;
        } else if (fact.factType === 'PAYMENT_HOLD_PLACED') {
          state = 'HELD';
          activeHoldId = factData.holdId;
        } else if (fact.factType === 'PAYMENT_SENT') {
          state = 'SENT';
        } else if (fact.factType === 'PAYMENT_SETTLED') {
          state = 'SETTLED';
          settledAt = fact.occurredAt;
          activeHoldId = null;
        } else if (fact.factType === 'PAYMENT_FAILED') {
          state = 'FAILED';
          failedAt = fact.occurredAt;
          failureReason = factData.reason;
        } else if (fact.factType === 'PAYMENT_REVERSED') {
          state = 'REVERSED';
          reversedAt = fact.occurredAt;
          reversalReason = factData.reason;
        }
      }
      
      // Insert rebuilt payment
      await connection.query(
        `INSERT INTO payments 
         (paymentId, fromAccount, toAccount, toExternal, amount, currency, state, 
          reference, description, activeHoldId, failureReason, reversalReason,
          initiatedAt, settledAt, failedAt, reversedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [paymentId, fromAccount, toAccount, toExternal ? JSON.stringify(toExternal) : null,
         amount, currency, state, reference, description, activeHoldId,
         failureReason, reversalReason, initiatedAt, settledAt, failedAt, reversedAt]
      );
      
      paymentsReplayed++;
    }
    
    console.log(`  ✓ Replayed ${paymentsReplayed} payments from facts`);
    console.log('');
    
    // ============================================
    // PHASE 5: VERIFY STATE MATCHES
    // ============================================
    console.log('✅ PHASE 5: VERIFYING STATE');
    console.log('─────────────────────────────────────────────────────────────');
    
    // Count projections after replay
    const [paymentsAfter] = await connection.query('SELECT COUNT(*) as count FROM payments');
    const [accountsAfter] = await connection.query('SELECT COUNT(*) as count FROM deposit_accounts');
    
    console.log(`  Payments: ${paymentsCount[0].count} → ${paymentsAfter[0].count} ${paymentsCount[0].count === paymentsAfter[0].count ? '✓' : '❌'}`);
    console.log(`  Accounts: ${depositAccountsCount[0].count} → ${accountsAfter[0].count} ${depositAccountsCount[0].count === accountsAfter[0].count ? '✓' : '❌'}`);
    
    // Verify payment states match
    const [paymentsAfterData] = await connection.query('SELECT paymentId, state, amount FROM payments ORDER BY paymentId');
    
    let paymentMismatches = 0;
    for (let i = 0; i < paymentsBefore.length; i++) {
      const before = paymentsBefore[i];
      const after = paymentsAfterData.find(p => p.paymentId === before.paymentId);
      
      if (!after) {
        console.log(`  ❌ Payment ${before.paymentId} missing after replay`);
        paymentMismatches++;
      } else if (before.state !== after.state || before.amount !== after.amount) {
        console.log(`  ❌ Payment ${before.paymentId} mismatch: ${before.state}/${before.amount} → ${after.state}/${after.amount}`);
        paymentMismatches++;
      }
    }
    
    // Verify account balances match
    const [accountsAfterData] = await connection.query('SELECT accountId, ledgerBalance, availableBalance FROM deposit_accounts ORDER BY accountId');
    
    let accountMismatches = 0;
    for (let i = 0; i < accountsBefore.length; i++) {
      const before = accountsBefore[i];
      const after = accountsAfterData.find(a => a.accountId === before.accountId);
      
      if (!after) {
        console.log(`  ❌ Account ${before.accountId} missing after replay`);
        accountMismatches++;
      } else if (before.ledgerBalance !== after.ledgerBalance || before.availableBalance !== after.availableBalance) {
        console.log(`  ❌ Account ${before.accountId} balance mismatch: ${before.ledgerBalance}/${before.availableBalance} → ${after.ledgerBalance}/${after.availableBalance}`);
        accountMismatches++;
      }
    }
    
    console.log('');
    
    // ============================================
    // FINAL REPORT
    // ============================================
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  DRILL COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('');
    console.log(`  Duration: ${duration}s`);
    console.log(`  Facts Replayed: ${depositFacts.length + paymentFacts.length}`);
    console.log(`  Accounts Rebuilt: ${accountsReplayed}`);
    console.log(`  Payments Rebuilt: ${paymentsReplayed}`);
    console.log('');
    
    if (paymentMismatches === 0 && accountMismatches === 0) {
      console.log('  ✅ ALL VERIFICATIONS PASSED');
      console.log('');
      console.log('  DR is not "on paper"');
      console.log('  Replay is not "best effort"');
      console.log('  Ops does not need heroics');
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      return { success: true, duration, mismatches: 0 };
    } else {
      console.log(`  ❌ VERIFICATION FAILED`);
      console.log(`  Payment mismatches: ${paymentMismatches}`);
      console.log(`  Account mismatches: ${accountMismatches}`);
      console.log('');
      console.log('═══════════════════════════════════════════════════════════════');
      return { success: false, duration, mismatches: paymentMismatches + accountMismatches };
    }
    
  } finally {
    await connection.end();
  }
}

runDrill()
  .then(result => {
    process.exit(result.success ? 0 : 1);
  })
  .catch(err => {
    console.error('❌ Drill failed with error:', err);
    process.exit(1);
  });
