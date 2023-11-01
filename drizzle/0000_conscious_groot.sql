CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sentences` (
	`id` text PRIMARY KEY NOT NULL,
	`repo` text NOT NULL,
	`position` integer NOT NULL,
	`document_id` text NOT NULL,
	`content` text NOT NULL,
	`status` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_repo` ON `documents` (`repo`);--> statement-breakpoint
CREATE INDEX `idx_documents_url` ON `documents` (`url`);--> statement-breakpoint
CREATE INDEX `idx_sentences_repo` ON `sentences` (`repo`);--> statement-breakpoint
CREATE INDEX `idx_sentences_document_id` ON `sentences` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_sentences_position` ON `sentences` (`position`);--> statement-breakpoint
CREATE INDEX `idx_sentences_status` ON `sentences` (`status`);