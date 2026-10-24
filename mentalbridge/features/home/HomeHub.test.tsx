import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import Link from 'next/link'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HomeHub } from './HomeHub'
import { getHomeNextStep } from './browser-home-next-step'
import { homeDestination } from './home-destination'
import {
  homeFirstUseFixture,
  homeJourneyFixture,
  homeNextStepFixture,
  homePlanFixture,
} from './testing/home-next-step-fixture'

const location = vi.hoisted(() => ({ query: '' }))
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(location.query),
}))
vi.mock('./browser-home-next-step', () => ({ getHomeNextStep: vi.fn() }))
vi.mock('./home-destination', () => ({ homeDestination: vi.fn() }))
vi.mock('./HomeGreeting', () => ({
  HomeGreeting: () => (
    <header data-testid="home-greeting">Chào buổi sáng</header>
  ),
}))
vi.mock('./HomeQuickActions', () => ({
  HomeQuickActions: () => (
    <nav aria-label="Hành động nhanh">
      <Link href="/resources">Tài nguyên</Link>
    </nav>
  ),
}))
vi.mock('./HomeResources', () => ({
  HomeResources: ({ loading }: { loading: boolean }) => (
    <section aria-label="Tài nguyên gợi ý" data-loading={loading}>
      Tài nguyên gợi ý
    </section>
  ),
}))
vi.mock('./HomeUpcomingAppointment', () => ({
  HomeUpcomingAppointment: () => (
    <section aria-label="Buổi hẹn sắp tới">Buổi hẹn sắp tới</section>
  ),
}))
vi.mock('./HomeEmotionSection', async () => {
  const { useState } = await import('react')
  return {
    HomeEmotionSection: ({ onPersisted }: { onPersisted: () => void }) => {
      const [saved, setSaved] = useState(false)
      return (
        <section aria-label="Cảm xúc">
          <button
            onClick={() => {
              setSaved(true)
              onPersisted()
            }}
          >
            {saved ? 'Đã ghi nhận thử nghiệm' : 'Lưu cảm xúc thử nghiệm'}
          </button>
        </section>
      )
    },
  }
})
vi.mock('@/features/emotion-check-in/PlanEmotionCheckIn', () => ({
  PlanEmotionCheckIn: ({ onPersisted }: { onPersisted: () => void }) => (
    <button onClick={onPersisted}>Lưu cảm xúc trong kế hoạch</button>
  ),
}))

beforeEach(() => {
  vi.clearAllMocks()
  location.query = ''
  vi.mocked(homeDestination).mockResolvedValue({})
  vi.mocked(getHomeNextStep).mockResolvedValue(homeFirstUseFixture())
})

