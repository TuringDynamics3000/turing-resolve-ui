"use client";

import { useState, useEffect } from "react";

/**
 * Evidence Pack Viewer - Unified view of TuringCore-v3 decision evidence
 * 
 * PURPOSE:
 * - Query TuringCore-v3 governance.listEvidencePacks endpoint
 * - Display decision evidence with full audit trail
 * - Link to payment/deposit facts
 * - Export evidence pack to PDF for board packs
 * 
 * BOUNDARIES:
 * - Read-only (no mutations)
 * - Evidence packs are truth from TuringCore-v3
 * - Used for Risk Brain Reporter board pack generation
 */

interface EvidencePack {
  decisionId: string;
  entityType: string;
  entityId: string;
  outcome: "ALLOW" | "REVIEW" | "DECLINE";
  timestamp: string;
  policyEvaluations: Array<{
    policyId: string;
    result: "PASS" | "FAIL" | "REVIEW";
    reasoning: string;
  }>;
  factReferences: string[];
  cryptographicHash: string;
}

export default function EvidencePacksPage() {
  const [evidencePacks, setEvidencePacks] = useState<EvidencePack[]>([]);
  const [selectedPack, setSelectedPack] = useState<EvidencePack | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{
    entityType?: string;
    outcome?: string;
  }>({});

  useEffect(() => {
    fetchEvidencePacks();
  }, [filter]);

  const fetchEvidencePacks = async () => {
    setLoading(true);
    try {
      // In production, this would query TuringCore-v3
      // const response = await fetch(`${turingCoreUrl}/api/trpc/governance.listEvidencePacks`, {
      //   method: "POST",
      //   headers: { "Content-Type": "application/json" },
      //   body: JSON.stringify(filter),
      // });
      // const data = await response.json();
      
      // Mock data for demonstration
      const mockPacks: EvidencePack[] = [
        {
          decisionId: "DEC-001",
          entityType: "PAYMENT",
          entityId: "PAY-chmi41O8au5I",
          outcome: "ALLOW",
          timestamp: "2024-12-16T10:30:00Z",
          policyEvaluations: [
            { policyId: "POL-001", result: "PASS", reasoning: "Payment amount within limit" },
            { policyId: "POL-002", result: "PASS", reasoning: "No fraud indicators detected" },
          ],
          factReferences: ["FACT-001", "FACT-002"],
          cryptographicHash: "sha256:a1b2c3d4e5f6...",
        },
        {
          decisionId: "DEC-002",
          entityType: "DEPOSIT",
          entityId: "ACC-001",
          outcome: "REVIEW",
          timestamp: "2024-12-16T09:15:00Z",
          policyEvaluations: [
            { policyId: "POL-003", result: "REVIEW", reasoning: "Large deposit requires manual review" },
          ],
          factReferences: ["FACT-003"],
          cryptographicHash: "sha256:f6e5d4c3b2a1...",
        },
      ];

      setEvidencePacks(mockPacks);
    } catch (error) {
      console.error("Failed to fetch evidence packs:", error);
    } finally {
      setLoading(false);
    }
  };

  const exportToPDF = (pack: EvidencePack) => {
    // In production, this would generate a PDF evidence pack
    console.log("Exporting evidence pack to PDF:", pack.decisionId);
    alert(`Evidence pack ${pack.decisionId} exported to PDF (demo)`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Evidence Pack Viewer</h1>
          <p className="text-slate-400">
            Unified view of TuringCore-v3 decision evidence for Risk Brain Reporter
          </p>
        </div>

        {/* Boundary Banner */}
        <div className="bg-blue-900/30 border border-blue-500/50 rounded-lg p-4 mb-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h3 className="text-blue-400 font-semibold">Read-Only Evidence Viewer</h3>
              <p className="text-blue-200/80 text-sm mt-1">
                Evidence packs are immutable truth from TuringCore-v3 Resolve. No modifications possible.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Entity Type</label>
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100"
                value={filter.entityType || ""}
                onChange={(e) => setFilter({ ...filter, entityType: e.target.value || undefined })}
              >
                <option value="">All Types</option>
                <option value="PAYMENT">Payment</option>
                <option value="DEPOSIT">Deposit</option>
                <option value="LOAN">Loan</option>
                <option value="EXPOSURE">Exposure</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Outcome</label>
              <select
                className="w-full bg-slate-700 border border-slate-600 rounded px-3 py-2 text-slate-100"
                value={filter.outcome || ""}
                onChange={(e) => setFilter({ ...filter, outcome: e.target.value || undefined })}
              >
                <option value="">All Outcomes</option>
                <option value="ALLOW">Allow</option>
                <option value="REVIEW">Review</option>
                <option value="DECLINE">Decline</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => setFilter({})}
                className="w-full bg-slate-700 hover:bg-slate-600 border border-slate-600 rounded px-4 py-2 text-slate-100 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Evidence Packs List */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Evidence Packs</h2>
            
            {loading ? (
              <p className="text-slate-400">Loading evidence packs...</p>
            ) : evidencePacks.length === 0 ? (
              <p className="text-slate-400">No evidence packs found</p>
            ) : (
              <div className="space-y-3">
                {evidencePacks.map((pack) => (
                  <div
                    key={pack.decisionId}
                    onClick={() => setSelectedPack(pack)}
                    className={`p-4 rounded-lg border cursor-pointer transition-colors ${
                      selectedPack?.decisionId === pack.decisionId
                        ? "bg-blue-900/30 border-blue-500/50"
                        : "bg-slate-700/30 border-slate-600 hover:border-slate-500"
                    }`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-mono text-sm text-slate-300">{pack.decisionId}</p>
                        <p className="text-xs text-slate-400">{pack.entityType} • {pack.entityId}</p>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        pack.outcome === "ALLOW" ? "bg-green-900/50 text-green-300" :
                        pack.outcome === "REVIEW" ? "bg-amber-900/50 text-amber-300" :
                        "bg-red-900/50 text-red-300"
                      }`}>
                        {pack.outcome}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">
                      {new Date(pack.timestamp).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Evidence Pack Detail */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4">Evidence Detail</h2>
            
            {selectedPack ? (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Decision ID</h3>
                  <p className="font-mono text-sm text-slate-100">{selectedPack.decisionId}</p>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Policy Evaluations</h3>
                  <div className="space-y-2">
                    {selectedPack.policyEvaluations.map((eval, idx) => (
                      <div key={idx} className="bg-slate-700/30 border border-slate-600 rounded p-3">
                        <div className="flex justify-between items-start mb-1">
                          <p className="font-mono text-xs text-slate-300">{eval.policyId}</p>
                          <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                            eval.result === "PASS" ? "bg-green-900/50 text-green-300" :
                            eval.result === "REVIEW" ? "bg-amber-900/50 text-amber-300" :
                            "bg-red-900/50 text-red-300"
                          }`}>
                            {eval.result}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">{eval.reasoning}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Fact References</h3>
                  <div className="flex flex-wrap gap-2">
                    {selectedPack.factReferences.map((factId) => (
                      <span key={factId} className="px-2 py-1 bg-slate-700/50 border border-slate-600 rounded text-xs font-mono text-slate-300">
                        {factId}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Cryptographic Hash</h3>
                  <p className="font-mono text-xs text-slate-400 break-all">{selectedPack.cryptographicHash}</p>
                </div>

                <button
                  onClick={() => exportToPDF(selectedPack)}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded transition-colors"
                >
                  Export to PDF
                </button>
              </div>
            ) : (
              <p className="text-slate-400">Select an evidence pack to view details</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
