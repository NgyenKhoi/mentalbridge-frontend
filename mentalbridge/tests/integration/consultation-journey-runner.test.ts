import { spawnSync } from 'node:child_process'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('MB-623 controlled cross-stack runner boundary', () => {
  it.each([
    'private.invalid.bootstrap',
    JSON.stringify({
      fixture: 'https://example.com',
      consultation: 'http://127.0.0.1:1',
      key: 'private.invalid.bootstrap',
    }),
    JSON.stringify({
      fixture: 'http://127.0.0.1:1/?secret=private.invalid.bootstrap',
      consultation: 'http://127.0.0.1:2',
      key: '00000000-0000-4000-8000-000000000623',
    }),
    JSON.stringify({
      fixture: 'http://user:private.invalid.bootstrap@127.0.0.1:1',
      consultation: 'http://127.0.0.1:2',
      key: '00000000-0000-4000-8000-000000000623',
    }),
  ])(
    'rejects unsafe bootstrap before any server/browser startup without echoing input',
    (input) => {
      const result = spawnSync(
        process.execPath,
        [resolve('scripts/run-consultation-journey.mjs')],
        { input, encoding: 'utf8', timeout: 15_000, windowsHide: true },
      )
      expect(result.error).toBeUndefined()
      expect(result.status).toBe(2)
      expect(result.stdout).toBe('')
      expect(result.stderr).toContain('protected disposable loopback fixture')
      expect(result.stderr).not.toContain('private.invalid.bootstrap')
    },
  )
})
