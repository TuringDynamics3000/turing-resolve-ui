CREATE TABLE `approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`approvalId` varchar(64) NOT NULL,
	`proposalId` varchar(64) NOT NULL,
	`approvedBy` varchar(128) NOT NULL,
	`approvedRole` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`environmentId` varchar(32) NOT NULL,
	`domain` varchar(32) NOT NULL,
	`decision` enum('APPROVE','REJECT') NOT NULL,
	`reason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `approvals_id` PRIMARY KEY(`id`),
	CONSTRAINT `approvals_approvalId_unique` UNIQUE(`approvalId`)
);
--> statement-breakpoint
CREATE TABLE `authority_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`authorityFactId` varchar(64) NOT NULL,
	`actorId` varchar(128) NOT NULL,
	`actorRole` varchar(64) NOT NULL,
	`commandCode` varchar(64) NOT NULL,
	`resourceId` varchar(128),
	`tenantId` varchar(64) NOT NULL,
	`environmentId` varchar(32) NOT NULL,
	`domain` varchar(32) NOT NULL,
	`decision` enum('ALLOW','DENY') NOT NULL,
	`reasonCode` varchar(64) NOT NULL,
	`proposalId` varchar(64),
	`evidencePackId` varchar(64),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `authority_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `authority_facts_authorityFactId_unique` UNIQUE(`authorityFactId`)
);
--> statement-breakpoint
CREATE TABLE `command_proposals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` varchar(64) NOT NULL,
	`commandCode` varchar(64) NOT NULL,
	`resourceId` varchar(128) NOT NULL,
	`proposedBy` varchar(128) NOT NULL,
	`proposedRole` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`environmentId` varchar(32) NOT NULL,
	`domain` varchar(32) NOT NULL,
	`proposalData` json,
	`status` enum('PENDING','APPROVED','REJECTED','EXPIRED','EXECUTED') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`resolvedAt` timestamp,
	CONSTRAINT `command_proposals_id` PRIMARY KEY(`id`),
	CONSTRAINT `command_proposals_proposalId_unique` UNIQUE(`proposalId`)
);
--> statement-breakpoint
CREATE TABLE `command_role_bindings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commandCode` varchar(64) NOT NULL,
	`roleCode` varchar(64) NOT NULL,
	`isApprover` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `command_role_bindings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `rbac_commands` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commandCode` varchar(64) NOT NULL,
	`domain` varchar(32) NOT NULL,
	`description` text NOT NULL,
	`requiresApproval` enum('true','false') NOT NULL DEFAULT 'false',
	`isForbidden` enum('true','false') NOT NULL DEFAULT 'false',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rbac_commands_id` PRIMARY KEY(`id`),
	CONSTRAINT `rbac_commands_commandCode_unique` UNIQUE(`commandCode`)
);
--> statement-breakpoint
CREATE TABLE `rbac_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleCode` varchar(64) NOT NULL,
	`category` enum('PLATFORM','GOVERNANCE','ML','OPERATIONS','CUSTOMER') NOT NULL,
	`description` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `rbac_roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `rbac_roles_roleCode_unique` UNIQUE(`roleCode`)
);
--> statement-breakpoint
CREATE TABLE `role_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`roleAssignmentId` varchar(64) NOT NULL,
	`actorId` varchar(128) NOT NULL,
	`roleCode` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`environmentId` varchar(32) NOT NULL,
	`domain` varchar(32) NOT NULL,
	`validFrom` timestamp NOT NULL DEFAULT (now()),
	`validTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`createdBy` varchar(128) NOT NULL,
	`revokedAt` timestamp,
	`revokedBy` varchar(128),
	`revokeReason` text,
	CONSTRAINT `role_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `role_assignments_roleAssignmentId_unique` UNIQUE(`roleAssignmentId`)
);
