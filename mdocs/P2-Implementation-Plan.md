# BiuPodcast P2 Desktop Parity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `v2.2.0` as a small desktop-parity release: auto-launch, OPML drag-import, copy/share links, native context menus, macOS Dock menu, plus a timeboxed macOS Now Playing Spike.

**Architecture:** Keep platform differences inside `src/main/infra/*` adapters; renderer talks to main only through `src/shared/ipc-contract.ts` + preload whitelist. Renderer menus/actions stay in feature code; main only provides native primitives (context menu popup, clipboard, file path for dropped files, Dock menu, login items).

**Tech Stack:** Electron 39, React 19, TypeScript, Zustand, better-sqlite3 + Drizzle, electron-store, i18next, Vitest + Testing Library, Playwright.

## Global Constraints

- Electron `^39.2.6`; Node types `^22`; package manager `pnpm@10.11.0`; do not add a second package manager lockfile.
- Platform branching is allowed only under `src/main/infra/*`; renderer and feature services must not import `process.platform`.
- Every renderer → main capability must be declared in `src/shared/ipc-contract.ts` with a zod schema, exposed in `src/preload/index.ts`, and mirrored in `src/preload/index.d.ts`.
- User-visible renderer strings go in `src/renderer/src/locales/zh.ts` and `src/renderer/src/locales/en.ts`; main-process menu/Dock strings go in `src/main/infra/i18n/index.ts`.
- Offline-first: drag import, copy links, context menus, Dock menu, and auto-launch settings must work without network; Now Playing remains additive/noop-safe.
- Each task ends with focused tests green plus `pnpm run lint` and `pnpm run typecheck` before commit.

---

### Task 1: P2-1 开机自启设置

**Files:**
- Modify: `src/shared/types.ts` (`AppSettings`)
- Modify: `src/shared/ipc-contract.ts` (`SetSettingInputSchema` key enum)
- Modify: `src/main/infra/settings/store.ts` (defaults + `getAll`)
- Create: `src/main/infra/auto-launch/index.ts`
- Create: `src/main/infra/auto-launch/index.test.ts`
- Modify: `src/main/ipc/handlers.ts` (`registerSettingsHandlers`)
- Modify: `src/renderer/src/features/settings/api.ts`
- Modify: `src/renderer/src/features/settings/pages/SettingsPage.tsx`
- Modify: `src/renderer/src/features/settings/pages/SettingsPage.test.tsx`
- Modify: `src/renderer/src/locales/zh.ts`
- Modify: `src/renderer/src/locales/en.ts`

**Interfaces:**
- Consumes: existing `settingsStore.getAll()/set()`, `registerVoidHandler`, `settingsApi.setSetting`.
- Produces: `AppSettings.autoLaunchEnabled: boolean`; `createAutoLaunch(): AutoLaunchAdapter`; settings key `'autoLaunchEnabled'`.

- [ ] **Step 1: Write the failing adapter test**

```ts
// src/main/infra/auto-launch/index.test.ts
import { describe, expect, it } from 'vitest'

import { buildLinuxDesktopEntry, resolveLinuxAutostartPath } from './index'

describe('auto-launch linux desktop entry', () => {
  it('builds an autostart desktop file pointing at the current executable', () => {
    const entry = buildLinuxDesktopEntry({ appName: 'BiuPodcast', execPath: '/opt/BiuPodcast/biu-podcast' })
    expect(entry).toContain('Type=Application')
    expect(entry).toContain('Name=BiuPodcast')
    expect(entry).toContain('Exec=/opt/BiuPodcast/biu-podcast')
    expect(entry).toContain('X-GNOME-Autostart-enabled=true')
  })

  it('resolves the autostart path under the user config dir', () => {
    expect(resolveLinuxAutostartPath('/home/alice', 'biu-podcast')).toBe(
      '/home/alice/.config/autostart/biu-podcast.desktop'
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/main/infra/auto-launch/index.test.ts`
Expected: FAIL with `Cannot find module './index'` or missing exports.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/types.ts
export interface AppSettings {
  // ...existing keys
  /** Launch the app automatically at OS login. */
  autoLaunchEnabled: boolean
}
```

```ts
// src/main/infra/settings/store.ts
const defaults: AppSettings = {
  // ...existing defaults
  autoLaunchEnabled: false
}

// getAll(): add
autoLaunchEnabled: this.store.get('autoLaunchEnabled')
```

```ts
// src/shared/ipc-contract.ts
export const SetSettingInputSchema = z.object({
  key: z.enum([
    // ...existing keys
    'freeSpaceThresholdMB',
    'autoLaunchEnabled'
  ]),
  value: z.union([z.number().nullable(), z.string(), z.boolean()])
})
```

```ts
// src/main/infra/auto-launch/index.ts
import { app } from 'electron'
import { mkdir, unlink, writeFile } from 'fs/promises'
import { join } from 'path'

import { AppError } from '@shared/errors'

export interface AutoLaunchAdapter {
  isSupported(): boolean
  setEnabled(enabled: boolean): Promise<void>
}

export function resolveLinuxAutostartPath(homeDir: string, appId: string): string {
  return join(homeDir, '.config', 'autostart', `${appId}.desktop`)
}

export function buildLinuxDesktopEntry(input: { appName: string; execPath: string }): string {
  return [
    '[Desktop Entry]',
    'Type=Application',
    `Name=${input.appName}`,
    `Exec=${input.execPath}`,
    'Terminal=false',
    'X-GNOME-Autostart-enabled=true',
    ''
  ].join('\n')
}

class LoginItemsAutoLaunch implements AutoLaunchAdapter {
  isSupported(): boolean {
    return process.platform === 'darwin' || process.platform === 'win32'
  }

  async setEnabled(enabled: boolean): Promise<void> {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: false })
  }
}

