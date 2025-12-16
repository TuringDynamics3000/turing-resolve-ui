import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";

interface AdvisoryFormProps {
  entityType: "PAYMENT" | "ACCOUNT";
  entityId: string;
}

const advisoryTypes = [
  { value: "HOLD_FOR_REVIEW", label: "Hold for Review" },
  { value: "RECOMMEND_RETRY", label: "Recommend Retry" },
  { value: "RECOMMEND_REVERSAL", label: "Recommend Reversal" },
  { value: "NO_ACTION", label: "No Action Required" },
] as const;

export function AdvisoryForm({ entityType, entityId }: AdvisoryFormProps) {
  const [note, setNote] = useState("");
  const [advisoryType, setAdvisoryType] = useState<typeof advisoryTypes[number]["value"]>("HOLD_FOR_REVIEW");
  const [isExpanded, setIsExpanded] = useState(false);

  const utils = trpc.useUtils();

  const addMutation = trpc.advisory.add.useMutation({
    onSuccess: () => {
      setNote("");
      setIsExpanded(false);
      utils.advisory.list.invalidate({ entityType, entityId });
    },
  });

  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 border-dashed rounded-lg text-slate-400 hover:text-slate-300 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Add Advisory Note
      </button>
    );
  }

  return (
    <div className="space-y-3 p-4 bg-slate-800/50 border border-slate-600 rounded-lg">
      <div>
        <label className="block text-sm text-slate-400 mb-1">Advisory Type</label>
        <select
          value={advisoryType}
          onChange={(e) => setAdvisoryType(e.target.value as typeof advisoryType)}
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-amber-500"
        >
          {advisoryTypes.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm text-slate-400 mb-1">Note</label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Enter advisory note..."
          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          rows={3}
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => {
            if (note.trim()) {
              addMutation.mutate({
                entityType,
                entityId,
                advisoryType,
                note: note.trim(),
              });
            }
          }}
          disabled={!note.trim() || addMutation.isPending}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
        >
          {addMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          Add Note
        </button>
        <button
          onClick={() => {
            setIsExpanded(false);
            setNote("");
          }}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
