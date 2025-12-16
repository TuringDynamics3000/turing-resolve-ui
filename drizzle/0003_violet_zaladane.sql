CREATE TABLE `deposit_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`productType` varchar(32) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'AUD',
	`status` enum('OPEN','CLOSED') NOT NULL DEFAULT 'OPEN',
	`customerSegment` varchar(32),
	`ledgerBalance` decimal(18,2) NOT NULL DEFAULT '0.00',
	`availableBalance` decimal(18,2) NOT NULL DEFAULT '0.00',
	`holdCount` int NOT NULL DEFAULT 0,
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deposit_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `deposit_accounts_accountId_unique` UNIQUE(`accountId`)
);
--> statement-breakpoint
CREATE TABLE `deposit_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`factId` varchar(64) NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`sequence` int NOT NULL,
	`factType` enum('ACCOUNT_OPENED','POSTING_APPLIED','ACCOUNT_CLOSED') NOT NULL,
	`factData` json NOT NULL,
	`decisionId` varchar(64),
	`commandId` varchar(64),
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deposit_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `deposit_facts_factId_unique` UNIQUE(`factId`)
);
--> statement-breakpoint
CREATE TABLE `deposit_holds` (
	`id` int AUTO_INCREMENT NOT NULL,
	`holdId` varchar(64) NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'AUD',
	`holdType` varchar(32) NOT NULL,
	`reason` text,
	`status` enum('ACTIVE','RELEASED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
	`placedAt` timestamp NOT NULL,
	`releasedAt` timestamp,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deposit_holds_id` PRIMARY KEY(`id`),
	CONSTRAINT `deposit_holds_holdId_unique` UNIQUE(`holdId`)
);
