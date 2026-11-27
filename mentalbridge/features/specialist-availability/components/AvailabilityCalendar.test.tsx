import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  AvailabilityCalendar,
  AvailabilityViewSwitch,
} from './AvailabilityCalendar'
import type { AvailabilitySlot } from '@/lib/consultation/consultation-validation'

const READINESS_LABELS: Record<AvailabilitySlot['readiness'], string> = {
  AVAILABLE: 'Có thể đặt',
  STARTED: 'Đã bắt đầu',
  WITHDRAWN: 'Đã rút',
  VIDEO_DISABLED: 'Video đang tắt',
}

const mockSlot: AvailabilitySlot = {
  id: 'slot-1',
  startAt: '2026-10-25T02:00:00.000Z',
  endAt: '2026-10-25T03:00:00.000Z',
  timezone: 'Asia/Ho_Chi_Minh',
  modality: 'IN_APP_CHAT',
  status: 'ACTIVE',
  readiness: 'AVAILABLE',
  withdrawnAt: null,
  createdAt: '2026-10-22T00:00:00Z',
  updatedAt: '2026-10-22T00:00:00Z',
  version: 0,
}

describe('AvailabilityViewSwitch', () => {
  it('toggles between list and calendar views', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<AvailabilityViewSwitch value="list" onChange={onChange} />)

    const calendarBtn = screen.getByRole('button', { name: /lịch/i })
    expect(screen.getByRole('button', { name: /danh sách/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(calendarBtn).toHaveAttribute('aria-pressed', 'false')

    await user.click(calendarBtn)
    expect(onChange).toHaveBeenCalledWith('calendar')
  })
})

describe('AvailabilityCalendar', () => {
  it('renders month title and slots', () => {
    const onNavigate = vi.fn()
    const onSelect = vi.fn()
    render(
      <AvailabilityCalendar
        slots={[mockSlot]}
        anchor="2026-10-22"
        today="2026-10-22"
        timezone="Asia/Ho_Chi_Minh"
        busy={false}
        readinessLabels={READINESS_LABELS}
        onNavigate={onNavigate}
        onSelect={onSelect}
      />,
    )

    expect(screen.getByText(/Tháng 10 năm 2026/i)).toBeInTheDocument()
    expect(
      screen.getByText('Giờ hiển thị: Asia/Ho_Chi_Minh'),
    ).toBeInTheDocument()
  })

  it('navigates previous and next month', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onSelect = vi.fn()
    render(
      <AvailabilityCalendar
        slots={[mockSlot]}
        anchor="2026-10-22"
        today="2026-10-22"
        timezone="Asia/Ho_Chi_Minh"
        busy={false}
        readinessLabels={READINESS_LABELS}
        onNavigate={onNavigate}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Xem tháng sau' }))
    expect(onNavigate).toHaveBeenCalledWith('2026-11-01')

    await user.click(screen.getByRole('button', { name: 'Xem tháng trước' }))
    expect(onNavigate).toHaveBeenCalledWith('2026-09-01')
  })

  it('selects a slot to trigger onSelect', async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    const onSelect = vi.fn()
    render(
      <AvailabilityCalendar
        slots={[mockSlot]}
        anchor="2026-10-25"
        today="2026-10-22"
        timezone="Asia/Ho_Chi_Minh"
        busy={false}
        readinessLabels={READINESS_LABELS}
        onNavigate={onNavigate}
        onSelect={onSelect}
      />,
    )

    const slotButtons = screen.getAllByRole('button', {
      name: /09:00 – 10:00/i,
    })
    expect(slotButtons.length).toBeGreaterThan(0)
    await user.click(slotButtons[0])
    expect(onSelect).toHaveBeenCalledWith(mockSlot)
  })
})
