import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { SupportPlanV3 } from '../api/support-plan-contract'
import { nativeSupportPlanFixture } from '../testing/native-support-plan-fixture'
import AdjustPanel from './AdjustPanel'

vi.mock('./AdaptiveReview', () => ({
  default: () => <p>Nội dung xem lại</p>,
}))

function cycle(
  changes: Partial<NonNullable<SupportPlanV3['cycle']>>,
): SupportPlanV3['cycle'] {
  return {
    policyVersion: 'support-plan-cycle-v1',
    lengthDays: 14,
    timezone: 'Asia/Ho_Chi_Minh',
    cycleNumber: 1,
    startedOn: '2026-10-10',
    reviewDueOn: '2026-10-23',
    currentDay: 4,
    pausedDays: 0,
    state: 'IN_PROGRESS',
    ...changes,
  }
}

function renderAdjust(planCycle: SupportPlanV3['cycle']) {
  render(
    <AdjustPanel
      plan={{ ...nativeSupportPlanFixture(), cycle: planCycle }}
      busy={false}
      dirty={false}
      reviewOpen={false}
      schedule={<p>Lịch</p>}
      preferences={<p>Ưu tiên</p>}
      history={<p>Lịch sử</p>}
      onApplied={vi.fn()}
      onDiscardDraft={vi.fn()}
      onRefreshPlan={vi.fn()}
      onProposeReplacement={vi.fn()}
      onReviewReplacement={vi.fn()}
      onConfirmReplacement={vi.fn()}
      onDiscardReplacement={vi.fn()}
      onTogglePause={vi.fn()}
      onEnd={vi.fn()}
    />,
  )
}

describe('AdjustPanel what-matters-now card', () => {
  it('leads with the review that is due, shown in the card itself', () => {
    renderAdjust(cycle({ state: 'REVIEW_DUE' }))
    expect(
      screen.getByRole('heading', { name: 'Đã đến lúc xem lại kế hoạch' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Xem lại kế hoạch' }),
    ).toBeNull()
    expect(screen.getByText('Nội dung xem lại')).toBeVisible()
  })

  it('leads with the invite and its date while the cycle runs', () => {
    renderAdjust(cycle({}))
    expect(
      screen.getByRole('heading', { name: /^Lời mời xem lại: .*23\/10$/ }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: 'Xem lại kế hoạch' }),
    ).toHaveLength(1)
    expect(screen.queryByText('Nội dung xem lại')).toBeNull()
  })

  it.each([
    ['no cycle', null],
    ['a closed cycle', cycle({ state: 'CLOSED' })],
    ['a cycle without a review date', cycle({ reviewDueOn: null })],
  ])(
    'shows no card with %s and keeps the review entry in the list',
    (_, value) => {
      renderAdjust(value)
      expect(screen.queryByRole('heading', { level: 2 })).toBeNull()
      expect(
        screen.getAllByRole('button', { name: 'Xem lại kế hoạch' }),
      ).toHaveLength(1)
    },
  )

  it('groups the settings under two named lists', () => {
    renderAdjust(cycle({}))
    expect(
      screen.getByRole('heading', { name: 'Tùy chỉnh chu kỳ' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Hỗ trợ và quản lý' }),
    ).toBeVisible()
    const titles = screen
      .getAllByRole('button')
      .map(
        (button) =>
          button.querySelector('strong')?.textContent ?? button.textContent,
      )
      .filter(
        (text) =>
          text &&
          !/^(Xem lại kế hoạch|Tạm dừng kế hoạch|Kết thúc kế hoạch)$/.test(
            text,
          ),
      )
    expect(titles).toEqual([
      'Lịch và thời lượng',
      'Điều bạn muốn ưu tiên',
      'Phương án khác',
      'Hỗ trợ từ chuyên giaBạn tự chọn và đặt lịch',
      'Các kế hoạch trướcCác chu kỳ đã qua',
      'Tạm dừng hoặc kết thúcKhi cần nghỉ',
    ])
  })

  it('opens one adjustment as its own screen and returns to its row', () => {
    renderAdjust(cycle({}))
    fireEvent.click(screen.getByRole('button', { name: /Lịch và thời lượng/ }))
    expect(
      screen.getByRole('heading', { name: 'Lịch và thời lượng' }),
    ).toHaveFocus()
    expect(screen.getByText('Lịch')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Quay lại Điều chỉnh' }))
    expect(
      screen.getByRole('button', { name: /Lịch và thời lượng/ }),
    ).toHaveFocus()
  })
})
