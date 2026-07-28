import * as React from 'react'

import { cn } from '@/lib/utils'

function Skeleton({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('animate-pulse rounded-md bg-line/40', className)} {...props} />
}

export { Skeleton }
