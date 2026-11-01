import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { CRISIS_SUPPORT_CONTENT } from '@/components/crisis-support/crisis-support-content'
import HomeNextStepCard from './HomeNextStepCard'
import { homeNextStepView } from './home-next-step-state'
import {
  HOME_GUIDE_ID as guideId,
  HOME_PLAN_ID as planId,
  homeFirstUseFixture,
  homeJourneyFixture as journey,
  homeNextStepFixture as home,
  homePlanFixture as plan,
} from './testing/home-next-step-fixture'

const firstUse = homeFirstUseFixture()

describe('HomeNextStepCard', () => {
  it.each([
    [firstUse, 'Bắt đầu kiểm tra ban đầu'],
    [
      {
        ...firstUse,
        journey: { ...firstUse.journey, assessmentInProgress: true },
      },
      'Tiếp tục kiểm tra ban đầu',
    ],
  ])(
    'opens the initial check for the Care assessment state',
    (value, label) => {
      render(<HomeNextStepCard home={value} onRetry={vi.fn()} />)

      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        '/initial-check',
      )
      expect(
        screen.getByText(
          '16 câu hỏi ngắn, khoảng 5 phút. Bạn có thể dừng và quay lại sau.',
        ),
      ).toBeVisible()
      expect(screen.queryByRole('navigation')).toBeNull()
    },
  )

  it('opens the saved result and Guide when the Guide is required', () => {
    render(
      <HomeNextStepCard
        home={home({
          journey: journey({ stage: 'GUIDE_REQUIRED', supportGuideId: null }),
        })}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Xem kết quả và hướng dẫn của bạn' }),
    ).toHaveAttribute('href', '/support-guides')
  })

  it.each([
    [firstUse, 'Bắt đầu kiểm tra ban đầu', '/initial-check'],
    [
      home({
        journey: journey({ stage: 'GUIDE_REQUIRED', supportGuideId: null }),
      }),
      'Xem kết quả và hướng dẫn của bạn',
      '/support-guides',
    ],
  ] as const)(
    'keeps the required journey continuation ahead of an existing plan',
    (value, label, href) => {
      render(
        <HomeNextStepCard
          home={{ ...value, plan: plan('DO_TODAY') }}
          destination="/resources/old-plan-task"
          onRetry={vi.fn()}
        />,
      )

      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        href,
      )
      expect(screen.queryByRole('link', { name: 'Bắt đầu ngay' })).toBeNull()
      expect(screen.queryByText('Đọc về giấc ngủ')).toBeNull()
    },
  )

  it.each([
    [
      'FIND_SPECIALIST',
      'Tìm chuyên gia phù hợp',
      `/specialists?from=support-guide&supportGuideId=${guideId}`,
    ],
    ['START_PLAN_PROPOSAL', 'Xem đề xuất kế hoạch 14 ngày', '/support-plan'],
  ] as const)(
    'uses the owning Guide continuation for %s',
    (nextAction, label, destination) => {
      render(
        <HomeNextStepCard
          home={home({ journey: journey({ nextAction }) })}
          destination={destination}
          onRetry={vi.fn()}
        />,
      )

      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        destination,
      )
      expect(
        screen.getByRole('link', { name: 'Xem hướng dẫn' }),
      ).toHaveAttribute('href', `/support-guides/${guideId}`)
    },
  )

  it('gives FREE users Guide resources and a quiet plan preview', () => {
    const destination = `/support-guides/${guideId}#support-guide-resources`
    render(
      <HomeNextStepCard
        home={home()}
        destination={destination}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Mở tài nguyên được gợi ý' }),
    ).toHaveAttribute('href', destination)
    const contextual = screen.getByRole('navigation', {
      name: 'Liên kết liên quan',
    })
    expect(within(contextual).getAllByRole('link')).toHaveLength(2)
    expect(
      within(contextual).getByRole('link', {
        name: 'Xem trước kế hoạch hỗ trợ',
      }),
    ).toHaveAttribute('href', '/support-plan')
    expect(screen.queryByRole('link', { name: /Nâng cấp|Mua gói/ })).toBeNull()
  })

  it('keeps the Guide usable with an entitlement outage and offers retry', () => {
    const onRetry = vi.fn()
    render(
      <HomeNextStepCard
        home={home({ journey: journey({ entitlementStatus: 'UNAVAILABLE' }) })}
        destination={`/support-guides/${guideId}#support-guide-resources`}
        onRetry={onRetry}
      />,
    )

    expect(
      screen.getByText(
        'Chưa kiểm tra được gói của bạn; bạn vẫn dùng được hướng dẫn.',
      ),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Mở tài nguyên được gợi ý' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Xem hướng dẫn' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(onRetry).toHaveBeenCalledOnce()
    expect(
      screen.queryByRole('link', { name: 'Xem trước kế hoạch hỗ trợ' }),
    ).toBeNull()
  })

  it('continues a draft without adding tracking or upgrade links', () => {
    render(
      <HomeNextStepCard
        home={home({ journey: journey({ nextAction: 'REVIEW_PLAN_DRAFT' }) })}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Tiếp tục xem bản nháp kế hoạch' }),
    ).toHaveAttribute('href', '/support-plan')
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('renders the exact Care occurrence, type, duration and remaining count', () => {
    const destination =
      '/resources/sleep?from=support-plan&occurrenceId=care-selected'
    render(
      <HomeNextStepCard
        home={home({ plan: plan('DO_TODAY') })}
        destination={destination}
        remaining={2}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Đọc về giấc ngủ' }),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Bắt đầu ngay' })).toHaveAttribute(
      'href',
      destination,
    )
    expect(screen.getByText('Tài nguyên')).toBeVisible()
    expect(screen.getByText('5 phút')).toBeVisible()
    expect(screen.getByText('Còn 2 việc hôm nay')).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Mở kế hoạch hôm nay' }),
    ).toHaveAttribute('href', '/support-plan')
  })

  it('keeps the first task neutral and uses a specific Content label', () => {
    const value = plan('DO_TODAY', { today: { total: 1, completed: 0 } })
    const { container } = render(
      <HomeNextStepCard
        home={home({ plan: value })}
        resourceCategory="JOURNALING"
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText('1 việc cho hôm nay')).toBeVisible()
    expect(screen.getByText('Bài tập viết')).toBeVisible()
    expect(screen.queryByText('Tài nguyên')).not.toBeInTheDocument()
    expect(
      container.querySelector('[data-home-art="journal"]'),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Bắt đầu ngay' }),
    ).toHaveTextContent(/^Bắt đầu ngay$/)
  })
  it('describes completed work positively', () => {
    render(
      <HomeNextStepCard
        home={home({
          plan: plan('DO_TODAY', { today: { total: 3, completed: 1 } }),
        })}
        onRetry={vi.fn()}
      />,
    )
    expect(screen.getByText('Đã xong 1 trong 3 việc hôm nay')).toBeVisible()
  })
  it('falls back to the plan when the task owner read cannot resolve a destination', () => {
    render(
      <HomeNextStepCard
        home={home({ plan: plan('DO_TODAY') })}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByRole('link', { name: 'Bắt đầu ngay' })).toHaveAttribute(
      'href',
      '/support-plan',
    )
    expect(screen.queryByText(/Còn \d+ việc hôm nay/)).toBeNull()
  })

  it('uses open occurrences rather than subtracting completed totals that include skipped items', () => {
    render(
      <HomeNextStepCard
        home={home({
          plan: plan('DO_TODAY', { today: { total: 3, completed: 1 } }),
        })}
        remaining={1}
        onRetry={vi.fn()}
      />,
    )

    expect(screen.getByText('Còn 1 việc hôm nay')).toBeVisible()
    expect(screen.queryByText('Còn 2 việc hôm nay')).toBeNull()
  })

  it('keeps professional support ahead of the current plan', () => {
    const destination = `/specialists?from=support-guide&supportGuideId=${guideId}`
    render(
      <HomeNextStepCard
        home={home({
          journey: journey({ nextAction: 'FIND_SPECIALIST' }),
          plan: plan('DO_TODAY'),
        })}
        destination={destination}
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Tìm chuyên gia phù hợp' }),
    ).toHaveAttribute('href', destination)
    expect(screen.queryByText('Đọc về giấc ngủ')).toBeNull()
  })

  it('does not invent a duration when Care has none', () => {
    const current = plan('DO_TODAY')
    if (!current.nextOccurrence) throw new Error('Expected a test occurrence')
    current.nextOccurrence.estimatedDurationMinutes = null
    render(
      <HomeNextStepCard home={home({ plan: current })} onRetry={vi.fn()} />,
    )

    expect(screen.queryByText(/phút/)).toBeNull()
  })

  it.each([
    ['TODAY_DONE', 'Bạn đã xong việc hôm nay', 'Xem kế hoạch', '/support-plan'],
    [
      'NOTHING_TODAY',
      'Hôm nay không có việc nào trong kế hoạch',
      'Xem kế hoạch',
      '/support-plan',
    ],
    [
      'RESUME_PAUSED',
      'Kế hoạch đang tạm dừng',
      'Xem và tiếp tục kế hoạch',
      '/support-plan',
    ],
    [
      'REVIEW_DUE',
      'Đến lúc nhìn lại 14 ngày qua',
      'Xem lại kế hoạch',
      '/support-plan?review=open',
    ],
  ] as const)(
    'renders the selected plan focus %s',
    (focus, title, label, destination) => {
      const { container } = render(
        <HomeNextStepCard
          home={home({ plan: plan(focus) })}
          onRetry={vi.fn()}
        />,
      )

      expect(screen.getByRole('heading', { name: title })).toBeVisible()
      expect(screen.getByRole('link', { name: label })).toHaveAttribute(
        'href',
        destination,
      )
      expect(container.querySelector('[data-home-state]')).toHaveAttribute(
        'data-home-state',
        focus,
      )
      if (focus === 'TODAY_DONE')
        expect(container.querySelector('.home-symbol svg')).not.toBeNull()
      if (focus === 'REVIEW_DUE') {
        expect(
          screen.getByRole('link', { name: 'Mở kế hoạch hôm nay' }),
        ).toHaveAttribute('href', '/support-plan')
      } else {
        expect(screen.queryByRole('navigation')).toBeNull()
      }
    },
  )

  it('offers completed-plan history and redo without replacing the journey primary', () => {
    render(
      <HomeNextStepCard
        home={home({
          journey: journey({ nextAction: 'START_PLAN_PROPOSAL' }),
          lastCompletedPlan: {
            supportPlanId: planId,
            completedAt: '2026-10-21T09:00:00Z',
          },
        })}
        destination="/support-plan"
        onRetry={vi.fn()}
      />,
    )

    expect(
      screen.getByRole('link', { name: 'Xem đề xuất kế hoạch 14 ngày' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Xem kế hoạch đã hoàn thành' }),
    ).toHaveAttribute('href', '/support-plan')
    expect(
      screen.getByRole('link', { name: 'Làm lại kiểm tra' }),
    ).toHaveAttribute('href', '/initial-check')
    expect(screen.queryByRole('link', { name: 'Xem hướng dẫn' })).toBeNull()
    expect(screen.getAllByRole('link')).toHaveLength(3)
  })

  it.each([false, true])(
    'puts hotline and local help on the safety step with plan=%s',
    (hasPlan) => {
      const hotline = CRISIS_SUPPORT_CONTENT.contacts[0]
      const { container } = render(
        <HomeNextStepCard
          home={home({
            journey: journey({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
            plan: hasPlan ? plan('REVIEW_DUE') : null,
          })}
          onRetry={vi.fn()}
        />,
      )

      expect(
        screen.getByRole('link', {
          name: `Gọi ${hotline.name} số ${hotline.displayPhone}`,
        }),
      ).toHaveAttribute('href', hotline.href)
      expect(
        screen.getByRole('link', { name: 'Xem nơi hỗ trợ' }),
      ).toHaveAttribute('href', '/safety-directory')
      expect(
        screen.getByRole('link', {
          name: hasPlan ? 'Mở kế hoạch' : 'Xem hướng dẫn',
        }),
      ).toBeVisible()
      expect(container.querySelector('.home-next-step--safety')).not.toBeNull()
      expect(container.querySelector('[class*="rise"]')).toBeNull()
      expect(
        screen.queryByRole('link', { name: /đề xuất|Xem trước|Nâng cấp/ }),
      ).toBeNull()
      expect(screen.queryByText('Đến lúc nhìn lại 14 ngày qua')).toBeNull()
    },
  )

  it.each([
    firstUse,
    home(),
    home({ journey: journey({ nextAction: 'START_PLAN_PROPOSAL' }) }),
    home({ journey: journey({ nextAction: 'REVIEW_SAFETY_SUPPORT' }) }),
    ...(
      [
        'DO_TODAY',
        'TODAY_DONE',
        'NOTHING_TODAY',
        'RESUME_PAUSED',
        'REVIEW_DUE',
      ] as const
    ).map((focus) => home({ plan: plan(focus) })),
  ])('contains one next step and no tracking components', (value) => {
    const { container } = render(
      <HomeNextStepCard home={value} onRetry={vi.fn()} />,
    )

    expect(
      screen.getAllByRole('region', { name: 'Bước tiếp theo' }),
    ).toHaveLength(1)
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1)
    expect(screen.queryByRole('progressbar')).toBeNull()
    expect(
      screen.queryByText(
        /chuỗi ngày|lịch hẹn|PHQ-9|GAD-7|Điểm số|Tiến triển cảm xúc/i,
      ),
    ).toBeNull()
    expect(
      container.querySelector('.ref-tasks, .emotion-progress, .latest-phq9'),
    ).toBeNull()
    expect(
      container.querySelector(
        '[class$="-card"], [class$="-panel"], [class$="-summary"]',
      ),
    ).toBeNull()
  })
})

describe('homeNextStepView', () => {
  it('renders the focus from Care instead of calculating it from lifecycle, date or counts', () => {
    const current = plan('NOTHING_TODAY', {
      status: 'PAUSED',
      reviewDueOn: '2000-01-01',
      today: { total: 20, completed: 20 },
    })
    expect(homeNextStepView(home({ plan: current })).state).toBe(
      'NOTHING_TODAY',
    )
  })

  it('does not replace safety with a completed-plan action', () => {
    const view = homeNextStepView(
      home({
        journey: journey({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
        lastCompletedPlan: {
          supportPlanId: planId,
          completedAt: '2026-10-21T09:00:00Z',
        },
      }),
    )
    expect(view.safety).toBe(true)
    expect(view.contextual).toEqual([
      { label: 'Xem hướng dẫn', href: `/support-guides/${guideId}` },
    ])
  })

  it.each([
    'FIND_SPECIALIST',
    'START_PLAN_PROPOSAL',
    'EXPLORE_GUIDE_RESOURCES',
  ] as const)(
    'returns to the saved Guide when %s continuation cannot be loaded',
    (nextAction) => {
      expect(
        homeNextStepView(home({ journey: journey({ nextAction }) })).primary
          .href,
      ).toBe(`/support-guides/${guideId}`)
    },
  )
})
