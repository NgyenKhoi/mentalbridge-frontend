import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserPage from '@/app/(dashboard)/appointments/[appointmentId]/video/page'
import SpecialistPage from '@/app/specialist/appointments/[appointmentId]/video/page'

const authority = vi.hoisted(() => ({
  requireAccount: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error('NOT_FOUND')
  }),
}))
vi.mock('@/lib/auth/dal', () => ({
  requireCurrentAccount: authority.requireAccount,
}))
vi.mock('next/navigation', () => ({ notFound: authority.notFound }))
vi.mock('@/components/RoleWorkspace', () => ({ default: () => null }))
vi.mock('./VideoConsultationWorkspace', () => ({
  VideoConsultationWorkspace: () => null,
}))
const id = '10000000-0000-4000-8000-000000000001'
describe('role-authorized dedicated video routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authority.requireAccount.mockResolvedValue({
      accountId: 'synthetic-subject-A',
      roles: ['USER', 'SPECIALIST'],
    })
  })
  it.each([
    ['USER', UserPage],
    ['SPECIALIST', SpecialistPage],
  ] as const)(
    'rechecks %s and keys the room by authenticated subject and appointment',
    async (role, page) => {
      const result = await page({
        params: Promise.resolve({ appointmentId: id }),
      })
      expect(authority.requireAccount).toHaveBeenCalledWith([role])
      expect(result.key).toBe(`synthetic-subject-A:${id}`)
      authority.requireAccount.mockResolvedValue({
        accountId: 'synthetic-subject-B',
        roles: [role],
      })
      expect(
        (await page({ params: Promise.resolve({ appointmentId: id }) })).key,
      ).toBe(`synthetic-subject-B:${id}`)
    },
  )
  it.each([UserPage, SpecialistPage])(
    'rejects malformed route identity without creating a room',
    async (page) => {
      await expect(
        page({
          params: Promise.resolve({ appointmentId: 'not-an-appointment' }),
        }),
      ).rejects.toThrow('NOT_FOUND')
    },
  )
  it.each([UserPage, SpecialistPage])(
    'does not render when current role authorization fails',
    async (page) => {
      authority.requireAccount.mockRejectedValue(new Error('FORBIDDEN'))
      await expect(
        page({ params: Promise.resolve({ appointmentId: id }) }),
      ).rejects.toThrow('FORBIDDEN')
    },
  )
})
