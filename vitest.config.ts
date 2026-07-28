import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'renderer',
          environment: 'jsdom',
          include: ['src/renderer/src/**/*.test.{ts,tsx}'],
          setupFiles: ['src/renderer/src/test/setup.ts']
        },
        plugins: [react(), tailwindcss()],
        resolve: {
          alias: {
            '@': resolve('src/renderer/src'),
            '@renderer': resolve('src/renderer/src'),
            '@shared': resolve('src/shared')
          }
        }
      },
      {
        test: {
          name: 'main',
          environment: 'node',
          include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts']
        },
        resolve: {
          alias: {
            '@shared': resolve('src/shared')
          }
        }
      }
    ]
  }
})
