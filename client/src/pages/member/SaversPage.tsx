import { useState } from "react";
import { Plus, Settings, TrendingUp, ArrowRight, Sparkles, Target } from "lucide-react";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================
// TYPES
// ============================================

interface Saver {
  id: string;
  name: string;
  emoji: string;
  current: number;
  target: number;
  color: string;
  autoTransfer?: {
    amount: number;
    frequency: string;
  };
  roundUps: boolean;
  recentActivity: {
    type: string;
    amount: number;
    date: string;
  }[];
}

// ============================================
// MOCK DATA
// ============================================

const SAVERS: Saver[] = [
  { 
    id: "1", 
    name: "Holiday", 
    emoji: "🏖️", 
    current: 2850, 
    target: 5000, 
    color: "coral",
    autoTransfer: { amount: 100, frequency: "weekly" },
    roundUps: true,
    recentActivity: [
      { type: "Round Up", amount: 0.50, date: "Today" },
      { type: "Auto Transfer", amount: 100, date: "Monday" },
      { type: "Round Up", amount: 0.23, date: "Sunday" },
    ]
  },
  { 
    id: "2", 
    name: "New Car", 
    emoji: "🚗", 
    current: 8500, 
    target: 20000, 
    color: "blue",
    autoTransfer: { amount: 200, frequency: "fortnightly" },
    roundUps: false,
    recentActivity: [
      { type: "Auto Transfer", amount: 200, date: "Last Friday" },
      { type: "Manual Transfer", amount: 500, date: "Dec 10" },
    ]
  },
  { 
    id: "3", 
    name: "Emergency", 
    emoji: "🛡️", 
    current: 4200, 
    target: 10000, 
    color: "emerald",
    autoTransfer: { amount: 50, frequency: "weekly" },
    roundUps: true,
    recentActivity: [
      { type: "Auto Transfer", amount: 50, date: "Monday" },
      { type: "Round Up", amount: 0.77, date: "Sunday" },
    ]
  },
  { 
    id: "4", 
    name: "Christmas", 
    emoji: "🎄", 
    current: 1200, 
    target: 1500, 
    color: "red",
    roundUps: false,
    recentActivity: [
      { type: "Manual Transfer", amount: 200, date: "Dec 1" },
    ]
  },
];

const TOTAL_SAVED = SAVERS.reduce((sum, s) => sum + s.current, 0);

// ============================================
// COMPONENTS
// ============================================

function TotalSavedHero() {
  return (
    <div className="px-6 pt-6 pb-4">
      <div className="bg-gradient-to-br from-coral-500/20 to-orange-500/20 rounded-3xl p-6 border border-coral-500/30">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-5 h-5 text-coral-400" />
          <span className="text-coral-400 text-sm font-medium">Total Saved</span>
        </div>
        <p className="text-4xl font-bold text-white">
          ${TOTAL_SAVED.toLocaleString("en-AU", { minimumFractionDigits: 2 })}
        </p>
        <p className="text-slate-400 text-sm mt-2">
          Across {SAVERS.length} savers
        </p>
      </div>
    </div>
  );
}

