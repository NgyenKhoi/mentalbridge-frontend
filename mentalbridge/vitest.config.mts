import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    globals: true,
    setupFiles: ['./tests/setup/vitest.setup.ts'],
    include: ['**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['lib/**/*.{ts,tsx}', 'features/**/*.{ts,tsx}'],
    },
  },
})
