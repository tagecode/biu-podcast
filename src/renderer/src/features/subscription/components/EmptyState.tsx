import { PodcastIcon, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'

interface EmptyStateProps {
  onAdd: () => void
}

export function EmptyState({ onAdd }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      <PodcastIcon className="mb-6 size-16 text-muted" strokeWidth={1.75} />
      <h2 className="mb-2 text-lg font-semibold text-ink">还没有订阅任何播客</h2>
      <p className="mb-6 max-w-sm text-sm leading-5 text-muted">
        粘贴 RSS Feed 地址即可开始收听。所有数据保存在本机，无需注册账号。
      </p>
      <Button onClick={onAdd}>
        <Plus className="size-4" />
        添加第一个订阅
      </Button>
    </div>
  )
}
