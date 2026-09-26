import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  contentPreferenceClient,
  type ContentServiceError,
} from './content-client'

const preferences = {
  notificationsEnabled: true,
  channels: { inApp: true, email: false, push: false },
  contentGroups: {
    journalReminder: true,
    emotionCheckIn: true,
    streakMilestone: true,
    screeningReassessment: true,
    appointmentMessage: true,
    resourceSystem: true,
  },
  quietHours: {
    enabled: false,
    start: '22:00',
    end: '07:00',
    timeZone: 'Asia/Ho_Chi_Minh',
  },
  email: {
    cadence: 'IMMEDIATE',
    wellbeingDigestEnabled: false,
    resourceRemindersEnabled: false,
  },
  version: 0,
  updatedAt: '2026-09-26T00:00:00.000Z',
}

function upstream(etag: string | null = '"0"') {
  return new Response(JSON.stringify(preferences), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      ...(etag ? { ETag: etag } : {}),
    },
  })
}

describe('content notification preference client', () => {
  beforeEach(() => {
    process.env.CONTENT_SERVICE_URL = 'http://content.local:3003'
    process.env.CONTENT_SERVICE_TIMEOUT_MS = '5000'
  })

  afterEach(() => vi.unstubAllGlobals())

  it('forwards owner authentication and the exact optimistic version', async () => {
    const fetchMock = vi.fn().mockResolvedValue(upstream('"1"'))
    vi.stubGlobal('fetch', fetchMock)

    const result = await contentPreferenceClient.update(
      'owner-token',
      { channels: { push: true } },
      '"0"',
      '10000000-0000-4000-8000-000000000001',
    )

    expect(result.etag).toBe('"1"')
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit]
    expect(url.toString()).toBe(
      'http://content.local:3003/api/v1/notification-preferences',
    )
    expect(init.headers).toMatchObject({
      Authorization: 'Bearer owner-token',
      'If-Match': '"0"',
    })
    expect(init.body).toBe(JSON.stringify({ channels: { push: true } }))
  })

  it('fails closed when Content omits the preference ETag', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(upstream(null)))
    await expect(
      contentPreferenceClient.get('owner-token', 'correlation'),
    ).rejects.toMatchObject({
      code: 'CONTENT_MALFORMED_RESPONSE',
      status: 502,
    } satisfies Partial<ContentServiceError>)
  })
})
