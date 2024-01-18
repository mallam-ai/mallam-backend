CREATE TABLE `chats` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `histories` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`user_id` text NOT NULL,
	`chat_id` text NOT NULL,
	`role` text NOT NULL,
	`content` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_chats_team_id` ON `chats` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_chats_user_id` ON `chats` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_chats_created_at` ON `chats` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chats_deleted_at` ON `chats` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_histories_team_id` ON `histories` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_histories_user_id` ON `histories` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_histories_chat_id` ON `histories` (`chat_id`);--> statement-breakpoint
CREATE INDEX `idx_histories_role` ON `histories` (`role`);--> statement-breakpoint
CREATE INDEX `idx_histories_created_at` ON `histories` (`created_at`);