import { cn } from "@/lib/utils";
import { CheckCircle2, Clock, AlertTriangle, XCircle, Circle } from "lucide-react";

export interface TimelineEvent {
  id: string;
  title: string;
  description?: string;
  timestamp: string;
  status?: "complete" | "current" | "pending" | "error" | "warning";
  actor?: string;
  metadata?: Record<string, string>;
}

export interface TimelineProps extends React.HTMLAttributes<HTMLDivElement> {
  events: TimelineEvent[];
  orientation?: "vertical" | "horizontal";
}

function getStatusConfig(status: TimelineEvent["status"] = "complete") {
  switch (status) {
    case "complete":
      return {
        icon: <CheckCircle2 className="w-4 h-4" />,
        dotClass: "border-success bg-success/10 text-success",
        lineClass: "bg-success",
      };
    case "current":
      return {
        icon: <Circle className="w-4 h-4 animate-pulse" />,
        dotClass: "border-primary bg-primary/10 text-primary",
        lineClass: "bg-primary",
      };
    case "pending":
      return {
        icon: <Clock className="w-4 h-4" />,
        dotClass: "border-muted-foreground bg-muted text-muted-foreground",
        lineClass: "bg-muted",
      };
    case "error":
      return {
        icon: <XCircle className="w-4 h-4" />,
        dotClass: "border-destructive bg-destructive/10 text-destructive",
        lineClass: "bg-destructive",
      };
    case "warning":
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        dotClass: "border-warning bg-warning/10 text-warning",
        lineClass: "bg-warning",
      };
  }
}

export function Timeline({
  events,
  orientation = "vertical",
  className,
  ...props
}: TimelineProps) {
  if (orientation === "horizontal") {
    return (
      <div
        className={cn("flex items-start gap-4 overflow-x-auto pb-4", className)}
        {...props}
      >
        {events.map((event, index) => {
          const config = getStatusConfig(event.status);
          const isLast = index === events.length - 1;

          return (
            <div key={event.id} className="flex flex-col items-center min-w-[150px]">
              {/* Dot and line */}
              <div className="flex items-center w-full">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full border-2 flex items-center justify-center shrink-0",
                    config.dotClass
                  )}
                >
                  {config.icon}
                </div>
                {!isLast && (
                  <div className={cn("h-0.5 flex-1", config.lineClass)} />
                )}
              </div>

              {/* Content */}
              <div className="mt-3 text-center">
                <p className="font-medium text-sm">{event.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.timestamp}
                </p>
                {event.description && (
                  <p className="text-xs text-muted-foreground mt-1 max-w-[140px]">
                    {event.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical orientation (default)
  return (
    <div className={cn("space-y-0", className)} {...props}>
      {events.map((event, index) => {
        const config = getStatusConfig(event.status);
        const isLast = index === events.length - 1;

        return (
          <div key={event.id} className="relative pl-8 pb-6 last:pb-0">
            {/* Vertical line */}
            {!isLast && (
              <div
                className={cn(
                  "absolute left-[15px] top-8 bottom-0 w-0.5",
                  config.lineClass
                )}
              />
            )}

            {/* Dot */}
            <div
              className={cn(
                "absolute left-0 top-0 w-8 h-8 rounded-full border-2 flex items-center justify-center",
                config.dotClass
              )}
            >
              {config.icon}
            </div>

            {/* Content */}
            <div className="pt-1">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium text-sm">{event.title}</p>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {event.timestamp}
                </span>
              </div>

              {event.actor && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  by {event.actor}
                </p>
              )}

              {event.description && (
                <p className="text-sm text-muted-foreground mt-1">
                  {event.description}
                </p>
              )}

              {event.metadata && Object.keys(event.metadata).length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.entries(event.metadata).map(([key, value]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1 text-[10px] bg-muted/50 px-2 py-0.5 rounded"
                    >
                      <span className="text-muted-foreground">{key}:</span>
                      <span className="font-mono">{value}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Skeleton loader
export function TimelineSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-0">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="relative pl-8 pb-6 last:pb-0 animate-pulse">
          {i < count - 1 && (
            <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-muted" />
          )}
          <div className="absolute left-0 top-0 w-8 h-8 rounded-full bg-muted" />
          <div className="pt-1 space-y-2">
            <div className="h-4 w-32 bg-muted rounded" />
            <div className="h-3 w-48 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}
