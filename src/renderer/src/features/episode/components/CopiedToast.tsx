import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { COPIED_MS, subscribeCopied } from '@/lib/copied-feedback'

export function CopiedToast(): React.JSX.Element | null {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const stop = subscribeCopied(() => {
      setVisible(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setVisible(false), COPIED_MS)
    })
    return () => {
      stop()
      if (timer) clearTimeout(timer)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      role="status"
      className="pointer-events-none fixed bottom-20 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md"
    >
      {t('common.copied')}
    </div>
  )
}
