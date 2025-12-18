import { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { 
  Inbox, 
  FileText, 
  Search, 
  AlertCircle, 
  Database,
  Shield,
  Wallet,
  CreditCard,
  TrendingUp,
  Users,
  Settings,
  Plus
} from 'lucide-react';
import { cn } from '@/lib/utils';

type EmptyStateVariant = 
  | 'default'
  | 'search'
  | 'decisions'
  | 'evidence'
  | 'payments'
  | 'lending'
  | 'exposure'
  | 'cases'
  | 'users'
  | 'settings'
  | 'error';

interface EmptyStateProps {
  variant?: EmptyStateVariant;
  title?: string;
  description?: string;
  icon?: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
    icon?: ReactNode;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

const variantConfig: Record<EmptyStateVariant, { icon: ReactNode; title: string; description: string }> = {
  default: {
    icon: <Inbox className="w-12 h-12" />,
    title: 'No data yet',
    description: 'There\'s nothing here at the moment. Data will appear once available.',
  },
  search: {
    icon: <Search className="w-12 h-12" />,
    title: 'No results found',
    description: 'Try adjusting your search or filter criteria to find what you\'re looking for.',
  },
  decisions: {
    icon: <Shield className="w-12 h-12" />,
    title: 'No decisions recorded',
    description: 'Decisions will appear here once the system processes requests through Resolve.',
  },
  evidence: {
    icon: <FileText className="w-12 h-12" />,
    title: 'No evidence packs',
    description: 'Evidence packs are generated automatically when decisions are made.',
  },
  payments: {
    icon: <Wallet className="w-12 h-12" />,
    title: 'No payments',
    description: 'Payment transactions will appear here once processed.',
  },
  lending: {
    icon: <CreditCard className="w-12 h-12" />,
    title: 'No loans',
    description: 'Loan applications and disbursements will appear here.',
  },
  exposure: {
    icon: <TrendingUp className="w-12 h-12" />,
    title: 'No exposure data',
    description: 'Customer exposure snapshots will appear once calculated.',
  },
  cases: {
    icon: <Inbox className="w-12 h-12" />,
    title: 'No open cases',
    description: 'Exception cases and reviews will appear here when created.',
  },
  users: {
    icon: <Users className="w-12 h-12" />,
    title: 'No users',
    description: 'User accounts will appear here once created.',
  },
  settings: {
    icon: <Settings className="w-12 h-12" />,
    title: 'No configuration',
    description: 'Settings and configuration options will appear here.',
  },
  error: {
    icon: <AlertCircle className="w-12 h-12" />,
    title: 'Something went wrong',
    description: 'We encountered an error loading this data. Please try again.',
  },
};

export function EmptyState({
  variant = 'default',
  title,
  description,
  icon,
  action,
  secondaryAction,
  className,
}: EmptyStateProps) {
  const config = variantConfig[variant];
  
  return (
    <div className={cn(
      "flex flex-col items-center justify-center py-12 px-4 text-center",
      className
    )}>
      <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-6 text-muted-foreground/50">
        {icon || config.icon}
      </div>
      
      <h3 className="text-lg font-semibold mb-2">
        {title || config.title}
      </h3>
      
      <p className="text-muted-foreground max-w-md mb-6">
        {description || config.description}
      </p>
      
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action && (
            <Button onClick={action.onClick}>
              {action.icon || <Plus className="w-4 h-4 mr-2" />}
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button variant="outline" onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// Specialized empty states for common use cases
export function SearchEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      variant="search"
      action={onClear ? { label: 'Clear search', onClick: onClear } : undefined}
    />
  );
}

export function DecisionsEmptyState() {
  return <EmptyState variant="decisions" />;
}

export function EvidenceEmptyState() {
  return <EmptyState variant="evidence" />;
}

export function PaymentsEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      variant="payments"
      action={onCreate ? { label: 'Create payment', onClick: onCreate } : undefined}
    />
  );
}

export function CasesEmptyState({ onCreate }: { onCreate?: () => void }) {
  return (
    <EmptyState
      variant="cases"
      action={onCreate ? { label: 'Create case', onClick: onCreate } : undefined}
    />
  );
}

export function ErrorEmptyState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      variant="error"
      action={onRetry ? { label: 'Try again', onClick: onRetry } : undefined}
    />
  );
}
