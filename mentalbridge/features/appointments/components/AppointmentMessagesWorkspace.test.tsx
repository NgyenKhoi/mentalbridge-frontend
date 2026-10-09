import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Appointment } from '@/lib/consultation/consultation-validation'
import AppointmentMessagesWorkspace from './AppointmentMessagesWorkspace'

const navigation = vi.hoisted(() => ({
  replace: vi.fn(),
  pathname: '/specialist/messages',
}))

const api = vi.hoisted(() => ({
  assigned: vi.fn(),
  list: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useRouter: () => ({ replace: navigation.replace }),
}))

vi.mock('../api/browser-client', () => ({
  appointmentBrowserClient: api,
}))

vi.mock('./AppointmentChatPanel', () => ({
  default: ({ appointmentId }: { appointmentId: string }) => (
    <div data-testid="appointment-chat">Chat {appointmentId}</div>
  ),
}))

const baseAppointment: Appointment = {
  id: '11111111-1111-4111-8111-111111111111',
  slotId: '22222222-2222-4222-8222-222222222222',
  specialistAccountId: '33333333-3333-4333-8333-333333333333',
  specialistDisplayName: 'ThS. Thảo Nguyễn',
  status: 'CONFIRMED',
  modality: 'IN_APP_CHAT',
  scheduledStartAt: '2026-10-03T07:00:00Z',
  scheduledEndAt: '2026-10-03T08:00:00Z',
  timezone: 'Asia/Ho_Chi_Minh',
  requestedAt: '2026-10-01T07:00:00Z',
  decisionDeadlineAt: '2026-10-02T07:00:00Z',
  heldCreditId: '44444444-4444-4444-8444-444444444444',
  replacesAppointmentId: null,
  replacedByAppointmentId: null,
  decidedAt: '2026-10-01T08:00:00Z',
  decisionReason: 'SPECIALIST_ACCEPTED',
  cancelledAt: null,
  cancellationReason: null,
  cancellationActor: null,
  cancellationCreditOutcome: null,
  sessionOutcome: null,
  sessionOutcomeReason: null,
  sessionPolicyVersion: null,
  sessionEndedAt: null,
  sessionSettledAt: null,
  completionFactId: null,
  creditState: 'HELD',
  history: [],
  version: 1,
}

const response = (items: Appointment[]) => ({
  items,
  count: items.length,
  generatedAt: '2026-10-02T08:00:00Z',
})

describe('AppointmentMessagesWorkspace', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navigation.pathname = '/specialist/messages'
    api.assigned.mockResolvedValue(response([baseAppointment]))
    api.list.mockResolvedValue(response([baseAppointment]))
  })

  it('loads only appointment conversations assigned to the specialist', async () => {
    const video = {
      ...baseAppointment,
      id: '55555555-5555-4555-8555-555555555555',
      modality: 'IN_APP_VIDEO' as const,
    }
    const requested = {
      ...baseAppointment,
      id: '66666666-6666-4666-8666-666666666666',
      status: 'REQUESTED' as const,
    }
    api.assigned.mockResolvedValue(
      response([baseAppointment, video, requested]),
    )

    render(<AppointmentMessagesWorkspace viewerRole="SPECIALIST" />)

    expect(await screen.findByText('Khách hàng')).toBeVisible()
    expect(api.assigned).toHaveBeenCalledTimes(1)
    expect(api.list).not.toHaveBeenCalled()
    expect(screen.getByText('1')).toBeVisible()
    expect(await screen.findByTestId('appointment-chat')).toHaveTextContent(
      baseAppointment.id,
    )
  })

  it('shows specialist names to the user and keeps selection in the URL', async () => {
    navigation.pathname = '/messages'
    const second = {
      ...baseAppointment,
      id: '77777777-7777-4777-8777-777777777777',
      specialistDisplayName: 'BS. Minh Trần',
      scheduledStartAt: '2026-10-04T02:00:00Z',
      scheduledEndAt: '2026-10-04T03:00:00Z',
    }
    api.list.mockResolvedValue(response([baseAppointment, second]))

    render(
      <AppointmentMessagesWorkspace
        viewerRole="USER"
        initialAppointmentId={second.id}
      />,
    )

    expect(await screen.findByText('BS. Minh Trần')).toBeVisible()
    expect(api.list).toHaveBeenCalledTimes(1)
    expect(screen.getByTestId('appointment-chat')).toHaveTextContent(second.id)

    fireEvent.click(screen.getByRole('button', { name: /ThS\. Thảo Nguyễn/ }))

    await waitFor(() => {
      expect(navigation.replace).toHaveBeenCalledWith(
        `/messages?appointmentId=${baseAppointment.id}`,
        { scroll: false },
      )
    })
    expect(screen.getByTestId('appointment-chat')).toHaveTextContent(
      baseAppointment.id,
    )
  })

  it('explains when no confirmed chat appointment exists', async () => {
    api.list.mockResolvedValue(response([]))

    render(<AppointmentMessagesWorkspace viewerRole="USER" />)

    expect(await screen.findByText('Chưa có cuộc trò chuyện')).toBeVisible()
    expect(
      screen.getByText(/sau khi một lịch hẹn chat được xác nhận/i),
    ).toBeVisible()
  })

  it('recovers empty search/filter without losing the selected session', async () => {
    render(<AppointmentMessagesWorkspace viewerRole="SPECIALIST" />)
    await screen.findByText('Khách hàng')
    fireEvent.change(
      screen.getByRole('searchbox', { name: 'Tìm cuộc trò chuyện' }),
      { target: { value: 'không tồn tại' } },
    )
    expect(
      screen.getByText('Không tìm thấy cuộc trò chuyện phù hợp'),
    ).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Xóa bộ lọc' }))
    expect(
      screen.getByRole('searchbox', { name: 'Tìm cuộc trò chuyện' }),
    ).toHaveValue('')
    fireEvent.click(screen.getByRole('button', { name: 'Đang diễn ra' }))
    expect(
      screen.getByText('Không tìm thấy cuộc trò chuyện phù hợp'),
    ).toBeVisible()
    expect(screen.getByTestId('appointment-chat')).toHaveTextContent(
      baseAppointment.id,
    )
  })

  it('does not silently open a different appointment for a missing deep link', async () => {
    render(
      <AppointmentMessagesWorkspace
        viewerRole="SPECIALIST"
        initialAppointmentId="missing"
      />,
    )
    expect(
      await screen.findByText('Lịch hẹn này không có trong hộp thư'),
    ).toBeVisible()
    expect(screen.queryByTestId('appointment-chat')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Khách hàng/ }))
    expect(screen.getByTestId('appointment-chat')).toHaveTextContent(
      baseAppointment.id,
    )
  })

  it('does not label an initial fetch failure as an empty inbox', async () => {
    api.assigned.mockRejectedValueOnce(new Error('offline'))
    render(<AppointmentMessagesWorkspace viewerRole="SPECIALIST" />)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Chưa thể tải tin nhắn lịch hẹn',
    )
    expect(
      screen.queryByText('Chưa có cuộc trò chuyện'),
    ).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }))
    expect(await screen.findByText('Khách hàng')).toBeVisible()
  })
})
