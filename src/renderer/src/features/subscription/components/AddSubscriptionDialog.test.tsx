import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { AddSubscriptionDialog } from './AddSubscriptionDialog'

describe('AddSubscriptionDialog', () => {
  it('submits a valid feed URL on Enter', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => {})
    render(<AddSubscriptionDialog open onOpenChange={() => undefined} onSubmit={onSubmit} />)

    await user.type(screen.getByLabelText('RSS Feed 地址'), 'https://example.com/feed.xml')
    await user.keyboard('{Enter}')

    expect(onSubmit).toHaveBeenCalledWith('https://example.com/feed.xml')
  })
})
