ALTER TABLE `ledger_postings` ADD `reversesPostingId` varchar(64);--> statement-breakpoint
ALTER TABLE `ledger_postings` ADD `reversedBy` varchar(64);--> statement-breakpoint
ALTER TABLE `ledger_postings` ADD `reversedAt` timestamp;