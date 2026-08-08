import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { ShortcutCommand, ShortcutConfig } from '@shared/ipc-contract'
import { formatAccelerator } from '@/lib/accelerator'
import { eventToAccelerator } from '../lib/shortcut-record'

const COMMANDS: Array<{ command: ShortcutCommand; labelKey: string }> = [
  { command: 'toggle', labelKey: 'settings.shortcutToggle' },
  { command: 'next', labelKey: 'settings.shortcutNext' },
  { command: 'previous', labelKey: 'settings.shortcutPrevious' }
]

interface Feedback {
  text: string
  kind: 'ok' | 'error' | 'warn'
}

/**
 * Global-shortcut settings: shows the current binding for each playback
 * command and lets the user re-record it by pressing a key combination.
 */
export function ShortcutSettings(): React.JSX.Element {
  const { t } = useTranslation()
  const [config, setConfig] = useState<ShortcutConfig | null>(null)
  const [recording, setRecording] = useState<ShortcutCommand | null>(null)
  const [feedback, setFeedback] = useState<Feedback | null>(null)

  const loadConfig = useCallback(async (): Promise<void> => {
    const result = await window.api.shortcuts.getConfig()
    if (result.ok) setConfig(result.data)
  }, [])

  useEffect(() => {
    window.api.shortcuts
      .getConfig()
      .then((result) => {
        if (result.ok) setConfig(result.data)
      })
      .catch(() => {})
    // Keep the shown bindings in sync when main re-registers (e.g. after a
    // conflicting combo reverts, or a language change).
    return window.api.shortcuts.onApplied(() => {
      void loadConfig()
    })
  }, [loadConfig])

  const save = useCallback(
    async (command: ShortcutCommand, accelerator: string): Promise<void> => {
      try {
        const result = await window.api.shortcuts.set({ command, accelerator })
        if (!result.ok) {
          setFeedback({ text: t('settings.shortcutConflict'), kind: 'error' })
          return
        }
        if (result.data.taken) {
          setFeedback({ text: t('settings.shortcutTaken'), kind: 'warn' })
        } else {
          setFeedback({
            text: t('settings.shortcutApplied', {
              accelerator: formatAccelerator(accelerator) ?? accelerator
            }),
            kind: 'ok'
          })
        }
        void loadConfig()
      } catch {
        setFeedback({ text: t('settings.saveFailed'), kind: 'error' })
      }
    },
    [t, loadConfig]
  )

  // While recording, a global capture listener turns the next key combo into a
  // new binding; Esc aborts.
  useEffect(() => {
    if (!recording) return
    const onKeyDown = (e: KeyboardEvent): void => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      const accelerator = eventToAccelerator(e)
      if (!accelerator) return
      setRecording(null)
      void save(recording, accelerator)
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => window.removeEventListener('keydown', onKeyDown, true)
  }, [recording, save])

  const resetToDefault = async (command: ShortcutCommand): Promise<void> => {
    try {
      const result = await window.api.shortcuts.set({ command, accelerator: null })
      if (!result.ok || result.data.taken) {
        setFeedback({ text: t('settings.shortcutTaken'), kind: 'warn' })
      } else {
        setFeedback({
          text: t('settings.shortcutApplied', {
            accelerator: formatAccelerator(config?.defaults[command]) ?? ''
          }),
          kind: 'ok'
        })
      }
      void loadConfig()
    } catch {
      setFeedback({ text: t('settings.saveFailed'), kind: 'error' })
    }
  }

  const effective = (command: ShortcutCommand): string | undefined =>
    config?.custom[command] ?? config?.defaults[command]

  return (
    <div>
      <div className="border-b border-line py-4">
        <div className="text-xs text-muted">{t('settings.shortcutSectionHint')}</div>
      </div>

      {COMMANDS.map(({ command, labelKey }) => {
        const binding = effective(command)
        const isRecording = recording === command
        return (
          <div
            key={command}
            className="flex items-center justify-between gap-4 border-b border-line py-4"
          >
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-ink">{t(labelKey)}</div>
              <div className="mt-1 text-xs text-muted">
                {isRecording
                  ? t('settings.shortcutPressToRecord')
                  : (formatAccelerator(binding) ?? t('settings.shortcutDefault'))}
                {isRecording ? ` · ${t('settings.shortcutEscCancel')}` : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {config?.custom[command] ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={isRecording}
                  onClick={() => void resetToDefault(command)}
                >
                  {t('settings.shortcutUnbind')}
                </Button>
              ) : null}
              <Button
                variant="secondary"
                size="sm"
                disabled={recording !== null}
                onClick={() => {
                  setFeedback(null)
                  setRecording(command)
                }}
                aria-label={t('settings.shortcutRecordAria')}
              >
                {isRecording ? t('settings.shortcutRecord') : (formatAccelerator(binding) ?? '—')}
              </Button>
            </div>
          </div>
        )
      })}

      {feedback ? (
        <div
          className={
            feedback.kind === 'ok'
              ? 'mt-3 rounded-lg border border-line bg-amber-100/50 p-3 text-sm text-ink'
              : feedback.kind === 'warn'
                ? 'mt-3 rounded-lg border border-amber-400/50 bg-amber-100/50 p-3 text-sm text-amber-800'
                : 'mt-3 rounded-lg border border-danger/20 bg-danger/5 p-3 text-sm text-danger'
          }
        >
          {feedback.text}
        </div>
      ) : null}
    </div>
  )
}
