import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, ...props }: React.ComponentProps<'input'>): React.JSX.Element {
  return (
    <input
      type={type}
      className={cn(
        'flex h-10 w-full rounded-md border border-line bg-surface px-3 py-2 text-sm text-ink outline-none transition-colors placeholder:text-muted focus-visible:border-amber-600 focus-visible:ring-[3px] focus-visible:ring-amber-600/15 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-danger',
        className
      )}
      {...props}
    />
  )
}

export { Input }
