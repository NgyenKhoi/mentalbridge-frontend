import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

import AdminDashboardManager from './AdminDashboardManager'

function metrics() {
  const available = (
    stage: string,
    source: string,
    count: number,
    rate: unknown = null,
  ) => ({
    stage,
    source,
    status: 'AVAILABLE',
    count,
    rate,
    unavailableReason: null,
  })
  return {
    projectionVersion: 'product-journey-metrics-v1',
    window: { from: '2026-09-09T08:00:00Z', to: '2026-10-09T08:00:00Z' },
    asOf: '2026-10-09T08:00:00Z',
    interpretation: 'DESCRIPTIVE_PRODUCT_ACTIVITY_NOT_CLINICAL_EFFECTIVENESS',
    sources: [
      {
        source: 'IDENTITY',
        sourceVersion: 'identity-account-projection-v1',
        status: 'AVAILABLE',
        asOf: '2026-10-09T08:00:00Z',
        unavailableReason: null,
      },
      {
        source: 'CARE',
        sourceVersion: 'care-product-journey-v1',
        status: 'AVAILABLE',
        asOf: '2026-10-09T08:00:00Z',
        unavailableReason: null,
      },
      {
        source: 'CONSULTATION',
        sourceVersion: null,
        status: 'UNAVAILABLE',
        asOf: null,
        unavailableReason: 'DEPENDENCY_UNAVAILABLE',
      },
    ],
    stages: [
      available('REGISTERED_ACCOUNTS', 'IDENTITY', 100),
      available('ACTIVE_REGISTERED_ACCOUNTS', 'IDENTITY', 80, {
        denominatorStage: 'REGISTERED_ACCOUNTS',
        percentage: 80,
      }),
      available('COMPLETED_SCREENING_EPISODES', 'CARE', 70),
      available('SUPPORT_GUIDES_GENERATED', 'CARE', 60),
      {
        stage: 'SUPPORT_GUIDES_OPENED',
        source: 'CARE',
        status: 'UNAVAILABLE',
        count: null,
        rate: null,
        unavailableReason: 'AUTHORITATIVE_USAGE_FACT_UNAVAILABLE',
      },
      available('PAID_SUPPORT_PLANS_ACTIVATED', 'CARE', 20),
      {
        stage: 'CONSULTATIONS_REQUESTED',
        source: 'CONSULTATION',
        status: 'UNAVAILABLE',
        count: null,
        rate: null,
        unavailableReason: 'SOURCE_UNAVAILABLE',
      },
      {
        stage: 'CONSULTATIONS_CONFIRMED',
        source: 'CONSULTATION',
        status: 'UNAVAILABLE',
        count: null,
        rate: null,
        unavailableReason: 'SOURCE_UNAVAILABLE',
      },
      {
        stage: 'CONSULTATIONS_COMPLETED',
        source: 'CONSULTATION',
        status: 'UNAVAILABLE',
        count: null,
        rate: null,
        unavailableReason: 'SOURCE_UNAVAILABLE',
      },
    ],
  }
}

afterEach(() => vi.unstubAllGlobals())

describe('AdminDashboardManager', () => {
  it('renders authoritative aggregates and explicit unavailable states', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(
          new Response(JSON.stringify(metrics()), { status: 200 }),
        ),
    )
    render(<AdminDashboardManager onNotice={vi.fn()} />)

    expect(await screen.findByText('100')).toBeInTheDocument()
    expect(screen.getByText('Lượt hoàn thành sàng lọc')).toBeInTheDocument()
    expect(
      screen.getByText('Chưa có nguồn sử dụng đáng tin cậy'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/1 nguồn đang tạm thời không phản hồi/),
    ).toBeInTheDocument()
    expect(screen.queryByText('12.480')).not.toBeInTheDocument()
    expect(
      screen.getByText(/không chứng minh hiệu quả lâm sàng/i),
    ).toBeInTheDocument()
  })

  it('requests a fresh explicit window when the admin changes range', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(metrics()), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)
    render(<AdminDashboardManager onNotice={vi.fn()} />)
    await screen.findByText('100')
    await userEvent.selectOptions(
      screen.getByLabelText('Khoảng thời gian thống kê'),
      '7',
    )
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2))
    const requested = new URL(
      String(fetchMock.mock.calls[1][0]),
      'http://localhost',
    )
    expect(
      Date.parse(requested.searchParams.get('to')!) -
        Date.parse(requested.searchParams.get('from')!),
    ).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('clears stale data when refresh fails', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(metrics()), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)
    render(<AdminDashboardManager onNotice={vi.fn()} />)
    await screen.findByText('100')
    await userEvent.click(
      screen.getByRole('button', { name: 'Làm mới số liệu' }),
    )
    expect(await screen.findByText('Chưa thể tải số liệu.')).toBeInTheDocument()
    expect(screen.queryByText('100')).not.toBeInTheDocument()
  })
})
