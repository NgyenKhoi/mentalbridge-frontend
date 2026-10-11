import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpecialistAvailabilityManager, {
  localSlotToUtc,
} from './SpecialistAvailabilityManager'
import { AvailabilityBrowserError } from '../api/browser-client'
import { AvailabilityDatePicker } from './AvailabilityPickers'

const activeSlot = {
  id: '1c12df8c-bdd7-4a14-9cd1-e9ce9d35d7f8',
  startAt: '2099-01-02T02:00:00.000Z',
  endAt: '2099-01-02T03:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  modality: 'IN_APP_CHAT' as const,
  status: 'ACTIVE' as const,
  readiness: 'AVAILABLE' as const,
  withdrawnAt: null,
  createdAt: '2026-09-17T01:00:00Z',
  updatedAt: '2026-09-17T01:00:00Z',
  version: 0,
}

const api = vi.hoisted(() => ({
  list: vi.fn(),
  publish: vi.fn(),
  withdraw: vi.fn(),
}))

vi.mock('../api/browser-client', () => ({
  browserAvailability: api,
  AvailabilityBrowserError: class extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message)
    }
  },
}))

describe('SpecialistAvailabilityManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.list.mockResolvedValue({
      data: {
        items: [activeSlot],
        count: 1,
        generatedAt: '2026-09-17T01:00:00Z',
        videoPublishingEnabled: false,
      },
    })
    api.publish.mockResolvedValue({ data: activeSlot })
    api.withdraw.mockResolvedValue({
      data: {
        ...activeSlot,
        status: 'WITHDRAWN',
        readiness: 'WITHDRAWN',
        withdrawnAt: '2026-09-17T02:00:00Z',
        version: 1,
      },
    })
  })

  it('shows persisted slots and explains that video publication is disabled', async () => {
    render(<SpecialistAvailabilityManager />)

    expect(await screen.findByText('Chat trong ứng dụng')).toBeInTheDocument()
    expect(screen.getByText(/Video chưa sẵn sàng/)).toBeInTheDocument()
    expect(
      screen.getByRole('radio', { name: 'Video trong ứng dụng' }),
    ).toBeDisabled()
    expect(
      screen.queryByText(/địa điểm|điện thoại|liên kết/i),
    ).not.toBeInTheDocument()
  })

  it('publishes an exact 60-minute UTC slot using a stable idempotency key', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')

    await user.type(screen.getByLabelText('Ngày'), '2099-01-03')
    await user.type(screen.getByLabelText('Giờ bắt đầu'), '09:30')
    const timezone = screen.getByLabelText('Múi giờ hiển thị')
    await user.clear(timezone)
    await user.type(timezone, 'Asia/Ho_Chi_Minh')
    await user.click(screen.getByRole('button', { name: 'Xuất bản khung giờ' }))

    await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(1))
    const [body, key] = api.publish.mock.calls[0]
    expect(Date.parse(body.endAt) - Date.parse(body.startAt)).toBe(3_600_000)
    expect(body).toMatchObject({
      startAt: '2099-01-03T02:30:00.000Z',
      timezone: 'Asia/Ho_Chi_Minh',
      modality: 'IN_APP_CHAT',
    })
    expect(key).toMatch(/^[0-9a-f-]{36}$/)
  })

  it('withdraws the current persisted version and keeps the tombstone visible', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Rút khung giờ' }),
    )
    expect(api.withdraw).not.toHaveBeenCalled()
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Rút khung giờ này?' }),
      ).getByRole('button', { name: /^Rút khung giờ$/ }),
    )

    await waitFor(() =>
      expect(api.withdraw).toHaveBeenCalledWith(activeSlot.id, 0),
    )
    expect(await screen.findByText('Đã rút')).toBeInTheDocument()
    expect(
      within(
        screen.getByRole('region', { name: 'Khung giờ đã lưu' }),
      ).queryByRole('button', { name: 'Rút khung giờ' }),
    ).not.toBeInTheDocument()
  })

  it('explains an overlapping publish without claiming that the list was reloaded', async () => {
    api.publish.mockRejectedValueOnce(
      new AvailabilityBrowserError(
        409,
        'AVAILABILITY_SLOT_OVERLAP',
        'Availability overlaps an active slot',
      ),
    )
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')

    await user.type(screen.getByLabelText('Ngày'), '2099-01-03')
    await user.type(screen.getByLabelText('Giờ bắt đầu'), '09:30')
    await user.click(screen.getByRole('button', { name: 'Xuất bản khung giờ' }))

    expect(
      await screen.findByText(
        'Khung giờ này trùng với một khung giờ đang hoạt động. Hãy chọn thời gian khác.',
      ),
    ).toBeInTheDocument()
    expect(api.list).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/đã được tải lại/i)).not.toBeInTheDocument()
  })

  it('reloads before confirming a withdrawal version conflict was refreshed', async () => {
    api.withdraw.mockRejectedValueOnce(
      new AvailabilityBrowserError(
        412,
        'AVAILABILITY_SLOT_VERSION_MISMATCH',
        'Availability slot changed since it was read',
      ),
    )
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Rút khung giờ' }),
    )
    await user.click(
      within(
        screen.getByRole('dialog', { name: 'Rút khung giờ này?' }),
      ).getByRole('button', { name: /^Rút khung giờ$/ }),
    )

    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2))
    expect(
      await screen.findByText(
        'Khung giờ đã thay đổi. Danh sách mới nhất đã được tải lại.',
      ),
    ).toBeInTheDocument()
  })

  it('keeps invalid daylight-saving local times fail-closed', () => {
    expect(() =>
      localSlotToUtc('2027-03-14', '02:30', 'America/New_York'),
    ).toThrow('không tồn tại')
  })

  it('cancels withdrawal without sending a command', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await user.click(
      await screen.findByRole('button', { name: 'Rút khung giờ' }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Rút khung giờ này?' })
    expect(dialog).toHaveTextContent('09:00 – 10:00')
    expect(dialog).toHaveTextContent('Các cuộc hẹn đã có không bị thay đổi.')
    await user.click(
      within(dialog).getByRole('button', { name: 'Giữ lại khung giờ' }),
    )
    expect(api.withdraw).not.toHaveBeenCalled()
    expect(screen.getByText('Có thể đặt')).toBeInTheDocument()
  })

  it('operates the calendar with arrow keys and restores trigger focus', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    fireEvent.change(screen.getByLabelText('Ngày'), {
      target: { value: '2099-01-03' },
    })
    const trigger = screen.getByRole('button', { name: 'Mở lịch chọn ngày' })
    await user.click(trigger)
    expect(
      screen.getByRole('dialog', { name: 'Chọn ngày tư vấn' }),
    ).toBeInTheDocument()
    expect(document.activeElement).toHaveAttribute('data-date', '2099-01-03')
    await user.keyboard('{ArrowRight}')
    expect(document.activeElement).toHaveAttribute('data-date', '2099-01-04')
    await user.keyboard('{Enter}')
    expect(screen.getByLabelText('Ngày')).toHaveValue('2099-01-04')
    expect(trigger).toHaveFocus()
    expect(
      screen.queryByRole('dialog', { name: 'Chọn ngày tư vấn' }),
    ).not.toBeInTheDocument()
  })

  it('applies a custom hour/minute only after confirmation and cancels on Escape', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '09:00' },
    })
    const trigger = screen.getByRole('button', { name: 'Mở bộ chọn giờ' })
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: '14 giờ' }))
    await user.click(screen.getByRole('button', { name: '45 phút' }))
    await user.keyboard('{Escape}')
    expect(screen.getByLabelText('Giờ bắt đầu')).toHaveValue('09:00')
    expect(trigger).toHaveFocus()
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: '14 giờ' }))
    await user.type(screen.getByLabelText('Phút'), '{selectall}37')
    await user.click(screen.getByRole('button', { name: 'Chọn 14:37' }))
    expect(screen.getByLabelText('Giờ bắt đầu')).toHaveValue('14:37')
    expect(trigger).toHaveFocus()
  })

  it('returns calendar focus to an enabled day when navigating back to the current month', async () => {
    const user = userEvent.setup()
    render(
      <AvailabilityDatePicker
        value=""
        min="2027-03-14"
        disabled={false}
        onChange={vi.fn()}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Mở lịch chọn ngày' }))
    await user.click(screen.getByRole('button', { name: 'Tháng sau' }))
    expect(document.activeElement).toHaveAttribute('data-date', '2027-04-01')
    await user.click(screen.getByRole('button', { name: 'Tháng trước' }))
    expect(document.activeElement).toHaveAttribute('data-date', '2027-03-14')
    expect(document.activeElement).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Tháng trước' })).toBeDisabled()
  })

  it('prevents past, overlapping and invalid-timezone publication without losing entered values', async () => {
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    fireEvent.change(screen.getByLabelText('Ngày'), {
      target: { value: '2099-01-02' },
    })
    fireEvent.change(screen.getByLabelText('Múi giờ hiển thị'), {
      target: { value: 'Asia/Ho_Chi_Minh' },
    })
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '09:30' },
    })
    expect(screen.getByText(/Giờ này trùng lịch đã lưu/)).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Xuất bản khung giờ' }),
    ).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '10:00' },
    })
    expect(
      screen.getByRole('button', { name: 'Xuất bản khung giờ' }),
    ).toBeEnabled()
    fireEvent.change(screen.getByLabelText('Múi giờ hiển thị'), {
      target: { value: 'Invalid/Timezone' },
    })
    expect(screen.getByLabelText('Múi giờ hiển thị')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
    expect(
      screen.getByRole('button', { name: 'Xuất bản khung giờ' }),
    ).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Múi giờ hiển thị'), {
      target: { value: 'Asia/Ho_Chi_Minh' },
    })
    fireEvent.change(screen.getByLabelText('Ngày'), {
      target: { value: '2020-01-01' },
    })
    expect(await screen.findByText(/Giờ này đã qua/)).toBeInTheDocument()
    expect(api.publish).not.toHaveBeenCalled()
  })

  it('keeps persisted slots and draft values visible during failed refresh', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    fireEvent.change(screen.getByLabelText('Ngày'), {
      target: { value: '2099-01-03' },
    })
    api.list.mockRejectedValueOnce(new Error('network unavailable'))
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    expect(
      await screen.findByText('Chưa thể cập nhật danh sách'),
    ).toBeInTheDocument()
    expect(screen.getByText('09:00 – 10:00')).toBeInTheDocument()
    expect(screen.getByLabelText('Ngày')).toHaveValue('2099-01-03')
    expect(
      screen.queryByText('Chưa có khung giờ nào được xuất bản'),
    ).not.toBeInTheDocument()
  })

  it('does not represent failed initial reads as an empty saved schedule', async () => {
    api.list.mockRejectedValueOnce(new Error('network unavailable'))
    render(<SpecialistAvailabilityManager />)
    expect(
      await screen.findByText('Chưa thể tải lịch khả dụng'),
    ).toBeInTheDocument()
    expect(
      screen.queryByText('Chưa có khung giờ nào được xuất bản'),
    ).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Xuất bản khung giờ' }),
    ).toBeDisabled()
    expect(
      screen.getByRole('button', { name: 'Xem khung giờ có thể đặt' }),
    ).toHaveTextContent('—')
  })

  it('reuses the same command key after an uncertain failure and changes it when the payload changes', async () => {
    api.publish
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockRejectedValueOnce(new Error('network unavailable'))
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    fireEvent.change(screen.getByLabelText('Ngày'), {
      target: { value: '2099-01-03' },
    })
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '09:30' },
    })
    await user.click(screen.getByRole('button', { name: 'Xuất bản khung giờ' }))
    await screen.findByRole('alert')
    await user.click(screen.getByRole('button', { name: 'Xuất bản khung giờ' }))
    await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(2))
    expect(api.publish.mock.calls[1][1]).toBe(api.publish.mock.calls[0][1])
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '11:30' },
    })
    await user.click(screen.getByRole('button', { name: 'Xuất bản khung giờ' }))
    await waitFor(() => expect(api.publish).toHaveBeenCalledTimes(3))
    expect(api.publish.mock.calls[2][1]).not.toBe(api.publish.mock.calls[0][1])
  })

  it('ignores a pre-command read resolving after a successful publication', async () => {
    const user = userEvent.setup()
    let resolveRead!: (value: unknown) => void
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    api.list.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRead = resolve
        }),
    )
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    const created = {
      ...activeSlot,
      id: '20000000-0000-4000-8000-000000000001',
      startAt: '2099-01-03T02:30:00Z',
      endAt: '2099-01-03T03:30:00Z',
    }
    api.publish.mockResolvedValueOnce({ data: created })
    api.list.mockResolvedValue({
      data: {
        items: [activeSlot, created],
        count: 2,
        generatedAt: activeSlot.createdAt,
        videoPublishingEnabled: false,
      },
    })
    fireEvent.change(screen.getByLabelText('Ngày'), {
      target: { value: '2099-01-03' },
    })
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '09:30' },
    })
    await user.click(screen.getByRole('button', { name: 'Xuất bản khung giờ' }))
    expect(await screen.findByText('09:30 – 10:30')).toBeInTheDocument()
    await act(async () => {
      resolveRead({
        data: {
          items: [],
          videoPublishingEnabled: false,
          generatedAt: activeSlot.createdAt,
        },
      })
    })
    expect(screen.getByText('09:30 – 10:30')).toBeInTheDocument()
    expect(screen.getByText('09:00 – 10:00')).toBeInTheDocument()
  })

  it('clears restricted data on revoked access rather than retaining unauthorized slots', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    api.list.mockRejectedValueOnce(
      new AvailabilityBrowserError(
        403,
        'CONSULTATION_ROLE_REQUIRED',
        'Forbidden',
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Tải lại' }))
    expect(
      await screen.findByText(/Tài khoản hiện tại không có quyền/),
    ).toBeInTheDocument()
    expect(screen.queryByText('09:00 – 10:00')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Xuất bản khung giờ' }),
    ).toBeDisabled()
  })

  it('discards the unsubmitted date/time through Nhập lại', async () => {
    const user = userEvent.setup()
    render(<SpecialistAvailabilityManager />)
    await screen.findByText('Chat trong ứng dụng')
    fireEvent.change(screen.getByLabelText('Ngày'), {
      target: { value: '2099-01-03' },
    })
    fireEvent.change(screen.getByLabelText('Giờ bắt đầu'), {
      target: { value: '09:30' },
    })
    await user.click(screen.getByRole('button', { name: 'Nhập lại' }))
    expect(screen.getByLabelText('Ngày')).toHaveValue('')
    expect(screen.getByLabelText('Giờ bắt đầu')).toHaveValue('')
    expect(screen.getByLabelText('Ngày')).toHaveFocus()
    expect(api.publish).not.toHaveBeenCalled()
  })
})
