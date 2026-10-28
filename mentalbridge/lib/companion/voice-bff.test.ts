import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import {
  eligibility,
  session,
  voiceKey,
  voiceSessionId,
  connection,
  disclosure,
} from '@/tests/fixtures/voice'

const auth = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))
vi.mock('@/lib/auth/session-service', () => ({
  ...auth,
  RefreshFailedError: class extends Error {},
}))
import { voiceBff } from './voice-bff'

const request = (
  method = 'GET',
  body: unknown = {},
  headers: Record<string, string> = {},
) =>
  new NextRequest('http://localhost/api/ai-companion/voice/eligibility', {
    method,
    headers: {
      cookie: 'mentalbridge_access=synthetic-access',
      origin: 'http://localhost',
      'Content-Type': 'application/json',
      'Idempotency-Key': voiceKey,
      ...headers,
    },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  })
describe('closed Voice BFF', () => {
  beforeEach(() => {
    vi.stubEnv('JOURNAL_AI_SERVICE_URL', 'http://journal.test')
    vi.stubEnv('CARE_API_BASE_URL', 'http://care.test')
    auth.resolveSession
      .mockReset()
      .mockResolvedValue({ account: { roles: ['USER'] } })
    auth.ensureRole.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })
  it('forwards only the current USER credential, preserves owner/token binding and no-store', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json(eligibility()))
    vi.stubGlobal('fetch', fetch)
    const response = await voiceBff(request(), ['eligibility'])
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(auth.ensureRole).toHaveBeenCalledWith(expect.anything(), ['USER'])
    expect(fetch).toHaveBeenCalledWith(
      new URL('http://journal.test/api/v1/ai-companion/voice-eligibility'),
      expect.objectContaining({
        cache: 'no-store',
        redirect: 'error',
        headers: expect.objectContaining({
          Authorization: 'Bearer synthetic-access',
        }),
      }),
    )
    expect(JSON.stringify(await response.json())).not.toContain(
      'synthetic-access',
    )
  })
  it('routes only published public operations, retaining command keys', async () => {
    for (const [parts, value, owner] of [
      [['sessions'], session(), 'journal.test'],
      [
        ['sessions', voiceSessionId, 'connection'],
        connection(),
        'journal.test',
      ],
      [
        ['sessions', voiceSessionId, 'end'],
        session({ state: 'ENDING' }),
        'journal.test',
      ],
      [
        ['consent'],
        {
          consentType: 'AI_VOICE_PROCESSING',
          consentVersion: 'ai-voice-processing-capstone-v1',
          granted: true,
          current: true,
          acceptedAt: new Date().toISOString(),
        },
        'care.test',
      ],
    ] as const) {
      const fetch = vi.fn().mockResolvedValue(Response.json(value))
      vi.stubGlobal('fetch', fetch)
      const response = await voiceBff(
        request(
          'POST',
          parts[0] === 'consent'
            ? {
                consentVersion: 'ai-voice-processing-capstone-v1',
                granted: true,
              }
            : {},
        ),
        [...parts],
      )
      expect(response.status).toBeLessThan(300)
      expect(fetch.mock.calls[0]?.[0].hostname).toBe(owner)
      expect(fetch.mock.calls[0]?.[1].headers['Idempotency-Key']).toBe(voiceKey)
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(disclosure)))
    expect((await voiceBff(request(), ['disclosure'])).status).toBe(200)
  })
  it('blocks internal routes, foreign resource selectors, CSRF and invalid commands before upstream mutation', async () => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    for (const parts of [
      ['internal', 'claim'],
      ['sessions', voiceSessionId, 'turns'],
      ['sessions', 'foreign', 'end'],
    ])
      expect((await voiceBff(request('POST'), parts)).status).toBe(404)
    expect(
      (
        await voiceBff(request('POST', { ownerId: voiceSessionId }), [
          'sessions',
        ])
      ).status,
    ).toBe(422)
    expect(
      (
        await voiceBff(request('POST', {}, { origin: 'http://foreign.test' }), [
          'sessions',
        ])
      ).status,
    ).toBe(403)
    expect(
      (
        await voiceBff(request('POST', {}, { 'Idempotency-Key': 'not-uuid' }), [
          'sessions',
        ])
      ).status,
    ).toBe(422)
    expect(fetch).not.toHaveBeenCalled()
  })
  it('fails closed on auth, malformed/oversized responses and downstream error payloads', async () => {
    auth.ensureRole.mockImplementationOnce(() => {
      throw new ApiError({ message: 'Denied', code: 'FORBIDDEN', status: 403 })
    })
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    expect((await voiceBff(request(), ['eligibility'])).status).toBe(403)
    expect(fetch).not.toHaveBeenCalled()
    fetch.mockResolvedValueOnce(
      Response.json({ ...eligibility(), availableSessionSeconds: 999 }),
    )
    expect((await voiceBff(request(), ['eligibility'])).status).toBe(502)
    fetch.mockResolvedValueOnce(Response.json({ secret: 'x'.repeat(33_000) }))
    expect((await voiceBff(request(), ['eligibility'])).status).toBe(502)
    fetch.mockResolvedValueOnce(
      Response.json(
        { code: 'PRIVATE_API_SECRET', title: 'private payload' },
        { status: 503 },
      ),
    )
    const error = await voiceBff(request(), ['eligibility'])
    expect(JSON.stringify(await error.json())).not.toMatch(
      /PRIVATE_API_SECRET|private payload/,
    )
    fetch.mockRejectedValueOnce(new Error('private credential'))
    expect(
      await (await voiceBff(request('POST'), ['sessions'])).json(),
    ).toMatchObject({ code: 'OUTCOME_UNKNOWN' })
  })
  it.each([
    [403, 'FREE_LOCKED'],
    [403, 'CONSENT_REQUIRED'],
    [403, 'VOICE_CONSENT_REQUIRED'],
    [409, 'GLOBAL_CAPACITY_FULL'],
    [409, 'SESSION_LIMIT'],
    [429, 'QUOTA_EXHAUSTED'],
    [429, 'RATE_LIMITED'],
    [503, 'PROVIDER_UNAVAILABLE'],
  ])(
    'MB-762 preserves owner denial %s/%s without forwarding private error detail',
    async (status, code) => {
      const fetch = vi.fn().mockResolvedValue(
        Response.json(
          {
            code,
            detail: 'private-provider-marker',
            token: 'private-token-marker',
          },
          { status: Number(status) },
        ),
      )
      vi.stubGlobal('fetch', fetch)
      const response = await voiceBff(request('POST'), ['sessions'])
      expect(response.status).toBe(status)
      const body = await response.json()
      expect(body).toMatchObject({ code })
      expect(JSON.stringify(body)).not.toMatch(
        /private-provider-marker|private-token-marker/,
      )
      expect(response.headers.get('Cache-Control')).toContain('no-store')
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )
  it('MB-762 preserves each caller credential when the owner rejects a foreign session token', async () => {
    const fetch = vi
      .fn()
      .mockImplementation(() =>
        Response.json(
          { code: 'SESSION_NOT_FOUND', detail: 'private-owner-marker' },
          { status: 404 },
        ),
      )
    vi.stubGlobal('fetch', fetch)
    for (const actor of ['synthetic-user-a', 'synthetic-user-b']) {
      const response = await voiceBff(
        request('POST', {}, { cookie: `mentalbridge_access=${actor}` }),
        ['sessions', voiceSessionId, 'connection'],
      )
      expect(response.status).toBe(404)
      const text = await response.text()
      expect(text).not.toMatch(
        /private-owner-marker|participantToken|synthetic-user/,
      )
    }
    expect(
      fetch.mock.calls.map((call) => call[1].headers.Authorization),
    ).toEqual(['Bearer synthetic-user-a', 'Bearer synthetic-user-b'])
  })
})
