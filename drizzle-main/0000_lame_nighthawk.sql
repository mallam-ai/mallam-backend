CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`source` text NOT NULL,
	`source_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_source` ON `users` (`source`);--> statement-breakpoint
CREATE INDEX `idx_users_source_user_id` ON `users` (`source_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_unique_source_with_id` ON `users` (`source`,`source_user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);