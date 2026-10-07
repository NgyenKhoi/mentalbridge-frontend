import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  hide: vi.fn(),
  block: vi.fn(),
  unblock: vi.fn(),
}))
vi.mock('@/features/community/api/browser-community', () => ({
  reportCommunityContent: mocks.report,
  hideCommunityContent: mocks.hide,
  blockCommunityProfile: mocks.block,
  unblockCommunityProfile: mocks.unblock,
}))

import CommunitySafetyActions from './CommunitySafetyActions'

describe('CommunitySafetyActions', () => {
  beforeEach(() => vi.clearAllMocks())

  it('keeps one idempotency key when an ambiguous report is retried', async () => {
    const user = userEvent.setup()
    mocks.report
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(undefined)
    render(
      <CommunitySafetyActions
        targetType="POST"
        targetId="10000000-0000-4000-8000-000000000001"
        communityProfileId={null}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Tùy chọn an toàn' }))
    await user.click(screen.getByRole('button', { name: 'Báo cáo' }))
    await user.selectOptions(screen.getByLabelText('Lý do'), 'SPAM')
    await user.type(
      screen.getByLabelText('Thông tin thêm (không bắt buộc)'),
      'Nội dung lặp lại',
    )
    await user.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))
    expect(await screen.findByText(/Nội dung được giữ lại/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Gửi báo cáo' }))

    expect(mocks.report).toHaveBeenCalledTimes(2)
    expect(mocks.report.mock.calls[0][1]).toBe(mocks.report.mock.calls[1][1])
    expect(await screen.findByText(/đã được gửi/)).toBeInTheDocument()
  })

  it('explains the bounded crisis flow without promising diagnosis or outreach', async () => {
    const user = userEvent.setup()
    render(
      <CommunitySafetyActions
        targetType="COMMENT"
        targetId="10000000-0000-4000-8000-000000000002"
        communityProfileId={null}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Tùy chọn an toàn' }))
    await user.click(screen.getByRole('button', { name: 'Báo cáo' }))
    await user.selectOptions(
      screen.getByLabelText('Lý do'),
      'SELF_HARM_OR_CRISIS_CONCERN',
    )
    expect(
      screen.getByText(/không tự động liên hệ bên thứ ba/),
    ).toBeInTheDocument()
  })

  it('lets a user undo a profile block from the same safety control', async () => {
    const user = userEvent.setup()
    mocks.block.mockResolvedValue(undefined)
    mocks.unblock.mockResolvedValue(undefined)
    render(
      <CommunitySafetyActions
        targetType="POST"
        targetId="10000000-0000-4000-8000-000000000003"
        communityProfileId="20000000-0000-4000-8000-000000000003"
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Tùy chọn an toàn' }))
    await user.click(screen.getByRole('button', { name: 'Chặn thành viên' }))
    await user.click(screen.getByRole('button', { name: 'Tùy chọn an toàn' }))
    await user.click(
      await screen.findByRole('button', { name: 'Bỏ chặn thành viên' }),
    )
    expect(mocks.block).toHaveBeenCalledOnce()
    expect(mocks.unblock).toHaveBeenCalledOnce()
  })
})
