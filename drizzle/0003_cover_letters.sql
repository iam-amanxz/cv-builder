CREATE TABLE `cover_letters` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`company` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`recipient` text DEFAULT '' NOT NULL,
	`job_description` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `cover_letters_variant_idx` ON `cover_letters` (`variant_id`);