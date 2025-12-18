import { cn } from "@/lib/utils";
import { AlertTriangle, RotateCcw, Home, Copy, CheckCircle, Bug } from "lucide-react";
import { Component, ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  onError?: (error: Error) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function ErrorFallbackUI({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  const errorDetails = `Error: ${error?.message || 'Unknown error'}\n\nStack Trace:\n${error?.stack || 'No stack trace'}\n\nTimestamp: ${new Date().toISOString()}\nURL: ${window.location.href}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(errorDetails);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-8 bg-background">
      <div className="flex flex-col items-center w-full max-w-2xl p-8 rounded-lg border border-border bg-card">
        <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mb-6">
          <AlertTriangle size={32} className="text-destructive" />
        </div>

        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-muted-foreground text-center mb-6">
          An unexpected error occurred. You can try again or return to the dashboard.
        </p>

        {error && (
          <div className="p-3 w-full rounded-lg bg-destructive/10 border border-destructive/30 mb-6">
            <p className="text-sm font-mono text-destructive break-all">
              {error.message}
            </p>
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <Button onClick={onRetry} className="gap-2">
            <RotateCcw size={16} />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.location.href = '/'} className="gap-2">
            <Home size={16} />
            Go to Dashboard
          </Button>
        </div>

        <div className="w-full pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDetails(!showDetails)}
            className="w-full text-muted-foreground"
          >
            <Bug className="w-4 h-4 mr-2" />
            {showDetails ? 'Hide' : 'Show'} Technical Details
          </Button>

          {showDetails && (
            <div className="mt-3 space-y-2">
              <div className="p-3 rounded-lg bg-muted max-h-48 overflow-auto">
                <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-all">
                  {errorDetails}
                </pre>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopy} className="w-full">
                {copied ? (
                  <><CheckCircle className="w-4 h-4 mr-2 text-green-500" />Copied!</>
                ) : (
                  <><Copy className="w-4 h-4 mr-2" />Copy Error Details</>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error);
    console.error('ErrorBoundary caught:', error);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallbackUI error={this.state.error} onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

// Page-level error boundary wrapper
export function PageErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary onError={(error) => console.error('Page error:', error)}>
      {children}
    </ErrorBoundary>
  );
}
