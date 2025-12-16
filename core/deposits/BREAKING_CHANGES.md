# Deposits Core v1 - Breaking Change Checklist

## STOP. READ THIS FIRST.

If you are modifying anything in `/core/deposits/`, you are potentially making a **breaking banking change**.

This is not a normal code change. This affects:
- Customer balances
- Regulatory compliance
- Audit trails
- Replay determinism

## Before ANY Change

### 1. Is This Really Necessary?

Ask yourself:
- [ ] Can this be solved in the **policy layer** instead?
- [ ] Can this be solved in the **application layer** instead?
- [ ] Is this a **new version** of existing behavior (create v2, don't edit v1)?
- [ ] Have I discussed this with the **platform leads**?

If you answered "yes" to any of the first three, **do not modify core**.

### 2. Classification

What type of change is this?

| Type | Examples | Review Required |
|------|----------|-----------------|
| **Invariant Change** | Balance calculation, hold logic | Platform Lead + Compliance + Legal |
| **New Posting Type** | Adding a new posting variant | Platform Lead + API Stewards |
| **Error Code Change** | Modifying error messages/codes | Platform Lead |
| **Serialization Change** | JSON format, field names | Platform Lead + All Consumers |
| **Bug Fix** | Correcting incorrect behavior | Platform Lead |

### 3. Impact Assessment

Complete this assessment:

- [ ] **Replay Safety**: Will existing facts replay to the same state?
- [ ] **Backward Compatibility**: Will existing consumers break?
- [ ] **Audit Trail**: Will historical records remain valid?
- [ ] **Test Coverage**: Are all edge cases covered?
- [ ] **Documentation**: Is the change documented?

### 4. Required Approvals

| Change Type | Required Approvers |
|-------------|-------------------|
| Any invariant change | @deposits-core-maintainers + @platform-leads + @compliance |
| New posting type | @deposits-core-maintainers + @platform-leads |
| Error code change | @deposits-core-maintainers |
| Bug fix | @deposits-core-maintainers |

### 5. Testing Requirements

Before merging:

- [ ] All existing tests pass (44+ tests)
- [ ] New tests added for the change
- [ ] Replay proof test passes
- [ ] Shadow mode comparison shows no regressions
- [ ] Property-based tests pass

### 6. Rollout Plan

- [ ] Feature flag for gradual rollout
- [ ] Rollback plan documented
- [ ] Monitoring alerts configured
- [ ] On-call team notified

---

## Absolute Rules (No Exceptions)

1. **Never delete tests** - only add
2. **Never modify released policy versions** - create new version
3. **Never bypass invariants** - if invariant is wrong, fix it properly
4. **Never add side effects to core** - no DB, no HTTP, no logging
5. **Never add time-dependent logic** - time is passed explicitly

---

## Emergency Procedures

If a critical bug is found in production:

1. **Do not hotfix core directly**
2. Contact @platform-leads immediately
3. Document the issue in detail
4. Create a proper fix with full review
5. Deploy with feature flag

---

## Change Log

| Date | Change | Author | Approvers |
|------|--------|--------|-----------|
| 2024-12-16 | Initial v1 release | Platform Team | @platform-leads |

---

## Contact

For questions about this process:
- Slack: #deposits-core
- Email: deposits-core@company.com
