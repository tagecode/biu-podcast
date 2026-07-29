export const IPC_CHANNELS = {
  subscription: {
    add: 'subscription:add',
    list: 'subscription:list',
    remove: 'subscription:remove',
    refresh: 'subscription:refresh',
    changed: 'subscription:changed'
  },
  episode: {
    listByPodcast: 'episode:list-by-podcast',
    markAllPlayed: 'episode:mark-all-played',
    getAdjacent: 'episode:get-adjacent',
    changed: 'episode:changed'
  },
  playback: {
    updateProgress: 'playback:update-progress',
    getLastSession: 'playback:get-last-session'
  },
  download: {
    enqueue: 'download:enqueue',
    list: 'download:list',
    pause: 'download:pause',
    resume: 'download:resume',
    cancel: 'download:cancel',
    progress: 'download:progress'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set'
  }
} as const