class LinuxAutoLaunch implements AutoLaunchAdapter {
  isSupported(): boolean {
    return process.platform === 'linux'
  }

  async setEnabled(enabled: boolean): Promise<void> {
    const filePath = resolveLinuxAutostartPath(app.getPath('home'), 'biu-podcast')
    if (!enabled) {
      await unlink(filePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error
      })
      return
    }
    await mkdir(join(filePath, '..'), { recursive: true })
    await writeFile(
      filePath,
      buildLinuxDesktopEntry({ appName: 'BiuPodcast', execPath: app.getPath('exe') }),
      'utf8'
    )
  }
}

class NoopAutoLaunch implements AutoLaunchAdapter {
  isSupported(): boolean {
    return false
  }

  async setEnabled(): Promise<void> {
    throw new AppError('NOT_SUPPORTED', '当前系统不支持开机自启')
  }
}

export function createAutoLaunch(): AutoLaunchAdapter {
  if (process.platform === 'darwin' || process.platform === 'win32') return new LoginItemsAutoLaunch()
  if (process.platform === 'linux') return new LinuxAutoLaunch()
  return new NoopAutoLaunch()
}

export const autoLaunch = createAutoLaunch()
```

```ts
// src/main/ipc/handlers.ts — registerSettingsHandlers
registerVoidHandler(IPC_CHANNELS.settings.set, SetSettingInputSchema, async (_event, input) => {
  if (input.key === 'autoLaunchEnabled') {
    await autoLaunch.setEnabled(input.value === true)
  }
  settingsStore.set(input.key, input.value as never)
  if (input.key === 'autoRefreshMinutes') autoRefreshScheduler.restart()
  if (input.key === 'language') {
    installApplicationMenu()
    getTrayInstance()?.rebuild()
  }
})
```

```ts
// src/renderer/src/features/settings/api.ts
key:
  | 'autoRefreshMinutes'
  // ...existing keys
  | 'freeSpaceThresholdMB'
  | 'autoLaunchEnabled',
```

- [ ] **Step 4: Add the settings UI + i18n**

```tsx
// SettingsPage.tsx state + load
const [autoLaunchEnabled, setAutoLaunchEnabled] = useState(false)
// in getSettings().then: setAutoLaunchEnabled(settings.autoLaunchEnabled)

// new section before playbackSection
<div>
  <h2 className="text-sm font-semibold text-ink">{t('settings.desktopSection')}</h2>
</div>
<div className="flex items-center justify-between gap-4 border-b border-line py-4">
  <div>
    <div className="text-sm font-medium text-ink">{t('settings.autoLaunch')}</div>
    <div className="mt-1 text-xs text-muted">{t('settings.autoLaunchHint')}</div>
  </div>
  <label className="flex cursor-pointer items-center">
    <input
      type="checkbox"
      aria-label={t('settings.autoLaunch')}
      className="accent-amber-600"
      checked={autoLaunchEnabled}
      onChange={(e) => {
        const next = e.target.checked
        setAutoLaunchEnabled(next)
        void settingsApi.setSetting('autoLaunchEnabled', next).catch((err) => {
          setAutoLaunchEnabled(!next)
          setError(err instanceof Error ? err.message : t('settings.saveFailed'))
        })
      }}
    />
    <span className="ml-2 text-sm text-muted">
      {autoLaunchEnabled ? t('common.on') : t('common.off')}
    </span>
  </label>
</div>
```

```ts
// locales/zh.ts settings
desktopSection: '桌面集成',
autoLaunch: '登录时自动启动',
autoLaunchHint: '在系统登录后自动启动博播；不支持的平台会显示错误并回退开关',
// locales/en.ts settings
desktopSection: 'Desktop integration',
autoLaunch: 'Launch at login',
autoLaunchHint: 'Start BiuPodcast after OS sign-in; unsupported platforms roll the switch back',
```

- [ ] **Step 5: Add the failing settings component test, then make it pass**

```tsx
// SettingsPage.test.tsx — extend makeSettings(...) with autoLaunchEnabled: false first
it('saves and rolls back the auto-launch toggle on failure', async () => {
  const user = userEvent.setup()
  window.api.settings.get = vi.fn(async () => ({ ok: true as const, data: makeSettings({ autoLaunchEnabled: false }) }))
  window.api.settings.set = vi.fn(async () => ({
    ok: false as const,
    error: { code: 'NOT_SUPPORTED', message: '当前系统不支持开机自启' }
  }))
  render(<SettingsPage onBack={() => {}} onOpenAbout={() => {}} />)

  const toggle = await screen.findByRole('checkbox', { name: '登录时自动启动' })
  await user.click(toggle)

  expect(window.api.settings.set).toHaveBeenCalledWith({ key: 'autoLaunchEnabled', value: true })
  expect(await screen.findByText('当前系统不支持开机自启')).toBeInTheDocument()
  expect(toggle).not.toBeChecked()
})
```

Run: `pnpm exec vitest run src/renderer/src/features/settings/pages/SettingsPage.test.tsx`
Expected: FAIL before UI exists; PASS after UI/i18n.

- [ ] **Step 6: Run gates and commit**

Run: `pnpm exec vitest run src/main/infra/auto-launch/index.test.ts src/renderer/src/features/settings/pages/SettingsPage.test.tsx && pnpm run lint && pnpm run typecheck`
Expected: PASS.

```bash
git add src/shared/types.ts src/shared/ipc-contract.ts src/main/infra/settings/store.ts src/main/infra/auto-launch src/main/ipc/handlers.ts src/renderer/src/features/settings src/renderer/src/locales
git commit -m "feat(settings): add launch-at-login desktop integration"
```

---

### Task 2: P2-2 拖拽 `.opml` 导入

**Files:**
- Modify: `src/shared/ipc-contract.ts` (`ImportOpmlPathInputSchema`)
- Modify: `src/shared/ipc-channels.ts` (`subscription.importOpmlPath`)
- Modify: `src/preload/index.ts` (`subscription.importOpmlPath`, `files.getPathForFile`)
- Modify: `src/preload/index.d.ts`
- Modify: `src/main/features/subscription/subscription.service.ts` (`importOpmlFromPath`)
- Create: `src/main/features/subscription/import-opml-path.test.ts`
- Modify: `src/main/ipc/handlers.ts` (`registerSubscriptionHandlers`)
- Modify: `src/renderer/src/app/AppShell.tsx` (drop handling + banner)
- Create: `src/renderer/src/app/AppShell.test.tsx`
- Modify: `src/renderer/src/locales/zh.ts`
- Modify: `src/renderer/src/locales/en.ts`

**Interfaces:**
- Consumes: `parseOpml`, `SubscriptionService.add`, renderer `useSubscriptionStore.load`.
- Produces: `subscriptionService.importOpmlFromPath(filePath)`; preload `window.api.files.getPathForFile(file)`; IPC `subscription:import-opml-path`.

- [ ] **Step 1: Write the failing service test**

```ts
// src/main/features/subscription/import-opml-path.test.ts
import { mkdtemp, rm, writeFile } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SubscriptionService } from './subscription.service'
import { createTestDb } from '../../test-utils/db'

