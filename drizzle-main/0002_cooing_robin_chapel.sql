ALTER TABLE teams ADD `created_by` text NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_teams_created_by` ON `teams` (`created_by`);