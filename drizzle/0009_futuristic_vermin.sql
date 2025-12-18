CREATE TABLE `customer_currency_balances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`currency` varchar(3) NOT NULL,
	`balance` decimal(18,2) NOT NULL DEFAULT '0.00',
	`availableBalance` decimal(18,2) NOT NULL DEFAULT '0.00',
	`holdAmount` decimal(18,2) NOT NULL DEFAULT '0.00',
	`glAccountId` varchar(64),
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customer_currency_balances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fx_rate_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`baseCurrency` varchar(3) NOT NULL,
	`quoteCurrency` varchar(3) NOT NULL,
	`bidRate` decimal(18,8) NOT NULL,
	`askRate` decimal(18,8) NOT NULL,
	`midRate` decimal(18,8) NOT NULL,
	`source` varchar(64) NOT NULL,
	`validFrom` timestamp NOT NULL,
	`validTo` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fx_rate_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `fx_transactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`transactionId` varchar(64) NOT NULL,
	`customerId` varchar(64) NOT NULL,
	`fromCurrency` varchar(3) NOT NULL,
	`toCurrency` varchar(3) NOT NULL,
	`fromAmount` decimal(18,2) NOT NULL,
	`toAmount` decimal(18,2) NOT NULL,
	`spotRate` decimal(18,8) NOT NULL,
	`customerRate` decimal(18,8) NOT NULL,
	`spreadPercent` decimal(5,4) NOT NULL,
	`postingId` varchar(64),
	`status` enum('PENDING','COMPLETED','FAILED','REVERSED') NOT NULL DEFAULT 'PENDING',
	`executedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `fx_transactions_id` PRIMARY KEY(`id`),
	CONSTRAINT `fx_transactions_transactionId_unique` UNIQUE(`transactionId`)
);
