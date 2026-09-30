import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Analytics } from '@/lib/analytics'

import ActivityDashboard from './ActivityDashboard'

function fixture(overrides: Partial<Analytics> = {}): Analytics {
  const byDay = Array.from({ length: 30 }, (_, index) => ({
    localDate: `2026-09-${String(index + 1).padStart(2, '0')}`,
    total: index === 28 ? 3 : index === 29 ? 5 : 0,
    byKind: {
      assessments: index === 29 ? 2 : 0,
      journals: index === 28 ? 1 : 0,
      emotions: index >= 27 ? 1 : 0,
      support: index === 28 ? 1 : 0,
      appointments: index === 29 ? 1 : 0,
    },
  }))
  return {
    range: 30,
    total: 8,
    byKind: {
      assessments: 2,
      journals: 1,
      emotions: 3,
      support: 1,
      appointments: 1,
    },
    byDay,
    activeDays: 3,
    emotionSeries: byDay.map((day, index) => ({
      localDate: day.localDate,
      level: index >= 27 ? index - 24 : null,
    })),
    emotionActiveDays: 3,
    supportCompleted: 1,
    supportSkipped: 0,
    streak: 3,
    latestAssessment: {
      instrument: 'GAD7',
      submittedAt: '2026-09-30T03:00:00Z',
    },
    appointmentCount: 1,
    startLocalDate: '2026-09-01',
    asOfLocalDate: '2026-09-30',
    timezone: 'Asia/Bangkok',
    partial: false,
    ...overrides,
  }
}

describe('ActivityDashboard', () => {
  it('renders one compact dashboard from the provided analytics model', () => {
    render(<ActivityDashboard analytics={fixture()} />)

    expect(
      screen.getByRole('heading', { name: 'Xu hướng cảm xúc' }),
    ).toBeVisible()
    expect(
      screen.getByRole('heading', { name: 'Cơ cấu hoạt động' }),
    ).toBeVisible()
    expect(
      screen.getByRole('img', {
        name: 'Bản đồ nhiệt hoạt động từng ngày trong 30 ngày',
      }),
    ).toBeVisible()
    expect(screen.queryByText('Số ngày có ghi nhận')).not.toBeInTheDocument()
    expect(screen.queryByText(/Đã tải|Tạm gián đoạn/)).not.toBeInTheDocument()
  })

  it('renders the sparse emotion prompt and zero-appointment action', () => {
    const analytics = fixture({
      appointmentCount: 0,
      byKind: { ...fixture().byKind, appointments: 0 },
      emotionActiveDays: 2,
      emotionSeries: fixture().emotionSeries.map((entry, index) => ({
        ...entry,
        level: index >= 28 ? entry.level : null,
      })),
    })
    render(<ActivityDashboard analytics={analytics} />)

    expect(
      screen.getByText('Cần thêm vài ngày để tạo đường xu hướng'),
    ).toBeVisible()
    expect(screen.getByRole('link', { name: 'Đặt lịch' })).toHaveAttribute(
      'href',
      '/specialists',
    )
  })

  it('uses one page-level empty state when there are no activities', () => {
    render(<ActivityDashboard analytics={fixture({ total: 0 })} />)

    expect(
      screen.getByRole('heading', {
        name: 'Chưa có hoạt động trong 30 ngày gần nhất',
      }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', { name: 'Cơ cấu hoạt động' }),
    ).not.toBeInTheDocument()
  })
})
