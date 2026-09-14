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
  pending: vi.fn(),
  detail: vi.fn(),
  approve: vi.fn(),
}))
vi.mock('../api/browser-client', () => ({ browserConsultation: api }))

describe('AdminSpecialistReviewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.pending.mockResolvedValue({
      data: { items: [profile], count: 1 },
      etag: null,
    })
    api.detail.mockResolvedValue({ data: profile, etag: '"1"' })
    api.approve.mockResolvedValue({
      data: { ...profile, approvalStatus: 'APPROVED' },
      etag: '"2"',
    })
  })

  it('inspects and approves a submitted profile without credential claims', async () => {
    const user = userEvent.setup()
    render(<AdminSpecialistReviewSection />)
    await user.click(await screen.findByRole('button', { name: /Nguyễn An/ }))
    expect(await screen.findByText('Hỗ trợ phi lâm sàng')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Phê duyệt hồ sơ' }))
    await waitFor(() =>
      expect(api.approve).toHaveBeenCalledWith(profile.accountId, '"1"'),
    )
    expect(
      await screen.findByText('Đã phê duyệt hồ sơ chuyên gia.'),
    ).toBeInTheDocument()
  })

  it('renders the real empty queue state', async () => {
    api.pending.mockResolvedValue({ data: { items: [], count: 0 }, etag: null })

    render(<AdminSpecialistReviewSection />)

    expect(
      await screen.findByText('Không có hồ sơ đang chờ.'),
    ).toBeInTheDocument()
    expect(api.detail).not.toHaveBeenCalled()
    expect(api.approve).not.toHaveBeenCalled()
  })
})
