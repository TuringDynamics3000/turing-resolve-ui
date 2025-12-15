import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// System Governance Dashboard Pages
import { DashboardLayout } from "@/components/DashboardLayout";
import SystemOverview from "@/pages/SystemOverview";
import OpsInbox from "@/pages/OpsInbox";
import DecisionDetail from "@/pages/DecisionDetail";
import PolicyViewer from "@/pages/PolicyViewer";
import EvidenceVault from "@/pages/EvidenceVault";
import EvidenceVaultSystem from "@/pages/EvidenceVaultSystem";
import ExposureDashboard from "@/pages/ExposureDashboard";
import ExposureDetail from "@/pages/ExposureDetail";
import EvidenceDetail from "@/pages/EvidenceDetail";
import LendingDashboard from "@/pages/LendingDashboard";
import PaymentsDashboard from "@/pages/PaymentsDashboard";
import DepositsDashboard from "@/pages/DepositsDashboard";
import GovernanceControls from "@/pages/GovernanceControls";
import NotFound from "@/pages/NotFound";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        {/* System Overview */}
        <Route path="/" component={SystemOverview} />
        
        {/* Resolve Module */}
        <Route path="/resolve" component={OpsInbox} />
        <Route path="/decisions" component={OpsInbox} />
        <Route path="/decisions/:id" component={DecisionDetail} />
        <Route path="/policies" component={PolicyViewer} />
        
        {/* Lending Module */}
        <Route path="/lending" component={LendingDashboard} />
        
        {/* Payments Module */}
        <Route path="/payments" component={PaymentsDashboard} />
        
        {/* Deposits Module */}
        <Route path="/deposits" component={DepositsDashboard} />
        
        {/* Exposure Module */}
        <Route path="/exposure" component={ExposureDashboard} />
        <Route path="/exposure/:id" component={ExposureDetail} />
        
        {/* Evidence Vault */}
        <Route path="/evidence" component={EvidenceVaultSystem} />
        <Route path="/evidence/:id" component={EvidenceDetail} />
        
        {/* Governance */}
        <Route path="/governance" component={GovernanceControls} />
        
        {/* 404 */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
