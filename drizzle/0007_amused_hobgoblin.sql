CREATE TABLE `feature_usage` (
	`feature` text PRIMARY KEY NOT NULL,
	`period` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	`updated_at` integer NOT NULL
);