function SaverProgressRing({ saver, size = "large" }: { saver: Saver; size?: "small" | "large" }) {
  const progress = (saver.current / saver.target) * 100;
  const radius = size === "large" ? 70 : 40;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;
  const viewBox = size === "large" ? "0 0 160 160" : "0 0 100 100";
  const center = size === "large" ? 80 : 50;
  
  const colorClasses: Record<string, string> = {
    coral: "stroke-coral-500",
    blue: "stroke-blue-500",
    emerald: "stroke-emerald-500",
    red: "stroke-red-500",
    purple: "stroke-purple-500",
  };
  
  return (
    <div className="relative" style={{ width: size === "large" ? 160 : 100, height: size === "large" ? 160 : 100 }}>
      <svg className="w-full h-full -rotate-90" viewBox={viewBox}>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={size === "large" ? 10 : 6}
          className="text-slate-800"
        />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          strokeWidth={size === "large" ? 10 : 6}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={`${colorClasses[saver.color]} transition-all duration-700`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={size === "large" ? "text-4xl" : "text-2xl"}>{saver.emoji}</span>
        {size === "large" && (
          <span className="text-xs text-slate-400 mt-1">{Math.round(progress)}%</span>
        )}
      </div>
    </div>
  );
}

function SaverCard({ saver }: { saver: Saver }) {
  const progress = (saver.current / saver.target) * 100;
  const remaining = saver.target - saver.current;
  
  return (
    <div className="bg-slate-900/80 rounded-2xl border border-slate-800/50 p-6 hover:border-slate-700 transition-all">
      <div className="flex items-start gap-6">
        <SaverProgressRing saver={saver} />
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xl font-semibold text-white">{saver.name}</h3>
            <Button variant="ghost" size="icon" className="text-slate-500 hover:text-white">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
          
          <div className="space-y-2 mb-4">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Saved</span>
              <span className="text-white font-medium">${saver.current.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Target</span>
              <span className="text-slate-300">${saver.target.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Remaining</span>
              <span className="text-coral-400">${remaining.toLocaleString()}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap gap-2">
            {saver.autoTransfer && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs">
                <TrendingUp className="w-3 h-3" />
                ${saver.autoTransfer.amount}/{saver.autoTransfer.frequency}
              </span>
            )}
            {saver.roundUps && (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs">
                Round Ups on
              </span>
            )}
          </div>
        </div>
      </div>
      
      {/* Recent Activity */}
      <div className="mt-6 pt-4 border-t border-slate-800/50">
        <p className="text-sm text-slate-500 mb-3">Recent activity</p>
        <div className="space-y-2">
          {saver.recentActivity.slice(0, 3).map((activity, i) => (
            <div key={i} className="flex items-center justify-between text-sm">
              <span className="text-slate-400">{activity.type}</span>
              <div className="flex items-center gap-2">
                <span className="text-emerald-400">+${activity.amount.toFixed(2)}</span>
                <span className="text-slate-600 text-xs">{activity.date}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Transfer Button */}
      <Button className="w-full mt-4 bg-slate-800 hover:bg-slate-700 text-white rounded-xl h-11">
        Transfer to {saver.name}
        <ArrowRight className="w-4 h-4 ml-2" />
      </Button>
    </div>
  );
}

function CreateSaverDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="w-full bg-coral-500 hover:bg-coral-600 text-white rounded-xl h-12">
          <Plus className="w-5 h-5 mr-2" />
          Create New Saver
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-slate-900 border-slate-800 text-white">
        <DialogHeader>
          <DialogTitle>Create a new saver</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          <div>
            <Label className="text-slate-300">What are you saving for?</Label>
            <Input 
              placeholder="e.g., Holiday, New Phone, Emergency Fund"
              className="mt-2 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label className="text-slate-300">Target amount</Label>
            <Input 
              type="number"
              placeholder="$0.00"
              className="mt-2 bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <div>
            <Label className="text-slate-300">Choose an emoji</Label>
            <div className="flex gap-2 mt-2 flex-wrap">
              {["🏖️", "🚗", "🏠", "💍", "🎓", "🎄", "🛡️", "✈️", "📱", "🎮"].map((emoji) => (
                <button
                  key={emoji}
                  className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-2xl transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
          <Button className="w-full bg-coral-500 hover:bg-coral-600 text-white rounded-xl h-12 mt-4">
            Create Saver
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function SaversPage() {
  return (
    <MemberPortalLayout title="Savers" showBack>
      <TotalSavedHero />
      
      <div className="px-6 pb-6">
        <CreateSaverDialog />
      </div>
      
      <div className="px-6 pb-6 space-y-4">
        {SAVERS.map((saver) => (
          <SaverCard key={saver.id} saver={saver} />
        ))}
      </div>
    </MemberPortalLayout>
  );
}
