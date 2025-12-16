CREATE TABLE `loan_facts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loanId` varchar(64) NOT NULL,
	`sequence` int NOT NULL,
	`factType` enum('LOAN_OFFERED','LOAN_ACCEPTED','LOAN_ACTIVATED','LOAN_PAYMENT_APPLIED','INTEREST_ACCRUED','FEE_APPLIED','LOAN_IN_ARREARS','HARDSHIP_ENTERED','HARDSHIP_EXITED','LOAN_RESTRUCTURED','LOAN_DEFAULTED','LOAN_CLOSED','LOAN_WRITTEN_OFF') NOT NULL,
	`factData` json NOT NULL,
	`depositFactId` int,
	`depositPostingType` varchar(32),
	`decisionId` varchar(64),
	`occurredAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `loan_facts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `loans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`loanId` varchar(64) NOT NULL,
	`borrowerAccountId` varchar(64) NOT NULL,
	`principal` decimal(18,2) NOT NULL,
	`interestRate` decimal(5,4) NOT NULL,
	`termMonths` int NOT NULL,
	`state` enum('OFFERED','ACTIVE','IN_ARREARS','HARDSHIP','DEFAULT','CLOSED','WRITTEN_OFF') NOT NULL,
	`disbursementAccountId` varchar(64),
	`activatedAt` timestamp,
	`totalPaid` decimal(18,2) NOT NULL DEFAULT '0.00',
	`principalPaid` decimal(18,2) NOT NULL DEFAULT '0.00',
	`interestPaid` decimal(18,2) NOT NULL DEFAULT '0.00',
	`feesPaid` decimal(18,2) NOT NULL DEFAULT '0.00',
	`daysPastDue` int DEFAULT 0,
	`amountOverdue` decimal(18,2) DEFAULT '0.00',
	`decisionId` varchar(64),
	`offeredAt` timestamp NOT NULL,
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `loans_id` PRIMARY KEY(`id`),
	CONSTRAINT `loans_loanId_unique` UNIQUE(`loanId`)
);
