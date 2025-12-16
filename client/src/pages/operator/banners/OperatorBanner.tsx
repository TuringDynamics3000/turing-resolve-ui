import { Shield, Info } from "lucide-react";

export function OperatorBanner() {
  return (
    <div className="bg-blue-950/50 border border-blue-500/30 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
        <div>
          <h3 className="font-semibold text-blue-300 flex items-center gap-2">
            Operator Control Plane
            <Info className="w-4 h-4 text-blue-500" />
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Operators issue commands and manage safeguards.
            Money moves only when Deposits Core applies facts.
            All actions are audited and produce immutable evidence.
          </p>
        </div>
      </div>
    </div>
  );
}
