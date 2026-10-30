import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import { AppState, type AppStateStatus } from 'react-native'
import { ApiError } from '@/api/api-error'
import type { AppointmentDisputeApi } from '@/appointment-dispute/appointment-dispute-api'
import type { AppSession } from '@/auth/session'
import type { ConsultationBriefApi } from '@/consultation-brief/consultation-brief-api'
import {
  draftBrief,
  screeningChoices,
} from '@/consultation-brief/consultation-brief-fixtures'
import type { DiscoveryApi } from '@/discovery/discovery-api'
import { fixtureSpecialist } from '@/discovery/discovery-fixtures'
import { slotLabel } from '@/discovery/discovery-model'
import {
  makeSessionSummary,
  makeSessionSummaryList,
} from '@/specialist-summary/specialist-summary-test-fixtures'
import type { UserSummaryApi } from '@/user-summary/user-summary-api'
import type { AppointmentApi } from './appointment-api'
import type { Appointment } from './appointment-contract'
import {
  appointment,
  cancelled,
  credits,
  page,
  selection,
  slot,
  subject,
} from './appointment-fixtures'
import { appointmentCommands, sessionLabels } from './appointment-model'
import { AppointmentsScreen } from './AppointmentsScreen'

let mockSession: AppSession | null = { subject, role: 'USER' }
jest.mock('@/auth/session-context', () => ({
  useSession: () => ({ session: mockSession }),
}))
const problem = (status: number, code = 'DEPENDENCY_UNAVAILABLE') =>
  new ApiError({ status, code, message: 'synthetic' })
const network = new ApiError({ code: 'NETWORK_ERROR', message: 'synthetic' })
function services(
  initial: Appointment[] = [],
  generatedAt = credits.generatedAt,
) {
  let items = initial
  const api: AppointmentApi = {
    list: jest.fn().mockImplementation(async () => ({
      items,
      count: items.length,
      generatedAt,
    })),
    credits: jest.fn().mockResolvedValue(credits),
    slots: jest.fn().mockResolvedValue({
      items: [slot],
      count: 1,
      generatedAt: credits.generatedAt,
      videoEnabled: false,
    }),
    request: jest.fn().mockImplementation(async () => {
      items = [appointment]
      return appointment
    }),
    cancel: jest.fn().mockImplementation(async () => {
      items = [cancelled]
      return cancelled
    }),
  }
  const discovery: DiscoveryApi = {
    list: jest.fn().mockResolvedValue(page),
    detail: jest.fn().mockResolvedValue(fixtureSpecialist),
  }
  return {
    api,
    discovery,
    setItems: (value: Appointment[]) => {
      items = value
    },
  }
}
async function mount(
  service = services(),
  handoff = true,
  originatingPlanActionId?: string,
  consultationBriefApi?: ConsultationBriefApi,
  sessionSummaryApi?: UserSummaryApi,
  disputeApi?: AppointmentDisputeApi,
  supportEvaluationId?: string,
) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  })
  const view = () => (
    <QueryClientProvider client={client}>
      <AppointmentsScreen
        api={service.api}
        {...(disputeApi ? { disputeApi } : {})}
        {...(consultationBriefApi ? { consultationBriefApi } : {})}
        discovery={service.discovery}
        initialSelection={handoff ? selection : undefined}
        {...(originatingPlanActionId ? { originatingPlanActionId } : {})}
        {...(sessionSummaryApi ? { sessionSummaryApi } : {})}
        {...(supportEvaluationId ? { supportEvaluationId } : {})}
        onBack={jest.fn()}
      />
    </QueryClientProvider>
  )
  const result = await render(view())
  await screen.findByText('Lịch hẹn của bạn')
  return { ...result, ...service, client, view }
}

function completedAppointment(
  id = appointment.id,
  specialistDisplayName = appointment.specialistDisplayName,
): Appointment {
  return {
    ...appointment,
    id,
    specialistDisplayName,
    status: 'COMPLETED',
    sessionOutcome: 'COMPLETED',
    sessionOutcomeReason: 'EVIDENCE_REQUIREMENTS_MET',
    sessionPolicyVersion: 'chat-session-completion-v1',
    sessionEndedAt: '2026-10-10T10:00:00Z',
    sessionSettledAt: '2026-10-10T10:01:00Z',
    completionFactId: '12121212-1212-4212-8212-121212121212',
    creditState: 'CONSUMED',
  }
}

