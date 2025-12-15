CREATE TABLE `ledger_accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`accountType` enum('ASSET','LIABILITY','EQUITY','REVENUE','EXPENSE') NOT NULL,
	`name` varchar(255) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'AUD',
	`balance` decimal(18,2) NOT NULL DEFAULT '0.00',
	`frozen` enum('true','false') NOT NULL DEFAULT 'false',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ledger_accounts_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledger_accounts_accountId_unique` UNIQUE(`accountId`)
);
--> statement-breakpoint
CREATE TABLE `ledger_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`entryId` varchar(64) NOT NULL,
	`postingId` varchar(64) NOT NULL,
	`accountId` varchar(64) NOT NULL,
	`direction` enum('DEBIT','CREDIT') NOT NULL,
	`amount` decimal(18,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'AUD',
	`description` text,
	`decisionId` varchar(64),
	`loanId` varchar(64),
	`idempotencyKey` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ledger_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledger_entries_entryId_unique` UNIQUE(`entryId`),
	CONSTRAINT `ledger_entries_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `ledger_postings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postingId` varchar(64) NOT NULL,
	`status` enum('PENDING','COMMITTED','REVERSED') NOT NULL DEFAULT 'PENDING',
	`description` text,
	`decisionId` varchar(64),
	`loanId` varchar(64),
	`idempotencyKey` varchar(128),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`committedAt` timestamp,
	CONSTRAINT `ledger_postings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ledger_postings_postingId_unique` UNIQUE(`postingId`),
	CONSTRAINT `ledger_postings_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
