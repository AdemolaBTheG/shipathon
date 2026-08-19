CREATE TABLE `onboarding_state` (
	`id` text PRIMARY KEY NOT NULL,
	`current_step` text DEFAULT 'welcome' NOT NULL,
	`selected_platform_ids_json` text DEFAULT '[]' NOT NULL,
	`selected_game_id` integer,
	`selected_game_name` text,
	`selected_game_cover_url` text,
	`notification_preference` text DEFAULT 'unknown' NOT NULL,
	`onboarding_completed_at` integer,
	`updated_at` integer NOT NULL
);
