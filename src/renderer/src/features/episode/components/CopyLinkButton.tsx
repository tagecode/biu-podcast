import { Check, Link2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { copyShareUrl } from '../lib/share-link'

interface CopyLinkButtonProps {
  url: string
  label: string
}

const COPIED_MS = 2000

export function CopyLinkButton({ url, label }: CopyLinkButtonProps): React.JSX.Element {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const handleClick = async (): Promise<void> => {
    await copyShareUrl(url)
    setCopied(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setCopied(false), COPIED_MS)
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
