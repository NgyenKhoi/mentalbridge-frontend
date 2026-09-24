import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpecialistProfileWorkspace from './SpecialistProfileWorkspace'

const profile = {
  accountId: 'f5297ec9-bbc9-4d51-8212-62778245335c',
  displayName: 'Nguyễn An',
  bio: 'Hỗ trợ phi lâm sàng',
  supportAreas: ['DEPRESSIVE_SYMPTOMS'] as const,
  languages: ['vi'],
  yearsOfExperience: 4,
  timezone: 'Asia/Ho_Chi_Minh',
  approvalStatus: 'PENDING' as const,
  submittedAt: null,
  reviewedAt: null,
  reviewedBy: null,
  decisionReasonCode: null,
  createdAt: '2026-09-14T03:00:00Z',
  updatedAt: '2026-09-14T03:00:00Z',
  version: 0,
}
const api = vi.hoisted(() => ({
  own: vi.fn(),
  save: vi.fn(),
  submit: vi.fn(),
  resubmit: vi.fn(),
}))
vi.mock('../api/browser-client', () => ({
  browserConsultation: api,
  BrowserConsultationError: class extends Error {},
}))

describe('SpecialistProfileWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.own.mockResolvedValue({ data: profile, etag: '"0"' })
    api.save.mockResolvedValue({
      data: { ...profile, displayName: 'Nguyễn Bình', version: 1 },
      etag: '"1"',
    })
    api.submit.mockResolvedValue({
      data: { ...profile, submittedAt: '2026-09-14T03:10:00Z', version: 2 },
      etag: '"2"',
    })
  })

  it('loads, saves, and explicitly submits the real profile flow', async () => {
    const user = userEvent.setup()
    render(<SpecialistProfileWorkspace />)
    const name = await screen.findByLabelText('Tên hiển thị')
    await user.clear(name)
    await user.type(name, 'Nguyễn Bình')
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    await waitFor(() =>
      expect(api.save).toHaveBeenCalledWith(
        expect.objectContaining({ displayName: 'Nguyễn Bình' }),
        '"0"',
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Gửi xét duyệt' }))
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith('"1"'))
    expect(
      await screen.findByText('Hồ sơ đã được gửi để quản trị viên xét duyệt.'),
    ).toBeInTheDocument()
  })

  it('shows the rejection reason, edits the same profile, and resubmits it', async () => {
    const rejected = {
      ...profile,
      approvalStatus: 'REJECTED' as const,
      submittedAt: '2026-09-14T03:10:00Z',
      decisionReasonCode: 'PROFILE_INFORMATION_INCOMPLETE' as const,
      version: 2,
    }
    api.own.mockResolvedValue({ data: rejected, etag: '"2"' })
    api.save.mockResolvedValue({
      data: { ...rejected, version: 3 },
      etag: '"3"',
    })
    api.resubmit.mockResolvedValue({
      data: {
        ...rejected,
        approvalStatus: 'PENDING',
        decisionReasonCode: null,
        version: 4,
      },
      etag: '"4"',
    })
    const user = userEvent.setup()
    render(<SpecialistProfileWorkspace />)

    expect(
      await screen.findByText('Thông tin hồ sơ chưa đầy đủ.'),
    ).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Lưu hồ sơ' }))
    await user.click(
      await screen.findByRole('button', { name: 'Gửi lại để xét duyệt' }),
    )

    await waitFor(() => expect(api.resubmit).toHaveBeenCalledWith('"3"'))
    expect(api.submit).not.toHaveBeenCalled()
  })

  it('locks a suspended profile and shows the safe operational reason', async () => {
    api.own.mockResolvedValue({
      data: {
        ...profile,
        approvalStatus: 'SUSPENDED',
        decisionReasonCode: 'QUALITY_REVIEW_REQUIRED',
      },
      etag: '"5"',
    })
    render(<SpecialistProfileWorkspace />)

    expect(
      await screen.findByText('Tài khoản đang được rà soát chất lượng.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Tên hiển thị')).toBeDisabled()
    expect(
      screen.queryByRole('button', { name: 'Lưu hồ sơ' }),
    ).not.toBeInTheDocument()
  })
})
