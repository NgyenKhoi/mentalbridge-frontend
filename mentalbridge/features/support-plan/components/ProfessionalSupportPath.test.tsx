import { fireEvent, render, screen, waitFor } from '@testing-library/react'
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

function renderPath(professionalSupportRequired = false) {
  return render(
    <ProfessionalSupportPath
      professionalSupportRequired={professionalSupportRequired}
      supportPlanId={planId}
    />,
  )
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

    renderPath(true)

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
    expect(consultation.list).toHaveBeenCalledWith(actionId)
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

    const { container } = renderPath()

    await waitFor(() => {
      expect(care.getSupportPlanActions).toHaveBeenCalled()
      expect(container).toBeEmptyDOMElement()
    })
    expect(consultation.list).not.toHaveBeenCalled()
  })

  it('shows a truthful retry state when the primary path projection is unavailable', async () => {
    care.getSupportPlanActions.mockRejectedValueOnce(new Error('offline'))

    renderPath(true)

    expect(
      await screen.findByRole('heading', {
        name: 'Chưa thể tải chi tiết hướng hỗ trợ',
      }),
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        /Các nội dung bổ trợ vẫn có thể xem, nhưng không thay thế/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: 'Xem chuyên gia và lịch trống' }),
    ).not.toBeInTheDocument()
    expect(consultation.list).not.toHaveBeenCalled()

    care.getSupportPlanActions.mockResolvedValueOnce(
      actionModel([
        {
          actionId,
          actionType: 'PROFESSIONAL_SUPPORT',
          status: 'ACTIVE',
          pathRole: 'PRIMARY',
          presentation: { title: 'Kết nối với chuyên gia', summary: null },
        },
      ]),
    )
    fireEvent.click(
      screen.getByRole('button', { name: 'Thử tải lại hướng hỗ trợ' }),
    )

    expect(
      await screen.findByRole('link', { name: 'Xem chuyên gia và lịch trống' }),
    ).toHaveAttribute('href', `/specialists?planActionId=${actionId}`)
  })

  it('keeps the last verified path and appointment when a refresh fails', async () => {
    care.getSupportPlanActions.mockResolvedValueOnce(
      actionModel([
        {
          actionId,
          actionType: 'PROFESSIONAL_SUPPORT',
          status: 'ACTIVE',
          pathRole: 'PRIMARY',
          presentation: { title: 'Kết nối với chuyên gia', summary: null },
        },
      ]),
    )
    consultation.list.mockResolvedValueOnce({
      items: [
        {
          originatingPlanActionId: actionId,
          requestedAt: '2026-10-11T08:00:00Z',
          status: 'CONFIRMED',
        },
      ],
      count: 1,
    })
    renderPath(true)
    expect(
      await screen.findByText(/Lịch hẹn đã được chuyên gia xác nhận/),
    ).toBeInTheDocument()

    care.getSupportPlanActions.mockRejectedValueOnce(new Error('offline'))
    fireEvent.focus(window)

    expect(
      await screen.findByText(
        /Thông tin bên dưới là lần tải đã xác nhận gần nhất/,
      ),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/Lịch hẹn đã được chuyên gia xác nhận/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Xem chuyên gia và lịch trống' }),
    ).toHaveAttribute('href', `/specialists?planActionId=${actionId}`)
  })

  it('does not infer an appointment state when consultation data is unavailable', async () => {
    care.getSupportPlanActions.mockResolvedValueOnce(
      actionModel([
        {
          actionId,
          actionType: 'PROFESSIONAL_SUPPORT',
          status: 'ACTIVE',
          pathRole: 'PRIMARY',
          presentation: { title: 'Kết nối với chuyên gia', summary: null },
        },
      ]),
    )
    consultation.list.mockRejectedValueOnce(new Error('offline'))

    renderPath(true)

    expect(
      await screen.findByText(/MentalBridge không tự suy đoán trạng thái/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Trạng thái lịch hẹn:/)).not.toBeInTheDocument()
  })
})
