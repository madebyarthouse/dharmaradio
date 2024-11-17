DROP INDEX IF EXISTS `talk_teacher_idx`;--> statement-breakpoint
CREATE INDEX `talk_teacher_idx` ON `talks` (`teacher_id`);