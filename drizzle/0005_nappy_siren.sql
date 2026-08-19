PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_backlog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` integer NOT NULL,
	`status` text DEFAULT 'want-to-play' NOT NULL,
	`rating` real,
	`notes` text,
	`source_url` text,
	`progress_current` integer DEFAULT 0 NOT NULL,
	`progress_total` integer DEFAULT 100 NOT NULL,
	`added_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`igdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_backlog_items`("id", "game_id", "status", "rating", "notes", "source_url", "progress_current", "progress_total", "added_at", "started_at", "completed_at") SELECT "id", "game_id", "status", "rating", "notes", "source_url", "progress_current", "progress_total", "added_at", "started_at", "completed_at" FROM `backlog_items`;--> statement-breakpoint
DROP TABLE `backlog_items`;--> statement-breakpoint
ALTER TABLE `__new_backlog_items` RENAME TO `backlog_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `backlog_items_game_id_unique` ON `backlog_items` (`game_id`);