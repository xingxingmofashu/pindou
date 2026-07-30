PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_patterns` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`author_name` text,
	`grid_data` text NOT NULL,
	`brand_id` text DEFAULT 'mard' NOT NULL,
	`bead_stats` text DEFAULT '{}' NOT NULL,
	`thumb_png` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_patterns`("id", "title", "description", "author_name", "grid_data", "brand_id", "bead_stats", "thumb_png", "created_at", "updated_at") SELECT "id", "title", "description", "author_name", "grid_data", "brand_id", "bead_stats", "thumb_png", "created_at", "updated_at" FROM `patterns`;--> statement-breakpoint
DROP TABLE `patterns`;--> statement-breakpoint
ALTER TABLE `__new_patterns` RENAME TO `patterns`;--> statement-breakpoint
PRAGMA foreign_keys=ON;