function disputeService(): AppointmentDisputeApi {
  return {
    get: jest.fn().mockRejectedValue(
      new ApiError({
        code: 'APPOINTMENT_DISPUTE_NOT_FOUND',
        status: 404,
        message: 'synthetic',
      }),
    ),
    open: jest.fn(),
  }
}
async function reviewRequest() {
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Kiểm tra giờ đã chọn' }),
  )
  await screen.findByRole('button', { name: 'Gửi yêu cầu đặt lịch' })
}
async function openDetail() {
  const [button] = await screen.findAllByRole('button', { name: /^Xem lịch / })
  if (!button) throw new Error('Owner appointment detail action missing')
  await fireEvent.press(button)
  await screen.findByText('Chi tiết lịch hẹn')
}
async function reviewCancel() {
  await openDetail()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Hủy lịch hẹn này' }),
  )
  await screen.findByRole('button', { name: 'Xác nhận hủy lịch' })
}
async function reviewReplacement() {
  await openDetail()
  await fireEvent.press(
    screen.getByRole('button', { name: 'Đổi lịch hẹn này' }),
  )
  await fireEvent.press(
    await screen.findByRole('button', {
      name: `Xem hồ sơ ${fixtureSpecialist.displayName}`,
    }),
  )
  await fireEvent.press(
    await screen.findByRole('button', {
      name: `Chọn ${slotLabel(selection.slot)}`,
    }),
  )
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Tiếp tục đặt lịch' }),
  )
  await screen.findByRole('button', { name: 'Gửi yêu cầu đổi lịch' })
}
beforeEach(() => {
  mockSession = { subject, role: 'USER' }
  appointmentCommands.remove(subject)
  appointmentCommands.remove(slot.id)
  jest.restoreAllMocks()
})

