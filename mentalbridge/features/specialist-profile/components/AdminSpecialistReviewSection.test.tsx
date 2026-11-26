import { render, screen, waitFor, within } from '@testing-library/react'
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
  pendingCredentialDocuments: vi.fn(),
  adminSpecialistCredentialDocuments: vi.fn(),
  adminCredentialFile: vi.fn(),
  reviewCredential: vi.fn(),
  profileAmendments: vi.fn(),
  amendmentDetail: vi.fn(),
  decideAmendment: vi.fn(),
}))
vi.mock('../api/browser-client', () => ({ browserConsultation: api }))

describe('AdminSpecialistReviewSection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.pendingCredentialDocuments.mockResolvedValue({ data: [] })
    api.adminSpecialistCredentialDocuments.mockResolvedValue({ data: [] })
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

  it('shows the submitted original as pending and records only a manual decision', async () => {
    const document = {
      id: '10000000-0000-4000-8000-000000000001',
      specialistAccountId: profile.accountId,
      title: 'Giấy phép thử nghiệm',
      issuer: 'Đơn vị thử nghiệm',
      issueYear: 2020,
      fileName: 'cchn-gia.pdf',
      verificationStatus: 'PENDING',
      createdAt: '2026-10-17T00:00:00Z',
      version: 2,
    }
    const rejected = { ...document, verificationStatus: 'REJECTED' }
    api.adminSpecialistCredentialDocuments.mockResolvedValue({
      data: [document],
    })
    api.adminCredentialFile.mockResolvedValue({
      data: { url: 'https://files.example.test/original.pdf' },
    })
    api.reviewCredential.mockImplementation(async () => {
      api.adminSpecialistCredentialDocuments.mockResolvedValue({
        data: [rejected],
      })
      return { data: rejected }
    })

    const user = userEvent.setup()
    render(<AdminSpecialistReviewSection />)
    const review = within(
      await screen.findByRole('region', { name: /Giấy tờ của chuyên gia/ }),
    )
    expect(await review.findByText('Đang chờ xác minh')).toBeInTheDocument()
    expect(api.adminSpecialistCredentialDocuments).toHaveBeenCalledWith(
      profile.accountId,
    )
    expect(screen.queryByText(/khớp 100%|áp dụng kết luận AI/i)).toBeNull()
    expect(api.reviewCredential).not.toHaveBeenCalled()

    await user.click(review.getByRole('button', { name: 'Xem tệp' }))
    const dialog = within(screen.getByRole('dialog'))
    expect(
      await dialog.findByTitle(`Tệp gốc ${document.title}`),
    ).toHaveAttribute('src', 'https://files.example.test/original.pdf')
    await user.click(dialog.getByRole('button', { name: 'Từ chối' }))
    expect(api.reviewCredential).toHaveBeenCalledWith(document.id, 'reject', 2)
    expect(await review.findByText('Đã từ chối')).toBeInTheDocument()
    expect(api.approve).not.toHaveBeenCalled()
  })

  it('keeps the pending profile visible if approval fails', async () => {
    api.approve.mockRejectedValueOnce(new Error('Dữ liệu đã thay đổi.'))
    const user = userEvent.setup()
    render(<AdminSpecialistReviewSection />)

    await user.click(
      await screen.findByRole('button', { name: 'Phê duyệt hồ sơ' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Dữ liệu đã thay đổi.',
    )
    expect(
      screen.getByRole('heading', { name: profile.displayName }),
    ).toBeVisible()
    expect(
      screen.queryByText('Đã phê duyệt và kích hoạt hồ sơ chuyên gia.'),
    ).toBeNull()
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
      await screen.findByText(/rút 2 lịch, hủy 1 cuộc hẹn và hoàn 1 buổi/),
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

  it('shows only the real profile with its own documents inside the detail', async () => {
    render(<AdminSpecialistReviewSection />)

    const detail = (
      await screen.findByRole('heading', { name: profile.displayName })
    ).closest('article') as HTMLElement
    expect(
      await within(detail).findByRole('region', {
        name: /Giấy tờ của chuyên gia/,
      }),
    ).toBeInTheDocument()
    expect(api.adminSpecialistCredentialDocuments).toHaveBeenCalledWith(
      profile.accountId,
    )
    expect(api.pendingCredentialDocuments).not.toHaveBeenCalled()
    expect(
      screen.queryByText(/SLA còn|PADDLEOCR|CSDL Quốc gia|#MB-/),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: /Tải tệp thật|Yêu cầu bổ sung/ }),
    ).toBeNull()
  })

  it('reviews a real amendment against the published profile and decides through the consultation API', async () => {
    const amendment = {
      id: '0b7c2f43-6a1e-4f7e-9d43-2a6f1d1f8c11',
      specialistAccountId: profile.accountId,
      basePublishedVersion: 1,
      status: 'PENDING_REVIEW' as const,
      proposedProfile: {
        displayName: profile.displayName,
        bio: 'Giới thiệu mới',
        supportAreas: ['DEPRESSIVE_SYMPTOMS' as const],
        languages: ['vi'],
        yearsOfExperience: 4,
        timezone: 'Asia/Ho_Chi_Minh',
      },
      submittedAt: '2026-11-20T03:00:00Z',
      reviewedAt: null,
      reviewedBy: null,
      reasonCode: null,
      createdAt: '2026-11-20T02:00:00Z',
      updatedAt: '2026-11-20T03:00:00Z',
      version: 5,
    }
    api.profileAmendments.mockResolvedValue({
      data: { items: [amendment], count: 1, hasMore: false },
      etag: null,
    })
    api.amendmentDetail.mockResolvedValue({
      data: {
        approvedProfile: { ...profile, approvalStatus: 'APPROVED' },
        amendment,
      },
      etag: '"5"',
    })
    api.decideAmendment.mockResolvedValue({
      data: { ...amendment, status: 'APPROVED' },
      etag: '"6"',
    })
    const user = userEvent.setup()
    render(<AdminSpecialistReviewSection />)
    await screen.findByRole('heading', { name: profile.displayName })

    await user.click(screen.getByRole('button', { name: /Có bản sửa đổi/ }))
    await user.click(
      await screen.findByRole('button', {
        name: new RegExp(profile.displayName),
      }),
    )
    expect(await screen.findByText('Giới thiệu mới')).toBeInTheDocument()
    expect(screen.getByText(profile.bio)).toBeInTheDocument()
    expect(api.adminSpecialistCredentialDocuments).toHaveBeenLastCalledWith(
      profile.accountId,
    )

    await user.click(
      screen.getByRole('button', { name: 'Phê duyệt & Công khai bản mới' }),
    )
    await waitFor(() =>
      expect(api.decideAmendment).toHaveBeenCalledWith(
        amendment.id,
        'approve',
        '"5"',
        undefined,
      ),
    )
    expect(
      await screen.findByText('Không có bản chỉnh sửa nào chờ duyệt.'),
    ).toBeInTheDocument()
  })
})
