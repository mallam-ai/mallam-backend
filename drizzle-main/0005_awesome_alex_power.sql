ALTER TABLE documents ADD `deleted_at` integer;--> statement-breakpoint
CREATE INDEX `idx_documents_deleted_at` ON `documents` (`deleted_at`);