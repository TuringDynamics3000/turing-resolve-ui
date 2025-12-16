CREATE TABLE `audit_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`factId` varchar(64) NOT NULL,
	`actor` varchar(128) NOT NULL,
	`actorRole` varchar(64) NOT NULL,
	`actionType` enum('KILL_SWITCH_ENABLE','KILL_SWITCH_DISABLE','PAYMENT_RETRY','PAYMENT_REVERSE','ADVISORY_NOTE_ADDED','INCIDENT_ANNOTATION') NOT NULL,
	`targetType` enum('PAYMENT','ACCOUNT','ADAPTER','SYSTEM') NOT NULL,
	`targetId` varchar(64) NOT NULL,
	`reason` text,
	`metadata` json,
	`result` enum('ACCEPTED','REJECTED') NOT NULL,
	`resultReason` text,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `audit_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_facts_factId_unique` UNIQUE(`factId`)
);
