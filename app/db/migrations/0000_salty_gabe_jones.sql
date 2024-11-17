CREATE TABLE `centers` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`dharma_seed_subdomain` text NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `retreats` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`language` text NOT NULL,
	`dharma_seed_id` integer NOT NULL,
	`last_build_date` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE TABLE `talks` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`audio_url` text NOT NULL,
	`external_guid` text NOT NULL,
	`teacher_id` integer NOT NULL,
	`center_id` integer,
	`retreat_id` integer,
	`dharma_seed_id` integer NOT NULL,
	`duration` integer NOT NULL,
	`publicationDate` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`teacher_id`) REFERENCES `teachers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`center_id`) REFERENCES `centers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`retreat_id`) REFERENCES `retreats`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `teachers` (
	`id` integer PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`profile_image_url` text,
	`website_url` text,
	`donation_url` text,
	`dharma_seed_id` integer NOT NULL,
	`created_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`published_on` integer NOT NULL,
	`updated_at` integer DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `centers_slug_unique` ON `centers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `centers_dharma_seed_subdomain_unique` ON `centers` (`dharma_seed_subdomain`);--> statement-breakpoint
CREATE UNIQUE INDEX `center_slug_idx` ON `centers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `center_name_idx` ON `centers` (`name`);--> statement-breakpoint
CREATE UNIQUE INDEX `center_dharma_seed_subdomain_idx` ON `centers` (`dharma_seed_subdomain`);--> statement-breakpoint
CREATE UNIQUE INDEX `retreats_slug_unique` ON `retreats` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `retreats_dharma_seed_id_unique` ON `retreats` (`dharma_seed_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `retreat_slug_idx` ON `retreats` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `retreat_dharma_seed_id_idx` ON `retreats` (`dharma_seed_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `talks_slug_unique` ON `talks` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `talks_dharma_seed_id_unique` ON `talks` (`dharma_seed_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `talk_slug_idx` ON `talks` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `talk_teacher_idx` ON `talks` (`teacher_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teachers_slug_unique` ON `teachers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `teachers_dharma_seed_id_unique` ON `teachers` (`dharma_seed_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_slug_idx` ON `teachers` (`slug`);--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_dharma_seed_id_idx` ON `teachers` (`dharma_seed_id`);