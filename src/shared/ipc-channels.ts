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
    getById: 'episode:get-by-id',
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
    verifyLocal: 'download:verify-local',
    progress: 'download:progress'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set'
  },
  dataPortability: {
    export: 'data-portability:export',
    previewImport: 'data-portability:preview-import',
    import: 'data-portability:import'
  }
} as const
