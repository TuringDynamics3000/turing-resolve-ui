import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        success: "bg-success/15 text-success border border-success/20",
        warning: "bg-warning/15 text-warning border border-warning/20",
        destructive: "bg-destructive/15 text-destructive border border-destructive/20",
        info: "bg-info/15 text-info border border-info/20",
        muted: "bg-muted text-muted-foreground border border-border",
        primary: "bg-primary/15 text-primary border border-primary/20",
      },
      size: {
        sm: "text-[10px] px-2 py-0.5",
        default: "text-xs px-2.5 py-1",
        lg: "text-sm px-3 py-1.5",
      },
    },
    defaultVariants: {
      variant: "muted",
      size: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  icon?: React.ReactNode;
}

export function StatusBadge({
  className,
  variant,
  size,
  icon,
  children,
  ...props
}: StatusBadgeProps) {
  return (
    <span
      className={cn(statusBadgeVariants({ variant, size }), className)}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      {children}
    </span>
  );
}

// Convenience components for common statuses
export function ApprovedBadge({ className, ...props }: Omit<StatusBadgeProps, "variant">) {
  return (
    <StatusBadge variant="success" className={className} {...props}>
      Approved
    </StatusBadge>
  );
}

export function DeclinedBadge({ className, ...props }: Omit<StatusBadgeProps, "variant">) {
  return (
    <StatusBadge variant="destructive" className={className} {...props}>
      Declined
    </StatusBadge>
  );
}

export function PendingBadge({ className, ...props }: Omit<StatusBadgeProps, "variant">) {
  return (
    <StatusBadge variant="warning" className={className} {...props}>
      Pending
    </StatusBadge>
  );
}

export function FlaggedBadge({ className, ...props }: Omit<StatusBadgeProps, "variant">) {
  return (
    <StatusBadge variant="destructive" className={className} {...props}>
      Flagged
    </StatusBadge>
  );
}

export function ReviewBadge({ className, ...props }: Omit<StatusBadgeProps, "variant">) {
  return (
    <StatusBadge variant="info" className={className} {...props}>
      Review
    </StatusBadge>
  );
}
