import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'shared'),
    },
  },
  test: {
    include: ['shared/**/*.test.ts', 'electron/**/*.test.ts'],
    environment: 'node',
  },
})
