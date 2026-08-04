import { Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { cn } from '@/lib/utils'

declare module 'react' {
  interface CSSProperties {
    /** Non-standard Electron property; enables window dragging regions. */
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

/** -webkit-app-region is non-standard; Electron reads it for window dragging. */
const dragRegion: CSSProperties = { WebkitAppRegion: 'drag' }
const noDragRegion: CSSProperties = { WebkitAppRegion: 'no-drag' }

/**
 * Custom title bar for the frameless window (frame:false on Win/Linux,
 * hiddenInset on macOS). The middle region is draggable (-webkit-app-region:
 * drag); the window controls are no-drag so clicks land on the buttons.
 *
 * macOS keeps the native traffic lights in the top-left (hiddenInset), so we
 * reserve left padding there and keep our controls on the right.
 */
export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    void window.api.window.isMaximized().then((result) => {
      if (result.ok) setIsMaximized(result.data)
    })
  }, [])

  const toggleMaximize = (): void => {
    void window.api.window.maximize().then(() =>
      window.api.window.isMaximized().then((result) => {
        if (result.ok) setIsMaximized(result.data)
      })
    )
  }

  const isMac = navigator.platform.toLowerCase().includes('mac')

  return (
    <div
      className={cn(
        'flex h-11 shrink-0 select-none items-center border-b border-line bg-surface',
        isMac ? 'pl-20' : 'pl-3'
      )}
    >
      <div className="flex items-center gap-2">
        <div className="flex size-5 items-center justify-center rounded-sm bg-amber-600">
          <span className="size-2 translate-x-[1px] border-l-2 border-r-0 border-ink bg-transparent" />
        </div>
        <span className="text-sm font-semibold text-ink">博播</span>
      </div>

      <div className="min-w-0 flex-1 self-stretch" style={dragRegion} />

      <div className="flex h-full items-center" style={noDragRegion}>
        <button
          type="button"
          aria-label="最小化"
          className="flex h-full w-11 items-center justify-center text-muted-700 hover:bg-amber-100 hover:text-ink"
          onClick={() => void window.api.window.minimize()}
        >
          <Minus className="size-4" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label={isMaximized ? '还原' : '最大化'}
          className="flex h-full w-11 items-center justify-center text-muted-700 hover:bg-amber-100 hover:text-ink"
          onClick={toggleMaximize}
        >
          <Square className="size-3.5" strokeWidth={1.75} />
        </button>
        <button
          type="button"
          aria-label="关闭"
          className="flex h-full w-11 items-center justify-center text-muted-700 hover:bg-danger hover:text-white"
          onClick={() => void window.api.window.close()}
        >
          <X className="size-4" strokeWidth={1.75} />
        </button>
      </div>
    </div>
  )
}
