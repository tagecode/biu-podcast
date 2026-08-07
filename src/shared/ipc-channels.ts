export const IPC_CHANNELS = {
  subscription: {
    add: 'subscription:add',
    list: 'subscription:list',
    remove: 'subscription:remove',
    refresh: 'subscription:refresh',
    refreshAll: 'subscription:refresh-all',
    setPaused: 'subscription:set-paused',
    importOpml: 'subscription:import-opml',
    exportOpml: 'subscription:export-opml',
    changed: 'subscription:changed'
  },
  episode: {
    listByPodcast: 'episode:list-by-podcast',
    getById: 'episode:get-by-id',
    markAllPlayed: 'episode:mark-all-played',
    markPlayed: 'episode:mark-played',
    getAdjacent: 'episode:get-adjacent',
    changed: 'episode:changed'
  },
  playback: {
    updateProgress: 'playback:update-progress',
    getLastSession: 'playback:get-last-session',
    /** Main → renderer: global shortcut / media key pressed. */
    command: 'playback:command',
    getRegisteredShortcuts: 'playback:get-registered-shortcuts'
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
    set: 'settings:set',
    chooseDirectory: 'settings:choose-directory'
  },
  dataPortability: {
    export: 'data-portability:export',
    previewImport: 'data-portability:preview-import',
    import: 'data-portability:import'
  },
  window: {
    minimize: 'window:minimize',
    maximize: 'window:maximize',
    close: 'window:close',
    isMaximized: 'window:is-maximized',
    maximizedChanged: 'window:maximized-changed'
  },
  playlist: {
    create: 'playlist:create',
    list: 'playlist:list',
    rename: 'playlist:rename',
    delete: 'playlist:delete',
    addItem: 'playlist:add-item',
    removeItem: 'playlist:remove-item',
    listItems: 'playlist:list-items',
    reorder: 'playlist:reorder'
  },
  note: {
    create: 'note:create',
    listByEpisode: 'note:list-by-episode',
    listAll: 'note:list-all',
    delete: 'note:delete',
    export: 'note:export'
  }
} as const
