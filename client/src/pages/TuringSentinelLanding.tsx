import { Link } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Eye, 
  Lock, 
  FileCheck, 
  Users, 
  Activity,
  ChevronRight,
  CheckCircle2,
  Fingerprint,
  Scale,
  Zap,
  Database,
  GitBranch,
  ArrowRight
} from "lucide-react";

const SENTINEL_FEATURES = [
  {
    icon: Shield,
    title: "Role-Based Access Control",
    description: "Granular permissions with maker/checker workflows. Every action requires proper authority.",
    href: "/sentinel",
    color: "amber"
  },
  {
    icon: Fingerprint,
    title: "Cryptographic Evidence",
    description: "Every decision generates a signed evidence pack with Merkle inclusion proof.",
    href: "/evidence",
    color: "cyan"
  },
  {
    icon: Eye,
    title: "Complete Audit Trail",
    description: "Authority facts record who did what, when, and why — immutably.",
    href: "/sentinel",
    color: "purple"
  },
  {
    icon: Lock,
    title: "Forbidden Commands",
    description: "Architecturally blocked operations that no role can execute. Ever.",
    href: "/governance-controls",
    color: "red"
  },
  {
    icon: Scale,
    title: "Policy DSL",
    description: "Deterministic policy evaluation with replay guarantees.",
    href: "/policies",
    color: "emerald"
  },
  {
    icon: GitBranch,
    title: "Model Governance",
    description: "ML model lifecycle with shadow → canary → production promotion gates.",
    href: "/ml-models",
    color: "blue"
  }
];

const COMPETITIVE_ADVANTAGES = [
  {
    us: "Cryptographic proof of every decision",
    them: "Audit logs that can be modified"
  },
  {
    us: "Merkle-anchored evidence packs",
    them: "Database records"
  },
  {
    us: "Deterministic replay guarantees",
    them: "Point-in-time snapshots"
  },
  {
    us: "Architecturally forbidden commands",
    them: "Role-based restrictions only"
  }
];

function getColorClasses(color: string) {
  const colors: Record<string, { bg: string; border: string; text: string; icon: string }> = {
    amber: { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400", icon: "text-amber-400" },
    cyan: { bg: "bg-cyan-500/10", border: "border-cyan-500/30", text: "text-cyan-400", icon: "text-cyan-400" },
    purple: { bg: "bg-purple-500/10", border: "border-purple-500/30", text: "text-purple-400", icon: "text-purple-400" },
    red: { bg: "bg-red-500/10", border: "border-red-500/30", text: "text-red-400", icon: "text-red-400" },
    emerald: { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400", icon: "text-emerald-400" },
    blue: { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400", icon: "text-blue-400" },
  };
  return colors[color] || colors.amber;
}

export default function TuringSentinelLanding() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 via-transparent to-cyan-500/5" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-transparent to-transparent" />
        
        <div className="container relative py-16">
          <div className="flex items-center gap-6 mb-8">
            <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 shadow-lg shadow-amber-500/10">
              <Shield className="h-12 w-12 text-amber-400" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400 bg-clip-text text-transparent">
                TuringSentinel
              </h1>
              <p className="text-xl text-zinc-400 mt-1">Vigilant governance, provable decisions</p>
            </div>
          </div>

          <div className="max-w-3xl mb-12">
            <p className="text-lg text-zinc-300 leading-relaxed">
              TuringSentinel is the command center for TuringDynamics governance. Unlike traditional 
              audit logs, every decision generates <span className="text-amber-400 font-semibold">cryptographic proof</span> that 
              can be independently verified. When a regulator asks "prove this decision was correct," 
              you don't show a log — you show a <span className="text-cyan-400 font-semibold">signed evidence pack</span>.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <Link href="/sentinel/console">
              <Button size="lg" className="bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white">
                <Shield className="h-5 w-5 mr-2" />
                Open Console
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </Link>
            <Link href="/evidence">
              <Button size="lg" variant="outline" className="border-zinc-700 hover:bg-zinc-800">
                <FileCheck className="h-5 w-5 mr-2" />
                View Evidence Vault
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="border-y border-zinc-800 bg-zinc-900/50">
        <div className="container py-6">
          <div className="grid grid-cols-4 gap-8">
            <div className="text-center">
              <p className="text-3xl font-bold text-amber-400">1,247</p>
              <p className="text-sm text-zinc-500 uppercase tracking-wider">Authority Decisions</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-emerald-400">87.3%</p>
              <p className="text-sm text-zinc-500 uppercase tracking-wider">Auto-Approved</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-cyan-400">39</p>
              <p className="text-sm text-zinc-500 uppercase tracking-wider">Active Role Assignments</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-bold text-purple-400">100%</p>
              <p className="text-sm text-zinc-500 uppercase tracking-wider">Evidence Packs Verified</p>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container py-12">
        <h2 className="text-2xl font-bold text-zinc-100 mb-8">Governance Capabilities</h2>
        <div className="grid grid-cols-3 gap-6">
          {SENTINEL_FEATURES.map((feature) => {
            const colors = getColorClasses(feature.color);
            return (
              <Link key={feature.title} href={feature.href}>
                <Card className={`bg-zinc-900/50 border-zinc-800 hover:${colors.border} transition-all cursor-pointer group`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${colors.bg}`}>
                        <feature.icon className={`h-6 w-6 ${colors.icon}`} />
                      </div>
                      <CardTitle className="text-lg text-zinc-100 group-hover:text-zinc-50">
                        {feature.title}
                      </CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-zinc-400 text-sm">{feature.description}</p>
                    <div className="flex items-center gap-1 mt-4 text-sm text-zinc-500 group-hover:text-zinc-400">
                      Learn more <ChevronRight className="h-4 w-4" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Competitive Advantage Section */}
      <div className="border-t border-zinc-800 bg-zinc-900/30">
        <div className="container py-12">
          <h2 className="text-2xl font-bold text-zinc-100 mb-2">Why TuringSentinel</h2>
          <p className="text-zinc-400 mb-8">vs. traditional governance consoles</p>
          
          <div className="grid grid-cols-2 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">TuringSentinel</Badge>
              </div>
              <div className="space-y-3">
                {COMPETITIVE_ADVANTAGES.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-zinc-200">{item.us}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Badge variant="outline" className="text-zinc-500 border-zinc-700">Traditional Consoles</Badge>
              </div>
              <div className="space-y-3">
                {COMPETITIVE_ADVANTAGES.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/30 border border-zinc-800/50">
                    <div className="h-5 w-5 rounded-full border border-zinc-700 flex-shrink-0" />
                    <span className="text-zinc-500">{item.them}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="container py-12">
        <h2 className="text-2xl font-bold text-zinc-100 mb-8">Quick Actions</h2>
        <div className="grid grid-cols-4 gap-4">
          <Link href="/sentinel/console">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-amber-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Users className="h-5 w-5 text-amber-400" />
                <span className="text-zinc-200">Manage Roles</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/sentinel/console">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <FileCheck className="h-5 w-5 text-cyan-400" />
                <span className="text-zinc-200">Review Approvals</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/evidence">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-purple-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Fingerprint className="h-5 w-5 text-purple-400" />
                <span className="text-zinc-200">Verify Evidence</span>
              </CardContent>
            </Card>
          </Link>
          <Link href="/governance-controls">
            <Card className="bg-zinc-900/50 border-zinc-800 hover:border-red-500/30 transition-all cursor-pointer">
              <CardContent className="p-4 flex items-center gap-3">
                <Lock className="h-5 w-5 text-red-400" />
                <span className="text-zinc-200">View Boundaries</span>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
