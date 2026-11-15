// @vitest-environment node

import { http, HttpResponse } from 'msw'
import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'
import { mockServer } from '@/tests/mocks/server'

const sessionMocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
}))

vi.mock('@/lib/auth/session-service', () => ({
  RefreshFailedError: class RefreshFailedError extends Error {},
  resolveSession: sessionMocks.resolveSession,
  ensureRole: sessionMocks.ensureRole,
}))

import { GET, POST } from './route'

const upstream = 'http://journal.test/api/v1/ai-companion/conversations'
const account = {
  accountId: '22222222-2222-4222-8222-222222222222',
  status: 'ACTIVE',
  roles: ['USER'],
  emailVerified: true,
}
const stamp = '2026-11-06T08:00:00Z'
const summary = {
  conversationId: '11111111-1111-4111-8111-111111111111',
  title: 'Chuyện đã lưu',
  titleVersion: 'A'.repeat(43),
  createdAt: stamp,
  updatedAt: stamp,
  expiresAt: '2027-02-04T08:00:00Z',
}
const detail = {
  ...summary,
  context: {
    sources: { plan: false, diary: false, screening: false, resourceIds: [] },
    updatedAt: stamp,
  },
  messages: [],
}
const request = (method: string) =>
  new NextRequest('http://localhost/api/ai-companion/conversations', {
    method,
    headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
  })

describe('AI Companion conversations BFF with MB-810 titles', () => {
  beforeEach(() => {
    vi.stubEnv('JOURNAL_AI_SERVICE_URL', 'http://journal.test')
    sessionMocks.resolveSession.mockResolvedValue({ account })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('lists conversations with and without titleVersion', async () => {
    const legacy = {
      conversationId: '55555555-5555-4555-8555-555555555555',
      title: summary.title,
      createdAt: stamp,
      updatedAt: stamp,
      expiresAt: summary.expiresAt,
    }
    const items = [summary, legacy]
    mockServer.use(http.get(upstream, () => HttpResponse.json({ items })))

    const response = await GET(request('GET'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ items })
  })

  it('creates a conversation whose detail carries titleVersion', async () => {
    mockServer.use(
      http.post(upstream, () => HttpResponse.json(detail, { status: 201 })),
    )

    const response = await POST(request('POST'))

    expect(response.status).toBe(201)
    expect(await response.json()).toEqual(detail)
  })

  it('blocks a malformed titleVersion as an invalid upstream response', async () => {
    mockServer.use(
      http.post(upstream, () =>
        HttpResponse.json({ ...detail, titleVersion: 'nope' }, { status: 201 }),
      ),
    )

    const response = await POST(request('POST'))

    expect(response.status).toBe(502)
    expect((await response.json()).code).toBe('COMPANION_MALFORMED_RESPONSE')
  })
})
