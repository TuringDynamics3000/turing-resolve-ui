# Automated DR Drill Schedule

## Overview

The automated DR drill script runs weekly to ensure replay capability never regresses. It verifies that all payment and deposit facts can be replayed to reconstruct system state.

## Script Location

```
/home/ubuntu/turing-resolve-ui/scripts/automated-dr-drill.mjs
```

## Cron Schedule

Add this line to your crontab to run the drill every Sunday at 2:00 AM:

```bash
0 2 * * 0 cd /home/ubuntu/turing-resolve-ui && node scripts/automated-dr-drill.mjs >> /var/log/turing-dr-drill.log 2>&1
```

### Install Cron Job

```bash
# Edit crontab
crontab -e

# Add the line above, then save and exit
```

## Manual Execution

To run the drill manually:

```bash
cd /home/ubuntu/turing-resolve-ui
node scripts/automated-dr-drill.mjs
```

## What the Drill Does

1. **Backup Current State** - Records row counts for payments, deposit accounts, and facts
2. **Drop Projections** - Truncates projection tables (payments, deposit_accounts, deposit_holds)
3. **Verify Empty State** - Confirms projections are empty
4. **Replay Facts** - Replays all deposit and payment facts in sequence
5. **Verify State** - Confirms replayed state matches original state
6. **Record Audit Fact** - Logs drill result (SUCCESS or FAILURE) in audit_facts table

## Success Criteria

- All payment facts replayed successfully
- All deposit facts replayed successfully
- Rebuilt payment count matches original
- Rebuilt account count matches original
- No errors during replay

## Failure Handling

If the drill fails:
- An audit fact with `actionType: "DR_DRILL_FAILED"` is recorded
- The script exits with code 1
- The error is logged to the cron log file

## Monitoring

Check drill results in the audit log:

```sql
SELECT * FROM audit_facts 
WHERE actionType IN ('DR_DRILL_COMPLETED', 'DR_DRILL_FAILED') 
ORDER BY occurredAt DESC 
LIMIT 10;
```

Or view the cron log:

```bash
tail -f /var/log/turing-dr-drill.log
```

## Compliance Reporting

Generate a compliance report of all DR drills:

```sql
SELECT 
  auditId,
  actionType,
  result,
  resultReason,
  occurredAt
FROM audit_facts
WHERE actorRole = 'AUTOMATED_DR_DRILL'
ORDER BY occurredAt DESC;
```

## Notes

- The drill does NOT affect fact tables (they are append-only and never truncated)
- The drill only drops and rebuilds projection tables
- The drill is safe to run in production (facts are the source of truth)
- The drill proves DR readiness without requiring actual disaster recovery
