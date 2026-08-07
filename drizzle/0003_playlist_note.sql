CREATE TABLE `playlists` (
  `id` text PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `playlist_items` (
  `id` text PRIMARY KEY NOT NULL,
  `playlist_id` text NOT NULL,
  `episode_id` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `added_at` integer NOT NULL,
  FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `notes` (
  `id` text PRIMARY KEY NOT NULL,
  `episode_id` text NOT NULL,
  `timestamp_sec` integer NOT NULL,
  `content` text NOT NULL,
  `created_at` integer NOT NULL,
  FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade
);
