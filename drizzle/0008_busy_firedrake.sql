CREATE TABLE `merkle_anchor_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`eventId` varchar(64) NOT NULL,
	`eventType` enum('AUTHORITY_FACT','ML_INFERENCE','POLICY_EVALUATION','DECISION','LEDGER_POSTING','STATE_TRANSITION') NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`environmentId` varchar(32) NOT NULL,
	`occurredAt` timestamp NOT NULL,
	`leafHash` varchar(64) NOT NULL,
	`leafIndex` int,
	`payload` json,
	`anchorId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merkle_anchor_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `merkle_anchor_events_eventId_unique` UNIQUE(`eventId`)
);
--> statement-breakpoint
CREATE TABLE `merkle_anchor_verifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`verificationId` varchar(64) NOT NULL,
	`anchorId` varchar(64) NOT NULL,
	`verifiedAt` timestamp NOT NULL,
	`verifiedBy` varchar(128) NOT NULL,
	`verificationMethod` enum('INTERNAL','EXTERNAL_AUDITOR','AUTOMATED') NOT NULL,
	`result` enum('VALID','INVALID','TAMPERED') NOT NULL,
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merkle_anchor_verifications_id` PRIMARY KEY(`id`),
	CONSTRAINT `merkle_anchor_verifications_verificationId_unique` UNIQUE(`verificationId`)
);
--> statement-breakpoint
CREATE TABLE `merkle_anchors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`anchorId` varchar(64) NOT NULL,
	`tenantId` varchar(64) NOT NULL,
	`environmentId` varchar(32) NOT NULL,
	`batchNumber` int NOT NULL,
	`rootHash` varchar(64) NOT NULL,
	`eventCount` int NOT NULL,
	`startEventId` varchar(64) NOT NULL,
	`endEventId` varchar(64) NOT NULL,
	`treeLevels` json,
	`previousAnchorId` varchar(64),
	`previousRootHash` varchar(64),
	`chainHash` varchar(64) NOT NULL,
	`signedAt` timestamp NOT NULL,
	`signature` varchar(128) NOT NULL,
	`signingKeyId` varchar(64) NOT NULL,
	`anchorType` enum('S3_OBJECT_LOCK','BLOCKCHAIN','TIMESTAMPING_AUTHORITY','INTERNAL') NOT NULL,
	`externalRef` varchar(512),
	`status` enum('PENDING','ANCHORED','VERIFIED','FAILED') NOT NULL DEFAULT 'PENDING',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `merkle_anchors_id` PRIMARY KEY(`id`),
	CONSTRAINT `merkle_anchors_anchorId_unique` UNIQUE(`anchorId`)
);
