import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

const DOMAIN_COLORS: Record<string, string> = {
  DEPOSITS: "#f59e0b",
  PAYMENTS: "#3b82f6",
  LENDING: "#8b5cf6",
  ML: "#10b981",
  POLICY: "#ec4899",
  OPS: "#6366f1",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]?.payload;
    const total = (data?.allowed || 0) + (data?.denied || 0);
    const allowRate = total > 0 ? Math.round((data?.allowed / total) * 100) : 0;
    
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 shadow-xl">
        <p className="text-zinc-200 font-medium mb-1">{label}</p>
        <p className="text-zinc-500 text-xs mb-2">{data?.domain}</p>
        <div className="space-y-1">
          <p className="text-emerald-400 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Allowed: <span className="font-semibold">{data?.allowed || 0}</span>
          </p>
          <p className="text-red-400 text-sm flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-400" />
            Denied: <span className="font-semibold">{data?.denied || 0}</span>
          </p>
          <p className="text-zinc-400 text-xs mt-2 pt-2 border-t border-zinc-700">
            Approval Rate: <span className="font-semibold text-zinc-200">{allowRate}%</span>
          </p>
        </div>
      </div>
    );
  }
  return null;
};

export function CommandBreakdownChart() {
  const { data: commandData, isLoading } = trpc.rbac.getDecisionsByCommand.useQuery(undefined, {
    refetchInterval: 60000,
  });

  if (isLoading) {
    return (
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Skeleton className="h-9 w-9 rounded-lg bg-zinc-800" />
            <div>
              <Skeleton className="h-5 w-40 bg-zinc-800 mb-2" />
              <Skeleton className="h-4 w-56 bg-zinc-800" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full bg-zinc-800" />
        </CardContent>
      </Card>
    );
  }

  // Transform data for stacked bar chart
  const chartData = commandData?.map(item => ({
    ...item,
    // Shorten command names for display
    shortName: item.command.replace(/_/g, ' ').replace(/PROMOTE MODEL TO /i, '→ '),
  })) || [];

  return (
    <Card className="bg-zinc-900/50 border-zinc-800">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-purple-500/10">
            <BarChart3 className="h-5 w-5 text-purple-400" />
          </div>
          <div>
            <CardTitle className="text-xl text-zinc-100">Decisions by Command</CardTitle>
            <CardDescription className="text-zinc-500">Top commands by decision volume</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="#71717a" 
                fontSize={12}
                tickLine={false}
                axisLine={{ stroke: '#27272a' }}
              />
              <YAxis 
                type="category" 
                dataKey="shortName" 
                stroke="#71717a" 
                fontSize={11}
                tickLine={false}
                axisLine={{ stroke: '#27272a' }}
                width={120}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="allowed" 
                stackId="a" 
                fill="#10b981" 
                radius={[0, 0, 0, 0]}
                name="Allowed"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-allowed-${index}`} fill="#10b981" fillOpacity={0.8} />
                ))}
              </Bar>
              <Bar 
                dataKey="denied" 
                stackId="a" 
                fill="#ef4444" 
                radius={[0, 4, 4, 0]}
                name="Denied"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-denied-${index}`} fill="#ef4444" fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        
        {/* Domain legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-emerald-500" />
            <span className="text-xs text-zinc-400">Allowed</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded bg-red-500" />
            <span className="text-xs text-zinc-400">Denied</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
