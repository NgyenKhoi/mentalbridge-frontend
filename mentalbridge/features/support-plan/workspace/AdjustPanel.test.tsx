import { render, screen } from '@testing-library/react'
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
  it('leads with the review that is due, opened, with one entry', () => {
    renderAdjust(cycle({ state: 'REVIEW_DUE' }))
    expect(
      screen.getByRole('heading', { name: 'Đã đến lúc xem lại kế hoạch' }),
    ).toBeVisible()
    expect(
      screen.getAllByRole('button', { name: 'Xem lại kế hoạch' }),
    ).toHaveLength(1)
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

  it('keeps the other sections in order, with history renamed', () => {
    renderAdjust(cycle({}))
    const names = screen
      .getAllByRole('button')
      .map((button) => button.textContent)
      .filter(
        (text) =>
          text &&
          !/^(Xem phương án mới|Tạm dừng kế hoạch|Kết thúc kế hoạch)$/.test(
            text,
          ),
      )
    expect(names).toEqual([
      'Xem lại kế hoạch',
      'Lịch và thời lượng',
      'Điều bạn muốn ưu tiên',
      'Phương án khác',
      'Hỗ trợ từ chuyên gia',
      'Tạm dừng hoặc kết thúc',
      'Các kế hoạch trước',
    ])
  })
})
