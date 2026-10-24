import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeGreeting } from './HomeGreeting'
import {
  homeNextStepFixture,
  homePlanFixture,
} from './testing/home-next-step-fixture'

describe('HomeGreeting', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 22, 8))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('renders the local date, greeting and actual plan cycle fields after hydration', () => {
    const { container } = render(
      <HomeGreeting
        home={homeNextStepFixture({
          plan: homePlanFixture('DO_TODAY', {
            cycleDay: 4,
            cycleLengthDays: 14,
          }),
        })}
        safety={false}
      />,
    )
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(
      screen.getByRole('heading', { name: 'Chào buổi sáng' }),
    ).toBeVisible()
    expect(
      screen.getByText('Một bước nhỏ hôm nay là đủ.', { exact: false }),
    ).toHaveTextContent('Bạn đang ở ngày 4 của kế hoạch 14 ngày.')
    expect(container.querySelector('.home-date-number')).toHaveTextContent('22')
    expect(container.querySelector('.home-greeting')).toHaveAttribute(
      'data-home-time',
      'morning',
    )
  })

  it.each([
    null,
    homePlanFixture('DO_TODAY', { cycleDay: null, cycleLengthDays: null }),
    homePlanFixture('DO_TODAY', { cycleLengthDays: null }),
  ])('omits plan-day text when cycle data is unavailable', (plan) => {
    render(<HomeGreeting home={homeNextStepFixture({ plan })} safety={false} />)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.getByText('Một bước nhỏ hôm nay là đủ.')).toBeVisible()
    expect(screen.queryByText(/Bạn đang ở ngày/)).toBeNull()
  })

  it('updates the time-of-day greeting and moon illustration without a reload', () => {
    vi.setSystemTime(new Date(2026, 9, 22, 17, 59, 30))
    const { container } = render(<HomeGreeting home={null} safety={false} />)
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(
      screen.getByRole('heading', { name: 'Chào buổi chiều' }),
    ).toBeVisible()
    expect(container.querySelectorAll('.home-sprig > circle')).toHaveLength(1)
    act(() => {
      vi.advanceTimersByTime(60_000)
    })
    expect(screen.getByRole('heading', { name: 'Chào buổi tối' })).toBeVisible()
    expect(container.querySelector('.home-greeting')).toHaveAttribute(
      'data-home-time',
      'evening',
    )
    expect(container.querySelectorAll('.home-sprig > circle')).toHaveLength(2)
  })

  it('keeps the safety reassurance without plan-day copy or decorative motion', () => {
    const { container } = render(
      <HomeGreeting
        home={homeNextStepFixture({ plan: homePlanFixture('DO_TODAY') })}
        safety
      />,
    )
    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(
      screen.getByText('Bạn không cần đi qua lúc này một mình.'),
    ).toBeVisible()
    expect(screen.queryByText(/Bạn đang ở ngày/)).toBeNull()
    expect(container.querySelector('.home-sprig')).toBeNull()
  })
})
