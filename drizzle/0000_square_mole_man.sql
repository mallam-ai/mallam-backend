CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`vendor` text NOT NULL,
	`author` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`content` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sentences` (
	`id` text PRIMARY KEY NOT NULL,
	`position` integer NOT NULL,
	`document_id` text NOT NULL,
	`content` text NOT NULL,
	FOREIGN KEY (`document_id`) REFERENCES `documents`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_documents_vendor` ON `documents` (`vendor`);--> statement-breakpoint
CREATE INDEX `idx_documents_author` ON `documents` (`author`);--> statement-breakpoint
CREATE INDEX `idx_documents_url` ON `documents` (`url`);--> statement-breakpoint
CREATE INDEX `idx_sentences_position` ON `sentences` (`position`);--> statement-breakpoint
CREATE INDEX `idx_sentences_document_id` ON `sentences` (`document_id`);