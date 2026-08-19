CREATE TABLE `backlog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`game_id` integer NOT NULL,
	`status` text DEFAULT 'want-to-play' NOT NULL,
	`rating` integer,
	`notes` text,
	`source_url` text,
	`added_at` integer NOT NULL,
	`started_at` integer,
	`completed_at` integer,
	FOREIGN KEY (`game_id`) REFERENCES `games`(`igdb_id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `backlog_items_game_id_unique` ON `backlog_items` (`game_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`igdb_id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text,
	`summary` text,
	`release_date` text,
	`cover_url` text,
	`platforms_json` text DEFAULT '[]' NOT NULL,
	`genres_json` text DEFAULT '[]' NOT NULL,
	`updated_at` integer NOT NULL
);
