CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`author_name` text,
	`grid_data` text NOT NULL,
	`palette_id` text DEFAULT 'mard' NOT NULL,
	`bead_stats` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `patterns_slug_unique` ON `patterns` (`slug`);