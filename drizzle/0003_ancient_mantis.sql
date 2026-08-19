CREATE TABLE `link_resolutions` (
	`source_url` text PRIMARY KEY NOT NULL,
	`resolution_json` text NOT NULL,
	`schema_version` integer DEFAULT 1 NOT NULL,
	`expires_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
