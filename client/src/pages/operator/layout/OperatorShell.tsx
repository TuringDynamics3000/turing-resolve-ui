import { OperatorNav } from "./OperatorNav";
import { OperatorBanner } from "../banners/OperatorBanner";
import { OperatorToastProvider } from "../OperatorToastProvider";

interface OperatorShellProps {
  children: React.ReactNode;
}

export function OperatorShell({ children }: OperatorShellProps) {
  return (
    <OperatorToastProvider>
      <div className="flex h-screen bg-slate-950">
        <OperatorNav />
        <main className="flex-1 overflow-auto">
          <div className="p-6">
            <OperatorBanner />
            {children}
          </div>
        </main>
      </div>
    </OperatorToastProvider>
  );
}
