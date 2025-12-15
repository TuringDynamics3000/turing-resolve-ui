import { cn } from "@/lib/utils";
import { Copy, Check, FileText, Database, Shield, Clock } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";

export interface EvidenceItem {
  id: string;
  type: "fact" | "policy" | "ledger" | "timestamp";
  label: string;
  value: string;
  hash?: string;
  timestamp?: string;
}

export interface EvidencePanelProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  items: EvidenceItem[];
  replayHash?: string;
  manifestHash?: string;
}

function getTypeIcon(type: EvidenceItem["type"]) {
  switch (type) {
    case "fact":
      return <Database className="w-4 h-4 text-info" />;
    case "policy":
      return <Shield className="w-4 h-4 text-primary" />;
    case "ledger":
      return <FileText className="w-4 h-4 text-success" />;
    case "timestamp":
      return <Clock className="w-4 h-4 text-muted-foreground" />;
  }
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={handleCopy}
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="w-3 h-3 text-success" />
      ) : (
        <Copy className="w-3 h-3" />
      )}
    </Button>
  );
}

function HashDisplay({ hash, label }: { hash: string; label: string }) {
  return (
    <div className="flex items-center justify-between gap-2 p-2 bg-muted/30 rounded-md border border-border/50">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
          {label}
        </p>
        <p className="font-mono text-xs truncate">{hash}</p>
      </div>
      <CopyButton text={hash} />
    </div>
  );
}

export function EvidencePanel({
  title = "Evidence Pack",
  items,
  replayHash,
  manifestHash,
  className,
  ...props
}: EvidencePanelProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden",
        className
      )}
      {...props}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          {title}
        </h3>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Evidence Items */}
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start gap-3 p-3 rounded-md bg-muted/20 border border-border/30"
            >
              <div className="shrink-0 mt-0.5">{getTypeIcon(item.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.timestamp && (
                    <span className="text-[10px] text-muted-foreground">
                      {item.timestamp}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5 break-all">
                  {item.value}
                </p>
                {item.hash && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded truncate max-w-[200px]">
                      {item.hash}
                    </span>
                    <CopyButton text={item.hash} />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Cryptographic Hashes */}
        {(replayHash || manifestHash) && (
          <div className="pt-3 border-t border-border/50 space-y-2">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
              Cryptographic Verification
            </p>
            {replayHash && <HashDisplay hash={replayHash} label="Replay Hash" />}
            {manifestHash && <HashDisplay hash={manifestHash} label="Manifest Hash" />}
          </div>
        )}
      </div>
    </div>
  );
}

// Compact evidence display for inline use
export function EvidenceHash({
  hash,
  label,
  className,
}: {
  hash: string;
  label?: string;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {label && (
        <span className="text-xs text-muted-foreground">{label}:</span>
      )}
      <code className="font-mono text-xs bg-muted/50 px-2 py-1 rounded border border-border/50 truncate max-w-[200px]">
        {hash}
      </code>
      <CopyButton text={hash} />
    </div>
  );
}

// Skeleton loader
export function EvidencePanelSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden animate-pulse">
      <div className="px-4 py-3 border-b border-border/50 bg-muted/20">
        <div className="h-5 w-32 bg-muted rounded" />
      </div>
      <div className="p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="p-3 rounded-md bg-muted/20 space-y-2">
            <div className="h-4 w-24 bg-muted rounded" />
            <div className="h-3 w-full bg-muted rounded" />
          </div>
        ))}
      </div>
    </div>
  );
}
