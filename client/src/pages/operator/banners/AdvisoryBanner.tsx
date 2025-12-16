import { MessageSquare, AlertCircle } from "lucide-react";

export function AdvisoryBanner() {
  return (
    <div className="bg-amber-950/50 border border-amber-500/30 rounded-lg p-4 mb-6">
      <div className="flex items-start gap-3">
        <MessageSquare className="w-5 h-5 text-amber-400 mt-0.5" />
        <div>
          <h3 className="font-semibold text-amber-300 flex items-center gap-2">
            Human Advisory
            <AlertCircle className="w-4 h-4 text-amber-500" />
          </h3>
          <p className="text-sm text-slate-400 mt-1">
            Advisory notes do <strong className="text-amber-400">NOT</strong> execute or override system decisions.
            They are governance artifacts for human review and audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}
