import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";

// Resolve UI Pages
import { DashboardLayout } from "@/components/DashboardLayout";
import OpsInbox from "@/pages/OpsInbox";
import DecisionDetail from "@/pages/DecisionDetail";
import PolicyViewer from "@/pages/PolicyViewer";
import EvidenceVault from "@/pages/EvidenceVault";
import NotFound from "@/pages/NotFound";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={OpsInbox} />
        <Route path="/decisions" component={OpsInbox} />
        <Route path="/decisions/:id" component={DecisionDetail} />
        <Route path="/policies" component={PolicyViewer} />
        <Route path="/evidence" component={EvidenceVault} />
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
