import { cn } from "@/lib/utils";

export interface RiskIndicatorProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0-100
  showLabel?: boolean;
  size?: "sm" | "default" | "lg";
}

function getRiskLevel(value: number): "low" | "medium" | "high" {
  if (value <= 33) return "low";
  if (value <= 66) return "medium";
  return "high";
}

function getRiskColor(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "low":
      return "bg-success";
    case "medium":
      return "bg-warning";
    case "high":
      return "bg-destructive";
  }
}

function getRiskLabel(level: "low" | "medium" | "high"): string {
  switch (level) {
    case "low":
      return "Low Risk";
    case "medium":
      return "Medium Risk";
    case "high":
      return "High Risk";
  }
}

const sizeClasses = {
  sm: "h-1",
  default: "h-2",
  lg: "h-3",
};

export function RiskIndicator({
  value,
  showLabel = false,
  size = "default",
  className,
  ...props
}: RiskIndicatorProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const level = getRiskLevel(clampedValue);
  const color = getRiskColor(level);
  const label = getRiskLabel(level);

  return (
    <div className={cn("space-y-1", className)} {...props}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">{label}</span>
          <span className="font-mono font-medium">{clampedValue}%</span>
        </div>
      )}
      <div
        className={cn(
          "relative w-full bg-muted rounded-full overflow-hidden",
          sizeClasses[size]
        )}
        role="progressbar"
        aria-valuenow={clampedValue}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Risk level: ${label}`}
      >
        <div
          className={cn(
            "absolute left-0 top-0 h-full rounded-full transition-all duration-500 ease-out",
            color
          )}
          style={{ width: `${clampedValue}%` }}
        />
      </div>
    </div>
  );
}

// Circular Risk Gauge variant
export interface RiskGaugeProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  size?: number;
  strokeWidth?: number;
}

export function RiskGauge({
  value,
  size = 80,
  strokeWidth = 8,
  className,
  ...props
}: RiskGaugeProps) {
  const clampedValue = Math.max(0, Math.min(100, value));
  const level = getRiskLevel(clampedValue);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (clampedValue / 100) * circumference;

  const colorClass = {
    low: "stroke-success",
    medium: "stroke-warning",
    high: "stroke-destructive",
  }[level];

  return (
    <div
      className={cn("relative inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      {...props}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        role="img"
        aria-label={`Risk score: ${clampedValue}%`}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn("transition-all duration-500 ease-out", colorClass)}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-lg font-semibold font-mono">{clampedValue}</span>
      </div>
    </div>
  );
}
