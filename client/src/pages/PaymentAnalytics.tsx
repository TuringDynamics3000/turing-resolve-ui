import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  TrendingUp, 
  TrendingDown,
  DollarSign,
  Clock,
  CheckCircle,
  XCircle,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Zap,
  BarChart3,
  PieChart,
  Calendar
} from "lucide-react";

// ============================================
// TYPES
// ============================================

interface DailyMetric {
  date: string;
  volume: number;
  count: number;
  successRate: number;
  avgSettlementTime: number;
}

interface SchemeMetric {
  scheme: string;
  volume: number;
  count: number;
  successRate: number;
  avgSettlementTime: number;
}

// ============================================
// SAMPLE DATA
// ============================================

const DAILY_METRICS: DailyMetric[] = [
  { date: "2024-12-12", volume: 1250000, count: 342, successRate: 98.5, avgSettlementTime: 2.3 },
  { date: "2024-12-13", volume: 1480000, count: 398, successRate: 99.1, avgSettlementTime: 2.1 },
  { date: "2024-12-14", volume: 890000, count: 245, successRate: 97.8, avgSettlementTime: 2.5 },
  { date: "2024-12-15", volume: 720000, count: 198, successRate: 98.9, avgSettlementTime: 2.2 },
  { date: "2024-12-16", volume: 1650000, count: 456, successRate: 99.3, avgSettlementTime: 1.9 },
  { date: "2024-12-17", volume: 1890000, count: 512, successRate: 98.8, avgSettlementTime: 2.0 },
  { date: "2024-12-18", volume: 2150000, count: 589, successRate: 99.5, avgSettlementTime: 1.8 },
];

const SCHEME_METRICS: SchemeMetric[] = [
  { scheme: "NPP", volume: 5250000, count: 1456, successRate: 99.2, avgSettlementTime: 0.5 },
  { scheme: "BECS", volume: 3890000, count: 892, successRate: 98.5, avgSettlementTime: 24.0 },
  { scheme: "INTERNAL", volume: 890000, count: 392, successRate: 99.9, avgSettlementTime: 0.1 },
];

const HOURLY_DISTRIBUTION = [
  { hour: "00:00", count: 45 },
  { hour: "01:00", count: 32 },
  { hour: "02:00", count: 28 },
  { hour: "03:00", count: 22 },
  { hour: "04:00", count: 18 },
  { hour: "05:00", count: 25 },
  { hour: "06:00", count: 48 },
  { hour: "07:00", count: 89 },
  { hour: "08:00", count: 156 },
  { hour: "09:00", count: 234 },
  { hour: "10:00", count: 287 },
  { hour: "11:00", count: 312 },
  { hour: "12:00", count: 298 },
  { hour: "13:00", count: 276 },
  { hour: "14:00", count: 289 },
  { hour: "15:00", count: 267 },
  { hour: "16:00", count: 234 },
  { hour: "17:00", count: 189 },
  { hour: "18:00", count: 145 },
  { hour: "19:00", count: 112 },
  { hour: "20:00", count: 89 },
  { hour: "21:00", count: 67 },
  { hour: "22:00", count: 54 },
  { hour: "23:00", count: 48 },
];

// ============================================
// COMPONENTS
// ============================================

