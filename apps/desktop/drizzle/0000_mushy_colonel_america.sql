CREATE TABLE `patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`grid_key` text DEFAULT '' NOT NULL,
	`fk_brand_id` text NOT NULL,
	`bead_stats` text DEFAULT '{}' NOT NULL,
	`thumb_url` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_patterns_updated_at` ON `patterns` (`updated_at`);