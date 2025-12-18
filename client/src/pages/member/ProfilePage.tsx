import { 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  HelpCircle, 
  LogOut,
  ChevronRight,
  Fingerprint,
  Smartphone,
  Mail,
  Lock,
  FileText
} from "lucide-react";
import { Link } from "wouter";
import { MemberPortalLayout } from "@/components/MemberPortalLayout";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

// ============================================
// MOCK DATA
// ============================================

const MEMBER = {
  name: "Sarah Mitchell",
  email: "sarah.mitchell@email.com",
  phone: "0412 345 678",
  memberId: "CU-2847291",
  memberSince: "March 2019",
};

// ============================================
// COMPONENTS
// ============================================

function ProfileHeader() {
  return (
    <div className="px-6 py-8 flex flex-col items-center">
      <div className="w-24 h-24 rounded-full bg-gradient-to-br from-coral-500 to-orange-500 flex items-center justify-center text-white font-bold text-3xl mb-4">
        {MEMBER.name.split(" ").map(n => n[0]).join("")}
      </div>
      <h1 className="text-2xl font-bold text-white">{MEMBER.name}</h1>
      <p className="text-slate-400 mt-1">{MEMBER.email}</p>
      <div className="flex items-center gap-2 mt-3">
        <span className="px-3 py-1 bg-coral-500/20 text-coral-400 text-sm font-medium rounded-full">
          Member since {MEMBER.memberSince}
        </span>
      </div>
    </div>
  );
}

interface SettingsItemProps {
  icon: React.ElementType;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  danger?: boolean;
}

function SettingsItem({ icon: Icon, label, description, href, onClick, trailing, danger }: SettingsItemProps) {
  const content = (
    <div className={`flex items-center gap-4 p-4 hover:bg-slate-800/50 transition-colors ${danger ? "text-red-400" : ""}`}>
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
        danger ? "bg-red-500/20" : "bg-slate-800"
      }`}>
        <Icon className={`w-5 h-5 ${danger ? "text-red-400" : "text-slate-400"}`} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={`font-medium ${danger ? "text-red-400" : "text-white"}`}>{label}</p>
        {description && <p className="text-sm text-slate-500">{description}</p>}
      </div>
      {trailing || <ChevronRight className="w-5 h-5 text-slate-600" />}
    </div>
  );
  
  if (href) {
    return <Link href={href}><a className="block">{content}</a></Link>;
  }
  
  return <button onClick={onClick} className="w-full text-left">{content}</button>;
}

function SettingsSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 pb-6">
      <h2 className="text-sm font-medium text-slate-500 mb-2 px-4">{title}</h2>
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800/50 divide-y divide-slate-800/50 overflow-hidden">
        {children}
      </div>
    </div>
  );
}

function QuickSettings() {
  return (
    <div className="px-6 pb-6">
      <div className="bg-slate-900/80 rounded-2xl border border-slate-800/50 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fingerprint className="w-5 h-5 text-coral-400" />
            <span className="text-white">Face ID / Touch ID</span>
          </div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Bell className="w-5 h-5 text-coral-400" />
            <span className="text-white">Push Notifications</span>
          </div>
          <Switch defaultChecked />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-coral-400" />
            <span className="text-white">Email Alerts</span>
          </div>
          <Switch />
        </div>
      </div>
    </div>
  );
}

// ============================================
// MAIN PAGE
// ============================================

export default function ProfilePage() {
  return (
    <MemberPortalLayout title="Profile" showBack>
      <ProfileHeader />
      
      <QuickSettings />
      
      <SettingsSection title="Account">
        <SettingsItem 
          icon={User} 
          label="Personal Details" 
          description="Name, address, contact info"
          href="/member/profile/details"
        />
        <SettingsItem 
          icon={Shield} 
          label="Limits & Security" 
          description="Transaction limits, 2FA settings"
          href="/member/limits"
        />
        <SettingsItem 
          icon={CreditCard} 
          label="Cards" 
          description="Manage your debit cards"
          href="/member/cards"
        />
      </SettingsSection>
      
      <SettingsSection title="Security">
        <SettingsItem 
          icon={Lock} 
          label="Change Password" 
          href="/member/profile/password"
        />
        <SettingsItem 
          icon={Smartphone} 
          label="Linked Devices" 
          description="3 devices"
          href="/member/profile/devices"
        />
      </SettingsSection>
      
      <SettingsSection title="Support">
        <SettingsItem 
          icon={HelpCircle} 
          label="Help Centre" 
          href="/member/help"
        />
        <SettingsItem 
          icon={FileText} 
          label="Terms & Conditions" 
          href="/member/terms"
        />
      </SettingsSection>
      
      <div className="px-6 pb-8">
        <Button 
          variant="outline" 
          className="w-full h-12 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 rounded-xl"
        >
          <LogOut className="w-5 h-5 mr-2" />
          Sign Out
        </Button>
        <p className="text-center text-xs text-slate-600 mt-4">
          Member ID: {MEMBER.memberId}
        </p>
      </div>
    </MemberPortalLayout>
  );
}