function MetricCard({ 
  title, 
  value, 
  change, 
  changeLabel,
  icon: Icon,
  trend 
}: { 
  title: string;
  value: string;
  change: number;
  changeLabel: string;
  icon: React.ElementType;
  trend: "up" | "down" | "neutral";
}) {
  const trendColors = {
    up: "text-emerald-400",
    down: "text-red-400",
    neutral: "text-slate-400",
  };
  
  const TrendIcon = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Activity;
  
  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-slate-500 mb-1">{title}</p>
            <p className="text-3xl font-bold text-slate-100">{value}</p>
            <div className={`flex items-center gap-1 mt-2 text-sm ${trendColors[trend]}`}>
              <TrendIcon className="w-4 h-4" />
              <span>{change > 0 ? "+" : ""}{change}%</span>
              <span className="text-slate-500">{changeLabel}</span>
            </div>
          </div>
          <div className="p-3 bg-slate-800 rounded-lg">
            <Icon className="w-6 h-6 text-cyan-400" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VolumeChart({ data }: { data: DailyMetric[] }) {
  const maxVolume = Math.max(...data.map(d => d.volume));
  
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 h-48">
        {data.map((day, i) => {
          const height = (day.volume / maxVolume) * 100;
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
              <div 
                className="w-full bg-gradient-to-t from-cyan-600 to-cyan-400 rounded-t transition-all hover:from-cyan-500 hover:to-cyan-300"
                style={{ height: `${height}%` }}
                title={`$${(day.volume / 1000000).toFixed(2)}M`}
              />
              <span className="text-xs text-slate-500">
                {new Date(day.date).toLocaleDateString("en-AU", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{data[0]?.date}</span>
        <span>{data[data.length - 1]?.date}</span>
      </div>
    </div>
  );
}

function SuccessRateChart({ data }: { data: DailyMetric[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 h-48">
        {data.map((day) => {
          const height = day.successRate;
          const color = day.successRate >= 99 ? "bg-emerald-500" : 
                       day.successRate >= 98 ? "bg-amber-500" : "bg-red-500";
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
              <div 
                className={`w-full ${color} rounded-t transition-all opacity-80 hover:opacity-100`}
                style={{ height: `${height}%` }}
                title={`${day.successRate}%`}
              />
              <span className="text-xs text-slate-500">
                {new Date(day.date).toLocaleDateString("en-AU", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="flex justify-center gap-4 text-xs">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-emerald-500 rounded" />
          <span className="text-slate-400">≥99%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-amber-500 rounded" />
          <span className="text-slate-400">98-99%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-500 rounded" />
          <span className="text-slate-400">&lt;98%</span>
        </div>
      </div>
    </div>
  );
}

function SchemeBreakdown({ data }: { data: SchemeMetric[] }) {
  const totalVolume = data.reduce((sum, d) => sum + d.volume, 0);
  
  const colors: Record<string, string> = {
    NPP: "bg-cyan-500",
    BECS: "bg-purple-500",
    INTERNAL: "bg-emerald-500",
  };
  
  return (
    <div className="space-y-6">
      {/* Volume bar */}
      <div>
        <p className="text-sm text-slate-500 mb-2">Volume Distribution</p>
        <div className="h-8 flex rounded-lg overflow-hidden">
          {data.map((scheme) => (
            <div
              key={scheme.scheme}
              className={`${colors[scheme.scheme]} transition-all hover:opacity-80`}
              style={{ width: `${(scheme.volume / totalVolume) * 100}%` }}
              title={`${scheme.scheme}: $${(scheme.volume / 1000000).toFixed(2)}M`}
            />
          ))}
        </div>
      </div>
      
      {/* Legend */}
      <div className="grid grid-cols-3 gap-4">
        {data.map((scheme) => (
          <div key={scheme.scheme} className="p-4 bg-slate-800/50 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-3 h-3 rounded ${colors[scheme.scheme]}`} />
              <span className="font-medium text-slate-200">{scheme.scheme}</span>
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Volume</span>
                <span className="text-slate-300">${(scheme.volume / 1000000).toFixed(2)}M</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Count</span>
                <span className="text-slate-300">{scheme.count.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Success</span>
                <span className={scheme.successRate >= 99 ? "text-emerald-400" : "text-amber-400"}>
                  {scheme.successRate}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Avg Settlement</span>
                <span className="text-slate-300">
                  {scheme.avgSettlementTime < 1 ? `${(scheme.avgSettlementTime * 60).toFixed(0)}s` : 
                   scheme.avgSettlementTime < 60 ? `${scheme.avgSettlementTime.toFixed(1)}m` : 
                   `${(scheme.avgSettlementTime / 60).toFixed(1)}h`}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourlyHeatmap({ data }: { data: { hour: string; count: number }[] }) {
  const maxCount = Math.max(...data.map(d => d.count));
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-12 gap-1">
        {data.map((hour) => {
          const intensity = hour.count / maxCount;
          const bg = intensity > 0.8 ? "bg-cyan-400" :
                    intensity > 0.6 ? "bg-cyan-500" :
                    intensity > 0.4 ? "bg-cyan-600" :
                    intensity > 0.2 ? "bg-cyan-700" : "bg-cyan-900";
          return (
            <div
              key={hour.hour}
              className={`aspect-square ${bg} rounded transition-all hover:ring-2 hover:ring-cyan-300`}
              title={`${hour.hour}: ${hour.count} payments`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>00:00</span>
        <span>06:00</span>
        <span>12:00</span>
        <span>18:00</span>
        <span>23:00</span>
      </div>
      <div className="flex justify-center gap-2 text-xs">
        <span className="text-slate-500">Low</span>
        <div className="flex gap-1">
          <div className="w-4 h-4 bg-cyan-900 rounded" />
          <div className="w-4 h-4 bg-cyan-700 rounded" />
          <div className="w-4 h-4 bg-cyan-600 rounded" />
          <div className="w-4 h-4 bg-cyan-500 rounded" />
          <div className="w-4 h-4 bg-cyan-400 rounded" />
        </div>
        <span className="text-slate-500">High</span>
      </div>
    </div>
  );
}

function SettlementTimeChart({ data }: { data: DailyMetric[] }) {
  const maxTime = Math.max(...data.map(d => d.avgSettlementTime));
  
  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 h-48">
        {data.map((day) => {
          const height = (day.avgSettlementTime / maxTime) * 100;
          const color = day.avgSettlementTime <= 2 ? "bg-emerald-500" :
                       day.avgSettlementTime <= 2.5 ? "bg-amber-500" : "bg-red-500";
          return (
            <div key={day.date} className="flex-1 flex flex-col items-center gap-2">
              <div 
                className={`w-full ${color} rounded-t transition-all opacity-80 hover:opacity-100`}
                style={{ height: `${height}%` }}
                title={`${day.avgSettlementTime.toFixed(1)} seconds`}
              />
              <span className="text-xs text-slate-500">
                {new Date(day.date).toLocaleDateString("en-AU", { weekday: "short" })}
              </span>
            </div>
          );
        })}
      </div>
      <div className="text-center text-sm text-slate-400">
        Average settlement time (seconds)
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function PaymentAnalytics() {
  const [timeRange, setTimeRange] = useState("7d");
  
  // Calculate summary metrics
  const summary = useMemo(() => {
    const totalVolume = DAILY_METRICS.reduce((sum, d) => sum + d.volume, 0);
    const totalCount = DAILY_METRICS.reduce((sum, d) => sum + d.count, 0);
    const avgSuccessRate = DAILY_METRICS.reduce((sum, d) => sum + d.successRate, 0) / DAILY_METRICS.length;
    const avgSettlementTime = DAILY_METRICS.reduce((sum, d) => sum + d.avgSettlementTime, 0) / DAILY_METRICS.length;
    
    return {
      totalVolume,
      totalCount,
      avgSuccessRate,
      avgSettlementTime,
    };
  }, []);
  
  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-100">Payment Analytics</h1>
            <p className="text-slate-500">Volume, success rates, and settlement performance</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Tabs value={timeRange} onValueChange={setTimeRange}>
              <TabsList className="bg-slate-800">
                <TabsTrigger value="24h">24h</TabsTrigger>
                <TabsTrigger value="7d">7d</TabsTrigger>
                <TabsTrigger value="30d">30d</TabsTrigger>
                <TabsTrigger value="90d">90d</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        
        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <MetricCard
            title="Total Volume"
            value={`$${(summary.totalVolume / 1000000).toFixed(2)}M`}
            change={12.5}
            changeLabel="vs last week"
            icon={DollarSign}
            trend="up"
          />
          <MetricCard
            title="Payment Count"
            value={summary.totalCount.toLocaleString()}
            change={8.3}
            changeLabel="vs last week"
            icon={Activity}
            trend="up"
          />
          <MetricCard
            title="Success Rate"
            value={`${summary.avgSuccessRate.toFixed(1)}%`}
            change={0.3}
            changeLabel="vs last week"
            icon={CheckCircle}
            trend="up"
          />
          <MetricCard
            title="Avg Settlement"
            value={`${summary.avgSettlementTime.toFixed(1)}s`}
            change={-5.2}
            changeLabel="vs last week"
            icon={Clock}
            trend="up"
          />
        </div>
        
        {/* Charts Row 1 */}
        <div className="grid grid-cols-2 gap-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-cyan-400" />
                Daily Volume
              </CardTitle>
              <CardDescription>Payment volume over the last 7 days</CardDescription>
            </CardHeader>
            <CardContent>
              <VolumeChart data={DAILY_METRICS} />
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-400" />
                Success Rate
              </CardTitle>
              <CardDescription>Daily payment success rates</CardDescription>
            </CardHeader>
            <CardContent>
              <SuccessRateChart data={DAILY_METRICS} />
            </CardContent>
          </Card>
        </div>
        
        {/* Scheme Breakdown */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="w-5 h-5 text-purple-400" />
              Scheme Performance
            </CardTitle>
            <CardDescription>Volume and performance by payment scheme</CardDescription>
          </CardHeader>
          <CardContent>
            <SchemeBreakdown data={SCHEME_METRICS} />
          </CardContent>
        </Card>
        
        {/* Charts Row 2 */}
        <div className="grid grid-cols-2 gap-6">
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-amber-400" />
                Hourly Distribution
              </CardTitle>
              <CardDescription>Payment activity by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              <HourlyHeatmap data={HOURLY_DISTRIBUTION} />
            </CardContent>
          </Card>
          
          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-cyan-400" />
                Settlement Time
              </CardTitle>
              <CardDescription>Average settlement time by day</CardDescription>
            </CardHeader>
            <CardContent>
              <SettlementTimeChart data={DAILY_METRICS} />
            </CardContent>
          </Card>
        </div>
        
        {/* Real-time Stats */}
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-400" />
              Real-time Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-5 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-emerald-400">12</p>
                <p className="text-sm text-slate-500">Processing</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-cyan-400">847</p>
                <p className="text-sm text-slate-500">Today's Count</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-slate-200">$2.4M</p>
                <p className="text-sm text-slate-500">Today's Volume</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-amber-400">3</p>
                <p className="text-sm text-slate-500">Pending Review</p>
              </div>
              <div className="p-4 bg-slate-800/50 rounded-lg text-center">
                <p className="text-3xl font-bold text-red-400">1</p>
                <p className="text-sm text-slate-500">Failed Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
