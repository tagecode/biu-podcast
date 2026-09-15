import { describe, expect, it, vi } from 'vitest'

import { isEditableContextTarget, showContextMenu } from './context-menu'

describe('showContextMenu', () => {
  it('forwards items and rounded coordinates to the native menu ipc', async () => {
    const show = vi.fn(async () => ({ ok: true as const, data: 'copy' }))
    window.api = { contextMenu: { show } } as unknown as Window['api']

    const result = await showContextMenu([{ id: 'copy', label: '复制' }], {
      clientX: 10.6,
      clientY: 20.4
    } as React.MouseEvent)

    expect(show).toHaveBeenCalledWith({
      items: [{ id: 'copy', label: '复制' }],
      x: 11,
      y: 20
    })
    expect(result).toBe('copy')
  })

  it('throws the ipc error message when the call fails', async () => {
    window.api = {
      contextMenu: {
        show: vi.fn(async () => ({
          ok: false as const,
          error: { code: 'INVALID_INPUT', message: '输入参数无效，请检查后重试' }
        }))
      }
    } as unknown as Window['api']

    await expect(showContextMenu([{ id: 'copy', label: '复制' }])).rejects.toThrow(
      '输入参数无效，请检查后重试'
    )
  })
})

describe('isEditableContextTarget', () => {
  it('accepts input and textarea elements only', () => {
    expect(isEditableContextTarget(document.createElement('input'))).toBe(true)
    expect(isEditableContextTarget(document.createElement('textarea'))).toBe(true)
    expect(isEditableContextTarget(document.createElement('div'))).toBe(false)
    expect(isEditableContextTarget(null)).toBe(false)
  })
})
