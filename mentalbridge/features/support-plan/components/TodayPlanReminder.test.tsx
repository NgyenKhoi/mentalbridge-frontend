import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '@/lib/api/api-error'
import TodayPlanReminder from './TodayPlanReminder'

const api = vi.hoisted(() => ({
  getCurrentSupportPlanActions: vi.fn(),
  getSupportPlanActionOccurrences: vi.fn(),
}))

vi.mock('../api/browser-support-plan-actions', () => api)

describe('TodayPlanReminder', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.getCurrentSupportPlanActions.mockResolvedValue({
      supportPlanId: 'plan-1',
      focuses: [
        {
          actions: [
            {
              actionId: 'action-1',
              presentation: { title: 'Thở thư giãn' },
              schedules: [{ status: 'ACTIVE', timezone: 'Asia/Ho_Chi_Minh' }],
            },
          ],
        },
      ],
    })
    api.getSupportPlanActionOccurrences.mockResolvedValue({
      supportPlanId: 'plan-1',
      occurrences: [
        {
          occurrenceId: 'item-1',
          actionId: 'action-1',
          state: 'SCHEDULED',
          displayState: 'SCHEDULED',
        },
      ],
    })
  })

  it('shows server-scheduled work and sends the user to the plan to record it', async () => {
    render(<TodayPlanReminder />)
    expect(
      await screen.findByRole('link', { name: /Thở thư giãn: Chưa ghi nhận/ }),
    ).toHaveAttribute('href', '/support-plan')
    expect(screen.getByText('0/1')).toBeVisible()
    expect(document.body).not.toHaveTextContent('Viết nhật ký hôm nay')
  })

  it('does not invent an activity when no plan exists', async () => {
    api.getCurrentSupportPlanActions.mockRejectedValue(
      new ApiError({ message: 'missing', status: 404, code: 'NOT_FOUND' }),
    )
    render(<TodayPlanReminder />)
    expect(
      await screen.findByText(/Bạn chưa có kế hoạch đang hoạt động/),
    ).toBeVisible()
    expect(screen.queryByText('0/3')).not.toBeInTheDocument()
  })

  it('shows the account path when the plan requires entitlement', async () => {
    api.getCurrentSupportPlanActions.mockRejectedValue(
      new ApiError({
        message: 'upgrade',
        status: 403,
        code: 'SUPPORT_PLAN_ENTITLEMENT_REQUIRED',
      }),
    )
    render(<TodayPlanReminder />)
    expect(
      await screen.findByRole('link', { name: 'Xem quyền lợi các gói' }),
    ).toHaveAttribute('href', '/subscription')
  })

  it('hides a response for another plan', async () => {
    api.getSupportPlanActionOccurrences.mockResolvedValue({
      supportPlanId: 'other-plan',
      occurrences: [],
    })
    render(<TodayPlanReminder />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa tải được hoạt động đã lưu.',
    )
    expect(screen.queryByText('0/0')).not.toBeInTheDocument()
  })
})
