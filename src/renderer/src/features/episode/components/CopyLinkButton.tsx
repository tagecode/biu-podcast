import { Check, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { COPIED_MS, subscribeCopied } from '@/lib/copied-feedback'

import { copyShareUrl } from '../lib/share-link'

interface CopyLinkButtonProps {
  url: string
  label: string
}

export function CopyLinkButton({ url, label }: CopyLinkButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const stop = subscribeCopied(() => {
      setCopied(true)
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => setCopied(false), COPIED_MS)
    })
    return () => {
      stop()
      if (timer) clearTimeout(timer)
    }
  }, [])

  const handleClick = async (): Promise<void> => {
    await copyShareUrl(url)
  }

  return (
    <span className="relative inline-flex">
      <Button
        variant="ghost"
        size="icon"
        aria-label={copied ? t('common.copied') : label}
        onClick={() => void handleClick()}
      >
        {copied ? <Check className="size-4 text-amber-700" /> : <Link2 className="size-4" />}
      </Button>
      {copied ? (
        <span
          role="status"
          className="pointer-events-none absolute top-full left-1/2 z-50 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs text-white shadow-md"
        >
          {t('common.copied')}
        </span>
      ) : null}
    </span>
  )
}
