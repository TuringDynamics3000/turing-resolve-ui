import React, { createContext, useContext, useState, ReactNode } from 'react';

export type UserRole = 
  | 'BOARD_VIEWER' 
  | 'OPS_ANALYST' 
  | 'OPS_SUPERVISOR' 
  | 'COMPLIANCE_VIEWER' 
  | 'POLICY_AUTHOR' 
  | 'SYSTEM_ADMIN';

export type Environment = 'DEV' | 'STAGING' | 'PROD';

interface RoleContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
  environment: Environment;
  setEnvironment: (env: Environment) => void;
  isLedgerFrozen: boolean;
}

const RoleContext = createContext<RoleContextType | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<UserRole>('OPS_ANALYST');
  const [environment, setEnvironment] = useState<Environment>('PROD');
  const isLedgerFrozen = true; // Always true for TuringCore-v3

  return (
    <RoleContext.Provider value={{ role, setRole, environment, setEnvironment, isLedgerFrozen }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole() {
  const context = useContext(RoleContext);
  if (context === undefined) {
    throw new Error('useRole must be used within a RoleProvider');
  }
  return context;
}
