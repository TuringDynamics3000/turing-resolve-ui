import { createContext, useContext, useState, useCallback, ReactNode } from "react";

// ============================================
// TYPES
// ============================================

export type AuthorityLevel = 
  | "VIEWER"           // Read-only access
  | "OPERATOR"         // Can initiate actions, cannot approve
  | "APPROVER_L1"      // Can approve up to $10k
  | "APPROVER_L2"      // Can approve up to $50k
  | "SUPERVISOR"       // Can approve up to $250k, can escalate
  | "MANAGER"          // Can approve any amount, can override
  | "COMPLIANCE"       // Special compliance authority
  | "ADMIN";           // Full system access

export interface Permission {
  action: string;
  resource: string;
  maxAmount?: number;
  conditions?: string[];
}

export interface Authority {
  level: AuthorityLevel;
  permissions: Permission[];
  delegatedFrom?: string;
  expiresAt?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  authority: Authority;
}

export interface AuthorityContextValue {
  user: User | null;
  isLoading: boolean;
  
  // Permission checks
  hasPermission: (action: string, resource: string, amount?: number) => boolean;
  canApprove: (amount: number) => boolean;
  canEscalate: () => boolean;
  getBlockedReason: (action: string, resource: string, amount?: number) => string | null;
  
  // Authority info
  getAuthorityLevel: () => AuthorityLevel | null;
  getApprovalLimit: () => number;
  getEscalationTarget: () => string;
  
  // Actions
  setUser: (user: User) => void;
  clearUser: () => void;
}

// ============================================
// AUTHORITY LIMITS
// ============================================

const AUTHORITY_LIMITS: Record<AuthorityLevel, number> = {
  VIEWER: 0,
  OPERATOR: 0,
  APPROVER_L1: 10000,
  APPROVER_L2: 50000,
  SUPERVISOR: 250000,
  MANAGER: Infinity,
  COMPLIANCE: 100000,
  ADMIN: Infinity,
};

const ESCALATION_TARGETS: Record<AuthorityLevel, string> = {
  VIEWER: "Operator",
  OPERATOR: "Level 1 Approver",
  APPROVER_L1: "Level 2 Approver",
  APPROVER_L2: "Supervisor",
  SUPERVISOR: "Manager",
  MANAGER: "Compliance",
  COMPLIANCE: "Manager",
  ADMIN: "Board",
};

// ============================================
// CONTEXT
// ============================================

const AuthorityContext = createContext<AuthorityContextValue | null>(null);

// ============================================
// PROVIDER
// ============================================

export function AuthorityProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(() => {
    // Default demo user
    return {
      id: "USR-001",
      name: "Sarah Chen",
      email: "sarah.chen@turingdynamics.com",
      role: "Operations Supervisor",
      authority: {
        level: "SUPERVISOR",
        permissions: [
          { action: "approve", resource: "payment", maxAmount: 250000 },
          { action: "approve", resource: "loan", maxAmount: 250000 },
          { action: "review", resource: "*" },
          { action: "escalate", resource: "*" },
          { action: "view", resource: "*" },
        ],
      },
    };
  });
  const [isLoading] = useState(false);
  
  const hasPermission = useCallback((action: string, resource: string, amount?: number): boolean => {
    if (!user) return false;
    
    const permission = user.authority.permissions.find(p => 
      (p.action === action || p.action === "*") &&
      (p.resource === resource || p.resource === "*")
    );
    
    if (!permission) return false;
    
    if (amount !== undefined && permission.maxAmount !== undefined) {
      return amount <= permission.maxAmount;
    }
    
    return true;
  }, [user]);
  
  const canApprove = useCallback((amount: number): boolean => {
    if (!user) return false;
    const limit = AUTHORITY_LIMITS[user.authority.level];
    return amount <= limit;
  }, [user]);
  
  const canEscalate = useCallback((): boolean => {
    if (!user) return false;
    return user.authority.level !== "ADMIN";
  }, [user]);
  
  const getBlockedReason = useCallback((action: string, resource: string, amount?: number): string | null => {
    if (!user) return "Not authenticated";
    
    const permission = user.authority.permissions.find(p => 
      (p.action === action || p.action === "*") &&
      (p.resource === resource || p.resource === "*")
    );
    
    if (!permission) {
      return `You do not have ${action} permission for ${resource}`;
    }
    
    if (amount !== undefined && permission.maxAmount !== undefined && amount > permission.maxAmount) {
      return `Amount exceeds your approval limit of $${permission.maxAmount.toLocaleString()}`;
    }
    
    return null;
  }, [user]);
  
  const getAuthorityLevel = useCallback((): AuthorityLevel | null => {
    return user?.authority.level ?? null;
  }, [user]);
  
  const getApprovalLimit = useCallback((): number => {
    if (!user) return 0;
    return AUTHORITY_LIMITS[user.authority.level];
  }, [user]);
  
  const getEscalationTarget = useCallback((): string => {
    if (!user) return "Supervisor";
    return ESCALATION_TARGETS[user.authority.level];
  }, [user]);
  
  const setUser = useCallback((newUser: User) => {
    setUserState(newUser);
  }, []);
  
  const clearUser = useCallback(() => {
    setUserState(null);
  }, []);
  
  return (
    <AuthorityContext.Provider value={{
      user,
      isLoading,
      hasPermission,
      canApprove,
      canEscalate,
      getBlockedReason,
      getAuthorityLevel,
      getApprovalLimit,
      getEscalationTarget,
      setUser,
      clearUser,
    }}>
      {children}
    </AuthorityContext.Provider>
  );
}

// ============================================
// HOOK
// ============================================

export function useAuthority() {
  const context = useContext(AuthorityContext);
  if (!context) {
    throw new Error("useAuthority must be used within an AuthorityProvider");
  }
  return context;
}

// ============================================
// UTILITY COMPONENTS
// ============================================

export function AuthorityBadge() {
  const { user, getApprovalLimit } = useAuthority();
  
  if (!user) return null;
  
  const limit = getApprovalLimit();
  const limitText = limit === Infinity ? "Unlimited" : `$${limit.toLocaleString()}`;
  
  const levelColors: Record<AuthorityLevel, string> = {
    VIEWER: "bg-slate-500/20 text-slate-300 border-slate-500/30",
    OPERATOR: "bg-blue-500/20 text-blue-300 border-blue-500/30",
    APPROVER_L1: "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
    APPROVER_L2: "bg-teal-500/20 text-teal-300 border-teal-500/30",
    SUPERVISOR: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    MANAGER: "bg-purple-500/20 text-purple-300 border-purple-500/30",
    COMPLIANCE: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    ADMIN: "bg-red-500/20 text-red-300 border-red-500/30",
  };
  
  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border ${levelColors[user.authority.level]}`}>
      <span className="text-xs font-medium">{user.authority.level.replace("_", " ")}</span>
      <span className="text-xs opacity-60">|</span>
      <span className="text-xs">{limitText}</span>
    </div>
  );
}

export function PermissionGate({ 
  action, 
  resource, 
  amount,
  children,
  fallback,
}: { 
  action: string;
  resource: string;
  amount?: number;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const { hasPermission, getBlockedReason } = useAuthority();
  
  if (hasPermission(action, resource, amount)) {
    return <>{children}</>;
  }
  
  if (fallback) {
    return <>{fallback}</>;
  }
  
  const reason = getBlockedReason(action, resource, amount);
  
  return (
    <div className="inline-flex items-center gap-2 px-3 py-2 bg-slate-800/50 border border-slate-700 rounded-lg text-sm text-slate-400">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
      <span>{reason}</span>
    </div>
  );
}

export default AuthorityContext;
