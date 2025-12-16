/**
 * Divergence Logger
 * 
 * Logs all divergences detected during shadow mode comparison.
 * Provides classification, trending, and reporting capabilities.
 * 
 * CRITICAL: Every divergence is logged. No silent failures.
 */

import type {
  Divergence,
  DivergenceType,
  ShadowComparisonResult,
} from '../types';

export interface DivergenceStats {
  total: number;
  byType: Record<DivergenceType, number>;
  bySeverity: Record<string, number>;
  byField: Record<string, number>;
  matchRate: number;
  lastUpdated: string;
}

export interface DivergenceTrend {
  period: string;
  total: number;
  matchRate: number;
  topIssues: Array<{ field: string; count: number; type: DivergenceType }>;
}

export class DivergenceLogger {
  private divergences: Divergence[] = [];
  private comparisons: ShadowComparisonResult[] = [];
  private readonly maxRetention: number;

  constructor(maxRetention: number = 10000) {
    this.maxRetention = maxRetention;
  }

  /**
   * Log a comparison result.
   */
  log(result: ShadowComparisonResult): void {
    this.comparisons.push(result);
    
    for (const divergence of result.divergences) {
      this.divergences.push(divergence);
      this.logToConsole(divergence);
    }

    // Trim if over retention limit
    if (this.divergences.length > this.maxRetention) {
      this.divergences = this.divergences.slice(-this.maxRetention);
    }
    if (this.comparisons.length > this.maxRetention) {
      this.comparisons = this.comparisons.slice(-this.maxRetention);
    }
  }

  /**
   * Log divergence to console with classification.
   */
  private logToConsole(divergence: Divergence): void {
    const icon = this.getIcon(divergence.type);
    const color = this.getColor(divergence.severity);
    
    console.log(
      `${icon} [SHADOW DIVERGENCE] ${divergence.type} | ` +
      `${divergence.field}: ${divergence.legacyValue} → ${divergence.coreV1Value}` +
      (divergence.delta ? ` (Δ${divergence.delta})` : '') +
      ` | Severity: ${divergence.severity}` +
      ` | Account: ${divergence.accountId}` +
      ` | Operation: ${divergence.operationId}`
    );
  }

  private getIcon(type: DivergenceType): string {
    switch (type) {
      case 'BUG': return '🐛';
      case 'POLICY_DIFFERENCE': return '📋';
      case 'ROUNDING_ARTEFACT': return '🔢';
      case 'TIMING': return '⏱️';
      case 'MISSING_FEATURE': return '🚧';
      case 'UNKNOWN': return '❓';
    }
  }

  private getColor(severity: string): string {
    switch (severity) {
      case 'CRITICAL': return 'red';
      case 'HIGH': return 'orange';
      case 'MEDIUM': return 'yellow';
      case 'LOW': return 'gray';
      default: return 'white';
    }
  }

  /**
   * Get current statistics.
   */
  getStats(): DivergenceStats {
    const byType: Record<DivergenceType, number> = {
      BUG: 0,
      POLICY_DIFFERENCE: 0,
      ROUNDING_ARTEFACT: 0,
      TIMING: 0,
      MISSING_FEATURE: 0,
      UNKNOWN: 0,
    };

    const bySeverity: Record<string, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };

    const byField: Record<string, number> = {};

    for (const d of this.divergences) {
      byType[d.type]++;
      bySeverity[d.severity]++;
      byField[d.field] = (byField[d.field] || 0) + 1;
    }

    const matches = this.comparisons.filter(c => c.match).length;
    const matchRate = this.comparisons.length > 0 
      ? (matches / this.comparisons.length) * 100 
      : 100;

