import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { OpmlImportPreviewDialog } from './OpmlImportPreviewDialog'
import type { OpmlPreviewResult } from '@shared/ipc-contract'

const preview: OpmlPreviewResult = {
  filePath: '/tmp/feeds.opml',
  items: [
    { title: '前端周刊', feedUrl: 'https://example.com/fe.xml', folderName: '技术' },
    { title: '独立播客', feedUrl: 'https://example.com/indie.xml', folderName: null }
  ]
}

describe('OpmlImportPreviewDialog', () => {
  it('confirms only checked feeds', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(async () => {})
    const onOpenChange = vi.fn()
    render(
      <OpmlImportPreviewDialog
        preview={preview}
        busy={false}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    )

    expect(screen.getByText('前端周刊')).toBeInTheDocument()
    await user.click(screen.getByRole('checkbox', { name: '独立播客' }))
    await user.click(screen.getByRole('button', { name: '导入选中项' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onConfirm).toHaveBeenCalledWith([
      { title: '前端周刊', feedUrl: 'https://example.com/fe.xml', folderName: '技术' }
    ])
  })

  it('does not import when cancelled', async () => {
    const user = userEvent.setup()
    const onConfirm = vi.fn(async () => {})
    const onOpenChange = vi.fn()
    render(
      <OpmlImportPreviewDialog
        preview={preview}
        busy={false}
        onOpenChange={onOpenChange}
        onConfirm={onConfirm}
      />
    )

    await user.click(screen.getByRole('button', { name: '取消' }))
    expect(onConfirm).not.toHaveBeenCalled()
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })
})
