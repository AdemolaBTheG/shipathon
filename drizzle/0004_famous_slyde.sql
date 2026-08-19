CREATE TABLE `badge_unlocks` (
	`key` text PRIMARY KEY NOT NULL,
	`badge_id` text NOT NULL,
	`tier` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	`seen_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `badge_unlocks_badge_tier_unique` ON `badge_unlocks` (`badge_id`,`tier`);