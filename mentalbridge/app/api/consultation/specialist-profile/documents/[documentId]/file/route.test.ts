import { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ACCESS_COOKIE_NAME } from '@/lib/auth/session-cookies'

const mocks = vi.hoisted(() => ({
  resolveSession: vi.fn(),
  credentialFile: vi.fn(),
}))

vi.mock('@/lib/auth/session-service', async (original) => ({
  ...(await original<typeof import('@/lib/auth/session-service')>()),
  resolveSession: mocks.resolveSession,
}))
vi.mock('@/lib/consultation/consultation-client', () => ({
  consultationClient: { credentialFile: mocks.credentialFile },
}))

import { GET } from './route'

const id = 'f5297ec9-bbc9-4d51-8212-62778245335c'
const signedUrl = 'https://api.cloudinary.com/v1_1/demo/raw/download'
const fetchFile = vi.fn()

function request() {
  return GET(
    new NextRequest(
      `http://localhost/api/consultation/specialist-profile/documents/${id}/file`,
      { headers: { cookie: `${ACCESS_COOKIE_NAME}=access-token` } },
    ),
    { params: Promise.resolve({ documentId: id }) },
  )
}

describe('specialist credential file', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubGlobal('fetch', fetchFile)
    mocks.resolveSession.mockResolvedValue({
      account: { roles: ['SPECIALIST'] },
    })
    mocks.credentialFile.mockResolvedValue({ data: { url: signedUrl } })
  })

  afterEach(() => vi.unstubAllGlobals())

  it('returns private PDF bytes following one authorized storage request', async () => {
    fetchFile.mockResolvedValue(new Response('%PDF-1.5'))
    const response = await request()

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('application/pdf')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.text()).toBe('%PDF-1.5')
    expect(mocks.credentialFile).toHaveBeenCalledWith(
      'access-token',
      expect.any(String),
      id,
      false,
    )
    expect(fetchFile).toHaveBeenCalledTimes(1)
    expect(fetchFile).toHaveBeenCalledWith(
      new URL(signedUrl),
      expect.objectContaining({ redirect: 'error' }),
    )
  })

  it('does not expose the storage response on a rate limit', async () => {
    fetchFile.mockResolvedValue(
      new Response('Private storage error', { status: 420 }),
    )
    const response = await request()

    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({
      code: 'CREDENTIAL_FILE_BUSY',
    })
  })

  it('rejects non-document responses even when storage returns HTTP 200', async () => {
    fetchFile.mockResolvedValue(Response.json({ error: 'Unexpected response' }))
    const response = await request()

    expect(response.status).toBe(502)
    expect(await response.json()).toMatchObject({
      code: 'CREDENTIAL_FILE_UNAVAILABLE',
    })
  })

  it('does not fetch an unexpected storage origin', async () => {
    mocks.credentialFile.mockResolvedValue({
      data: { url: 'https://other.test/file' },
    })

    expect((await request()).status).toBe(502)
    expect(fetchFile).not.toHaveBeenCalled()
  })

  it('does not look up the document for a user session', async () => {
    mocks.resolveSession.mockResolvedValue({ account: { roles: ['USER'] } })

    expect((await request()).status).toBe(403)
    expect(mocks.credentialFile).not.toHaveBeenCalled()
    expect(fetchFile).not.toHaveBeenCalled()
  })
})
