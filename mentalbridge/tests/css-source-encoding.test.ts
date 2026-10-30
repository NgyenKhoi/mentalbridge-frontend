// @vitest-environment node

import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = join(__dirname, '..')
const skipped = new Set([
  'node_modules',
  '.next',
  '.turbo',
  'coverage',
  'playwright-report',
  'test-results',
  'out',
  'dist',
  'build',
])

function authoredStylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('.') || skipped.has(entry.name)) return []
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return authoredStylesheets(path)
    return entry.isFile() && /\.s?css$/.test(entry.name) ? [path] : []
  })
}

describe('stylesheet encoding', () => {
  // A leading UTF-8 BOM becomes part of the first selector, so that rule never matches.
  it('has no UTF-8 byte order mark at the start of any authored stylesheet', () => {
    const files = authoredStylesheets(root)
    const withBom = files
      .filter((file) =>
        readFileSync(file)
          .subarray(0, 3)
          .equals(Buffer.from([0xef, 0xbb, 0xbf])),
      )
      .map((file) => relative(root, file).replaceAll('\\', '/'))

    expect(files.length).toBeGreaterThan(0)
    expect(withBom).toEqual([])
  })
})
