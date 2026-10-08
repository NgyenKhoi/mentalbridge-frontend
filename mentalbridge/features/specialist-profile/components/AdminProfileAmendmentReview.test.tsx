import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  approvedProfile,
  draftAmendment,
} from '@/tests/fixtures/profile-amendment'
import { BrowserConsultationError } from '../api/browser-client'
import AdminProfileAmendmentReview from './AdminProfileAmendmentReview'

const api = vi.hoisted(() => ({
  profileAmendments: vi.fn(),
  amendmentDetail: vi.fn(),
  decideAmendment: vi.fn(),
}))
vi.mock('../api/browser-client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserConsultation: api,
}))
const pending = {
  ...draftAmendment,
  status: 'PENDING_REVIEW',
  submittedAt: '2026-10-07T04:00:00Z',
  version: 2,
}

describe('admin amendment queue', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.profileAmendments.mockResolvedValue({
      data: { items: [pending], count: 1, hasMore: false },
    })
    api.amendmentDetail.mockResolvedValue({
      data: { approvedProfile, amendment: pending },
      etag: '"2"',
    })
    api.decideAmendment.mockResolvedValue({
      data: { ...pending, status: 'APPROVED' },
    })
  })
  it('compares all six fields and approves only the reviewed version', async () => {
    const user = userEvent.setup()
    render(<AdminProfileAmendmentReview />)
    await user.click(
      await screen.findByRole('button', { name: /Chuyên gia Bình/ }),
    )
    expect(
      await screen.findByText('Chuyên gia An', { selector: 'h2' }),
    ).toBeVisible()
    expect(screen.getByText('Tên hiển thị')).toBeVisible()
    expect(screen.getAllByText('Đang công khai')).toHaveLength(6)
    await user.click(
      screen.getByRole('button', { name: 'Phê duyệt và công khai' }),
    )
    await waitFor(() =>
      expect(api.decideAmendment).toHaveBeenCalledWith(
        pending.id,
        'approve',
        '"2"',
        undefined,
      ),
    )
  })
  it('sends a bounded rejection reason, not a suspension command', async () => {
    const user = userEvent.setup()
    render(<AdminProfileAmendmentReview />)
    await user.click(
      await screen.findByRole('button', { name: /Chuyên gia Bình/ }),
    )
    await screen.findByRole('button', { name: 'Phê duyệt và công khai' })
    await user.click(screen.getByRole('button', { name: 'Lý do từ chối' }))
    await user.click(
      screen.getByRole('option', {
        name: 'Nội dung hồ sơ chưa phù hợp để công khai',
      }),
    )
    await user.click(
      screen.getByRole('button', { name: 'Từ chối bản chỉnh sửa' }),
    )
    await waitFor(() =>
      expect(api.decideAmendment).toHaveBeenCalledWith(
        pending.id,
        'reject',
        '"2"',
        'PROFILE_CONTENT_NOT_APPROVED',
      ),
    )
  })
  it('stops duplicate decisions and offers reload after a stale review', async () => {
    api.decideAmendment.mockRejectedValue(
      new BrowserConsultationError(
        412,
        'PROFILE_AMENDMENT_VERSION_MISMATCH',
        'Changed',
      ),
    )
    const user = userEvent.setup()
    render(<AdminProfileAmendmentReview />)
    await user.click(
      await screen.findByRole('button', { name: /Chuyên gia Bình/ }),
    )
    await user.click(
      await screen.findByRole('button', { name: 'Phê duyệt và công khai' }),
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bản chỉnh sửa vừa thay đổi',
    )
    expect(
      screen.getByRole('button', { name: 'Phê duyệt và công khai' }),
    ).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Tải lại danh sách' }))
    await waitFor(() => expect(api.amendmentDetail).toHaveBeenCalledTimes(2))
  })
})
