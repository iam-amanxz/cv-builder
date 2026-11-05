CREATE TABLE `ai_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`variant_id` text,
	`model` text NOT NULL,
	`status` text NOT NULL,
	`input` text NOT NULL,
	`output` text,
	`error` text,
	`input_tokens` integer DEFAULT 0 NOT NULL,
	`output_tokens` integer DEFAULT 0 NOT NULL,
	`cost_usd` real,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `ai_runs_created_idx` ON `ai_runs` (`created_at`);