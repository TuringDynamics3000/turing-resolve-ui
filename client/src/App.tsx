import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, useRoute } from "wouter";
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
import LendingCorePage from "@/pages/LendingCorePage";
import GovernanceControls from "@/pages/GovernanceControls";
import ReportingDashboard from "@/pages/ReportingDashboard";
import NotFound from "@/pages/NotFound";
import { OperatorPage } from "@/pages/operator/OperatorPage";
import { LoansOverview } from "@/pages/member/loans/LoansOverview";
import { LoanDetail } from "@/pages/member/loans/LoanDetail";

function MainDashboard() {
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
        <Route path="/lending-core" component={LendingCorePage} />
        
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
        
        {/* Reporting Module */}
        <Route path="/reporting" component={ReportingDashboard} />
        
        {/* Governance */}
        <Route path="/governance" component={GovernanceControls} />
        
        {/* 404 */}
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function Router() {
  // Check if we're on an operator route
  const [isOperator] = useRoute("/operator/*?");
  const [isMemberLoans] = useRoute("/member/loans/*?");
  const [isMemberLoansOverview] = useRoute("/member/loans");
  
  if (isOperator) {
    return <OperatorPage />;
  }
  
  // Member routes (read-only truth surfaces)
  if (isMemberLoansOverview) {
    return <LoansOverview />;
  }
  
  if (isMemberLoans) {
    return (
      <Switch>
        <Route path="/member/loans/:loanId" component={LoanDetail} />
        <Route path="/member/loans" component={LoansOverview} />
      </Switch>
    );
  }
  
  return <MainDashboard />;
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
