import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SpecialistAvailabilityManager, {
  localSlotToUtc,
} from './SpecialistAvailabilityManager'
import { AvailabilityBrowserError } from '../api/browser-client'

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

    await waitFor(() =>
      expect(api.withdraw).toHaveBeenCalledWith(activeSlot.id, 0),
    )
    expect(await screen.findByText('Đã rút')).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Rút khung giờ' }),
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
})
