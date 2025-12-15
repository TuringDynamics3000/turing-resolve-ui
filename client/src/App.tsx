import { Switch, Route } from "wouter";
import { DashboardLayout } from "@/components/DashboardLayout";
import OpsInbox from "@/pages/OpsInbox";
import DecisionDetail from "@/pages/DecisionDetail";
import PolicyViewer from "@/pages/PolicyViewer";
import EvidenceVault from "@/pages/EvidenceVault";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

function NotFound() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-red-500" />
            <h1 className="text-2xl font-bold text-gray-900">404 Page Not Found</h1>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            The page you are looking for does not exist.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function App() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={OpsInbox} />
        <Route path="/decisions" component={OpsInbox} />
        <Route path="/decisions/:id" component={DecisionDetail} />
        <Route path="/policies" component={PolicyViewer} />
        <Route path="/evidence" component={EvidenceVault} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

export default App;
