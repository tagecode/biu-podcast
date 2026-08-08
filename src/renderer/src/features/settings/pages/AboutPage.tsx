import { ExternalLink, MessageSquare, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import type { AppInfo } from '@shared/ipc-contract'

interface AboutPageProps {
  onBack: () => void
}

/**
 * About page: version, license, feedback entry and the local-first privacy note.
 */
export function AboutPage({ onBack }: AboutPageProps): React.JSX.Element {
  const { t } = useTranslation()
  const [info, setInfo] = useState<AppInfo | null>(null)

  useEffect(() => {
    void window.api.app.getInfo().then((result) => {
      if (result.ok) setInfo(result.data)
    })
  }, [])

  const openHomepage = (): void => {
    void window.open(info?.homepage ?? 'https://github.com/tagecode/biu-podcast')
  }
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-line px-6 py-4">
        <button type="button" className="text-sm text-muted hover:text-ink" onClick={onBack}>
          {t('common.back')}
        </button>
        <h1 className="text-base font-semibold text-ink">{t('about.title')}</h1>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl space-y-6">
          <div className="flex items-center gap-4">
            <div className="flex size-16 items-center justify-center rounded-xl bg-amber-600">
              <span className="text-2xl font-semibold text-ink">{t('about.logo')}</span>
            </div>
            <div>
              <div className="text-lg font-semibold text-ink">{t('about.brandName')}</div>
              <div className="mt-0.5 text-sm text-muted">{t('about.tagline')}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="text-xs text-muted">{t('about.version')}</div>
              <div className="mt-0.5 text-sm font-medium text-ink">
                v{info?.version ?? '—'}
                {info?.isPackaged ? '' : ` (${t('about.dev')})`}
              </div>
            </div>
            <div className="rounded-lg border border-line bg-surface px-4 py-3">
              <div className="text-xs text-muted">{t('about.license')}</div>
              <div className="mt-0.5 text-sm font-medium text-ink">MIT License</div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-ink">
              <ShieldCheck className="size-4 text-success" />
              {t('about.privacyTitle')}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">{t('about.privacyBody')}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={openHomepage}>
              <MessageSquare className="size-4" />
              {t('about.feedback')}
            </Button>
            <Button variant="ghost" onClick={openHomepage}>
              <ExternalLink className="size-4" />
              {t('about.homepage')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
