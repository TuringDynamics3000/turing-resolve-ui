import { trpc } from "@/lib/trpc";
import { AdvisoryForm } from "./AdvisoryForm";
import { MessageSquare, User, Clock } from "lucide-react";

interface AdvisoryPanelProps {
  entityType: "PAYMENT" | "ACCOUNT";
  entityId: string;
}

const advisoryTypeColors: Record<string, { bg: string; text: string }> = {
  RECOMMEND_RETRY: { bg: "bg-blue-500/20", text: "text-blue-400" },
  RECOMMEND_REVERSAL: { bg: "bg-red-500/20", text: "text-red-400" },
  HOLD_FOR_REVIEW: { bg: "bg-amber-500/20", text: "text-amber-400" },
  NO_ACTION: { bg: "bg-slate-500/20", text: "text-slate-400" },
};

export function AdvisoryPanel({ entityType, entityId }: AdvisoryPanelProps) {
  const { data: notes, isLoading } = trpc.advisory.list.useQuery(
    { entityType, entityId },
    { enabled: !!entityId }
  );

  return (
    <div className="bg-slate-800/30 border border-slate-700 rounded-lg p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-amber-400" />
        Human Advisory Notes
      </h3>

      <div className="bg-amber-950/20 border border-amber-500/20 rounded-lg p-3 mb-4">
        <p className="text-xs text-amber-300/80">
          Advisory notes do NOT execute or override system decisions.
          They are governance artifacts for human review.
        </p>
      </div>

      {/* Existing Notes */}
      <div className="space-y-3 mb-6">
        {isLoading ? (
          <div className="animate-pulse space-y-2">
            <div className="h-16 bg-slate-800 rounded" />
            <div className="h-16 bg-slate-800 rounded" />
          </div>
        ) : notes && notes.length > 0 ? (
          notes.map((note) => {
            const style = advisoryTypeColors[note.advisoryType] || advisoryTypeColors.NO_ACTION;
            return (
              <div key={note.id} className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${style.bg} ${style.text}`}>
                    {note.advisoryType.replace(/_/g, " ")}
                  </span>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <User className="w-3 h-3" />
                    {note.actor}
                  </div>
                </div>
                <p className="text-sm text-slate-300">{note.note}</p>
                <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                  <Clock className="w-3 h-3" />
                  {new Date(note.occurredAt).toLocaleString()}
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-4 text-slate-500">
            No advisory notes recorded
          </div>
        )}
      </div>

      {/* Add Note Form */}
      <AdvisoryForm entityType={entityType} entityId={entityId} />
    </div>
  );
}
