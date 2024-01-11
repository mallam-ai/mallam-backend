ALTER TABLE documents ADD `is_analyzed` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE sentences ADD `is_analyzed` integer DEFAULT false NOT NULL;