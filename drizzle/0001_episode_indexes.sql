CREATE INDEX IF NOT EXISTS `episodes_podcast_published_idx` ON `episodes` (`podcast_id`, `published_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `episodes_podcast_played_idx` ON `episodes` (`podcast_id`, `is_played`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `episodes_podcast_guid_idx` ON `episodes` (`podcast_id`, `guid`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `episodes_podcast_audio_idx` ON `episodes` (`podcast_id`, `audio_url`);
