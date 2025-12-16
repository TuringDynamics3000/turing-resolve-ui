import { cn } from "@/lib/utils";
import { useState } from "react";
import { ChevronRight, CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react";

export interface ExplanationNode {
  id: string;
  label: string;
  status: "pass" | "fail" | "warn" | "info";
  description?: string;
  value?: string;
  children?: ExplanationNode[];
}

export interface ExplanationTreeProps extends React.HTMLAttributes<HTMLDivElement> {
  nodes: ExplanationNode[];
  defaultExpanded?: boolean;
}

function getStatusConfig(status: ExplanationNode["status"]) {
  switch (status) {
    case "pass":
      return {
        icon: <CheckCircle2 className="w-4 h-4 text-success" />,
        borderClass: "border-l-success",
        bgClass: "bg-success/5",
      };
    case "fail":
      return {
        icon: <XCircle className="w-4 h-4 text-destructive" />,
        borderClass: "border-l-destructive",
        bgClass: "bg-destructive/5",
      };
    case "warn":
      return {
        icon: <AlertTriangle className="w-4 h-4 text-warning" />,
        borderClass: "border-l-warning",
        bgClass: "bg-warning/5",
      };
    case "info":
      return {
        icon: <Info className="w-4 h-4 text-info" />,
        borderClass: "border-l-info",
        bgClass: "bg-info/5",
      };
  }
}

interface ExplanationNodeItemProps {
  node: ExplanationNode;
  level: number;
  defaultExpanded: boolean;
}

function ExplanationNodeItem({ node, level, defaultExpanded }: ExplanationNodeItemProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const hasChildren = node.children && node.children.length > 0;
  const config = getStatusConfig(node.status);

  return (
    <div className={cn("relative", level > 0 && "ml-6")}>
      {/* Connector line for non-root nodes */}
      {level > 0 && (
        <div
          className={cn(
            "absolute left-0 top-0 bottom-0 w-0.5 -ml-3",
            config.borderClass
          )}
        />
      )}

      {/* Node content */}
      <div
        className={cn(
          "relative rounded-lg border border-border/50 transition-all",
          config.bgClass,
          hasChildren && "cursor-pointer hover:border-border"
        )}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        role={hasChildren ? "button" : undefined}
        aria-expanded={hasChildren ? isExpanded : undefined}
        tabIndex={hasChildren ? 0 : undefined}
        onKeyDown={(e) => {
          if (hasChildren && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        {/* Horizontal connector */}
        {level > 0 && (
          <div
            className={cn(
              "absolute left-0 top-1/2 w-3 h-0.5 -ml-3 -translate-y-1/2",
              config.borderClass.replace("border-l-", "bg-")
            )}
          />
        )}

        <div className="p-3">
          <div className="flex items-start gap-3">
            {/* Expand/Collapse indicator */}
            {hasChildren && (
              <ChevronRight
                className={cn(
                  "w-4 h-4 text-muted-foreground transition-transform shrink-0 mt-0.5",
                  isExpanded && "rotate-90"
                )}
              />
            )}

            {/* Status icon */}
            <div className="shrink-0 mt-0.5">{config.icon}</div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium text-sm">{node.label}</span>
                {node.value && (
                  <span className="font-mono text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                    {node.value}
                  </span>
                )}
              </div>
              {node.description && (
                <p className="text-xs text-muted-foreground mt-1">
                  {node.description}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {node.children!.map((child) => (
            <ExplanationNodeItem
              key={child.id}
              node={child}
              level={level + 1}
              defaultExpanded={defaultExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ExplanationTree({
  nodes,
  defaultExpanded = true,
  className,
  ...props
}: ExplanationTreeProps) {
  return (
    <div className={cn("space-y-2", className)} {...props}>
      {nodes.map((node) => (
        <ExplanationNodeItem
          key={node.id}
          node={node}
          level={0}
          defaultExpanded={defaultExpanded}
        />
      ))}
    </div>
  );
}

// Skeleton loader
export function ExplanationTreeSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/5 animate-pulse">
          <div className="flex items-start gap-3">
            <div className="w-4 h-4 bg-muted rounded" />
            <div className="w-4 h-4 bg-muted rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-32 bg-muted rounded" />
              <div className="h-3 w-48 bg-muted rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
