CREATE TABLE `applications` (
	`id` text PRIMARY KEY NOT NULL,
	`company` text NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`url` text DEFAULT '' NOT NULL,
	`variant_id` text,
	`export_id` text,
	`letter_id` text,
	`status` text DEFAULT 'draft' NOT NULL,
	`applied_at` text DEFAULT '' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`export_id`) REFERENCES `exports`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`letter_id`) REFERENCES `cover_letters`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `applications_status_idx` ON `applications` (`status`);