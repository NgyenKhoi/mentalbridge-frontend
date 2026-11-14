import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  adminSpecialistCredentialDocuments: vi.fn(),
}))

vi.mock('@/lib/auth/session-service', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/auth/session-service')>()),
  resolveSession: mocks.resolveSession,
}))
vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: {
    adminSpecialistCredentialDocuments:
      mocks.adminSpecialistCredentialDocuments,
  },
}))

import { GET } from './route'

const specialistId = 'f5297ec9-bbc9-4d51-8212-62778245335c'

function request(id = specialistId) {
  return GET(
    new NextRequest(
      `http://localhost/api/admin/specialist-profiles/${id}/documents`,
      {
        headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` },
      },
    ),
    { params: Promise.resolve({ specialistId: id }) },
  )
}

describe('admin specialist credential documents route', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.adminSpecialistCredentialDocuments.mockResolvedValue({ data: [] })
  })

  it('loads only the requested specialist documents with an admin session', async () => {
    mocks.resolveSession.mockResolvedValue({ account: { roles: ['ADMIN'] } })
    const response = await request()
    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    expect(await response.json()).toEqual([])
    expect(mocks.adminSpecialistCredentialDocuments).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      specialistId,
    )
  })

  it('rejects a specialist session before requesting documents', async () => {
    mocks.resolveSession.mockResolvedValue({
      account: { roles: ['SPECIALIST'] },
    })
    expect((await request()).status).toBe(403)
    expect(mocks.adminSpecialistCredentialDocuments).not.toHaveBeenCalled()
  })

  it('rejects an invalid specialist ID before requesting documents', async () => {
    expect((await request('invalid')).status).toBe(400)
    expect(mocks.adminSpecialistCredentialDocuments).not.toHaveBeenCalled()
  })
})
