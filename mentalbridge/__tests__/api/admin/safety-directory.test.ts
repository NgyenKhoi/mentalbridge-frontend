import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  ensureRole: vi.fn(),
  readSessionCredentials: vi.fn(() => ({
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
  })),
}))

vi.mock('@/lib/auth/session-cookies', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session-cookies')>()),
  readSessionCredentials: mocks.readSessionCredentials,
}))

vi.mock('@/lib/auth/session-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session-service')>()),
  resolveSession: mocks.resolveSession,
  ensureRole: mocks.ensureRole,
}))

import {
  GET as listEntries,
  POST as createEntry,
} from '@/app/api/admin/safety-directory/entries/route'
import { PATCH as updateEntry } from '@/app/api/admin/safety-directory/entries/[entryId]/route'
import { POST as transitionEntry } from '@/app/api/admin/safety-directory/entries/[entryId]/[action]/route'

const ENTRY_ID = '123e4567-e89b-42d3-a456-426614174000'
const CORRELATION_ID = '223e4567-e89b-42d3-a456-426614174000'
const entryBody = {
  name: 'Đường dây hỗ trợ',
  type: 'HOTLINE',
  phone: '111',
  address: null,
  coverage: [
    {
      level: 'NATIONWIDE',
      provinceCode: null,
      provinceName: null,
      districtCode: null,
      districtName: null,
    },
  ],
  sourceName: 'Nguồn chính thức',
  sourceReference: 'Công văn 01',
  sourceRetrievedAt: '2026-11-10T12:00:00Z',
  sourceChecksum: null,
}

function request(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers)
  headers.set('x-correlation-id', CORRELATION_ID)
  return new NextRequest(`http://localhost:3000${path}`, {
    method: init?.method,
    headers,
    ...(init?.body === undefined ? {} : { body: init.body }),
  })
}

const updateContext = { params: Promise.resolve({ entryId: ENTRY_ID }) }
const reviewContext = {
  params: Promise.resolve({ entryId: ENTRY_ID, action: 'review' }),
}
const deactivateContext = {
  params: Promise.resolve({ entryId: ENTRY_ID, action: 'deactivate' }),
}

const operations = [
  {
    name: 'GET list',
    call: () => listEntries(request('/api/admin/safety-directory/entries')),
  },
  {
    name: 'POST create',
    call: () =>
      createEntry(
        request('/api/admin/safety-directory/entries', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'idempotency-key': 'mb696-create-command',
          },
          body: JSON.stringify(entryBody),
        }),
      ),
  },
  {
    name: 'PATCH update',
    call: () =>
      updateEntry(
        request(`/api/admin/safety-directory/entries/${ENTRY_ID}?version=1`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(entryBody),
        }),
        updateContext,
      ),
  },
  {
    name: 'POST review',
    call: () =>
      transitionEntry(
        request(
          `/api/admin/safety-directory/entries/${ENTRY_ID}/review?version=1`,
          { method: 'POST' },
        ),
        reviewContext,
      ),
  },
  {
    name: 'POST deactivate',
    call: () =>
      transitionEntry(
        request(
          `/api/admin/safety-directory/entries/${ENTRY_ID}/deactivate?version=1`,
          { method: 'POST' },
        ),
        deactivateContext,
      ),
  },
]

describe('Safety directory admin BFF authorization and version boundary', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    mocks.resolveSession.mockReset()
    mocks.ensureRole.mockReset()
    mocks.resolveSession.mockResolvedValue({
      account: { accountId: 'admin', roles: ['ADMIN'] },
      rotatedTokens: null,
    })
    mocks.ensureRole.mockReturnValue(undefined)
  })

  it.each(operations)('rejects unauthenticated $name', async ({ call }) => {
    mocks.resolveSession.mockRejectedValue(
      new ApiError({
        message: 'Authentication required',
        code: 'AUTH_REQUIRED',
        status: 401,
      }),
    )
    const fetchMock = vi.spyOn(global, 'fetch')

    expect((await call()).status).toBe(401)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each(operations)('rejects non-admin $name', async ({ call }) => {
    mocks.ensureRole.mockImplementation(() => {
      throw new ApiError({
        message: 'Forbidden',
        code: 'FORBIDDEN',
        status: 403,
      })
    })
    const fetchMock = vi.spyOn(global, 'fetch')

    expect((await call()).status).toBe(403)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects missing or invalid update versions before contacting Content', async () => {
    const fetchMock = vi.spyOn(global, 'fetch')
    for (const value of ['', '?version=-1', '?version=abc']) {
      const response = await updateEntry(
        request(`/api/admin/safety-directory/entries/${ENTRY_ID}${value}`, {
          method: 'PATCH',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(entryBody),
        }),
        updateContext,
      )
      expect(response.status).toBe(400)
    }
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['review', reviewContext],
    ['deactivate', deactivateContext],
  ])(
    'rejects missing or invalid %s versions before contacting Content',
    async (action, context) => {
      const fetchMock = vi.spyOn(global, 'fetch')
      for (const value of ['', '?version=-1', '?version=abc']) {
        const response = await transitionEntry(
          request(
            `/api/admin/safety-directory/entries/${ENTRY_ID}/${action}${value}`,
            { method: 'POST' },
          ),
          context,
        )
        expect(response.status).toBe(400)
      }
      expect(fetchMock).not.toHaveBeenCalled()
    },
  )
})
