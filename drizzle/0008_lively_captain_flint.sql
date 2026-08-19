CREATE TABLE `widget_state` (
	`id` text PRIMARY KEY NOT NULL,
	`tonight_pick_game_id` integer,
	`is_pro` integer DEFAULT false NOT NULL,
	`updated_at` integer NOT NULL
);
