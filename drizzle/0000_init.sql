CREATE TABLE `podcasts` (
  `id` text PRIMARY KEY NOT NULL,
  `feed_url` text NOT NULL,
  `title` text NOT NULL,
  `description` text,
  `cover_url` text,
  `author` text,
  `language` text,
  `is_paused` integer DEFAULT false NOT NULL,
  `subscribed_at` integer NOT NULL,
  `last_fetched_at` integer,
  `last_fetch_status` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `podcasts_feed_url_unique` ON `podcasts` (`feed_url`);
--> statement-breakpoint
CREATE TABLE `episodes` (
  `id` text PRIMARY KEY NOT NULL,
  `podcast_id` text NOT NULL,
  `guid` text,
  `title` text NOT NULL,
  `description_html` text,
  `published_at` integer NOT NULL,
  `audio_url` text NOT NULL,
  `duration_sec` integer,
  `file_size_bytes` integer,
  `is_played` integer DEFAULT false NOT NULL,
  `playback_position_sec` real DEFAULT 0 NOT NULL,
  `is_downloaded` integer DEFAULT false NOT NULL,
  `local_file_path` text,
  `download_status` text,
  `downloaded_at` integer,
  FOREIGN KEY (`podcast_id`) REFERENCES `podcasts`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `download_tasks` (
  `id` text PRIMARY KEY NOT NULL,
  `episode_id` text NOT NULL,
  `status` text NOT NULL,
  `progress_bytes` integer DEFAULT 0 NOT NULL,
  `total_bytes` integer,
  `retry_count` integer DEFAULT 0 NOT NULL,
  `updated_at` integer NOT NULL,
  FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
