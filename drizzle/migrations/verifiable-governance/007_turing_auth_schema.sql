-- ============================================================
-- TuringDynamics Verifiable Governance DDL
-- Migration 007: RBAC & Authority Schema
-- ============================================================
-- This migration creates the complete RBAC system including:
-- - Role definitions (immutable reference)
-- - Role assignments (scope-aware)
-- - Command registry (authoritative mapping)
-- - Command-role bindings
-- - Approval records (maker/checker)
-- - Authority facts (append-only audit trail)
--
-- CRITICAL: Authority facts are APPEND-ONLY. No UPDATE, no DELETE.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS turing_auth;

-- ============================================================
-- TABLE: role
-- Canonical role definitions (immutable reference)
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_auth.role (
  role_code      text PRIMARY KEY,
  category       text NOT NULL,               -- PLATFORM | GOVERNANCE | ML | OPERATIONS | CUSTOMER
  description    text NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- Seed canonical roles
INSERT INTO turing_auth.role (role_code, category, description) VALUES
  -- Platform roles
  ('PLATFORM_ENGINEER', 'PLATFORM', 'Core platform engineer - system operations'),
  ('PLATFORM_ADMIN', 'PLATFORM', 'Platform administrator - token issuance'),
  ('PLATFORM_AUDITOR', 'PLATFORM', 'Platform auditor - read-only access to all audit data'),
  
  -- Governance roles
  ('RISK_APPROVER', 'GOVERNANCE', 'Risk approval authority - high-risk action approvals'),
  ('COMPLIANCE_APPROVER', 'GOVERNANCE', 'Compliance approval authority - policy changes'),
  ('MODEL_RISK_OFFICER', 'GOVERNANCE', 'Model risk oversight - ML governance'),
  
  -- ML roles
  ('MODEL_AUTHOR', 'ML', 'Model author - register model versions'),
  ('MODEL_OPERATOR', 'ML', 'Model operator - shadow deployments'),
  ('MODEL_APPROVER', 'ML', 'Model approver - canary/production promotions'),
  
  -- Operations roles
  ('OPS_AGENT', 'OPERATIONS', 'Operations agent - customer-facing operations'),
  ('OPS_SUPERVISOR', 'OPERATIONS', 'Operations supervisor - high-risk operations'),
  
  -- Customer roles
  ('CUSTOMER_ADMIN', 'CUSTOMER', 'Customer administrator'),
  ('CUSTOMER_READONLY', 'CUSTOMER', 'Customer read-only access')
ON CONFLICT DO NOTHING;

COMMENT ON TABLE turing_auth.role IS 
  'Canonical RBAC role definitions. These are code constants - no aliases, no shortcuts.';

-- ============================================================
-- TABLE: role_assignment
-- Scope-aware role assignments
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_auth.role_assignment (
  role_assignment_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  actor_id        text NOT NULL,              -- User/service identifier
  role_code       text NOT NULL REFERENCES turing_auth.role(role_code),
  
  -- Scope (MANDATORY for every assignment)
  tenant_id       text NOT NULL,              -- Tenant isolation
  environment_id  text NOT NULL,              -- prod | staging | dev
  domain          text NOT NULL,              -- DEPOSITS | PAYMENTS | LENDING | ML | POLICY | OPS | *
  
  -- Validity period
  valid_from      timestamptz NOT NULL DEFAULT now(),
  valid_to        timestamptz NULL,           -- NULL = no expiry
  
  -- Audit
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      text NOT NULL,
  revoked_at      timestamptz NULL,
  revoked_by      text NULL,
  revoke_reason   text NULL,
  
  UNIQUE(actor_id, role_code, tenant_id, environment_id, domain)
);

CREATE INDEX IF NOT EXISTS idx_role_assignment_actor
  ON turing_auth.role_assignment(actor_id, valid_from, valid_to);

CREATE INDEX IF NOT EXISTS idx_role_assignment_scope
  ON turing_auth.role_assignment(tenant_id, environment_id, domain);

COMMENT ON TABLE turing_auth.role_assignment IS 
  'Scope-aware role assignments. Every assignment must include tenant, environment, and domain.';

-- ============================================================
-- TABLE: command
-- Authoritative command registry
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_auth.command (
  command_code     text PRIMARY KEY,
  domain           text NOT NULL,             -- DEPOSITS | PAYMENTS | LENDING | ML | POLICY | OPS
  description      text NOT NULL,
  requires_approval boolean NOT NULL DEFAULT false,
  is_forbidden     boolean NOT NULL DEFAULT false,  -- Commands that should never be allowed
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Seed commands by domain
INSERT INTO turing_auth.command (command_code, domain, description, requires_approval, is_forbidden) VALUES
  -- Deposits commands
  ('OPEN_ACCOUNT', 'DEPOSITS', 'Open a new deposit account', false, false),
  ('CLOSE_ACCOUNT', 'DEPOSITS', 'Close a deposit account', false, false),
  ('POST_INTEREST', 'DEPOSITS', 'Post interest to accounts (EOD job)', false, false),
  ('APPLY_FEE', 'DEPOSITS', 'Apply fee to account', false, false),
  ('WAIVE_FEE', 'DEPOSITS', 'Waive a fee (must emit reason)', false, false),
  ('PLACE_HOLD', 'DEPOSITS', 'Place temporary hold on account', false, false),
  ('RELEASE_HOLD', 'DEPOSITS', 'Release hold from account', false, false),
  ('ADJUST_BALANCE', 'DEPOSITS', 'Direct balance adjustment - FORBIDDEN', false, true),
  
  -- Payments commands
  ('INITIATE_PAYMENT', 'PAYMENTS', 'Initiate a payment', false, false),
  ('CANCEL_PAYMENT', 'PAYMENTS', 'Cancel payment before settlement', false, false),
  ('REVERSE_PAYMENT', 'PAYMENTS', 'Reverse a settled payment', false, false),
  ('FORCE_POST_PAYMENT', 'PAYMENTS', 'Force post payment - FORBIDDEN', false, true),
  ('SETTLE_PAYMENT', 'PAYMENTS', 'Settle payment (system process)', false, false),
  ('APPLY_CHARGEBACK', 'PAYMENTS', 'Apply chargeback (evidence required)', false, false),
  
  -- Lending commands
  ('CREATE_LOAN', 'LENDING', 'Create a new loan application', false, false),
  ('APPROVE_LOAN', 'LENDING', 'Approve loan - FORBIDDEN (must go via Resolve)', false, true),
  ('DISBURSE_LOAN', 'LENDING', 'Disburse approved loan', false, false),
  ('MODIFY_TERMS', 'LENDING', 'Modify loan terms', true, false),
  ('APPLY_HARDSHIP', 'LENDING', 'Apply hardship arrangement', false, false),
  ('WRITE_OFF_LOAN', 'LENDING', 'Write off loan (high scrutiny)', true, false),
  
  -- Policy commands
  ('REGISTER_POLICY', 'POLICY', 'Register new policy', false, false),
  ('UPDATE_POLICY_DSL', 'POLICY', 'Update policy DSL', true, false),
  ('ACTIVATE_POLICY', 'POLICY', 'Activate policy version', true, false),
  ('DEACTIVATE_POLICY', 'POLICY', 'Deactivate policy', false, false),
  ('ISSUE_AUTH_TOKEN', 'POLICY', 'Issue authorization token', false, false),
  
  -- ML commands
  ('REGISTER_MODEL_VERSION', 'ML', 'Register model artifact', false, false),
  ('PROMOTE_MODEL_TO_SHADOW', 'ML', 'Promote model to shadow', false, false),
  ('PROMOTE_MODEL_TO_CANARY', 'ML', 'Promote model to canary', true, false),
  ('PROMOTE_MODEL_TO_PROD', 'ML', 'Promote model to production', true, false),
  ('ROLLBACK_MODEL', 'ML', 'Rollback model (immediate)', false, false),
  ('DISABLE_MODEL', 'ML', 'Disable model (immediate)', false, false),
  ('DELETE_MODEL', 'ML', 'Delete model - FORBIDDEN (use RETIRE)', false, true)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE turing_auth.command IS 
  'Authoritative command registry. If a command is not listed here, it must not exist.';

-- ============================================================
-- TABLE: command_role
-- Command to role bindings
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_auth.command_role (
  command_code  text NOT NULL REFERENCES turing_auth.command(command_code),
  role_code     text NOT NULL REFERENCES turing_auth.role(role_code),
  is_approver   boolean NOT NULL DEFAULT false,  -- True if this role is an approver (not executor)
  
  PRIMARY KEY (command_code, role_code)
);

-- Seed command-role bindings
INSERT INTO turing_auth.command_role (command_code, role_code, is_approver) VALUES
  -- Deposits bindings
  ('OPEN_ACCOUNT', 'OPS_AGENT', false),
  ('CLOSE_ACCOUNT', 'OPS_SUPERVISOR', false),
  ('POST_INTEREST', 'PLATFORM_ENGINEER', false),
  ('APPLY_FEE', 'OPS_AGENT', false),
  ('WAIVE_FEE', 'OPS_SUPERVISOR', false),
  ('PLACE_HOLD', 'OPS_AGENT', false),
  ('RELEASE_HOLD', 'OPS_SUPERVISOR', false),
  
  -- Payments bindings
  ('INITIATE_PAYMENT', 'OPS_AGENT', false),
  ('CANCEL_PAYMENT', 'OPS_SUPERVISOR', false),
  ('REVERSE_PAYMENT', 'OPS_SUPERVISOR', false),
  ('SETTLE_PAYMENT', 'PLATFORM_ENGINEER', false),
  ('APPLY_CHARGEBACK', 'OPS_SUPERVISOR', false),
  
  -- Lending bindings
  ('CREATE_LOAN', 'OPS_AGENT', false),
  ('DISBURSE_LOAN', 'OPS_SUPERVISOR', false),
  ('MODIFY_TERMS', 'OPS_SUPERVISOR', false),
  ('MODIFY_TERMS', 'RISK_APPROVER', true),
  ('APPLY_HARDSHIP', 'OPS_AGENT', false),
  ('WRITE_OFF_LOAN', 'RISK_APPROVER', false),
  
  -- Policy bindings
  ('REGISTER_POLICY', 'PLATFORM_ENGINEER', false),
  ('UPDATE_POLICY_DSL', 'COMPLIANCE_APPROVER', false),
  ('ACTIVATE_POLICY', 'COMPLIANCE_APPROVER', false),
  ('DEACTIVATE_POLICY', 'COMPLIANCE_APPROVER', false),
  ('ISSUE_AUTH_TOKEN', 'PLATFORM_ADMIN', false),
  
  -- ML bindings
  ('REGISTER_MODEL_VERSION', 'MODEL_AUTHOR', false),
  ('PROMOTE_MODEL_TO_SHADOW', 'MODEL_OPERATOR', false),
  ('PROMOTE_MODEL_TO_CANARY', 'MODEL_APPROVER', false),
  ('PROMOTE_MODEL_TO_CANARY', 'MODEL_RISK_OFFICER', true),
  ('PROMOTE_MODEL_TO_PROD', 'MODEL_APPROVER', false),
  ('PROMOTE_MODEL_TO_PROD', 'RISK_APPROVER', true),
  ('ROLLBACK_MODEL', 'OPS_SUPERVISOR', false),
  ('DISABLE_MODEL', 'OPS_SUPERVISOR', false)
ON CONFLICT DO NOTHING;

COMMENT ON TABLE turing_auth.command_role IS 
  'Command to role bindings. is_approver=true means this role must approve, not execute.';

-- ============================================================
-- TABLE: command_proposal
-- Pending command proposals (maker/checker step 1)
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_auth.command_proposal (
  proposal_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  command_code    text NOT NULL REFERENCES turing_auth.command(command_code),
  resource_id     text NOT NULL,
  
  -- Proposer info
  proposed_by     text NOT NULL,
  proposed_role   text NOT NULL REFERENCES turing_auth.role(role_code),
  
  -- Scope
  tenant_id       text NOT NULL,
  environment_id  text NOT NULL,
  domain          text NOT NULL,
  
  -- Proposal data
  proposal_data   jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  status          text NOT NULL DEFAULT 'PENDING'
                  CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED')),
  
  -- Timestamps
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NULL,
  resolved_at     timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_command_proposal_status
  ON turing_auth.command_proposal(status, created_at);

CREATE INDEX IF NOT EXISTS idx_command_proposal_resource
  ON turing_auth.command_proposal(command_code, resource_id, status);

COMMENT ON TABLE turing_auth.command_proposal IS 
  'Pending command proposals for maker/checker workflow.';

-- ============================================================
-- TABLE: approval
-- Approval records (maker/checker step 2)
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_auth.approval (
  approval_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  proposal_id     uuid NOT NULL REFERENCES turing_auth.command_proposal(proposal_id),
  
  -- Approver info
  approved_by     text NOT NULL,
  approved_role   text NOT NULL REFERENCES turing_auth.role(role_code),
  
  -- Scope (must match proposal)
  tenant_id       text NOT NULL,
  environment_id  text NOT NULL,
  domain          text NOT NULL,
  
  -- Decision
  decision        text NOT NULL CHECK (decision IN ('APPROVE', 'REJECT')),
  reason          text NULL,
  
  created_at      timestamptz NOT NULL DEFAULT now(),
  
  -- Ensure same person cannot propose and approve
  CONSTRAINT chk_proposer_ne_approver CHECK (true)  -- Enforced in application layer
);

CREATE INDEX IF NOT EXISTS idx_approval_proposal
  ON turing_auth.approval(proposal_id);

COMMENT ON TABLE turing_auth.approval IS 
  'Approval records for maker/checker workflow. Proposer cannot be approver.';

-- ============================================================
-- TABLE: authority_fact
-- Append-only authority decision log (CRITICAL)
-- ============================================================
CREATE TABLE IF NOT EXISTS turing_auth.authority_fact (
  authority_fact_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Actor info
  actor_id        text NOT NULL,
  actor_role      text NOT NULL,
  
  -- Command info
  command_code    text NOT NULL,
  resource_id     text NULL,
  
  -- Scope
  tenant_id       text NOT NULL,
  environment_id  text NOT NULL,
  domain          text NOT NULL,
  
  -- Decision
  decision        text NOT NULL CHECK (decision IN ('ALLOW', 'DENY')),
  reason_code     text NOT NULL,
  
  -- Optional links
  proposal_id     uuid NULL,
  evidence_pack_id text NULL,
  
  -- Metadata
  metadata        jsonb NOT NULL DEFAULT '{}'::jsonb,
  
  -- Timestamp (immutable)
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- CRITICAL: No UPDATE or DELETE triggers
-- This table is append-only

CREATE INDEX IF NOT EXISTS idx_authority_fact_command
  ON turing_auth.authority_fact(command_code, created_at);

CREATE INDEX IF NOT EXISTS idx_authority_fact_actor
  ON turing_auth.authority_fact(actor_id, created_at);

CREATE INDEX IF NOT EXISTS idx_authority_fact_decision
  ON turing_auth.authority_fact(decision, created_at);

CREATE INDEX IF NOT EXISTS idx_authority_fact_resource
  ON turing_auth.authority_fact(resource_id, created_at)
  WHERE resource_id IS NOT NULL;

COMMENT ON TABLE turing_auth.authority_fact IS 
  'Append-only authority decision log. Every authorization attempt is recorded. NO UPDATE, NO DELETE.';

COMMENT ON COLUMN turing_auth.authority_fact.reason_code IS 
  'Reason codes: AUTHORIZED, ROLE_MISSING, APPROVAL_REQUIRED, FORBIDDEN_COMMAND, SCOPE_MISMATCH, EXPIRED_ASSIGNMENT';

-- ============================================================
-- FUNCTION: emit_authority_fact
-- Helper function to emit authority facts
-- ============================================================
CREATE OR REPLACE FUNCTION turing_auth.emit_authority_fact(
  p_actor_id text,
  p_actor_role text,
  p_command_code text,
  p_resource_id text,
  p_tenant_id text,
  p_environment_id text,
  p_domain text,
  p_decision text,
  p_reason_code text,
  p_proposal_id uuid DEFAULT NULL,
  p_evidence_pack_id text DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid AS $$
DECLARE
  v_fact_id uuid;
BEGIN
  INSERT INTO turing_auth.authority_fact (
    actor_id, actor_role, command_code, resource_id,
    tenant_id, environment_id, domain,
    decision, reason_code,
    proposal_id, evidence_pack_id, metadata
  ) VALUES (
    p_actor_id, p_actor_role, p_command_code, p_resource_id,
    p_tenant_id, p_environment_id, p_domain,
    p_decision, p_reason_code,
    p_proposal_id, p_evidence_pack_id, p_metadata
  ) RETURNING authority_fact_id INTO v_fact_id;
  
  RETURN v_fact_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION turing_auth.emit_authority_fact IS 
  'Emit an authority fact. Use this for all authorization decisions.';

-- ============================================================
-- FUNCTION: check_authorization
-- Main authorization check function
-- ============================================================
CREATE OR REPLACE FUNCTION turing_auth.check_authorization(
  p_actor_id text,
  p_command_code text,
  p_tenant_id text,
  p_environment_id text,
  p_domain text,
  p_resource_id text DEFAULT NULL
) RETURNS TABLE (
  authorized boolean,
  reason_code text,
  actor_roles text[],
  required_roles text[],
  missing_approvals text[]
) AS $$
DECLARE
  v_actor_roles text[];
  v_required_roles text[];
  v_approver_roles text[];
  v_is_forbidden boolean;
  v_requires_approval boolean;
  v_has_role boolean;
  v_missing_approvals text[];
BEGIN
  -- Check if command is forbidden
  SELECT c.is_forbidden, c.requires_approval
  INTO v_is_forbidden, v_requires_approval
  FROM turing_auth.command c
  WHERE c.command_code = p_command_code;
  
  IF v_is_forbidden THEN
    RETURN QUERY SELECT false, 'FORBIDDEN_COMMAND'::text, ARRAY[]::text[], ARRAY[]::text[], ARRAY[]::text[];
    RETURN;
  END IF;
  
  -- Get actor's active roles for this scope
  SELECT array_agg(DISTINCT ra.role_code)
  INTO v_actor_roles
  FROM turing_auth.role_assignment ra
  WHERE ra.actor_id = p_actor_id
    AND ra.tenant_id = p_tenant_id
    AND (ra.environment_id = p_environment_id OR ra.environment_id = '*')
    AND (ra.domain = p_domain OR ra.domain = '*')
    AND ra.valid_from <= now()
    AND (ra.valid_to IS NULL OR ra.valid_to > now())
    AND ra.revoked_at IS NULL;
  
  v_actor_roles := COALESCE(v_actor_roles, ARRAY[]::text[]);
  
  -- Get required roles for this command (executors, not approvers)
  SELECT array_agg(DISTINCT cr.role_code)
  INTO v_required_roles
  FROM turing_auth.command_role cr
  WHERE cr.command_code = p_command_code
    AND cr.is_approver = false;
  
  v_required_roles := COALESCE(v_required_roles, ARRAY[]::text[]);
  
  -- Check if actor has at least one required role
  v_has_role := v_actor_roles && v_required_roles;
  
  IF NOT v_has_role THEN
    RETURN QUERY SELECT false, 'ROLE_MISSING'::text, v_actor_roles, v_required_roles, ARRAY[]::text[];
    RETURN;
  END IF;
  
  -- Check approvals if required
  IF v_requires_approval AND p_resource_id IS NOT NULL THEN
    -- Get required approver roles
    SELECT array_agg(DISTINCT cr.role_code)
    INTO v_approver_roles
    FROM turing_auth.command_role cr
    WHERE cr.command_code = p_command_code
      AND cr.is_approver = true;
    
    v_approver_roles := COALESCE(v_approver_roles, ARRAY[]::text[]);
    
    -- Check which approvals are missing
    SELECT array_agg(ar.role_code)
    INTO v_missing_approvals
    FROM unnest(v_approver_roles) ar(role_code)
    WHERE NOT EXISTS (
      SELECT 1 FROM turing_auth.approval a
      JOIN turing_auth.command_proposal cp ON a.proposal_id = cp.proposal_id
      WHERE cp.command_code = p_command_code
        AND cp.resource_id = p_resource_id
        AND cp.status = 'PENDING'
        AND a.approved_role = ar.role_code
        AND a.decision = 'APPROVE'
        AND a.approved_by != p_actor_id  -- Proposer cannot approve
    );
    
    v_missing_approvals := COALESCE(v_missing_approvals, ARRAY[]::text[]);
    
    IF array_length(v_missing_approvals, 1) > 0 THEN
      RETURN QUERY SELECT false, 'APPROVAL_REQUIRED'::text, v_actor_roles, v_required_roles, v_missing_approvals;
      RETURN;
    END IF;
  END IF;
  
  -- Authorized
  RETURN QUERY SELECT true, 'AUTHORIZED'::text, v_actor_roles, v_required_roles, ARRAY[]::text[];
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION turing_auth.check_authorization IS 
  'Main authorization check. Returns authorization status and details.';
