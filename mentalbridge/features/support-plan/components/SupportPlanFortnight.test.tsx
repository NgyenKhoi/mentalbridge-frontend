import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import SupportPlanFortnight from './SupportPlanFortnight'

const getOccurrences = vi.hoisted(() => vi.fn())

vi.mock('../api/browser-support-plan-actions', () => ({
  getSupportPlanActionOccurrences: getOccurrences,
}))

describe('SupportPlanFortnight', () => {
  beforeEach(() => getOccurrences.mockReset())

  it('shows only saved activity counts and opens the selected day', async () => {
    getOccurrences.mockResolvedValue({
      supportPlanId: 'plan-1',
      representationMode: 'NATIVE_V3',
      occurrences: [
        { occurrenceId: 'one', localDate: '2026-10-15', state: 'COMPLETED' },
        { occurrenceId: 'two', localDate: '2026-10-15', state: 'SCHEDULED' },
        { occurrenceId: 'three', localDate: '2026-10-16', state: 'CANCELLED' },
      ],
    })
    const onSelectDay = vi.fn()
    render(
      <SupportPlanFortnight
        startDate="2026-10-15"
        supportPlanId="plan-1"
        onSelectDay={onSelectDay}
      />,
    )

    expect(getOccurrences).toHaveBeenCalledWith('2026-10-15', '2026-10-28')
    expect(await screen.findByText('1/2 đã ghi nhận')).toBeVisible()
    expect(screen.getAllByText('Chưa xếp lịch')).toHaveLength(13)
    await userEvent.click(
      screen.getByRole('button', { name: /Ngày 1,.*Xem hoạt động ngày này/ }),
    )
    expect(onSelectDay).toHaveBeenCalledWith('2026-10-15')
  })

  it('does not show counts from another plan', async () => {
    getOccurrences.mockResolvedValue({
      supportPlanId: 'different-plan',
      representationMode: 'NATIVE_V3',
      occurrences: [{ localDate: '2026-10-15', state: 'COMPLETED' }],
    })
    render(
      <SupportPlanFortnight
        startDate="2026-10-15"
        supportPlanId="plan-1"
        onSelectDay={vi.fn()}
      />,
    )

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được hoạt động của 14 ngày này.',
    )
    expect(screen.queryByText('1/1 đã ghi nhận')).not.toBeInTheDocument()
  })
})
