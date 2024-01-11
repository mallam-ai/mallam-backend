CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`is_public` integer NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sentences` (
	`id` text PRIMARY KEY NOT NULL,
	`team_id` text NOT NULL,
	`document_id` text NOT NULL,
	`sequence_id` integer NOT NULL,
	`content` text NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_documents_team_id` ON `documents` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_documents_is_public` ON `documents` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_documents_created_by` ON `documents` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_documents_created_at` ON `documents` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_sentences_team_id` ON `sentences` (`team_id`);--> statement-breakpoint
CREATE INDEX `idx_sentences_document_id` ON `sentences` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_sentences_sequence_id` ON `sentences` (`sequence_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_sentences_unique_document_sentence_id` ON `sentences` (`document_id`,`sequence_id`);--> statement-breakpoint
CREATE INDEX `idx_sentences_created_by` ON `sentences` (`created_by`);--> statement-breakpoint
CREATE INDEX `idx_sentences_created_at` ON `sentences` (`created_at`);