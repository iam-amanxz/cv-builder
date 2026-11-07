CREATE TABLE `interview_preps` (
	`id` text PRIMARY KEY NOT NULL,
	`variant_id` text NOT NULL,
	`application_id` text,
	`company` text DEFAULT '' NOT NULL,
	`role` text DEFAULT '' NOT NULL,
	`job_description` text DEFAULT '' NOT NULL,
	`result` text,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`variant_id`) REFERENCES `variants`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `interview_preps_variant_idx` ON `interview_preps` (`variant_id`);--> statement-breakpoint
CREATE TABLE `job_gaps` (
	`id` text PRIMARY KEY NOT NULL,
	`application_id` text NOT NULL,
	`skill` text NOT NULL,
	`skill_key` text NOT NULL,
	`importance` text DEFAULT 'required' NOT NULL,
	`requirement` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`application_id`) REFERENCES `applications`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `job_gaps_app_skill_idx` ON `job_gaps` (`application_id`,`skill_key`);--> statement-breakpoint
CREATE INDEX `job_gaps_skill_idx` ON `job_gaps` (`skill_key`);--> statement-breakpoint
CREATE TABLE `skill_progress` (
	`skill_key` text PRIMARY KEY NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE `applications` ADD `job_description` text DEFAULT '' NOT NULL;