CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor` text NOT NULL,
	`vendor_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_users_vendor` ON `users` (`vendor`);--> statement-breakpoint
CREATE INDEX `idx_users_vendor_user_id` ON `users` (`vendor_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_unique_vendor_with_id` ON `users` (`vendor`,`vendor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);