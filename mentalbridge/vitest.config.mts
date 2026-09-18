import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: {
      'server-only': fileURLToPath(
        new URL('./node_modules/server-only/empty.js', import.meta.url),
      ),
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'http://localhost/',
      },
    },
    environmentMatchGlobs: [
      // server-only client tests do not need DOM and must run in Node to avoid
      // the jsdom AbortSignal / undici-fetch incompatibility with msw/node
      ['lib/journal/**/*.test.ts', 'node'],
      ['lib/care/**/*.test.ts', 'node'],
    ],
    globals: true,
    testTimeout: 15_000,
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
