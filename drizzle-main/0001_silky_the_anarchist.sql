CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_memberships_user_id` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_team_id` ON `memberships` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_created_by` ON `memberships` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_memberships_created_at` ON `memberships` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_unique_user_with_team` ON `memberships` (`user_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_role` ON `memberships` (`role`);--> statement-breakpoint
CREATE INDEX `idx_teams_created_at` ON `teams` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_teams_deleted_at` ON `teams` (`deleted_at`);