CREATE TABLE `practice_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`duration_sec` integer NOT NULL,
	`kind` text NOT NULL,
	`talk_id` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`talk_id`) REFERENCES `talks`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `practice_sessions_user_started_idx` ON `practice_sessions` (`user_id`,`started_at`);