import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { SupportPlanV3 } from '../api/support-plan-contract'
import { nativeSupportPlanFixture } from '../testing/native-support-plan-fixture'
import PlanPanel from './PlanPanel'

const companion = {
  interrupted: false,
  pending: false,
  snapshot: undefined,
  request: vi.fn(),
  dismiss: vi.fn(),
  clear: vi.fn(),
} as never
// Tuesday: the week runs 12/10 to 18/10.
const today = '2026-10-13'

function planWith(
  schedule: Partial<
    SupportPlanV3['focuses'][0]['actions'][0]['schedules'][0]
  > | null,
) {
  const plan = nativeSupportPlanFixture()
  const action = plan.focuses[0].actions[0]
  action.schedules =
    schedule === null
      ? []
      : [{ ...action.schedules[0], effectiveFrom: '2026-10-01', ...schedule }]
  return plan
}

function renderPlan(plan: SupportPlanV3, onAdjust = vi.fn()) {
  render(
    <PlanPanel
      plan={plan}
      today={today}
      companion={companion}
      onAdjust={onAdjust}
    />,
  )
  return within(screen.getByRole('table'))
}

describe('PlanPanel week grid', () => {
  it('counts the việc, estimates the week and marks today in the header', () => {
    const table = renderPlan(planWith({}))
    expect(
      screen.getByRole('heading', { name: '1 việc trong kế hoạch' }),
    ).toBeVisible()
    expect(screen.getByText('Mỗi tuần khoảng 35 phút.')).toBeVisible()
    expect(table.getByRole('columnheader', { name: 'Thứ ba' })).toHaveAttribute(
      'aria-current',
      'date',
    )
    expect(
      table.getByRole('columnheader', { name: 'Thứ hai' }),
    ).not.toHaveAttribute('aria-current')
    expect(
      table.getByRole('rowheader', { name: /Check-in cảm xúc.*khoảng 5 phút/ }),
    ).toBeVisible()
    expect(
      table.getAllByText(/19:00/, { selector: '.mbw-week-time' }),
    ).toHaveLength(7)
  })

  it('puts a WEEKLY rule only on its days and says "Không có lịch" elsewhere', () => {
    const table = renderPlan(
      planWith({ recurrenceType: 'WEEKLY', daysOfWeek: [2, 4] }),
    )
    expect(
      table.getAllByText(/19:00/, { selector: '.mbw-week-time' }),
    ).toHaveLength(2)
    expect(table.getAllByText('Không có lịch')).toHaveLength(5)
    expect(screen.getByText('Mỗi tuần khoảng 10 phút.')).toBeVisible()
  })

  it('shows a scheduled day without a usable time, and no estimate for an unknown duration', () => {
    const table = renderPlan(
      planWith({ localTime: '', estimatedDurationMinutes: null }),
    )
    expect(table.getAllByText('Có lịch')).toHaveLength(7)
    expect(screen.queryByText(/Mỗi tuần khoảng/)).toBeNull()
    expect(table.queryByText(/khoảng \d+ phút/)).toBeNull()
  })

  it('reads as its cadence when the rule lands on no day of this week', () => {
    const table = renderPlan(
      planWith({ recurrenceType: 'ONCE', effectiveFrom: '2026-10-25' }),
    )
    expect(table.getByText('Một lần · khoảng 5 phút')).toBeVisible()
    expect(table.queryByText('Không có lịch')).toBeNull()
  })

  it('shows "Làm khi phù hợp" for a việc with no schedule and no estimate', () => {
    const table = renderPlan(planWith(null))
    expect(table.getByText('Làm khi phù hợp')).toBeVisible()
    expect(screen.queryByText(/Mỗi tuần khoảng/)).toBeNull()
  })

  it('keeps the why disclosure and the link to Điều chỉnh', async () => {
    const onAdjust = vi.fn()
    renderPlan(planWith({}), onAdjust)
    expect(
      screen.getByRole('button', {
        name: 'Vì sao có việc này: “Check-in cảm xúc”',
      }),
    ).toBeVisible()
    await userEvent.click(
      screen.getByRole('button', { name: /Đổi giờ hoặc bớt việc/ }),
    )
    expect(onAdjust).toHaveBeenCalledTimes(1)
  })

  it('renders no table or heading for a plan without listed việc', () => {
    const plan = nativeSupportPlanFixture()
    plan.focuses[0].actions = []
    render(
      <PlanPanel
        plan={plan}
        today={today}
        companion={companion}
        onAdjust={vi.fn()}
      />,
    )
    expect(screen.queryByRole('table')).toBeNull()
    expect(screen.queryByText(/việc trong kế hoạch/)).toBeNull()
  })
})
