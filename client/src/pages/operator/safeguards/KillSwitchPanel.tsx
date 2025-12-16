import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Power, AlertTriangle, Loader2 } from "lucide-react";

export function KillSwitchPanel() {
  const { data: safeguards, isLoading } = trpc.payments.getSafeguards.useQuery();
  const [reason, setReason] = useState("");
  const [showForm, setShowForm] = useState(false);

  const utils = trpc.useUtils();

  // Note: These mutations would need to be implemented in the backend
  // For now, showing the UI structure
  const killSwitch = safeguards?.killSwitch?.npp;
  const isActive = killSwitch?.state !== "ENABLED";

  if (isLoading) {
    return (
      <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-slate-700 rounded w-32 mb-4" />
        <div className="h-20 bg-slate-700 rounded" />
      </div>
    );
  }

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <Power className="w-5 h-5 text-red-400" />
        NPP Kill Switch
      </h3>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Current State</span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            isActive 
              ? "bg-red-500/20 text-red-400" 
              : "bg-green-500/20 text-green-400"
          }`}>
            {isActive ? "ACTIVE (Payments Blocked)" : "INACTIVE"}
          </span>
        </div>

        {killSwitch && (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-500">Last Changed</span>
              <span className="text-slate-300">
                {killSwitch.lastChanged 
                  ? new Date(killSwitch.lastChanged).toLocaleString()
                  : "Never"}
              </span>
            </div>
            {killSwitch.reason && (
              <div className="text-sm">
                <span className="text-slate-500">Reason: </span>
                <span className="text-slate-300">{killSwitch.reason}</span>
              </div>
            )}
          </>
        )}

        {isActive && (
          <div className="bg-red-950/30 border border-red-500/30 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-400 mt-0.5" />
              <div>
                <p className="text-sm text-red-300 font-medium">Kill Switch Active</p>
                <p className="text-xs text-red-400/80 mt-1">
                  All NPP payments are currently blocked. No new payments will be processed.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-700">
          <p className="text-xs text-slate-500 mb-3">
            Kill switch control requires elevated permissions. Contact system administrator.
          </p>
          <button
            disabled
            className="w-full px-4 py-2 bg-slate-700 text-slate-500 rounded-lg cursor-not-allowed"
          >
            {isActive ? "Disable Kill Switch" : "Enable Kill Switch"}
          </button>
        </div>
      </div>
    </div>
  );
}
