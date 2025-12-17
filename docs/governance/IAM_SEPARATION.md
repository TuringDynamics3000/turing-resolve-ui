# Environment & IAM Separation Governance

**Status:** ENFORCED  
**Effective Date:** 2024-12-18  
**Last Updated:** 2024-12-18  
**Owner:** TuringDynamics Engineering

---

## Executive Summary

Each environment (development, staging, production) MUST have isolated credentials and configuration. Cross-environment access is PROHIBITED. This prevents "demo shortcuts" from reaching production and ensures security boundaries are structural, not procedural.

---

## The Invariant

> **No credential from one environment may be used in another environment.**

This means:
- Production credentials are ONLY used in production
- Staging credentials are ONLY used in staging
- Development credentials are ONLY used in development
- No shared secrets across environments
- No "just use the prod key for testing"

---

## Environment Definitions

| Environment | Purpose | Data | Access |
|-------------|---------|------|--------|
| **Development** | Local development, experimentation | Synthetic/mock | Developers |
| **Staging** | Pre-production testing, integration | Anonymized copy | Engineering team |
| **Production** | Live customer data, real transactions | Real customer data | Authorized operators only |

---

## Credential Isolation

### Naming Convention

All environment-specific credentials MUST be prefixed with the environment name:

```bash
# Development
DEVELOPMENT_DATABASE_URL=...
DEVELOPMENT_API_KEY=...
DEVELOPMENT_ENCRYPTION_KEY=...

# Staging
STAGING_DATABASE_URL=...
STAGING_API_KEY=...
STAGING_ENCRYPTION_KEY=...

# Production
PRODUCTION_DATABASE_URL=...
PRODUCTION_API_KEY=...
PRODUCTION_ENCRYPTION_KEY=...
```

### Required Credentials Per Environment

| Credential | Dev | Staging | Prod | Notes |
|------------|-----|---------|------|-------|
| `{ENV}_DATABASE_URL` | ✓ | ✓ | ✓ | Primary database connection |
| `{ENV}_DATABASE_READ_REPLICA_URL` | - | ✓ | ✓ | Read replica for queries |
| `{ENV}_API_KEY` | ✓ | ✓ | ✓ | Internal API authentication |
| `{ENV}_API_SECRET` | ✓ | ✓ | ✓ | API secret for signing |
| `{ENV}_ENCRYPTION_KEY` | ✓ | ✓ | ✓ | Data encryption at rest |
| `{ENV}_NPP_PARTICIPANT_ID` | - | - | ✓ | NPP payment rail |
| `{ENV}_NPP_SIGNING_KEY` | - | - | ✓ | NPP message signing |
| `{ENV}_AUDIT_LOG_ENDPOINT` | - | - | ✓ | External audit logging |

---

## Configuration Differences

### Feature Flags by Environment

| Feature | Dev | Staging | Prod |
|---------|-----|---------|------|
| `shadowMode` | ✓ | ✓ | ✗ |
| `debugLogging` | ✓ | ✓ | ✗ |
| `mockExternalServices` | ✓ | ✗ | ✗ |
| `allowDirectDbAccess` | ✓ | ✗ | ✗ |

### Governance Requirements by Environment

| Requirement | Dev | Staging | Prod |
|-------------|-----|---------|------|
| `requireDecisionGate` | ✗ | ✓ | ✓ |
| `requireEvidencePack` | ✗ | ✓ | ✓ |
| `allowHumanOverride` | ✓ | ✓ | ✗ |
| `auditRetentionDays` | 7 | 30 | 2555 (7 years) |

---

## Enforcement Mechanisms

### 1. Startup Validation

The application validates environment configuration at startup:

```typescript
import { validateEnvironmentOnStartup } from '@/server/core/environment/EnvironmentConfig';

// Called in server initialization
validateEnvironmentOnStartup();

// Throws if:
// - Required credentials missing
// - Cross-environment contamination detected
// - Production-specific requirements not met
```

### 2. Runtime Guards

The `EnvironmentGuard` class enforces boundaries at runtime:

```typescript
import { environmentGuard } from '@/server/core/environment/EnvironmentConfig';

// Check environment
if (environmentGuard.isProduction()) {
  // Production-specific logic
}

// Enforce non-production for dangerous operations
environmentGuard.requireNonProduction('database-reset');

// Check feature flags
if (environmentGuard.isFeatureEnabled('debugLogging')) {
  console.log(debugInfo);
}
```

### 3. CI Enforcement

CI pipeline validates environment isolation:

```yaml
# .github/workflows/environment-check.yml
- name: Check environment isolation
  run: |
    pnpm run check:environment-isolation
    # Fails if:
    # - Hardcoded credentials found
    # - Cross-environment references detected
    # - Production credentials in non-production code
```

---

## Cross-Environment Contamination Detection

The system detects and blocks:

1. **Database URL contamination**
   - Production URL containing "staging", "dev", or "localhost"
   - Staging URL containing "prod"

2. **Credential reuse**
   - Same API key used across environments
   - Same encryption key across environments

3. **Configuration leakage**
   - Production features enabled in development
   - Development shortcuts enabled in production

---

## Production-Specific Requirements

Production startup is blocked if ANY of these are true:

| Check | Requirement |
|-------|-------------|
| `allowDirectDbAccess` | MUST be `false` |
| `mockExternalServices` | MUST be `false` |
| `requireDecisionGate` | MUST be `true` |
| `requireEvidencePack` | MUST be `true` |
| `PROD_DATABASE_URL` | MUST NOT contain "staging", "dev", "localhost" |
| All required credentials | MUST be present |

---

## Secrets Management

### Storage

| Environment | Secrets Storage |
|-------------|-----------------|
| Development | `.env.local` (gitignored) |
| Staging | GitHub Secrets / Vault |
| Production | HashiCorp Vault / AWS Secrets Manager |

### Rotation

| Credential Type | Rotation Frequency |
|-----------------|-------------------|
| API Keys | 90 days |
| Database passwords | 30 days |
| Encryption keys | 365 days (with re-encryption) |
| NPP signing keys | Per NPP requirements |

### Access Control

| Role | Dev | Staging | Prod |
|------|-----|---------|------|
| Developer | ✓ | Read-only | ✗ |
| Senior Engineer | ✓ | ✓ | Read-only |
| Platform Team | ✓ | ✓ | ✓ |
| Security Team | Audit | Audit | ✓ |

---

## Incident Response

### If Production Credentials Are Exposed

1. **Immediate**: Rotate all exposed credentials
2. **Within 1 hour**: Audit access logs for unauthorized use
3. **Within 24 hours**: Root cause analysis
4. **Within 48 hours**: Incident report to security team

### If Cross-Environment Access Is Detected

1. **Immediate**: Block the access path
2. **Within 1 hour**: Identify scope of contamination
3. **Within 24 hours**: Remediate affected systems
4. **Within 48 hours**: Governance exception review

---

## Verification

To verify environment isolation:

```bash
# Check current environment
pnpm run env:check

# Validate credentials for environment
pnpm run env:validate

# Detect cross-environment contamination
pnpm run env:audit

# List all environment-specific config
pnpm run env:list
```

---

## Related Documents

- [EnvironmentConfig.ts](../../server/core/environment/EnvironmentConfig.ts) - Implementation
- [PROTOCOL_ONLY_WRITES.md](./PROTOCOL_ONLY_WRITES.md) - Write enforcement
- [ARCHITECTURE.md](../ARCHITECTURE.md) - System architecture

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2024-12-18 | Initial governance document | TuringDynamics |
