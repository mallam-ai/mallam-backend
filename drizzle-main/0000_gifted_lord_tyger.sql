CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`status` text DEFAULT 'created' NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`team_id` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`role` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sentences` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`document_id` text NOT NULL,
	`sequence_id` integer NOT NULL,
	`is_analyzed` integer DEFAULT false NOT NULL,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `teams` (
	`id` text PRIMARY KEY NOT NULL,
	`display_name` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor` text NOT NULL,
	`vendor_user_id` text NOT NULL,
	`display_name` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_team_id` ON `documents` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_status` ON `documents` (`status`);--> statement-breakpoint
CREATE INDEX `idx_documents_created_by` ON `documents` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_documents_created_at` ON `documents` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_documents_deleted_at` ON `documents` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_memberships_user_id` ON `memberships` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_team_id` ON `memberships` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_created_by` ON `memberships` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_memberships_created_at` ON `memberships` (`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_memberships_unique_user_with_team` ON `memberships` (`user_id`,`team_id`);--> statement-breakpoint
CREATE INDEX `idx_memberships_role` ON `memberships` (`role`);--> statement-breakpoint
CREATE INDEX `idx_sentences_team_id` ON `sentences` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_sentences_document_id` ON `sentences` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_sentences_sequence_id` ON `sentences` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sentences_unique_document_sentence_id` ON `sentences` (`document_id`,`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_sentences_created_by` ON `sentences` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_sentences_created_at` ON `sentences` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_teams_created_by` ON `teams` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_teams_created_at` ON `teams` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_teams_deleted_at` ON `teams` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `idx_users_vendor` ON `users` (`vendor`);--> statement-breakpoint
CREATE INDEX `idx_users_vendor_user_id` ON `users` (`vendor_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_unique_vendor_with_id` ON `users` (`vendor`,`vendor_user_id`);--> statement-breakpoint
CREATE INDEX `idx_users_created_at` ON `users` (`created_at`);