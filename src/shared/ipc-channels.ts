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
    changed: 'subscription:changed',
    /** Main → renderer: deep link wants to subscribe to a feed. */
    deepLinkSubscribe: 'subscription:deep-link-subscribe'
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
    getRegisteredShortcuts: 'playback:get-registered-shortcuts',
    /** Main → renderer: deep link wants to play an episode. */
    deepLinkPlay: 'playback:deep-link-play'
  },
  download: {
    enqueue: 'download:enqueue',
    list: 'download:list',
    history: 'download:history',
    getDir: 'download:get-dir',
    pause: 'download:pause',
    resume: 'download:resume',
    cancel: 'download:cancel',
    verifyLocal: 'download:verify-local',
    progress: 'download:progress'
  },
  settings: {
    get: 'settings:get',
    set: 'settings:set',
    chooseDirectory: 'settings:choose-directory',
    openDirectory: 'settings:open-directory'
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
  app: {
    /** App metadata for the About page (version, homepage, etc.). */
    getInfo: 'app:get-info'
  },
  update: {
    /** Renderer → main: check for an update now (manual). */
    check: 'update:check',
    /** Renderer → main: download an available update. */
    download: 'update:download',
    /** Renderer → main: quit + install a downloaded update. */
    install: 'update:install',
    /** Renderer → main: current update status snapshot. */
    getStatus: 'update:get-status',
    /** Main → renderer: update lifecycle state changed. */
    status: 'update:status'
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
  },
  storage: {
    /** Per-podcast download size usage. */
    usage: 'storage:usage',
    /** Retention cleanup preview (no side effects). */
    cleanupPreview: 'storage:cleanup-preview',
    /** Execute the retention cleanup. */
    cleanupRun: 'storage:cleanup-run'
  },
  cleanup: {
    /** Clear browser caches / temp files only. */
    clearCache: 'cleanup:clear-cache',
    /** Wipe database, downloads, settings, caches, then relaunch. */
    clearAllData: 'cleanup:clear-all-data'
  },
  diagnostics: {
    /** Export a diagnostic report (logs + environment) via save dialog. */
    export: 'diagnostics:export'
  }
} as const
