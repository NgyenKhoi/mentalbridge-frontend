import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import ProfessionalSupportPath from './ProfessionalSupportPath'

const care = vi.hoisted(() => ({ getSupportPlanActions: vi.fn() }))
const consultation = vi.hoisted(() => ({ list: vi.fn() }))

vi.mock('../api/browser-support-plan', () => care)
vi.mock('@/features/appointments/api/browser-client', () => ({
  appointmentBrowserClient: consultation,
}))

const planId = '10000000-0000-4000-8000-000000000643'
const actionId = '20000000-0000-4000-8000-000000000643'

function actionModel(actions: unknown[]) {
  return {
    supportPlanId: planId,
    focuses: [{ focusId: 'focus', actions }],
  }
}

describe('ProfessionalSupportPath', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    consultation.list.mockResolvedValue({ items: [], count: 0 })
  })

  it('renders the primary professional path before reflecting its bounded appointment state', async () => {
    care.getSupportPlanActions.mockResolvedValue(
      actionModel([
        {
          actionId,
          actionType: 'PROFESSIONAL_SUPPORT',
          status: 'ACTIVE',
          pathRole: 'PRIMARY',
          presentation: {
            title: 'Kết nối với chuyên gia',
            summary: 'Đây là hướng hỗ trợ chính.',
          },
        },
      ]),
    )
    consultation.list.mockResolvedValue({
      items: [
        {
          originatingPlanActionId: actionId,
          requestedAt: '2026-10-11T08:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      count: 1,
    })

    render(<ProfessionalSupportPath supportPlanId={planId} />)

    expect(await screen.findByText('Hướng hỗ trợ chính')).toBeInTheDocument()
    expect(
      screen.getByText(/Lịch hẹn đã được chuyên gia xác nhận/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Xem chuyên gia và lịch trống' }),
    ).toHaveAttribute('href', `/specialists?planActionId=${actionId}`)
    expect(
      screen.getByText(/không tự đặt lịch hoặc chia sẻ dữ liệu/),
    ).toBeInTheDocument()
  })

  it('keeps minimal and mild plans unchanged when no professional action exists', async () => {
    care.getSupportPlanActions.mockResolvedValue(
      actionModel([
        {
          actionId,
          actionType: 'RESOURCE',
          status: 'ACTIVE',
          pathRole: 'PRIMARY',
          presentation: { title: 'Nội dung tự hỗ trợ' },
        },
      ]),
    )

    const { container } = render(
      <ProfessionalSupportPath supportPlanId={planId} />,
    )

    await vi.waitFor(() =>
      expect(care.getSupportPlanActions).toHaveBeenCalled(),
    )
    expect(container).toBeEmptyDOMElement()
    expect(consultation.list).not.toHaveBeenCalled()
  })
})
