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
const api = vi.hoisted(() => ({ own: vi.fn(), save: vi.fn(), submit: vi.fn() }))
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
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
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

  it('surfaces an optimistic-concurrency conflict without claiming the save succeeded', async () => {
    api.save.mockRejectedValue(
      new Error('Hồ sơ đã thay đổi. Vui lòng tải lại.'),
    )
    const user = userEvent.setup()
    render(<SpecialistProfileWorkspace />)

    await screen.findByLabelText('Tên hiển thị')
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hồ sơ đã thay đổi. Vui lòng tải lại.',
    )
    expect(screen.queryByText('Đã lưu hồ sơ.')).not.toBeInTheDocument()
  })
})
