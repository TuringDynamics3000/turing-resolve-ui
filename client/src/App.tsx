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
import GovernanceControls from "@/pages/GovernanceControls";
import ReportingDashboard from "@/pages/ReportingDashboard";
import MLModelsDashboard from "@/pages/MLModelsDashboard";
import CompareDecisions from "@/pages/CompareDecisions";
import WhatIfSimulator from "@/pages/WhatIfSimulator";
import ComplianceReport from "@/pages/ComplianceReport";
import TuringSentinel from "@/pages/TuringSentinel";
import TuringSentinelLanding from "@/pages/TuringSentinelLanding";
import CaseManagement from "@/pages/CaseManagement";
import PolicyEditor from "@/pages/PolicyEditor";
import GLLedger from "@/pages/GLLedger";
import ECLDashboard from "@/pages/ECLDashboard";
import OperationsPage from "@/pages/OperationsPage";
import WalletsPage from "@/pages/WalletsPage";
import PaymentsPage from "@/pages/PaymentsPage";
import BecsBatchesPage from "@/pages/BecsBatchesPage";
import APRAReporting from "@/pages/APRAReporting";
import PeriodClose from "@/pages/PeriodClose";
import NotFound from "@/pages/NotFound";
import { OperatorPage } from "@/pages/operator/OperatorPage";

function MainDashboard() {
  return (
    <DashboardLayout>
      <Switch>
        {/* System Overview */}
        <Route path="/" component={SystemOverview} />
        
        {/* Resolve Module */}
        <Route path="/resolve" component={OpsInbox} />
        <Route path="/cases" component={CaseManagement} />
        <Route path="/decisions" component={OpsInbox} />
        <Route path="/decisions/:id" component={DecisionDetail} />
        <Route path="/compare" component={CompareDecisions} />
        <Route path="/simulator" component={WhatIfSimulator} />
        <Route path="/policies" component={PolicyViewer} />
        <Route path="/policy-editor" component={PolicyEditor} />
        
        {/* Lending Module */}
        <Route path="/lending" component={LendingDashboard} />
        
        {/* Payments Module */}
        <Route path="/payments" component={PaymentsPage} />
        <Route path="/payments/batches" component={BecsBatchesPage} />
        
        {/* Deposits Module */}
        <Route path="/deposits" component={DepositsDashboard} />
        <Route path="/wallets" component={WalletsPage} />
        
        {/* General Ledger */}
        <Route path="/gl" component={GLLedger} />
        <Route path="/ecl" component={ECLDashboard} />
        <Route path="/operations" component={OperationsPage} />
        
        {/* Exposure Module */}
        <Route path="/exposure" component={ExposureDashboard} />
        <Route path="/exposure/:id" component={ExposureDetail} />
        
        {/* Evidence Vault */}
        <Route path="/evidence" component={EvidenceVaultSystem} />
        <Route path="/evidence/:id" component={EvidenceDetail} />
        
        {/* Reporting Module */}
        <Route path="/reporting" component={ReportingDashboard} />
        <Route path="/compliance" component={ComplianceReport} />
        <Route path="/apra" component={APRAReporting} />
        <Route path="/period-close" component={PeriodClose} />
        
        {/* ML Models */}
        <Route path="/ml-models" component={MLModelsDashboard} />
        <Route path="/sentinel" component={TuringSentinelLanding} />
        <Route path="/sentinel/console" component={TuringSentinel} />
        <Route path="/governance-controls" component={GovernanceControls} />
        
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
  
  if (isOperator) {
    return <OperatorPage />;
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
