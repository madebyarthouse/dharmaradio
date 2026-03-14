CREATE TABLE `sync_runs` (
	`id` integer PRIMARY KEY NOT NULL,
	`job` text NOT NULL,
	`status` text NOT NULL,
	`started_at` integer NOT NULL,
	`finished_at` integer NOT NULL,
	`duration_ms` integer NOT NULL,
	`processed_count` integer NOT NULL,
	`failed_count` integer NOT NULL,
	`meta_json` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `sync_runs_job_idx` ON `sync_runs` (`job`);--> statement-breakpoint
CREATE INDEX `sync_runs_status_idx` ON `sync_runs` (`status`);--> statement-breakpoint
CREATE INDEX `sync_runs_started_at_idx` ON `sync_runs` (`started_at`);