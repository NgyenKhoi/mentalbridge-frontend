import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    '.next-realtime-e2e/**',
    '.next-dev-runs/**',
    '.next-dev-configs/**',
    '.playwright-realtime-e2e/**',
    '.vite-realtime-e2e/**',
    // Retrieved design/prototype evidence includes generated third-party bundles,
    // not application source. Its behavior is checked by the prototype QA gate.
    '.stitch/**',
    // Vendored Mầm rig generator; kept byte-identical so it reproduces the frozen asset hash.
    'design-source/**',
    'out/**',
    'build/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
