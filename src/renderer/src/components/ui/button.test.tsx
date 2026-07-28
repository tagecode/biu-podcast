import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Button } from './button'

describe('Button', () => {
  it('renders without crashing', () => {
    render(<Button>添加订阅</Button>)
    expect(screen.getByRole('button', { name: '添加订阅' })).toBeInTheDocument()
  })
})
