import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  approvedProfile,
  draftAmendment,
} from '@/tests/fixtures/profile-amendment'
import ApprovedProfileAmendmentWorkspace from './ApprovedProfileAmendmentWorkspace'
import { BrowserConsultationError } from '../api/browser-client'
import { FeedbackProvider } from '@/components/ui/FeedbackProvider'

const api = vi.hoisted(() => ({
  ownAmendment: vi.fn(),
  startAmendment: vi.fn(),
  saveAmendment: vi.fn(),
  submitAmendment: vi.fn(),
  cancelAmendment: vi.fn(),
}))
vi.mock('../api/browser-client', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  browserConsultation: api,
}))

describe('approved profile amendments', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    api.ownAmendment.mockResolvedValue({
      data: { approvedProfile, amendment: null },
      etag: '"2"',
    })
    api.startAmendment.mockResolvedValue({ data: draftAmendment, etag: '"0"' })
    api.saveAmendment.mockImplementation(async (_id, body) => ({
      data: { ...draftAmendment, proposedProfile: body, version: 1 },
      etag: '"1"',
    }))
    api.submitAmendment.mockResolvedValue({
      data: { ...draftAmendment, status: 'PENDING_REVIEW', version: 2 },
      etag: '"2"',
    })
    api.cancelAmendment.mockResolvedValue({
      data: { ...draftAmendment, status: 'CANCELLED', version: 1 },
      etag: '"1"',
    })
  })
  it('starts from approved, saves privately, then explicitly submits the saved version', async () => {
    const user = userEvent.setup()
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    const begin = await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' })
    await waitFor(() => expect(begin).toBeEnabled())
    await user.click(begin)
    const name = await screen.findByLabelText('Tên hiển thị')
    expect(name).toHaveFocus()
    await user.clear(name)
    await user.type(name, 'Chuyên gia Chi')
    expect(screen.getByRole('button', { name: 'Gửi xét duyệt' })).toBeDisabled()
    expect(
      within(
        screen.getByRole('region', { name: 'Xem trước bản chỉnh sửa' }),
      ).getByText('Chuyên gia Chi'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Đang công khai' }))
    expect(
      within(
        screen.getByRole('region', { name: 'Hồ sơ đang công khai' }),
      ).getByText('Chuyên gia An'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
    await waitFor(() =>
      expect(api.saveAmendment).toHaveBeenCalledWith(
        draftAmendment.id,
        expect.objectContaining({ displayName: 'Chuyên gia Chi' }),
        '"0"',
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Gửi xét duyệt' }))
    await waitFor(() =>
      expect(api.submitAmendment).toHaveBeenCalledWith(
        draftAmendment.id,
        'submit',
        '"1"',
      ),
    )
    expect(await screen.findByText('Đang chờ duyệt')).toBeVisible()
    expect(api.startAmendment).toHaveBeenCalledWith('"2"')
  })
  it('reloads rejected amendments and resubmits without changing the public profile', async () => {
    api.ownAmendment.mockResolvedValue({
      data: {
        approvedProfile,
        amendment: {
          ...draftAmendment,
          status: 'REJECTED',
          reasonCode: 'PROFILE_CONTENT_NOT_APPROVED',
          version: 4,
        },
      },
    })
    const user = userEvent.setup()
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    expect(
      await screen.findByText('Nội dung hồ sơ chưa phù hợp để công khai'),
    ).toBeVisible()
    await user.click(screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' }))
    await user.click(
      screen.getByRole('button', { name: 'Gửi lại để xét duyệt' }),
    )
    await waitFor(() =>
      expect(api.submitAmendment).toHaveBeenCalledWith(
        draftAmendment.id,
        'resubmit',
        '"4"',
      ),
    )
    expect(api.startAmendment).not.toHaveBeenCalled()
  })
  it('keeps typed content and blocks blind retry after a version conflict', async () => {
    api.saveAmendment.mockRejectedValue(
      new BrowserConsultationError(
        412,
        'PROFILE_AMENDMENT_VERSION_MISMATCH',
        'Changed',
      ),
    )
    const user = userEvent.setup()
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    const begin = screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' })
    await waitFor(() => expect(begin).toBeEnabled())
    await user.click(begin)
    const bio = await screen.findByLabelText('Giới thiệu')
    await user.type(bio, ' Nội dung cần giữ.')
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hồ sơ đã thay đổi',
    )
    expect(bio).toHaveValue('Đồng hành sức khỏe tinh thần. Nội dung cần giữ.')
    expect(screen.getByRole('button', { name: 'Lưu bản nháp' })).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Kiểm tra trạng thái mới nhất' }),
    ).toBeEnabled()
  })
  it('validates with associated errors and focuses the invalid field', async () => {
    const user = userEvent.setup()
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    const begin = screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' })
    await waitFor(() => expect(begin).toBeEnabled())
    await user.click(begin)
    const name = await screen.findByLabelText('Tên hiển thị')
    await user.clear(name)
    await user.click(screen.getByRole('button', { name: 'Lưu bản nháp' }))
    expect(name).toHaveAttribute('aria-invalid', 'true')
    expect(name).toHaveFocus()
    expect(api.saveAmendment).not.toHaveBeenCalled()
  })
  it('offers recovery when initial read fails and never opens a blank draft', async () => {
    api.ownAmendment.mockRejectedValue(new Error('offline'))
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hồ sơ công khai vẫn được giữ nguyên',
    )
    expect(
      screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }),
    ).toBeDisabled()
    expect(screen.queryByLabelText('Tên hiển thị')).not.toBeInTheDocument()
  })
  it('previews the published profile in an app dialog, never treating live edits as public', async () => {
    const user = userEvent.setup()
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    const begin = screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' })
    await waitFor(() => expect(begin).toBeEnabled())
    await user.click(begin)
    await user.clear(screen.getByLabelText('Tên hiển thị'))
    await user.type(screen.getByLabelText('Tên hiển thị'), 'Tên chỉ ở bản nháp')
    await user.click(
      screen.getByRole('button', { name: 'Xem hồ sơ đang công khai' }),
    )
    const dialog = screen.getByRole('dialog', {
      name: 'Người dùng đang thấy gì?',
    })
    expect(within(dialog).getByText('Chuyên gia An')).toBeVisible()
    expect(
      within(dialog).queryByText('Tên chỉ ở bản nháp'),
    ).not.toBeInTheDocument()
    await user.click(
      within(dialog).getByRole('button', { name: 'Đóng xem trước' }),
    )
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    )
    expect(screen.getByLabelText('Tên hiển thị')).toHaveValue(
      'Tên chỉ ở bản nháp',
    )
  })
  it('cancels unsaved changes only after confirmation and returns to the retained saved draft', async () => {
    const user = userEvent.setup()
    render(
      <FeedbackProvider>
        <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />
      </FeedbackProvider>,
    )
    const begin = screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' })
    await waitFor(() => expect(begin).toBeEnabled())
    await user.click(begin)
    await user.type(screen.getByLabelText('Tên hiển thị'), ' Chưa lưu')
    await user.click(
      screen.getByRole('button', { name: 'Hủy thay đổi chưa lưu' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Tiếp tục viết',
      }),
    )
    expect(screen.getByLabelText('Tên hiển thị')).toHaveValue(
      'Chuyên gia Bình Chưa lưu',
    )
    await user.click(
      screen.getByRole('button', { name: 'Hủy thay đổi chưa lưu' }),
    )
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Hủy thay đổi',
      }),
    )
    expect(api.cancelAmendment).not.toHaveBeenCalled()
    const resume = screen.getByRole('button', { name: 'Tiếp tục chỉnh sửa' })
    await waitFor(() => expect(resume).toHaveFocus())
    await user.click(resume)
    expect(screen.getByLabelText('Tên hiển thị')).toHaveValue('Chuyên gia Bình')
    expect(api.saveAmendment).not.toHaveBeenCalled()
  })

  it.each(['DRAFT', 'PENDING_REVIEW', 'REJECTED'] as const)(
    'cancels persisted %s without changing the public profile and can start afresh',
    async (status) => {
      api.ownAmendment.mockResolvedValue({
        data: {
          approvedProfile,
          amendment: { ...draftAmendment, status, version: 4 },
        },
      })
      const user = userEvent.setup()
      render(
        <FeedbackProvider>
          <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />
        </FeedbackProvider>,
      )
      await user.click(
        await screen.findByRole('button', { name: 'Hủy bản chỉnh sửa' }),
      )
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Giữ bản chỉnh sửa',
        }),
      )
      expect(api.cancelAmendment).not.toHaveBeenCalled()
      await user.click(
        screen.getByRole('button', { name: 'Hủy bản chỉnh sửa' }),
      )
      await user.click(
        within(screen.getByRole('dialog')).getByRole('button', {
          name: 'Hủy bản chỉnh sửa',
        }),
      )
      await waitFor(() =>
        expect(api.cancelAmendment).toHaveBeenCalledWith(
          draftAmendment.id,
          '"4"',
        ),
      )
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Hủy bản chỉnh sửa' }),
        ).not.toBeInTheDocument(),
      )
      expect(
        within(
          screen.getByRole('region', { name: 'Hồ sơ đang công khai' }),
        ).getByText('Chuyên gia An'),
      ).toBeVisible()
      const begin = screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' })
      await waitFor(() => expect(begin).toHaveFocus())
      await user.click(begin)
      expect(api.startAmendment).toHaveBeenCalledWith('"2"')
    },
  )

  it('ignores a cancelled historical payload on reload', async () => {
    api.ownAmendment.mockResolvedValue({
      data: {
        approvedProfile,
        amendment: { ...draftAmendment, status: 'CANCELLED' },
      },
    })
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }),
      ).toBeEnabled(),
    )
    expect(screen.getByLabelText('Tên hiển thị')).toHaveValue('Chuyên gia An')
    expect(
      screen.queryByRole('button', { name: 'Hủy bản chỉnh sửa' }),
    ).not.toBeInTheDocument()
  })

  it('preserves typed content and stops blind cancellation on concurrent approval', async () => {
    api.cancelAmendment.mockRejectedValue(
      new BrowserConsultationError(
        412,
        'PROFILE_AMENDMENT_VERSION_MISMATCH',
        'Changed',
      ),
    )
    const user = userEvent.setup()
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }),
      ).toBeEnabled(),
    )
    await user.click(screen.getByRole('button', { name: 'Chỉnh sửa hồ sơ' }))
    await user.type(screen.getByLabelText('Giới thiệu'), ' Giữ nội dung.')
    await user.click(screen.getByRole('button', { name: 'Hủy bản chỉnh sửa' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Hồ sơ đã thay đổi',
    )
    expect(screen.getByLabelText('Giới thiệu')).toHaveValue(
      'Đồng hành sức khỏe tinh thần. Giữ nội dung.',
    )
    expect(
      screen.getByRole('button', { name: 'Hủy bản chỉnh sửa' }),
    ).toBeDisabled()
  })

  it('does not present a newly suspended profile as public and blocks amendment writes', async () => {
    api.ownAmendment.mockResolvedValue({
      data: {
        approvedProfile: { ...approvedProfile, approvalStatus: 'SUSPENDED' },
        amendment: draftAmendment,
      },
    })
    const user = userEvent.setup()
    render(
      <ApprovedProfileAmendmentWorkspace initialProfile={approvedProfile} />,
    )
    const preview = await screen.findByRole('button', {
      name: 'Xem hồ sơ đã duyệt',
    })
    expect(
      screen.queryByRole('button', { name: 'Tiếp tục chỉnh sửa' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('region', { name: 'Hồ sơ đang công khai' }),
    ).not.toBeInTheDocument()
    await user.click(preview)
    expect(
      within(screen.getByRole('dialog')).getByText(
        'Hồ sơ này hiện không được công khai.',
      ),
    ).toBeVisible()
    expect(api.startAmendment).not.toHaveBeenCalled()
  })
})
