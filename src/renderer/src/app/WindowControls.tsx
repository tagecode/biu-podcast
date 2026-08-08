import { Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'

declare module 'react' {
  interface CSSProperties {
    /** Non-standard Electron property; enables window dragging regions. */
    WebkitAppRegion?: 'drag' | 'no-drag'
  }
}

/** -webkit-app-region is non-standard; Electron reads it for window dragging. */
const noDragRegion: CSSProperties = { WebkitAppRegion: 'no-drag' }

/**
 * Window controls (minimize / maximize / close) for the frameless window.
 * Placed inline with the app header actions; marked no-drag so clicks land on
 * the buttons.
 */
export function WindowControls(): React.JSX.Element {
  const { t } = useTranslation()
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

  return (
    <div className="flex h-full items-center" style={noDragRegion}>
      <button
        type="button"
        aria-label={t('window.minimize')}
        className="flex h-full w-10 items-center justify-center text-muted-700 hover:bg-amber-100 hover:text-ink"
        onClick={() => void window.api.window.minimize()}
      >
        <Minus className="size-4" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={isMaximized ? t('window.restore') : t('window.maximize')}
        className="flex h-full w-10 items-center justify-center text-muted-700 hover:bg-amber-100 hover:text-ink"
        onClick={toggleMaximize}
      >
        <Square className="size-3.5" strokeWidth={1.75} />
      </button>
      <button
        type="button"
        aria-label={t('window.close')}
        className="flex h-full w-10 items-center justify-center text-muted-700 hover:bg-danger hover:text-white"
        onClick={() => void window.api.window.close()}
      >
        <X className="size-4" strokeWidth={1.75} />
      </button>
    </div>
  )
}
