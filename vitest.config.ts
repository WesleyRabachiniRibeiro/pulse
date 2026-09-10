import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
      '@main': resolve(__dirname, 'electron'),
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    setupFiles: ['./vitest.setup.ts'],
    include: ['shared/**/*.test.ts', 'electron/**/*.test.ts', 'src/**/*.test.ts'],
    environment: 'node',
  },
})
