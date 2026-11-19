import { beforeEach, describe, expect, it, vi } from 'vitest'
import UserCallPage from './page'
import SpecialistCallPage from '@/app/specialist/call/[appointmentId]/page'

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
vi.mock(
  '@/features/appointments/components/VideoConsultationWorkspace',
  () => ({
    VideoConsultationWorkspace: () => null,
  }),
)
const id = '10000000-0000-4000-8000-000000000001'
const workspaceProps = (element: {
  props: { children: { props: Record<string, unknown> } }
}) => element.props.children.props

describe('standalone call window routes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authority.requireAccount.mockResolvedValue({
      accountId: 'synthetic-subject-A',
      roles: ['USER', 'SPECIALIST'],
    })
  })
  it.each([
    ['USER', UserCallPage],
    ['SPECIALIST', SpecialistCallPage],
  ] as const)(
    'rechecks the %s role and renders the room without the app shell',
    async (role, page) => {
      const element = await page({
        params: Promise.resolve({ appointmentId: id }),
        searchParams: Promise.resolve({ join: '1' }),
      })
      expect(authority.requireAccount).toHaveBeenCalledWith([role])
      expect(element.key).toBe(`synthetic-subject-A:${id}`)
      expect(workspaceProps(element)).toMatchObject({
        appointmentId: id,
        role,
        callWindow: true,
        autoJoin: true,
      })
    },
  )
  it.each([UserCallPage, SpecialistCallPage])(
    'joins automatically only when the opener asked for it',
    async (page) => {
      const element = await page({
        params: Promise.resolve({ appointmentId: id }),
      })
      expect(workspaceProps(element)).toMatchObject({ autoJoin: false })
    },
  )
  it.each([UserCallPage, SpecialistCallPage])(
    'rejects a malformed appointment id and a failed role check',
    async (page) => {
      await expect(
        page({ params: Promise.resolve({ appointmentId: 'nope' }) }),
      ).rejects.toThrow('NOT_FOUND')
      authority.requireAccount.mockRejectedValue(new Error('FORBIDDEN'))
      await expect(
        page({ params: Promise.resolve({ appointmentId: id }) }),
      ).rejects.toThrow('FORBIDDEN')
    },
  )
})
