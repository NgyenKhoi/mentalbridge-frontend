import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/lib/api/api-error'

const apiMocks = vi.hoisted(() => ({
  getSupportPlanPersonalization: vi.fn(),
  replaceSupportPlanPersonalization: vi.fn(),
}))

vi.mock('../api/browser-support-plan', () => apiMocks)

import SupportPlanPersonalization from './SupportPlanPersonalization'

const notProvided = {
  value: {
    personalizationId: null,
    schemaVersion: 'support-plan-personalization-v1',
    revision: 0,
    status: 'NOT_PROVIDED',
    preferredFocus: null,
    desiredPace: null,
    dailyTimeBudgetMinutes: null,
    preferredDaypart: null,
    preferredActivityModes: [],
    commonBarriers: [],
    submittedAt: null,
    planReview: {
      required: false,
      supportPlanId: null,
      supportPlanVersion: null,
      reasonCode: null,
    },
  },
  etag: '"0"',
} as const

describe('SupportPlanPersonalization', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    apiMocks.getSupportPlanPersonalization.mockResolvedValue(notProvided)
  })

  it('renders every optional group from the absent fallback', async () => {
    render(<SupportPlanPersonalization onReviewPlan={vi.fn()} />)

    expect(
      await screen.findByRole('heading', {
        name: 'Điều gì giúp kế hoạch dễ thực hiện hơn?',
      }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Ngủ và nghỉ ngơi')).not.toBeChecked()
    expect(screen.getByLabelText('Bài tập có hướng dẫn')).not.toBeChecked()
    expect(screen.getByRole('button', { name: 'Lưu lựa chọn' })).toBeDisabled()
  })

  it('loads complete preferences and exposes explicit plan review', async () => {
    const onReviewPlan = vi.fn()
    apiMocks.getSupportPlanPersonalization.mockResolvedValue({
      value: {
        ...notProvided.value,
        personalizationId: '10000000-0000-4000-8000-000000000638',
        revision: 4,
        status: 'PROVIDED',
        preferredFocus: 'SLEEP',
        desiredPace: 'GENTLE',
        dailyTimeBudgetMinutes: 10,
        preferredDaypart: 'EVENING',
        preferredActivityModes: ['GUIDED_PRACTICE'],
        commonBarriers: ['LOW_ENERGY'],
        submittedAt: '2026-10-12T08:00:00Z',
        planReview: {
          required: true,
          supportPlanId: '20000000-0000-4000-8000-000000000638',
          supportPlanVersion: 2,
          reasonCode: 'PREFERENCES_CHANGED_AFTER_PLAN_ACTIVATION',
        },
      },
      etag: '"4"',
    })

    render(<SupportPlanPersonalization onReviewPlan={onReviewPlan} />)

    expect(await screen.findByLabelText('Ngủ và nghỉ ngơi')).toBeChecked()
    expect(screen.getByLabelText('Bài tập có hướng dẫn')).toBeChecked()
    expect(
      screen.getByText('Kế hoạch hiện tại vẫn được giữ nguyên'),
    ).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', { name: 'Xem kế hoạch hiện tại' }),
    )
    expect(onReviewPlan).toHaveBeenCalledOnce()
  })

  it('explains that a stale draft must be reviewed and regenerated explicitly', async () => {
    const onReviewPlan = vi.fn()
    apiMocks.getSupportPlanPersonalization.mockResolvedValue({
      value: {
        ...notProvided.value,
        personalizationId: '10000000-0000-4000-8000-000000000638',
        revision: 2,
        status: 'PROVIDED',
        preferredFocus: 'MOTIVATION',
        submittedAt: '2026-10-12T08:00:00Z',
        planReview: {
          required: true,
          supportPlanId: '20000000-0000-4000-8000-000000000638',
          supportPlanVersion: 1,
          reasonCode: 'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION',
        },
      },
      etag: '"2"',
    })

    render(<SupportPlanPersonalization onReviewPlan={onReviewPlan} />)

    expect(
      await screen.findByText('Bản đề xuất hiện tại cần được tạo lại'),
    ).toBeVisible()
    expect(
      screen.getByText(/tạo lại theo lựa chọn mới trước khi bắt đầu/i),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Xem bản đề xuất' }))
    expect(onReviewPlan).toHaveBeenCalledWith(
      'PREFERENCES_CHANGED_AFTER_DRAFT_CREATION',
    )
  })

  it('saves a partial preference replacement with the loaded ETag', async () => {
    apiMocks.replaceSupportPlanPersonalization.mockImplementation(
      async (request: Record<string, unknown>) => ({
        value: {
          ...notProvided.value,
          personalizationId: '10000000-0000-4000-8000-000000000638',
          revision: 1,
          status: 'PROVIDED',
          ...request,
          submittedAt: '2026-10-12T08:00:00Z',
        },
        etag: '"1"',
      }),
    )
    render(<SupportPlanPersonalization onReviewPlan={vi.fn()} />)

    fireEvent.click(await screen.findByLabelText('Tìm lại động lực'))
    fireEvent.click(screen.getByLabelText('Thói quen nhỏ'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))

    await waitFor(() =>
      expect(apiMocks.replaceSupportPlanPersonalization).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredFocus: 'MOTIVATION',
          preferredActivityModes: ['ROUTINE'],
          commonBarriers: [],
        }),
        '"0"',
      ),
    )
    expect(
      await screen.findByText('Đã lưu cách bạn muốn kế hoạch đồng hành.'),
    ).toBeInTheDocument()
  })

  it('keeps edits on a stale write and can reload authority', async () => {
    apiMocks.replaceSupportPlanPersonalization.mockRejectedValue(
      new ApiError({
        message: 'stale',
        code: 'SUPPORT_PLAN_PERSONALIZATION_VERSION_MISMATCH',
        status: 412,
      }),
    )
    render(<SupportPlanPersonalization onReviewPlan={vi.fn()} />)

    fireEvent.click(await screen.findByLabelText('Ít năng lượng'))
    fireEvent.click(screen.getByRole('button', { name: 'Lưu lựa chọn' }))

    expect(
      await screen.findByText(/đã được cập nhật ở nơi khác/i),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Ít năng lượng')).toBeChecked()
    fireEvent.click(
      screen.getByRole('button', { name: 'Tải lựa chọn mới nhất' }),
    )
    await waitFor(() =>
      expect(apiMocks.getSupportPlanPersonalization).toHaveBeenCalledTimes(2),
    )
  })

  it('records explicit skip without requiring any field', async () => {
    apiMocks.replaceSupportPlanPersonalization.mockResolvedValue({
      value: { ...notProvided.value, revision: 1, status: 'SKIPPED' },
      etag: '"1"',
    })
    render(<SupportPlanPersonalization onReviewPlan={vi.fn()} />)

    fireEvent.click(
      await screen.findByRole('button', { name: 'Bỏ qua tất cả' }),
    )

    await waitFor(() =>
      expect(apiMocks.replaceSupportPlanPersonalization).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredFocus: null,
          preferredActivityModes: [],
          commonBarriers: [],
        }),
        '"0"',
      ),
    )
    expect(await screen.findByText(/Đã bỏ qua/)).toBeInTheDocument()
  })
})
