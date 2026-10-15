import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  contentAchievementClient,
  type ContentServiceError,
} from './content-client'

const base = {
  visibilityState: 'VISIBLE',
  preferenceVersion: '0',
  policyVersion: 'achievement-rules-v1',
  calculatedAt: '2026-10-13T05:00:00.000Z',
  sources: [
    {
      domain: 'JOURNAL',
      availability: 'AVAILABLE',
      asOfLocalDate: '2026-10-13',
    },
    {
      domain: 'EMOTION_CHECK_IN',
      availability: 'AVAILABLE',
      asOfLocalDate: '2026-10-13',
    },
    { domain: 'RESOURCE', availability: 'AVAILABLE', asOfLocalDate: null },
    { domain: 'JOURNEY', availability: 'DEFERRED', asOfLocalDate: null },
  ],
  items: Array.from({ length: 11 }, (_, index) => ({
    definitionId:
      index === 10 ? 'journey.new-chapter' : `journal.item-${String(index)}`,
    domain: index === 10 ? 'JOURNEY' : 'JOURNAL',
    kind: index === 10 ? 'JOURNEY' : 'MILESTONE',
    tier: index === 10 ? 'JOURNEY' : 'FIRST_STEP',
    title: `Item ${String(index)}`,
    description: 'A factual item',
    status: index === 10 ? 'DEFERRED' : 'UNEARNED',
    evidenceClass:
      index === 10 ? 'USER_CONFIRMED_JOURNEY' : 'OWNER_SOURCE_FACT',
    unlockedAt: null,
    ruleVersion: 'achievement-rules-v1',
    privacy: 'PRIVATE',
    progress: index === 10 ? null : { current: 0, target: 1, unit: 'EVENT' },
  })),
}

describe('content achievement boundary', () => {
  beforeEach(() => {
    process.env.CONTENT_SERVICE_URL = 'http://content.local:3003'
    process.env.CONTENT_SERVICE_TIMEOUT_MS = '5000'
  })

  afterEach(() => vi.unstubAllGlobals())

  it('binds the strong ETag to the body version', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(Response.json(base, { headers: { ETag: '"9"' } })),
    )
    await expect(
      contentAchievementClient.get('token', 'Asia/Ho_Chi_Minh', 'correlation'),
    ).rejects.toMatchObject({
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    } satisfies Partial<ContentServiceError>)
  })

  it('forwards timezone, preference, and exact version', async () => {
    const changed = {
      ...base,
      visibilityState: 'HIDDEN',
      preferenceVersion: '1',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValue(Response.json(changed, { headers: { ETag: '"1"' } }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      contentAchievementClient.setVisibility(
        'token',
        'Asia/Ho_Chi_Minh',
        { visibilityState: 'HIDDEN' },
        '"0"',
        'correlation',
      ),
    ).resolves.toMatchObject({ etag: '"1"' })
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.searchParams.get('timezone')).toBe('Asia/Ho_Chi_Minh')
    expect(init.headers).toMatchObject({ 'If-Match': '"0"' })
  })
})