    return {
      total: this.divergences.length,
      byType,
      bySeverity,
      byField,
      matchRate,
      lastUpdated: new Date().toISOString(),
    };
  }

  /**
   * Get divergences filtered by type.
   */
  getByType(type: DivergenceType): Divergence[] {
    return this.divergences.filter(d => d.type === type);
  }

  /**
   * Get divergences filtered by severity.
   */
  getBySeverity(severity: Divergence['severity']): Divergence[] {
    return this.divergences.filter(d => d.severity === severity);
  }

  /**
   * Get divergences for a specific account.
   */
  getByAccount(accountId: string): Divergence[] {
    return this.divergences.filter(d => d.accountId === accountId);
  }

  /**
   * Get trend data for the last N periods.
   */
  getTrends(periodMinutes: number = 60, periods: number = 24): DivergenceTrend[] {
    const trends: DivergenceTrend[] = [];
    const now = Date.now();
    const periodMs = periodMinutes * 60 * 1000;

    for (let i = 0; i < periods; i++) {
      const periodEnd = now - (i * periodMs);
      const periodStart = periodEnd - periodMs;

      const periodComparisons = this.comparisons.filter(c => {
        const time = new Date(c.comparedAt).getTime();
        return time >= periodStart && time < periodEnd;
      });

      const periodDivergences = this.divergences.filter(d => {
        const time = new Date(d.detectedAt).getTime();
        return time >= periodStart && time < periodEnd;
      });

      // Count by field
      const fieldCounts: Record<string, { count: number; type: DivergenceType }> = {};
      for (const d of periodDivergences) {
        if (!fieldCounts[d.field]) {
          fieldCounts[d.field] = { count: 0, type: d.type };
        }
        fieldCounts[d.field].count++;
      }

      const topIssues = Object.entries(fieldCounts)
        .map(([field, data]) => ({ field, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      const matches = periodComparisons.filter(c => c.match).length;
      const matchRate = periodComparisons.length > 0 
        ? (matches / periodComparisons.length) * 100 
        : 100;

      trends.push({
        period: new Date(periodStart).toISOString(),
        total: periodDivergences.length,
        matchRate,
        topIssues,
      });
    }

    return trends.reverse();
  }

  /**
   * Export all divergences as JSON.
   */
  export(): string {
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      stats: this.getStats(),
      divergences: this.divergences,
      comparisons: this.comparisons.map(c => ({
        operationId: c.operationId,
        accountId: c.accountId,
        comparedAt: c.comparedAt,
        match: c.match,
        divergenceCount: c.divergences.length,
      })),
    }, null, 2);
  }

  /**
   * Generate a summary report.
   */
  generateReport(): string {
    const stats = this.getStats();
    const trends = this.getTrends(60, 24);

    let report = `
# Shadow Mode Divergence Report
Generated: ${new Date().toISOString()}

## Summary
- Total Comparisons: ${this.comparisons.length}
- Total Divergences: ${stats.total}
- Match Rate: ${stats.matchRate.toFixed(2)}%

## Divergences by Type
| Type | Count | % |
|------|-------|---|
${Object.entries(stats.byType)
  .filter(([_, count]) => count > 0)
  .map(([type, count]) => `| ${type} | ${count} | ${((count / stats.total) * 100).toFixed(1)}% |`)
  .join('\n')}

## Divergences by Severity
| Severity | Count |
|----------|-------|
${Object.entries(stats.bySeverity)
  .filter(([_, count]) => count > 0)
  .map(([severity, count]) => `| ${severity} | ${count} |`)
  .join('\n')}

## Top Divergent Fields
| Field | Count |
|-------|-------|
${Object.entries(stats.byField)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 10)
  .map(([field, count]) => `| ${field} | ${count} |`)
  .join('\n')}

## Recommendations
${this.generateRecommendations(stats)}
`;

    return report;
  }

  private generateRecommendations(stats: DivergenceStats): string {
    const recommendations: string[] = [];

    if (stats.byType.BUG > 0) {
      recommendations.push(`- 🐛 **${stats.byType.BUG} bugs detected** - Review and fix Core v1 implementation`);
    }

    if (stats.byType.ROUNDING_ARTEFACT > 0) {
      recommendations.push(`- 🔢 **${stats.byType.ROUNDING_ARTEFACT} rounding artefacts** - Consider if bigint precision is causing acceptable differences`);
    }

    if (stats.byType.POLICY_DIFFERENCE > 0) {
      recommendations.push(`- 📋 **${stats.byType.POLICY_DIFFERENCE} policy differences** - Document intentional behavior changes`);
    }

    if (stats.byType.MISSING_FEATURE > 0) {
      recommendations.push(`- 🚧 **${stats.byType.MISSING_FEATURE} missing features** - Prioritize implementation`);
    }

    if (stats.matchRate < 99) {
      recommendations.push(`- ⚠️ **Match rate below 99%** - Do not proceed to production cutover`);
    } else if (stats.matchRate >= 99.9) {
      recommendations.push(`- ✅ **Match rate at ${stats.matchRate.toFixed(2)}%** - Ready for production consideration`);
    }

    return recommendations.join('\n');
  }

  /**
   * Clear all logged data.
   */
  clear(): void {
    this.divergences = [];
    this.comparisons = [];
  }
}
