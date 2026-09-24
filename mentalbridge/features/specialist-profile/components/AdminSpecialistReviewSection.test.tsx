import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminSpecialistReviewSection from './AdminSpecialistReviewSection'

const profile = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  displayName: 'Nguyễn An',
  bio: 'Hỗ trợ phi lâm sàng',
  supportAreas: ['DEPRESSIVE_SYMPTOMS'] as const,
  languages: ['vi'],
  yearsOfExperience: 4,
  timezone: 'Asia/Ho_Chi_Minh',
  approvalStatus: 'PENDING' as const,
  submittedAt: '2026-09-14T03:00:00Z',
  reviewedAt: null,
  reviewedBy: null,
  decisionReasonCode: null,
  createdAt: '2026-09-14T02:00:00Z',
  updatedAt: '2026-09-14T03:00:00Z',
  version: 1,
}
const api = vi.hoisted(() => ({
  profiles: vi.fn(),
  detail: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
  suspend: vi.fn(),
  restore: vi.fn(),
}))
vi.mock('../api/browser-client', () => ({ browserConsultation: api }))

describe('AdminSpecialistReviewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.profiles.mockResolvedValue({
      data: { items: [profile], count: 1 },
      etag: null,
    })
    api.detail.mockResolvedValue({ data: profile, etag: '"1"' })
    api.approve.mockResolvedValue({
      data: { ...profile, approvalStatus: 'APPROVED' },
      etag: '"2"',
    })
  })

  it('inspects and rejects a pending profile with a closed reason', async () => {
    const user = userEvent.setup()
    render(<AdminSpecialistReviewSection />)
    await user.click(await screen.findByRole('button', { name: /Nguyễn An/ }))
    await user.selectOptions(
      screen.getByLabelText('Lý do từ chối'),
      'PROFILE_CONTENT_NOT_APPROVED',
    )
    await user.click(screen.getByRole('button', { name: 'Từ chối hồ sơ' }))

    await waitFor(() =>
      expect(api.reject).toHaveBeenCalledWith(
        profile.accountId,
        '"1"',
        'PROFILE_CONTENT_NOT_APPROVED',
      ),
    )
    expect(
      await screen.findByText(
        'Đã từ chối hồ sơ và lưu lý do để chuyên gia chỉnh sửa.',
      ),
    ).toBeInTheDocument()
  })

  it('suspends an approved specialist and reports exact committed outcomes', async () => {
    const approved = {
      ...profile,
      approvalStatus: 'APPROVED' as const,
      version: 2,
    }
    api.profiles.mockImplementation((status: string) =>
      Promise.resolve({
        data: {
          items: status === 'APPROVED' ? [approved] : [profile],
          count: 1,
        },
        etag: null,
      }),
    )
    api.detail.mockResolvedValue({ data: approved, etag: '"2"' })
    api.suspend.mockResolvedValue({
      data: {
        profile: { ...approved, approvalStatus: 'SUSPENDED' },
        effects: {
          withdrawnAvailabilitySlots: 2,
          cancelledAppointments: 1,
          releasedCredits: 1,
        },
      },
      etag: '"3"',
    })
    const user = userEvent.setup()
    render(<AdminSpecialistReviewSection />)

    await user.click(screen.getByRole('button', { name: 'Đã phê duyệt' }))
    await user.click(await screen.findByRole('button', { name: /Nguyễn An/ }))
    await user.click(
      screen.getByRole('button', { name: 'Tạm ngưng chuyên gia' }),
    )

    await waitFor(() =>
      expect(api.suspend).toHaveBeenCalledWith(
        profile.accountId,
        '"2"',
        'QUALITY_REVIEW_REQUIRED',
      ),
    )
    expect(
      await screen.findByText(/rút 2 lịch, hủy 1 cuộc hẹn và hoàn 1 lượt/),
    ).toBeInTheDocument()
  })

  it('loads the selected lifecycle queue instead of only pending profiles', async () => {
    api.profiles.mockResolvedValue({
      data: { items: [], count: 0 },
      etag: null,
    })
    const user = userEvent.setup()
    render(<AdminSpecialistReviewSection />)

    expect(
      await screen.findByText('Không có hồ sơ ở trạng thái này.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Đang tạm ngưng' }))
    await waitFor(() =>
      expect(api.profiles).toHaveBeenLastCalledWith('SUSPENDED'),
    )
  })
})
