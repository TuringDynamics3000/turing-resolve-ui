CREATE TABLE `advisory_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`factId` varchar(64) NOT NULL,
	`entityType` enum('PAYMENT','ACCOUNT') NOT NULL,
	`entityId` varchar(64) NOT NULL,
	`advisoryType` enum('RECOMMEND_RETRY','RECOMMEND_REVERSAL','HOLD_FOR_REVIEW','NO_ACTION') NOT NULL,
	`note` text NOT NULL,
	`actor` varchar(128) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `advisory_facts_id` PRIMARY KEY(`id`),
	CONSTRAINT `advisory_facts_factId_unique` UNIQUE(`factId`)
);
