ALTER TABLE histories ADD `status` text NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_histories_status` ON `histories` (`status`);