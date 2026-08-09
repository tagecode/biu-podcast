CREATE TABLE `playback_queue` (
  `id` text PRIMARY KEY NOT NULL,
  `episode_ids` text NOT NULL,
  `mode` text NOT NULL,
  `current_episode_id` text,
  `updated_at` integer NOT NULL
);