describe('HomeHub', () => {
  it('keeps every section in approved reading order while the next step loads', () => {
    vi.mocked(getHomeNextStep).mockReturnValue(new Promise(() => {}))
    const { container } = render(<HomeHub />)
    const nodes = [
      screen.getByTestId('home-greeting'),
      screen.getByRole('region', { name: 'Đang tải bước tiếp theo' }),
      screen.getByRole('region', { name: 'Cảm xúc' }),
      screen.getByRole('region', { name: 'Tài nguyên gợi ý' }),
      screen.getByRole('region', { name: 'Buổi hẹn sắp tới' }),
      screen.getByRole('navigation', { name: 'Hành động nhanh' }),
    ]
    nodes.slice(1).forEach((node, index) => {
      expect(
        nodes[index].compareDocumentPosition(node) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
    expect(nodes[1]).toHaveAttribute('aria-busy', 'true')
    expect(nodes[3]).toHaveAttribute('data-loading', 'true')
    expect(container.querySelector('.home-hub')).toHaveAttribute(
      'data-home-motion',
      'off',
    )
    expect(
      screen.getByRole('button', { name: 'Lưu cảm xúc thử nghiệm' }),
    ).toBeVisible()
    expect(
      screen.queryByText(/Chuỗi hiện tại|Kết quả sàng lọc|Nhìn lại cảm xúc/),
    ).toBeNull()
  })

  it('keeps the full emotion card and saved acknowledgement mounted while re-reading the next step', async () => {
    render(<HomeHub />)
    await screen.findByRole('link', { name: 'Bắt đầu kiểm tra ban đầu' })
    const card = screen.getByRole('region', { name: 'Cảm xúc' })
    let finish!: (value: HomeNextStep) => void
    vi.mocked(getHomeNextStep).mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Lưu cảm xúc thử nghiệm' }),
    )
    await waitFor(() => expect(getHomeNextStep).toHaveBeenCalledTimes(2))
    expect(screen.getByRole('region', { name: 'Cảm xúc' })).toBe(card)
    expect(
      screen.getByRole('button', { name: 'Đã ghi nhận thử nghiệm' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('region', { name: 'Đang tải bước tiếp theo' }),
    ).toBeNull()
    finish(homeNextStepFixture({ plan: homePlanFixture('TODAY_DONE') }))
    await screen.findByText('Bạn đã xong việc hôm nay')
    expect(screen.getByRole('region', { name: 'Cảm xúc' })).toBe(card)
    expect(
      screen.getByRole('button', { name: 'Đã ghi nhận thử nghiệm' }),
    ).toBeVisible()
  })

  it('opens the existing plan emotion task instead of the band and duplicate full emotion row', async () => {
    location.query = 'occurrenceId=invalid'
    render(<HomeHub />)
    expect(
      await screen.findByRole('button', { name: 'Lưu cảm xúc trong kế hoạch' }),
    ).toBeVisible()
    expect(
      screen.getByRole('link', { name: 'Về trang chính' }),
    ).toHaveAttribute('href', '/dashboard')
    expect(screen.queryByRole('region', { name: 'Bước tiếp theo' })).toBeNull()
    expect(screen.queryByRole('region', { name: 'Cảm xúc' })).toBeNull()
  })

  it('keeps other sections usable during an error and retries the owner read', async () => {
    vi.mocked(getHomeNextStep).mockRejectedValueOnce(new Error('Unavailable'))
    render(<HomeHub />)
    await screen.findByText('Chưa tải được bước tiếp theo.')
    expect(screen.getByRole('link', { name: 'Tài nguyên' })).toHaveAttribute(
      'href',
      '/resources',
    )
    expect(screen.getByRole('region', { name: 'Cảm xúc' })).toBeVisible()
    expect(
      screen.getByRole('region', { name: 'Buổi hẹn sắp tới' }),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    await screen.findByRole('link', { name: 'Bắt đầu kiểm tra ban đầu' })
    expect(getHomeNextStep).toHaveBeenCalledTimes(2)
  })

  it.each([null, homePlanFixture('DO_TODAY')])(
    'renders safety with no motion or secondary sections (plan: %s)',
    async (plan) => {
      vi.mocked(getHomeNextStep).mockResolvedValue(
        homeNextStepFixture({
          journey: homeJourneyFixture({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
          plan,
        }),
      )
      const { container } = render(<HomeHub />)
      await screen.findByRole('link', { name: 'Xem nơi hỗ trợ' })
      expect(container.querySelector('.home-hub')).toHaveAttribute(
        'data-home-motion',
        'off',
      )
      expect(container.querySelector('.home-hub')).toHaveAttribute(
        'data-page-motion',
        'off',
      )
      for (const name of ['Cảm xúc', 'Tài nguyên gợi ý', 'Buổi hẹn sắp tới'])
        expect(screen.queryByRole('region', { name })).toBeNull()
      expect(
        screen.queryByRole('navigation', { name: 'Hành động nhanh' }),
      ).toBeNull()
      if (plan)
        expect(
          screen.getByRole('link', { name: 'Mở kế hoạch' }),
        ).toHaveAttribute('href', '/support-plan')
    },
  )

  it('reads fresh owner state after leaving and returning Home', async () => {
    const view = render(<HomeHub />)
    await screen.findByRole('link', { name: 'Bắt đầu kiểm tra ban đầu' })
    view.unmount()
    vi.mocked(getHomeNextStep).mockResolvedValue(
      homeNextStepFixture({ plan: homePlanFixture('TODAY_DONE') }),
    )
    render(<HomeHub />)
    await screen.findByText('Bạn đã xong việc hôm nay')
    expect(getHomeNextStep).toHaveBeenCalledTimes(2)
    expect(vi.mocked(getHomeNextStep).mock.calls[0][0]).toBeInstanceOf(
      AbortSignal,
    )
    expect(vi.mocked(getHomeNextStep).mock.calls[0][0]?.aborted).toBe(true)
  })

  it.each([
    'occurrenceId=invalid',
    'occurrenceId=30000000-0000-4000-8000-000000000641&actionId=20000000-0000-4000-8000-000000000641&localDate=2026-10-22',
  ])('keeps safety help ahead of a plan emotion URL (%s)', async (query) => {
    location.query = query
    vi.mocked(getHomeNextStep).mockResolvedValue(
      homeNextStepFixture({
        journey: homeJourneyFixture({ nextAction: 'REVIEW_SAFETY_SUPPORT' }),
        plan: homePlanFixture('DO_TODAY'),
      }),
    )
    render(<HomeHub />)
    expect(
      await screen.findByRole('link', { name: 'Xem nơi hỗ trợ' }),
    ).toHaveAttribute('href', '/safety-directory')
    expect(screen.getByRole('link', { name: /^Gọi / })).toHaveAttribute(
      'href',
      expect.stringMatching(/^tel:/),
    )
    expect(
      screen.queryByRole('region', { name: 'Cảm xúc trong kế hoạch' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Lưu cảm xúc trong kế hoạch' }),
    ).toBeNull()
    expect(
      screen.queryByRole('navigation', { name: 'Hành động nhanh' }),
    ).toBeNull()
  })
})
