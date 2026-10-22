import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = vi.hoisted(() => ({
  redirect: vi.fn((href: string) => {
    throw new Error(`redirect:${href}`)
  }),
  notFound: vi.fn(() => {
    throw new Error('not-found')
  }),
}))
vi.mock('next/navigation', () => navigation)

import Target from './page'

const targetId = '20000000-0000-4000-8000-000000000001'
describe('Community notification destinations', () => {
  beforeEach(() => vi.clearAllMocks())
  it.each([
    ['conversations', `/community/messages/${targetId}`],
    ['requests', `/community/messages?requestId=${targetId}`],
    ['invitations', `/community/messages?invitationId=${targetId}`],
  ])(
    'maps %s to the existing owner-authorized UI',
    async (kind, destination) => {
      await expect(
        Target({
          params: Promise.resolve({ kind, targetId }),
          searchParams: Promise.resolve({}),
        }),
      ).rejects.toThrow(`redirect:${destination}`)
      expect(navigation.redirect).toHaveBeenCalledWith(destination)
    },
  )
  it.each([
    { kind: 'admin', targetId },
    { kind: 'conversations', targetId: 'invalid' },
    { kind: 'invitations', targetId: `${targetId}?redirect=/admin` },
  ])('denies unsupported target $kind / $targetId', async (params) => {
    await expect(
      Target({
        params: Promise.resolve(params),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow('not-found')
    expect(navigation.redirect).not.toHaveBeenCalled()
  })
})
