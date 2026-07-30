CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`author_name` text,
	`grid_data` text NOT NULL,
	`brand_id` text DEFAULT 'mard' NOT NULL,
	`bead_stats` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT '(datetime(''now''))' NOT NULL,
	`updated_at` text DEFAULT '(datetime(''now''))' NOT NULL
);
