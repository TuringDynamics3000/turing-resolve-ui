import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { EvidenceViewer } from "@/components/EvidenceViewer";

export default function EvidenceDetail() {
  const params = useParams();
  const decisionId = params.id || "DEC-LEND-2024-002";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/evidence">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Decision Evidence</h1>
          <p className="text-muted-foreground font-mono">{decisionId}</p>
        </div>
      </div>

      {/* Evidence Viewer */}
      <EvidenceViewer decisionId={decisionId} />
    </div>
  );
}
