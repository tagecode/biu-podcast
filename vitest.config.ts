import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: [
        'src/main/features/subscription/*.ts',
        'src/main/features/episode/*.ts',
        'src/main/features/playback/*.ts',
        'src/main/features/download/*.ts',
        'src/main/features/data-portability/*.ts'
      ],
      thresholds: {
        statements: 85,
        lines: 85,
        functions: 80,
        branches: 60
      }
    },
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
          include: ['src/main/**/*.test.ts', 'src/shared/**/*.test.ts'],
          env: {
            // Module-level singletons (getDb) run at import time; give them a
            // safe in-memory DB instead of touching a real userData path.
            BIU_PODCAST_DB_PATH: ':memory:'
          }
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