describe('MB-630 authoritative USER appointments', () => {
  it('mounts MB-726 only inside the exact settled owner detail', async () => {
    const completed = completedAppointment()
    const disputeApi = disputeService()
    await mount(
      services([completed], '2026-10-10T18:00:00Z'),
      false,
      undefined,
      undefined,
      undefined,
      disputeApi,
    )

    expect(screen.queryByTestId('appointment-dispute-panel')).toBeNull()
    expect(disputeApi.get).not.toHaveBeenCalled()
    await openDetail()
    expect(
      await screen.findByTestId('appointment-dispute-panel'),
    ).toBeOnTheScreen()
    expect(disputeApi.get).toHaveBeenCalledWith(completed.id)
    expect(disputeApi.open).not.toHaveBeenCalled()
  })

  it('clears an unsubmitted MB-726 choice across A → B → A without a POST', async () => {
    const first = completedAppointment(
      '10101010-1010-4010-8010-101010101010',
      'Chuyên gia A',
    )
    const second = completedAppointment(
      '20202020-2020-4020-8020-202020202020',
      'Chuyên gia B',
    )
    const disputeApi = disputeService()
    await mount(
      services([first, second], '2026-10-10T18:00:00Z'),
      false,
      undefined,
      undefined,
      undefined,
      disputeApi,
    )

    const listButtons = await screen.findAllByTestId('appointment-open-detail')
    const firstButton = listButtons[0]
    const secondButton = listButtons[1]
    if (!firstButton || !secondButton)
      throw new Error('Expected two owner appointment actions')
    await fireEvent.press(firstButton)
    await screen.findByText('Chọn lý do phù hợp nhất')
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Phiên gặp sự cố kỹ thuật' }),
    )
    expect(
      screen.getByRole('button', { name: 'Gửi yêu cầu xem xét' }),
    ).toBeEnabled()

    await fireEvent.press(secondButton)
    await waitFor(() => expect(disputeApi.get).toHaveBeenCalledWith(second.id))
    const currentButtons = await screen.findAllByTestId(
      'appointment-open-detail',
    )
    const backToFirst = currentButtons[0]
    if (!backToFirst) throw new Error('First appointment action missing')
    await fireEvent.press(backToFirst)
    await waitFor(() =>
      expect(
        jest
          .mocked(disputeApi.get)
          .mock.calls.filter(([appointmentId]) => appointmentId === first.id),
      ).toHaveLength(2),
    )
    expect(
      screen.getByRole('button', { name: 'Gửi yêu cầu xem xét' }),
    ).toBeDisabled()
    expect(disputeApi.open).not.toHaveBeenCalled()
  })

  it('mounts MB-724 only for an authoritatively completed owned appointment', async () => {
    const completed: Appointment = {
      ...appointment,
      status: 'COMPLETED',
      sessionOutcome: 'COMPLETED',
      sessionOutcomeReason: 'EVIDENCE_REQUIREMENTS_MET',
      sessionPolicyVersion: 'chat-session-completion-v1',
      sessionEndedAt: '2026-10-10T10:00:00Z',
      sessionSettledAt: '2026-10-10T10:01:00Z',
      completionFactId: '12121212-1212-4212-8212-121212121212',
      creditState: 'CONSUMED',
    }
    const sessionSummaryApi: UserSummaryApi = {
      list: jest.fn().mockResolvedValue(
        makeSessionSummaryList([
          makeSessionSummary({
            appointmentId: completed.id,
            userAccountId: subject,
          }),
        ]),
      ),
      updateConsent: jest.fn(),
      updateStep: jest.fn(),
    }
    await mount(
      services([completed]),
      false,
      undefined,
      undefined,
      sessionSummaryApi,
    )

    expect(screen.queryByTestId('user-session-summary-panel')).toBeNull()
    await openDetail()
    expect(
      await screen.findByTestId('user-session-summary-panel'),
    ).toBeOnTheScreen()
    expect(sessionSummaryApi.list).toHaveBeenCalledWith(completed.id)
  })

  it('mounts the MB-723 private brief only inside a confirmed appointment detail', async () => {
    const confirmed: Appointment = {
      ...appointment,
      status: 'CONFIRMED',
      decidedAt: '2026-10-10T09:30:00Z',
    }
    const consultationBriefApi: ConsultationBriefApi = {
      screeningContexts: jest.fn().mockResolvedValue(screeningChoices),
      get: jest.fn().mockResolvedValue({
        ...draftBrief,
        appointmentId: confirmed.id,
      }),
      save: jest.fn(),
      approve: jest.fn(),
      revoke: jest.fn(),
    }
    await mount(services([confirmed]), false, undefined, consultationBriefApi)

    expect(screen.queryByTestId('consultation-brief-panel')).toBeNull()
    await openDetail()
    expect(
      await screen.findByTestId('consultation-brief-panel'),
    ).toBeOnTheScreen()
    expect(screen.getByLabelText('Tình hình hiện tại').props.value).toBe(
      draftBrief.currentSituation,
    )
    expect(consultationBriefApi.get).toHaveBeenCalledWith(confirmed.id)
  })

  it('freshly reviews exact handoff and server balance/cap, then opens persisted owner detail', async () => {
    const { api, discovery } = await mount()
    await reviewRequest()
    expect(screen.getByText('Còn 4 lượt · đang giữ 0 lượt')).toBeTruthy()
    expect(api.request).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    )
    await screen.findByText('Chi tiết lịch hẹn')
    expect(api.request).toHaveBeenCalledWith(
      { slotId: slot.id, modality: slot.modality },
      expect.stringMatching(/^appointment-/),
      undefined,
    )
    expect(discovery.detail).toHaveBeenCalledTimes(2)
    expect(api.slots).toHaveBeenCalledTimes(2)
    expect(
      screen.getAllByText('Lượt tư vấn đang được giữ cho lịch hẹn').length,
    ).toBeGreaterThan(0)
    expect(appointmentCommands.read(subject)).toBeNull()
  })
  it('carries the plan action only after explicit booking confirmation', async () => {
    const originatingPlanActionId = '11111111-1111-4111-8111-111111111111'
    const service = services()
    await mount(service, true, originatingPlanActionId)

    await reviewRequest()
    expect(service.api.request).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('appointment-confirm'))

    await waitFor(() =>
      expect(service.api.request).toHaveBeenCalledWith(
        {
          slotId: slot.id,
          modality: slot.modality,
          originatingPlanActionId,
        },
        expect.stringMatching(/^appointment-/),
        undefined,
      ),
    )
  })
  it('keeps exact evaluation context during the booking authority recheck', async () => {
    const supportEvaluationId = '40000000-0000-4000-8000-000000000725'
    const service = services()
    await mount(
      service,
      true,
      undefined,
      undefined,
      undefined,
      undefined,
      supportEvaluationId,
    )

    await reviewRequest()

    expect(service.discovery.list).toHaveBeenLastCalledWith({
      supportEvaluationId,
    })
    expect(service.discovery.detail).toHaveBeenLastCalledWith(
      selection.slot.specialistAccountId,
      { supportEvaluationId },
    )
  })
  it.each([
    [
      409,
      'APPOINTMENT_SLOT_UNAVAILABLE',
      'Khung giờ hoặc điều kiện đặt lịch vừa thay đổi',
    ],
    [409, 'APPOINTMENT_RESERVATION_LIMIT_REACHED', 'Bạn đã đạt số lịch hẹn'],
    [409, 'APPOINTMENT_CREDIT_UNAVAILABLE', 'Chưa có lượt tư vấn phù hợp'],
    [403, 'PAID_PLAN_REQUIRED', 'Quyền lợi hiện tại chưa cho phép đặt lịch'],
    [403, 'FORBIDDEN', 'Không thể thực hiện'],
  ] as const)(
    'renders server rejection %s/%s without success/local settlement',
    async (status, code, copy) => {
      const service = services()
      jest.mocked(service.api.request).mockRejectedValue(problem(status, code))
      await mount(service)
      await reviewRequest()
      await fireEvent.press(
        screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
      )
      await screen.findByText(new RegExp(copy))
      expect(screen.queryByText('Chi tiết lịch hẹn')).toBeNull()
      expect(appointmentCommands.read(subject)).toBeNull()
    },
  )
  it('rejects stale exact slot version before sending a command', async () => {
    const service = services()
    jest.mocked(service.discovery.detail).mockResolvedValue({
      ...fixtureSpecialist,
      selectableSlots: [{ ...selection.slot, version: 1 }],
    })
    await mount(service)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Kiểm tra giờ đã chọn' }),
    )
    await screen.findByText(/Khung giờ hoặc điều kiện đặt lịch vừa thay đổi/)
    expect(service.api.request).not.toHaveBeenCalled()
  })
  it('uses zero credit/cap returned by the server, including historical policy limits', async () => {
    const service = services()
    jest.mocked(service.api.credits).mockResolvedValue({
      ...credits,
      policyVersion: 'consultation-credit-v1',
      balance: { ...credits.balance, available: 0 },
      reservationCapacity: { active: 1, maximum: 1, remaining: 0 },
    })
    await mount(service)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Kiểm tra giờ đã chọn' }),
    )
    await screen.findByText(/Chưa có lượt tư vấn phù hợp/)
    expect(screen.getByText(/Lịch đang giữ: 1 \/ 1/)).toBeTruthy()
    expect(service.api.request).not.toHaveBeenCalled()
  })
  it('replays ambiguous save on remount with identical key/body/version, only on user action', async () => {
    const service = services()
    jest.mocked(service.api.request).mockRejectedValueOnce(network)
    const first = await mount(service)
    await reviewRequest()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    )
    await screen.findByRole('button', { name: 'Kiểm tra lại yêu cầu' })
    const command = jest.mocked(service.api.request).mock.calls[0]
    expect(service.api.request).toHaveBeenCalledTimes(1)
    await first.unmount()
    await mount(service)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }),
    )
    await screen.findByText('Chi tiết lịch hẹn')
    expect(jest.mocked(service.api.request).mock.calls[1]).toEqual(command)
  })
  it('blocks duplicate taps during an in-flight command', async () => {
    const service = services()
    let finish: (value: Appointment) => void = () => undefined
    jest.mocked(service.api.request).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve
        }),
    )
    await mount(service)
    await reviewRequest()
    const button = screen.getByRole('button', { name: 'Gửi yêu cầu đặt lịch' })
    await fireEvent.press(button)
    await fireEvent.press(button)
    await waitFor(() => expect(service.api.request).toHaveBeenCalledTimes(1))
    await act(async () => {
      service.setItems([appointment])
      finish(appointment)
    })
    await screen.findByText('Chi tiết lịch hẹn')
  })
  it('replays an ambiguous cancellation with its original identity, version and key', async () => {
    const service = services([appointment])
    jest.mocked(service.api.cancel).mockRejectedValueOnce(network)
    const first = await mount(service, false)
    await reviewCancel()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận hủy lịch' }),
    )
    await screen.findByRole('button', { name: 'Kiểm tra lại yêu cầu' })
    const original = jest.mocked(service.api.cancel).mock.calls[0]
    await first.unmount()
    await mount(service, false)
    expect(service.api.cancel).toHaveBeenCalledTimes(1)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }),
    )
    await screen.findByText('Đã hủy lịch hẹn.')
    expect(jest.mocked(service.api.cancel).mock.calls[1]).toEqual(original)
  })
  it('retains an ambiguous replacement command and never retries it as a new booking', async () => {
    const service = services([appointment])
    jest.mocked(service.api.request).mockRejectedValueOnce(network)
    await mount(service, false)
    await reviewReplacement()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi yêu cầu đổi lịch' }),
    )
    await screen.findByRole('button', { name: 'Kiểm tra lại yêu cầu' })
    const original = jest.mocked(service.api.request).mock.calls[0]
    jest.mocked(service.api.request).mockResolvedValue({
      ...appointment,
      id: slot.id,
      replacesAppointmentId: appointment.id,
    })
    await fireEvent.press(
      screen.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }),
    )
    await waitFor(() => expect(service.api.request).toHaveBeenCalledTimes(2))
    expect(jest.mocked(service.api.request).mock.calls[1]).toEqual(original)
    expect(original?.[0].replacesAppointmentId).toBe(appointment.id)
    expect(service.api.cancel).not.toHaveBeenCalled()
  })
  it('explicitly confirms cancellation and renders only the server settlement', async () => {
    const service = services([appointment])
    await mount(service, false)
    await reviewCancel()
    expect(service.api.cancel).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận hủy lịch' }),
    )
    await screen.findByText('Đã hủy lịch hẹn.')
    await screen.findByText('Giờ hẹn cũ không còn dùng để tham gia phiên.')
    expect(service.api.cancel).toHaveBeenCalledWith(
      appointment.id,
      appointment.version,
      expect.any(String),
    )
    expect(
      screen.getAllByText('Lượt tư vấn đã được trả lại.').length,
    ).toBeGreaterThan(0)
    expect(
      screen.queryByRole('button', { name: 'Hủy lịch hẹn này' }),
    ).toBeNull()
  })
  it('stops cancellation after a decision/cancellation race changes the reviewed revision', async () => {
    const service = services([appointment])
    await mount(service, false)
    await reviewCancel()
    service.setItems([{ ...appointment, status: 'CONFIRMED', version: 1 }])
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận hủy lịch' }),
    )
    await screen.findByText(/Lịch hẹn vừa thay đổi/)
    expect(service.api.cancel).not.toHaveBeenCalled()
  })
  it('handles server If-Match rejection after the last cancellation preflight', async () => {
    const service = services([appointment])
    jest
      .mocked(service.api.cancel)
      .mockRejectedValue(problem(412, 'APPOINTMENT_VERSION_MISMATCH'))
    await mount(service, false)
    await reviewCancel()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận hủy lịch' }),
    )
    await screen.findByText(/Lịch hẹn vừa thay đổi/)
    expect(screen.queryByText('Đã hủy lịch hẹn.')).toBeNull()
  })
  it('atomically replaces the old appointment with no spare credit/cap and invalidates old links', async () => {
    const old = {
      ...appointment,
      slotId: '11111111-1111-4111-8111-111111111111',
    }
    const service = services([old])
    const next = { ...appointment, id: slot.id, replacesAppointmentId: old.id }
    jest.mocked(service.api.credits).mockResolvedValue({
      ...credits,
      balance: { ...credits.balance, available: 0 },
      reservationCapacity: { active: 2, maximum: 2, remaining: 0 },
    })
    jest.mocked(service.api.request).mockImplementation(async () => {
      service.setItems([
        next,
        {
          ...cancelled,
          cancellationReason: 'USER_RESCHEDULED',
          cancellationCreditOutcome: 'TRANSFERRED_TO_REPLACEMENT',
          replacedByAppointmentId: next.id,
        },
      ])
      return next
    })
    await mount(service, false)
    await reviewReplacement()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi yêu cầu đổi lịch' }),
    )
    await screen.findByRole('button', { name: 'Xem lịch trước khi đổi' })
    expect(service.api.request).toHaveBeenCalledWith(
      {
        slotId: slot.id,
        modality: slot.modality,
        replacesAppointmentId: old.id,
      },
      expect.any(String),
      old.version,
    )
    expect(service.api.cancel).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem lịch trước khi đổi' }),
    )
    await screen.findByRole('button', { name: 'Xem lịch thay thế' })
    expect(
      screen.queryByRole('button', { name: 'Hủy lịch hẹn này' }),
    ).toBeNull()
  })
  it('keeps the original appointment when replacement version races', async () => {
    const service = services([appointment])
    await mount(service, false)
    await reviewReplacement()
    service.setItems([{ ...appointment, version: 1 }])
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi yêu cầu đổi lịch' }),
    )
    await screen.findByText(/Lịch hẹn vừa thay đổi/)
    expect(service.api.request).not.toHaveBeenCalled()
    expect(service.api.cancel).not.toHaveBeenCalled()
  })
  it.each(Object.entries(sessionLabels))(
    'renders server outcome %s without session/action links',
    async (outcome, label) => {
      const parsed = {
        ...appointment,
        status: 'SESSION_ENDED' as const,
        sessionOutcome: outcome as Appointment['sessionOutcome'],
      }
      await mount(services([parsed]), false)
      await openDetail()
      expect(screen.getAllByText(label).length).toBeGreaterThan(0)
      expect(
        screen.queryByRole('button', { name: 'Hủy lịch hẹn này' }),
      ).toBeNull()
      expect(screen.queryByRole('link')).toBeNull()
    },
  )
  it('shows a persisted cancelled appointment in history and opens its exact detail', async () => {
    const service = services([cancelled])
    await mount(service, false)

    const filters = await screen.findAllByRole('radio')
    const historyFilter = filters[3]
    if (!historyFilter) throw new Error('History filter missing')
    await fireEvent.press(historyFilter)

    const historyEntry = await screen.findByTestId('appointment-open-detail')
    await fireEvent.press(historyEntry)

    expect(await screen.findByTestId('appointment-detail')).toBeOnTheScreen()
    expect(service.api.list).toHaveBeenCalled()
    expect(service.api.cancel).not.toHaveBeenCalled()
  })
  it('keeps history usable when credit dependency fails and distinguishes empty/filter-empty', async () => {
    const service = services([appointment])
    jest.mocked(service.api.credits).mockRejectedValue(problem(503))
    await mount(service, false)
    await openDetail()
    expect(screen.getByText(/Chưa thể tải lượt tư vấn/)).toBeTruthy()
    await fireEvent.press(screen.getByRole('radio', { name: 'Lịch sử' }))
    expect(screen.getByText(/Chưa có lịch hẹn trong nhóm này/)).toBeTruthy()
    service.setItems([])
    await fireEvent.press(
      screen.getByRole('button', { name: 'Cập nhật lịch hẹn và quyền lợi' }),
    )
    await screen.findByText(/Bạn chưa có lịch hẹn/)
  })
  it.each([401, 403, 503])(
    'hides stale owner detail/actions when a fresh list read fails HTTP %s',
    async (status) => {
      const service = services([appointment])
      await mount(service, false)
      await openDetail()
      jest.mocked(service.api.list).mockRejectedValue(problem(status))
      await fireEvent.press(
        screen.getByRole('button', { name: 'Cập nhật lịch hẹn và quyền lợi' }),
      )
      await screen.findByRole('button', { name: 'Tải lại lịch hẹn' })
      expect(screen.queryByText('Chi tiết lịch hẹn')).toBeNull()
      expect(
        screen.queryByRole('button', { name: 'Hủy lịch hẹn này' }),
      ).toBeNull()
      expect(screen.queryByText(/Bạn chưa có lịch hẹn/)).toBeNull()
    },
  )
  it('discards old subject review and initial selection without a full remount', async () => {
    const mounted = await mount()
    await reviewRequest()
    mockSession = { subject: slot.id, role: 'USER' }
    await mounted.rerender(mounted.view())
    expect(
      screen.queryByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    ).toBeNull()
    expect(
      screen.queryByRole('button', { name: 'Kiểm tra giờ đã chọn' }),
    ).toBeNull()
    expect(mounted.api.request).not.toHaveBeenCalled()
  })
  it.each([null, { subject, role: 'SPECIALIST' as const }])(
    'does not load for invalid actor %s',
    async (actor) => {
      mockSession = actor
      const service = services()
      await render(
        <QueryClientProvider client={new QueryClient()}>
          <AppointmentsScreen
            api={service.api}
            discovery={service.discovery}
            onBack={jest.fn()}
          />
        </QueryClientProvider>,
      )
      expect(service.api.list).not.toHaveBeenCalled()
      expect(service.api.credits).not.toHaveBeenCalled()
    },
  )
  it('discards confirmation and reloads owner list/credits on foreground', async () => {
    let listener: (state: AppStateStatus) => void = () => undefined
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, callback) => {
        listener = callback
        return { remove: jest.fn() }
      })
    const mounted = await mount()
    await reviewRequest()
    const before = jest.mocked(mounted.api.list).mock.calls.length
    await act(async () => listener('background'))
    expect(
      screen.queryByRole('button', { name: 'Gửi yêu cầu đặt lịch' }),
    ).toBeNull()
    await act(async () => listener('active'))
    await waitFor(() =>
      expect(jest.mocked(mounted.api.list).mock.calls.length).toBeGreaterThan(
        before,
      ),
    )
  })
})