let dir: string
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'biu-opml-'))
})
afterEach(async () => rm(dir, { recursive: true, force: true }))

describe('importOpmlFromPath', () => {
  it('rejects non-OPML files before reading', async () => {
    const { db } = createTestDb()
    const service = new SubscriptionService({ db })
    await expect(service.importOpmlFromPath(join(dir, 'notes.txt'))).rejects.toThrow('仅支持导入 .opml 或 .xml 文件')
  })

  it('imports a valid dropped OPML file', async () => {
    const filePath = join(dir, 'feeds.opml')
    await writeFile(filePath, `<?xml version="1.0"?><opml version="2.0"><body><outline text="A" xmlUrl="https://example.com/a.xml" /></body></opml>`)
    const { db } = createTestDb()
    const service = new SubscriptionService({ db })
    vi.spyOn(service, 'add').mockResolvedValue({ id: 'p1' } as never)
    await expect(service.importOpmlFromPath(filePath)).resolves.toMatchObject({ added: 1, skipped: 0, failed: [] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/main/features/subscription/import-opml-path.test.ts`
Expected: FAIL (`importOpmlFromPath` does not exist).

- [ ] **Step 3: Write minimal implementation**

```ts
// src/shared/ipc-contract.ts
export const ImportOpmlPathInputSchema = z.object({
  filePath: z.string().min(1).max(4096)
})
export type ImportOpmlPathInput = z.infer<typeof ImportOpmlPathInputSchema>
```

```ts
// src/shared/ipc-channels.ts
subscription: {
  // ...existing channels
  importOpmlPath: 'subscription:import-opml-path'
}
```

```ts
// src/main/features/subscription/subscription.service.ts
private async importOpmlOutlines(filePath: string): Promise<{
  filePath: string
  added: number
  skipped: number
  failed: Array<{ title: string; error: string }>
}> {
  const xml = await readFile(filePath, 'utf8')
  const outlines = parseOpml(xml)
  let added = 0
  let skipped = 0
  const failed: Array<{ title: string; error: string }> = []
  for (const outline of outlines) {
    try {
      await this.add(outline.feedUrl)
      added += 1
    } catch (error) {
      if (error instanceof AppError && error.code === 'ALREADY_SUBSCRIBED') skipped += 1
      else failed.push({ title: outline.title || outline.feedUrl, error: error instanceof Error ? error.message : '未知错误' })
    }
  }
  return { filePath, added, skipped, failed }
}

async importOpmlFromPath(filePath: string): Promise<OpmlImportResult> {
  if (!/\.(opml|xml)$/i.test(filePath)) {
    throw new AppError('INVALID_INPUT', '仅支持导入 .opml 或 .xml 文件')
  }
  const stat = await fsStat(filePath)
  if (stat.size > 5 * 1024 * 1024) {
    throw new AppError('INVALID_INPUT', 'OPML 文件过大（最大 5MB）')
  }
  return this.importOpmlOutlines(filePath)
}

async importOpmlFromFile(): Promise<OpmlImportResult | null> {
  const result = await dialog.showOpenDialog({
    title: '导入 OPML 订阅',
    properties: ['openFile'],
    filters: [{ name: 'OPML', extensions: ['opml', 'xml'] }]
  })
  if (result.canceled || !result.filePaths[0]) return null
  return this.importOpmlFromPath(result.filePaths[0])
}
```

```ts
// src/preload/index.ts
import { contextBridge, ipcRenderer, webUtils } from 'electron'
// api.subscription:
importOpmlPath: (input: ImportOpmlPathInput): Promise<IpcResult<OpmlImportResult>> =>
  ipcRenderer.invoke(IPC_CHANNELS.subscription.importOpmlPath, input),
// api root:
files: {
  getPathForFile: (file: File): string => webUtils.getPathForFile(file)
},
```

```ts
// src/main/ipc/handlers.ts — registerSubscriptionHandlers
registerHandler(IPC_CHANNELS.subscription.importOpmlPath, ImportOpmlPathInputSchema, async (_event, input) => {
  const result = await subscriptionService.importOpmlFromPath(input.filePath)
  broadcast(IPC_CHANNELS.subscription.changed, subscriptionService.list())
  return result
})
```

- [ ] **Step 4: Add drop handling in AppShell**

```tsx
// AppShell.tsx
const [dropMessage, setDropMessage] = useState<string | null>(null)
const loadSubscriptions = useSubscriptionStore((state) => state.load)

const handleDrop = async (event: React.DragEvent<HTMLDivElement>): Promise<void> => {
  event.preventDefault()
  const file = Array.from(event.dataTransfer.files).find((item) => /\.(opml|xml)$/i.test(item.name))
  if (!file) {
    setDropMessage(t('subscription.dragImportInvalid'))
    return
  }
  const filePath = window.api.files.getPathForFile(file)
  const result = await window.api.subscription.importOpmlPath({ filePath })
  if (!result.ok) {
    setDropMessage(result.error.message)
    return
  }
  await loadSubscriptions()
  setDropMessage(
    t('subscription.dragImportDone', { added: result.data.added, skipped: result.data.skipped, failed: result.data.failed.length })
  )
}

// top-level div:
<div
  className="flex h-full ..."
  onDragOver={(event) => event.preventDefault()}
  onDrop={(event) => void handleDrop(event)}
>
  {dropMessage ? <div className="...">{dropMessage}</div> : null}
  {/* existing shell */}
</div>
```

- [ ] **Step 5: Add the failing AppShell drop test, then make it pass**

```tsx
// AppShell.test.tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AppShell } from './AppShell'
import { useSubscriptionStore } from '@/features/subscription/store'

describe('AppShell OPML drag import', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.api = {
      files: { getPathForFile: vi.fn(() => '/tmp/feeds.opml') },
      subscription: {
        list: vi.fn(async () => ({ ok: true as const, data: [] })),
        importOpmlPath: vi.fn(async () => ({
          ok: true as const,
          data: { filePath: '/tmp/feeds.opml', added: 2, skipped: 1, failed: [] }
        })),
        onChanged: vi.fn(() => () => {})
      },
      episode: { search: vi.fn(async () => ({ ok: true as const, data: [] })) },
      download: {
        list: vi.fn(async () => ({ ok: true as const, data: [] })),
        onProgress: vi.fn(() => () => {})
      },
      playback: {
        getLastSession: vi.fn(async () => ({ ok: true as const, data: null })),
        onCommand: vi.fn(() => () => {})
      },
      queue: { load: vi.fn(async () => ({ ok: true as const, data: null })) },
      settings: {
        get: vi.fn(async () => ({
          ok: true as const,
          data: { playbackRate: 1, openFullPlayerDefault: false }
        }))
      }
    } as unknown as Window['api']
  })

  it('imports a dropped OPML file and reloads subscriptions', async () => {
    const load = vi.fn()
    useSubscriptionStore.setState({ podcasts: [], loading: false, load } as never)

    render(<AppShell />)
    const file = new File(['<opml />'], 'feeds.opml', { type: 'text/xml' })
    fireEvent.drop(screen.getByTestId('app-shell'), { dataTransfer: { files: [file] } })

    await waitFor(() =>
      expect(window.api.subscription.importOpmlPath).toHaveBeenCalledWith({ filePath: '/tmp/feeds.opml' })
    )
    expect(load).toHaveBeenCalled()
  })
})
```

Add `data-testid="app-shell"` to the top-level AppShell div.
Run: `pnpm exec vitest run src/renderer/src/app/AppShell.test.tsx`
Expected: FAIL before drop wiring; PASS after.

- [ ] **Step 6: Run gates and commit**

Run: `pnpm exec vitest run src/main/features/subscription/import-opml-path.test.ts src/renderer/src/app/AppShell.test.tsx && pnpm run lint && pnpm run typecheck`
Expected: PASS.

```bash
git add src/shared/ipc-contract.ts src/shared/ipc-channels.ts src/preload src/main/features/subscription src/main/ipc/handlers.ts src/renderer/src/app src/renderer/src/locales
git commit -m "feat(subscription): import OPML by drag and drop"
```

---

### Task 3: P2-3 复制播客/集数链接（分享降级）

**Files:**
- Create: `drizzle/0006_episode_link.sql`
- Modify: `src/main/infra/db/schema.ts` (`episodes.link`)
- Modify: `src/shared/types.ts` (`ParsedFeedEpisode.link`, `Episode.link`)
- Modify: `src/main/features/subscription/feed-parser.ts` (map `item.link`)
- Modify: `src/main/features/subscription/feed-parser.test.ts`
- Modify: `src/main/features/episode/episode.repository.ts` (insert/select/map `link`)
- Modify: `src/main/infra/db/migrate.test.ts` (or the existing migration test file)
- Modify: `src/preload/index.ts` (`clipboard.writeText`)
- Modify: `src/preload/index.d.ts`
- Create: `src/renderer/src/features/episode/lib/share-link.ts`
- Create: `src/renderer/src/features/episode/lib/share-link.test.ts`
- Modify: `src/renderer/src/features/episode/pages/PodcastDetailPage.tsx`
- Modify: `src/renderer/src/features/episode/components/EpisodeDetailPanel.tsx`
- Create: `src/renderer/src/features/episode/pages/PodcastDetailPage.test.tsx`
- Modify: `src/renderer/src/locales/zh.ts`
- Modify: `src/renderer/src/locales/en.ts`

**Interfaces:**
- Consumes: feed parser `item.link`, existing clipboard-capable preload bridge.
- Produces: `Episode.link?: string | null`; `podcastShareUrl(podcast)`; `episodeShareUrl(episode)`; preload `window.api.clipboard.writeText(text)`.

- [ ] **Step 1: Write the failing pure-function test**

```ts
// src/renderer/src/features/episode/lib/share-link.test.ts
import { describe, expect, it } from 'vitest'
import type { Episode, Podcast } from '@shared/types'

import { episodeShareUrl, podcastShareUrl } from './share-link'

describe('share links', () => {
  it('uses the podcast feed URL for podcasts', () => {
    expect(podcastShareUrl({ feedUrl: 'https://example.com/feed.xml' } as Podcast)).toBe('https://example.com/feed.xml')
  })

  it('prefers the episode permalink and falls back to audio URL', () => {
    expect(episodeShareUrl({ link: 'https://example.com/ep1', audioUrl: 'https://cdn.example.com/1.mp3' } as Episode)).toBe('https://example.com/ep1')
    expect(episodeShareUrl({ link: null, guid: 'https://example.com/ep1', audioUrl: 'https://cdn.example.com/1.mp3' } as Episode)).toBe('https://example.com/ep1')
    expect(episodeShareUrl({ link: null, guid: 'tag:example.com,1', audioUrl: 'https://cdn.example.com/1.mp3' } as Episode)).toBe('https://cdn.example.com/1.mp3')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/renderer/src/features/episode/lib/share-link.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Persist `link` from feed to episode**

```sql
-- drizzle/0006_episode_link.sql
ALTER TABLE `episodes` ADD `link` text;
```

```ts
// schema.ts episodes
link: text('link'),

// shared/types.ts
export interface ParsedFeedEpisode {
  // ...existing fields
  /** Permalink to the episode page (RSS item <link>), if provided. */
  link?: string | null
}
export interface Episode {
  // ...existing fields
  /** Permalink to the episode page (RSS item <link>), if provided. */
  link?: string | null
}

// feed-parser.ts mapEpisode
return {
  // ...existing fields
  guid: item.guid ?? item.link ?? audioUrl,
  link: typeof item.link === 'string' && item.link.trim() ? item.link.trim() : null,
  chaptersUrl
}

// episode.repository.ts: add link to insert rows, select lists, and toEpisode mapping.
```

Run the existing migration test command used by the repo (for example `pnpm exec vitest run src/main/infra/db/migrate.test.ts`) and extend it to assert `0006_episode_link.sql` applies idempotently and `PRAGMA table_info(episodes)` contains `link`.

- [ ] **Step 4: Implement share helpers + preload clipboard**

```ts
// src/renderer/src/features/episode/lib/share-link.ts
import type { Episode, Podcast } from '@shared/types'

export function podcastShareUrl(podcast: Podcast): string {
  return podcast.feedUrl
}

export function episodeShareUrl(episode: Episode): string {
  if (episode.link) return episode.link
  if (episode.guid && /^https?:\/\//i.test(episode.guid) && episode.guid !== episode.audioUrl) {
    return episode.guid
  }
  return episode.audioUrl
}

export async function copyShareUrl(text: string): Promise<void> {
  const result = await window.api.clipboard.writeText(text)
  if (!result.ok) throw new Error(result.error.message)
}
```

```ts
// preload/index.ts
import { clipboard, contextBridge, ipcRenderer, webUtils } from 'electron'
// api root:
clipboard: {
  writeText: (text: string): Promise<IpcResult<void>> => ipcRenderer.invoke(IPC_CHANNELS.clipboard.writeText, { text })
},
```

Add `IPC_CHANNELS.clipboard.writeText = 'clipboard:write-text'`, `ClipboardWriteInputSchema = z.object({ text: z.string().min(1).max(100_000) })`, and a main handler that calls `clipboard.writeText(input.text)`. Mirror `clipboard.writeText` in `src/preload/index.d.ts`.

- [ ] **Step 5: Wire visible copy buttons**

```tsx
// PodcastDetailPage.tsx header actions (next to refresh)
<Button
  variant="ghost"
  size="icon"
  aria-label={t('subscription.copyLink')}
  onClick={() => void copyShareUrl(podcastShareUrl(podcast))}
>
  <Link2 className="size-4" />
</Button>

// EpisodeDetailPanel.tsx action row
<Button
  variant="ghost"
  size="icon"
  aria-label={t('episode.copyLink')}
  onClick={() => void copyShareUrl(episodeShareUrl(episode))}
>
  <Link2 className="size-4" />
</Button>
```

Add a component test that clicks `episode.copyLink` and expects `window.api.clipboard.writeText` to receive the permalink; include a fallback case for `guid === audioUrl`.
Run: `pnpm exec vitest run src/renderer/src/features/episode/lib/share-link.test.ts src/renderer/src/features/episode/pages/PodcastDetailPage.test.tsx`
Expected: FAIL before buttons; PASS after.

- [ ] **Step 6: Run gates and commit**

Run: `pnpm exec vitest run src/main/features/subscription/feed-parser.test.ts src/main/infra/db/migrate.test.ts src/renderer/src/features/episode/lib/share-link.test.ts && pnpm run lint && pnpm run typecheck`
Expected: PASS.

```bash
git add drizzle/0006_episode_link.sql src/main/infra/db src/shared/types.ts src/main/features/subscription src/main/features/episode src/preload src/main/ipc src/renderer/src/features/episode src/renderer/src/locales
git commit -m "feat(episode): copy podcast and episode share links"
```

---

### Task 4: P2-4 原生右键上下文菜单

**Files:**
- Modify: `src/shared/ipc-contract.ts` (`ContextMenuItemSchema`, `ShowContextMenuInputSchema`)
- Modify: `src/shared/ipc-channels.ts` (`contextMenu.show`)
- Create: `src/main/infra/context-menu/index.ts`
- Create: `src/main/infra/context-menu/index.test.ts`
- Modify: `src/main/ipc/handlers.ts` (register context-menu handler in `registerAllHandlers`)
- Modify: `src/preload/index.ts` (`contextMenu.show`)
- Modify: `src/preload/index.d.ts`
- Create: `src/renderer/src/lib/context-menu.ts`
- Create: `src/renderer/src/lib/context-menu.test.ts`
- Modify: `src/renderer/src/app/AppShell.tsx` (editable-field menu capture)
- Modify: `src/renderer/src/features/subscription/components/PodcastCard.tsx`
- Modify: `src/renderer/src/features/subscription/components/SubscriptionListView.tsx`
- Modify: `src/renderer/src/features/subscription/components/SubscriptionListView.test.tsx`
- Modify: `src/renderer/src/features/episode/components/EpisodeListItem.tsx`
- Modify: `src/renderer/src/features/episode/pages/PodcastDetailPage.tsx`
- Modify: `src/renderer/src/features/playlist/pages/PlaylistsPage.tsx`
- Modify: `src/renderer/src/locales/zh.ts`
- Modify: `src/renderer/src/locales/en.ts`

**Interfaces:**
- Consumes: existing feature actions (`refresh`, `setPaused`, `remove`, `playEpisode`, `enqueue`, `addToQueue`, playlist rename/delete/remove).
- Produces: IPC `contextMenu:show -> string | null`; renderer helper `showContextMenu(items, event?)`.

- [ ] **Step 1: Write the failing template test**

```ts
// src/main/infra/context-menu/index.test.ts
import { describe, expect, it } from 'vitest'

import { toContextMenuTemplate } from './index'

describe('toContextMenuTemplate', () => {
  it('maps edit ids to native roles', () => {
    expect(toContextMenuTemplate([{ id: 'copy', label: '复制' }])).toEqual([{ id: 'copy', role: 'copy', label: '复制' }])
  })

  it('keeps business actions as click items', () => {
    const onPick = vi.fn()
    const [item] = toContextMenuTemplate([{ id: 'episode.copyLink', label: '复制链接' }], onPick)
    item.click?.({} as never, {} as never, {} as never)
    expect(onPick).toHaveBeenCalledWith('episode.copyLink')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/main/infra/context-menu/index.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement main context-menu primitive**

```ts
// src/shared/ipc-contract.ts
export const ContextMenuItemSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(80),
  enabled: z.boolean().optional().default(true),
  danger: z.boolean().optional().default(false)
})
export const ShowContextMenuInputSchema = z.object({
  items: z.array(ContextMenuItemSchema).min(1).max(24),
  x: z.number().int().optional(),
  y: z.number().int().optional()
})
export type ContextMenuItem = z.infer<typeof ContextMenuItemSchema>
export type ShowContextMenuInput = z.infer<typeof ShowContextMenuInputSchema>
```

```ts
// src/shared/ipc-channels.ts
contextMenu: {
  show: 'context-menu:show'
}
```

```ts
// src/main/infra/context-menu/index.ts
import { BrowserWindow, Menu, type MenuItemConstructorOptions } from 'electron'
import type { ContextMenuItem } from '@shared/ipc-contract'

const EDIT_ROLES = new Set(['undo', 'redo', 'cut', 'copy', 'paste', 'selectAll'])

export function toContextMenuTemplate(
  items: ContextMenuItem[],
  onPick: (id: string) => void = () => undefined
): MenuItemConstructorOptions[] {
  return items.map((item) => {
    if (EDIT_ROLES.has(item.id)) {
      return { id: item.id, label: item.label, role: item.id as 'cut' | 'copy' | 'paste' | 'selectAll' | 'undo' | 'redo', enabled: item.enabled }
    }
    return { id: item.id, label: item.label, enabled: item.enabled, click: () => onPick(item.id) }
  })
}

export async function showNativeContextMenu(
  window: BrowserWindow | null,
  items: ContextMenuItem[],
  position: { x?: number; y?: number } = {}
): Promise<string | null> {
  if (!window || window.isDestroyed()) return null
  return new Promise((resolve) => {
    let settled = false
    const done = (id: string | null): void => {
      if (settled) return
      settled = true
      resolve(id)
    }
    const menu = Menu.buildFromTemplate(toContextMenuTemplate(items, done))
    menu.popup({ window, x: position.x, y: position.y, callback: () => done(null) })
  })
}
```

Register `IPC_CHANNELS.contextMenu.show` with `ShowContextMenuInputSchema`; resolve `BrowserWindow.fromWebContents(event.sender)` and return `showNativeContextMenu(win, input.items, input)`. Expose `window.api.contextMenu.show(input)` in preload and `index.d.ts`.

- [ ] **Step 4: Implement renderer helper + editable capture**

```ts
// src/renderer/src/lib/context-menu.ts
import type { ContextMenuItem } from '@shared/ipc-contract'

export async function showContextMenu(
  items: ContextMenuItem[],
  event?: React.MouseEvent
): Promise<string | null> {
  const result = await window.api.contextMenu.show({
    items,
    x: event ? Math.round(event.clientX) : undefined,
    y: event ? Math.round(event.clientY) : undefined
  })
  if (!result.ok) throw new Error(result.error.message)
  return result.data
}

export function isEditableContextTarget(target: EventTarget | null): target is HTMLInputElement | HTMLTextAreaElement {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}
```

```tsx
// AppShell.tsx top-level div
onContextMenuCapture={(event) => {
  if (!isEditableContextTarget(event.target)) return
  event.preventDefault()
  event.stopPropagation()
  void showContextMenu(
    [
      { id: 'cut', label: t('menu.cut') },
      { id: 'copy', label: t('menu.copy') },
      { id: 'paste', label: t('menu.paste') },
      { id: 'selectAll', label: t('menu.selectAll') }
    ],
    event
  )
}}
```

- [ ] **Step 5: Wire feature menus**

```tsx
// PodcastCard.tsx props + root button
interface PodcastCardProps {
  podcast: Podcast
  onClick: () => void
  onContextMenu?: (event: React.MouseEvent<HTMLButtonElement>) => void
}
// root <button ... onContextMenu={onContextMenu}>

// SubscriptionListView.tsx
const showPodcastMenu = async (podcast: Podcast, event: React.MouseEvent): Promise<void> => {
  const id = await showContextMenu([
    { id: 'open', label: t('subscription.openDetail') },
    { id: 'refresh', label: t('subscription.refresh') },
    { id: 'copyLink', label: t('subscription.copyLink') },
    { id: podcast.isPaused ? 'resume' : 'pause', label: podcast.isPaused ? t('subscription.resume') : t('subscription.pause') }
  ], event)
  if (id === 'open') onOpenPodcast(podcast.id)
  if (id === 'refresh') await useSubscriptionStore.getState().refresh(podcast.id)
  if (id === 'copyLink') await copyShareUrl(podcastShareUrl(podcast))
  if (id === 'pause' || id === 'resume') await useSubscriptionStore.getState().setPaused(podcast.id, id === 'pause')
}
// <PodcastCard ... onContextMenu={(event) => { event.preventDefault(); void showPodcastMenu(podcast, event) }} />

// EpisodeListItem.tsx: add onContextMenu?: (event: React.MouseEvent<HTMLDivElement>) => void to props and root div.
// PodcastDetailPage.tsx: showEpisodeMenu(episode, event) items: play/pause, download when available, addToQueue, copyLink, openDetail.
// PlaylistsPage.tsx: left playlist item menu rename/delete; right item menu removeFromPlaylist/download.
```

Add component tests for `SubscriptionListView` and `PodcastDetailPage` that mock `window.api.contextMenu.show` resolving a chosen id and assert the mapped store/API action fires.
Run: `pnpm exec vitest run src/main/infra/context-menu/index.test.ts src/renderer/src/lib/context-menu.test.ts src/renderer/src/features/subscription/components/SubscriptionListView.test.tsx`
Expected: FAIL before wiring; PASS after.

- [ ] **Step 6: Run gates and commit**

Run: `pnpm exec vitest run src/main/infra/context-menu/index.test.ts src/renderer/src/lib/context-menu.test.ts src/renderer/src/features/subscription/components/SubscriptionListView.test.tsx && pnpm run lint && pnpm run typecheck`
Expected: PASS.

```bash
git add src/shared/ipc-contract.ts src/shared/ipc-channels.ts src/main/infra/context-menu src/main/ipc/handlers.ts src/preload src/renderer/src/lib/context-menu.ts src/renderer/src/app src/renderer/src/features/subscription src/renderer/src/features/episode src/renderer/src/features/playlist src/renderer/src/locales
git commit -m "feat(desktop): add native context menus for inputs and lists"
```

---

### Task 5: P2-5 macOS Dock 菜单

**Files:**
- Create: `src/main/infra/dock/index.ts`
- Create: `src/main/infra/dock/index.test.ts`
- Modify: `src/main/infra/media-session/session.ts` (remember last update + notify Dock)
- Modify: `src/main/infra/media-session/session.test.ts`
- Modify: `src/main/infra/i18n/index.ts` (Dock keys)
- Modify: `src/main/infra/i18n/index.test.ts`
- Modify: `src/main/index.ts` (`installDockMenu`)

**Interfaces:**
- Consumes: `IPC_CHANNELS.playback.command`, `BrowserWindow.webContents.send`, existing main i18n `translate`.
- Produces: `installDockMenu(getWindow)`; `setDockMenuState(info | null)`; `buildDockMenuTemplate(state, language)`.

- [ ] **Step 1: Write the failing Dock template test**

```ts
// src/main/infra/dock/index.test.ts
import { describe, expect, it } from 'vitest'

import { buildDockMenuTemplate } from './index'

describe('buildDockMenuTemplate', () => {
  it('shows only window actions when nothing is playing', () => {
    const template = buildDockMenuTemplate(null, 'zh')
    expect(template.map((item) => item.id)).toEqual(['show'])
  })

  it('adds playback controls when media session state exists', () => {
    const template = buildDockMenuTemplate({ title: 'Ep', artist: 'Pod', positionSec: 1, playing: true }, 'zh')
    expect(template.map((item) => item.id)).toEqual(['nowPlaying', 'toggle', 'previous', 'next', 'show'])
    expect(template.find((item) => item.id === 'toggle')?.label).toBe('暂停')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec vitest run src/main/infra/dock/index.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement Dock adapter**

```ts
// src/main/infra/dock/index.ts
import { app, Menu, type BrowserWindow, type MenuItemConstructorOptions } from 'electron'

import { IPC_CHANNELS } from '@shared/ipc-channels'
import type { MediaSessionUpdate } from '@shared/ipc-contract'
import { translate, type MainLanguage } from '../i18n'

export type DockMenuState = Pick<MediaSessionUpdate, 'title' | 'artist' | 'positionSec' | 'playing'> | null

let state: DockMenuState = null
let getWindow: () => BrowserWindow | null = () => null

export function buildDockMenuTemplate(current: DockMenuState, language: MainLanguage = 'zh'): MenuItemConstructorOptions[] {
  const tr = (key: string): string => translate(language, key)
  const show: MenuItemConstructorOptions = { id: 'show', label: tr('dock.showWindow'), click: () => showMainWindow() }
  if (!current) return [show]
  return [
    { id: 'nowPlaying', label: `${current.title} — ${current.artist}`, enabled: false },
    { id: 'toggle', label: current.playing ? tr('dock.pause') : tr('dock.play'), click: () => sendCommand('toggle') },
    { id: 'previous', label: tr('dock.previous'), click: () => sendCommand('previous') },
    { id: 'next', label: tr('dock.next'), click: () => sendCommand('next') },
    { type: 'separator' },
    show
  ]
}

function sendCommand(command: 'toggle' | 'previous' | 'next'): void {
  const win = getWindow()
  if (!win || win.isDestroyed()) return
  win.webContents.send(IPC_CHANNELS.playback.command, command)
}

function showMainWindow(): void {
  const win = getWindow()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

export function installDockMenu(resolveWindow: () => BrowserWindow | null): void {
  getWindow = resolveWindow
  if (process.platform !== 'darwin' || !app.dock) return
  app.dock.setMenu(Menu.buildFromTemplate(buildDockMenuTemplate(state)))
}

export function setDockMenuState(next: DockMenuState): void {
  state = next
  if (process.platform !== 'darwin' || !app.dock) return
  app.dock.setMenu(Menu.buildFromTemplate(buildDockMenuTemplate(state)))
}
```

```ts
// media-session/session.ts
let lastInfo: MediaSessionUpdateInput | null = null
export function updateMediaSession(info: MediaSessionUpdateInput): void {
  lastInfo = info
  const current = adapter ?? initMediaSession()
  current.update(info)
  setDockMenuState({ title: info.title, artist: info.artist, positionSec: info.positionSec, playing: info.playing })
}
export function getMediaSessionSnapshot(): MediaSessionUpdateInput | null {
  return lastInfo
}
```

```ts
// main/index.ts after createWindow()/tray setup
installDockMenu(() => mainWindowRef)
```

- [ ] **Step 4: Add i18n keys and session test**

```ts
// src/main/infra/i18n/index.ts zh
'dock.showWindow': '显示博播',
'dock.play': '播放',
'dock.pause': '暂停',
'dock.previous': '上一集',
'dock.next': '下一集',
// en
'dock.showWindow': 'Show BiuPodcast',
'dock.play': 'Play',
'dock.pause': 'Pause',
'dock.previous': 'Previous',
'dock.next': 'Next',
```

```ts
// media-session/session.test.ts
it('forwards a snapshot to the dock menu', () => {
  updateMediaSession({ title: 'Ep', artist: 'Pod', positionSec: 12, playing: true })
  expect(getMediaSessionSnapshot()).toMatchObject({ title: 'Ep', playing: true })
})
```

Run: `pnpm exec vitest run src/main/infra/dock/index.test.ts src/main/infra/media-session/session.test.ts src/main/infra/i18n/index.test.ts`
Expected: PASS.

- [ ] **Step 5: Run gates and commit**

Run: `pnpm run lint && pnpm run typecheck`
Expected: PASS.

```bash
git add src/main/infra/dock src/main/infra/media-session src/main/infra/i18n src/main/index.ts
git commit -m "feat(dock): add macOS dock playback menu"
```

---

### Task 6: P2-6 macOS Now Playing 限时 Spike

**Files:**
- Read: `mdocs/P1-13-Spike.md`
- Read: `src/main/infra/media-session/types.ts`
- Read: `src/main/infra/media-session/index.ts`
- Read: `package.json`
- Create: `mdocs/P2-6-NowPlaying-Spike.md`

**Interfaces:**
- Consumes: existing `MediaSessionAdapter` contract and P1-13 Spike conclusion.
- Produces: ADR-style Spike report with a binary decision: `implement-now` or `defer-with-noop`.

- [ ] **Step 1: Write the Spike report skeleton with the decision criteria filled from P2.md**

```markdown
# P2-6 macOS Now Playing Spike

| 字段 | 内容 |
| --- | --- |
| 时间盒 | 2～3 天 |
| 输入 | `mdocs/P1-13-Spike.md`、`src/main/infra/media-session/*`、`package.json` |
| 决策 | `defer-with-noop`（除非下方验证项全部通过） |

## 通过条件（全部满足才 implement-now）
1. 不引入需要长期自研维护的 Objective-C/Swift 原生模块；若必须引入，给出 CI 构建、签名/公证、崩溃隔离方案。
2. 能复用现有 `MediaSessionAdapter.update/onCommand/dispose` 契约，且命令仍走 `playback:command`。
3. macOS 构建不需要为未签名流程新增阻断步骤；Notarization 仍为可选增强。
4. 失败时可回退 `noopMediaSession`，播放链路零影响。

## 验证记录
- 候选方案：
- 构建影响：
- 命令映射：
- 风险与回退：

## 结论
- 决策：`defer-with-noop`
- 若未来实现：接入点 `src/main/infra/media-session/index.ts` 的 `createMediaSession()`，新增 `mac.ts` 适配器，不改变 renderer/playback 契约。
```

- [ ] **Step 2: Timebox verification**

Run: `pnpm exec electron --version && pnpm exec node -p "process.versions.modules"`
Expected: record Electron ABI and Node-API compatibility in the report; do not start implementation unless all pass criteria are met.

- [ ] **Step 3: Fill the report and self-check against P2.md non-goals**

Checklist:
- Report explicitly chooses `implement-now` or `defer-with-noop`.
- If `implement-now`, the report lists follow-up implementation tasks and whether they enter `v2.2.0` or `v2.3.0`.
- If `defer-with-noop`, the report states that `Feature.md` keeps macOS Now Playing unchecked with the note “P2 Spike 后仍降级”.

- [ ] **Step 4: Commit the Spike report**

```bash
git add mdocs/P2-6-NowPlaying-Spike.md
git commit -m "docs(p2): timebox macOS Now Playing spike"
```

---

## Self-Review

- Spec coverage: P2.md tasks P2-1～P2-6 map to Tasks 1～6; non-goals remain untouched.
- Placeholder scan: no unresolved placeholder markers; deferred decisions are only inside the P2-6 Spike report and have explicit pass criteria.
- Type consistency: `autoLaunchEnabled` is boolean end-to-end; `Episode.link` is optional/nullable end-to-end; `contextMenu.show` returns `string | null`; Dock state reuses `MediaSessionUpdate` fields.

## Execution Handoff

Plan complete and saved to `mdocs/P2-Implementation-Plan.md`. Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session with checkpoints for review.

Which approach?
