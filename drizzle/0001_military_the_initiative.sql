ALTER TABLE `backlog_items` ADD `progress_current` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `backlog_items` ADD `progress_total` integer DEFAULT 100 NOT NULL;