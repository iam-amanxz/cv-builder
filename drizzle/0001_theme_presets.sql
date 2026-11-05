CREATE TABLE `theme_presets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`base_theme_id` text NOT NULL,
	`tokens` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
