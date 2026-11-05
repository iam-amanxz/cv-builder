CREATE TABLE `exports` (
	`id` text PRIMARY KEY NOT NULL,
	`snapshot_id` text NOT NULL,
	`format` text NOT NULL,
	`file_name` text NOT NULL,
	`bytes` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`snapshot_id`) REFERENCES `snapshots`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `exports_snapshot_idx` ON `exports` (`snapshot_id`);--> statement-breakpoint
CREATE TABLE `snapshots` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`label` text DEFAULT '' NOT NULL,
	`doc` text NOT NULL,
	`theme_id` text NOT NULL,
	`theme_tokens` text NOT NULL,
	`reason` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `snapshots_variant_idx` ON `snapshots` (`variant_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `variants` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`parent_id` text,
	`doc` text NOT NULL,
	`theme_id` text NOT NULL,
	`theme_overrides` text DEFAULT '{}' NOT NULL,
	`is_master` integer DEFAULT false NOT NULL,
	`archived` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer NOT NULL
);
