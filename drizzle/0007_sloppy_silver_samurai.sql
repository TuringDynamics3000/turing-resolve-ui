CREATE TABLE `shadow_ai_advisory_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`advisoryId` varchar(64) NOT NULL,
	`domain` enum('PAYMENTS_RL','FRAUD','AML','TREASURY') NOT NULL,
	`entityType` enum('PAYMENT','DEPOSIT','LOAN','EXPOSURE') NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`recommendation` enum('APPROVE','REVIEW','DECLINE','HOLD','ESCALATE','NO_ACTION') NOT NULL,
	`confidence` decimal(5,4) NOT NULL,
	`reasoning` text NOT NULL,
	`modelVersion` varchar(64) NOT NULL,
	`modelType` varchar(64),
	`metadata` json,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `shadow_ai_advisory_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `shadow_ai_advisory_facts_advisoryId_unique` UNIQUE(`advisoryId`)
);
