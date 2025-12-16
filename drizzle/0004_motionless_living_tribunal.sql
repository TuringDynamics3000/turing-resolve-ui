CREATE TABLE `payment_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(64) NOT NULL,
	`sequence` int NOT NULL,
	`factType` enum('PAYMENT_INITIATED','PAYMENT_HOLD_PLACED','PAYMENT_AUTHORISED','PAYMENT_SENT','PAYMENT_SETTLED','PAYMENT_FAILED','PAYMENT_REVERSED') NOT NULL,
	`factData` json NOT NULL,
	`depositFactId` int,
	`depositPostingType` varchar(32),
	`decisionId` varchar(64),
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payment_facts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`paymentId` varchar(64) NOT NULL,
	`fromAccount` varchar(64) NOT NULL,
	`toAccount` varchar(64),
	`toExternal` json,
	`amount` decimal(18,2) NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'AUD',
	`state` enum('INITIATED','HELD','AUTHORISED','SENT','SETTLED','FAILED','REVERSED') NOT NULL DEFAULT 'INITIATED',
	`reference` varchar(255),
	`description` text,
	`activeHoldId` varchar(64),
	`failureReason` text,
	`reversalReason` text,
	`initiatedAt` timestamp NOT NULL,
	`settledAt` timestamp,
	`failedAt` timestamp,
	`reversedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_paymentId_unique` UNIQUE(`paymentId`)
);
