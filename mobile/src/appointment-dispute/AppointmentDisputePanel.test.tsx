import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'
import type { Appointment } from '@/appointments/appointment-contract'

import type { AppointmentDisputeApi } from './appointment-dispute-api'
import type { AppointmentDispute } from './appointment-dispute-contract'
import { disputeFixture } from './appointment-dispute-fixtures'
import { appointmentDisputeCommands } from './appointment-dispute-model'
import {
  AppointmentDisputePanel,
  appointmentDisputeReasonOptions,
} from './AppointmentDisputePanel'

jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => '11111111-1111-4111-8111-111111111111'),
}))

const subject = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ownedAppointment: Pick<
  Appointment,
  'id' | 'sessionOutcome' | 'sessionSettledAt' | 'status' | 'timezone'
> = {
  id: disputeFixture.appointmentId,
  sessionOutcome: 'COMPLETED',
  sessionSettledAt: '2026-10-10T17:01:00Z',
  status: 'COMPLETED',
  timezone: 'Asia/Ho_Chi_Minh',
}

const notFound = () =>
  new ApiError({
    code: 'APPOINTMENT_DISPUTE_NOT_FOUND',
    status: 404,
    message: 'synthetic',
  })
const failure = (status: number | undefined, code = 'DEPENDENCY_UNAVAILABLE') =>
  new ApiError({
    code,
    ...(status === undefined ? {} : { status }),
    message: 'synthetic',
  })

function service(
  current: AppointmentDispute | null = null,
): AppointmentDisputeApi {
  return {
    get: jest
      .fn()
      .mockImplementation(async () => current ?? Promise.reject(notFound())),
    open: jest.fn().mockResolvedValue(current ?? disputeFixture),
  }
}

async function mount(
  api: AppointmentDisputeApi,
  serverNow = '2026-10-10T18:00:00Z',
) {
  return await render(
    <AppointmentDisputePanel
      api={api}
      appointment={ownedAppointment}
      serverNow={serverNow}
      subject={subject}
    />,
  )
}

beforeEach(() => {
  appointmentDisputeCommands.clear()
  jest.clearAllMocks()
})

describe('MB-726 bounded USER appointment dispute panel', () => {
  it('offers only four operational reasons and posts exact null evidence', async () => {
    const api = service()
    await mount(api)

    expect(await screen.findByText('Chọn lý do phù hợp nhất')).toBeOnTheScreen()
    expect(screen.getAllByRole('radio')).toHaveLength(4)
    for (const option of appointmentDisputeReasonOptions)
      expect(
        screen.getByRole('radio', { name: option.label }),
      ).toBeOnTheScreen()
    expect(
      screen.getByText(/không gửi nội dung sức khỏe hoặc cuộc trò chuyện/i),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Để sau' }))
    expect(
      await screen.findByText(/Chưa có yêu cầu nào được gửi/),
    ).toBeOnTheScreen()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Chọn lý do xem xét' }),
    )

    const submit = screen.getByRole('button', {
      name: 'Gửi yêu cầu xem xét',
    })
    expect(submit).toBeDisabled()
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Phiên gặp sự cố kỹ thuật' }),
    )
    expect(submit).toBeEnabled()
    await fireEvent.press(submit)

    await screen.findByText('Yêu cầu đang được xem xét')
    expect(api.open).toHaveBeenCalledWith(
      ownedAppointment.id,
      {
        reasonCode: 'TECHNICAL_FAILURE',
        evidenceType: null,
        evidenceOccurredAt: null,
      },
      'appointment-dispute-11111111-1111-4111-8111-111111111111',
    )
  })

  it('retains the exact body/key after ambiguity and never retries automatically', async () => {
    const api = service()
    jest
      .mocked(api.open)
      .mockRejectedValueOnce(failure(undefined, 'NETWORK_ERROR'))
      .mockResolvedValueOnce(disputeFixture)
    await mount(api)
    await screen.findByText('Chọn lý do phù hợp nhất')

    await fireEvent.press(
      screen.getByRole('radio', { name: 'Kết quả phiên chưa chính xác' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi yêu cầu xem xét' }),
    )
    await screen.findByText(/Chưa thể xác nhận kết quả yêu cầu/)
    expect(api.open).toHaveBeenCalledTimes(1)

    await act(async () => Promise.resolve())
    expect(api.open).toHaveBeenCalledTimes(1)
    await fireEvent.press(
      screen.getByRole('button', { name: 'Kiểm tra lại cùng yêu cầu' }),
    )
    await screen.findByText('Yêu cầu đang được xem xét')
    expect(api.open).toHaveBeenCalledTimes(2)
    expect(jest.mocked(api.open).mock.calls[1]).toEqual(
      jest.mocked(api.open).mock.calls[0],
    )
  })

  it('refetches an already-existing dispute instead of fabricating success', async () => {
    const api = service()
    jest
      .mocked(api.get)
      .mockRejectedValueOnce(notFound())
      .mockResolvedValueOnce(disputeFixture)
    jest
      .mocked(api.open)
      .mockRejectedValueOnce(failure(409, 'APPOINTMENT_DISPUTE_ALREADY_EXISTS'))
    await mount(api)
    await screen.findByText('Chọn lý do phù hợp nhất')
    await fireEvent.press(
      screen.getByRole('radio', { name: 'Kết quả phiên chưa chính xác' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Gửi yêu cầu xem xét' }),
    )

    expect(
      await screen.findByText('Yêu cầu đang được xem xét'),
    ).toBeOnTheScreen()
    expect(api.get).toHaveBeenCalledTimes(2)
  })

  it.each([
    ['OPEN', disputeFixture, 'Yêu cầu đang được xem xét'],
    [
      'RESOLVED',
      {
        ...disputeFixture,
        status: 'RESOLVED',
        evidenceType: 'ACCESS_LOG',
        evidenceOccurredAt: '2026-10-10T16:30:00Z',
        resolutionOutcome: 'RELEASE_USER_CREDIT',
        resolutionReason: 'EVIDENCE_INCONCLUSIVE_RELEASED',
        resolvedAt: '2026-10-12T10:00:00Z',
        creditAction: 'ADJUSTED_RELEASED',
        version: 1,
      } as const,
      'Đã trả lại lượt tư vấn',
    ],
  ] as const)(
    'keeps server-confirmed %s visible after the window without private evidence',
    async (_status, current, title) => {
      await mount(service(current), '2026-10-15T18:00:00Z')
      expect(await screen.findByText(title)).toBeOnTheScreen()
      expect(
        screen.queryByRole('button', { name: 'Gửi yêu cầu xem xét' }),
      ).toBeNull()
      expect(screen.queryByText('ACCESS_LOG')).toBeNull()
      expect(screen.queryByText('USER')).toBeNull()
    },
  )

  it('explains expiry without offering a mutation when GET confirms none', async () => {
    const api = service()
    await mount(api, '2026-10-12T18:00:00Z')

    expect(
      await screen.findByText('Đã hết thời hạn gửi yêu cầu'),
    ).toBeOnTheScreen()
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(api.open).not.toHaveBeenCalled()
  })

  it.each([
    [403, 'FORBIDDEN'],
    [undefined, 'NETWORK_ERROR'],
  ] as const)(
    'fails closed on read error %s and exposes an explicit retry',
    async (status, code) => {
      const api = service()
      jest.mocked(api.get).mockRejectedValueOnce(failure(status, code))
      await mount(api)

      expect(
        await screen.findByRole('button', {
          name: 'Tải lại trạng thái yêu cầu',
        }),
      ).toBeOnTheScreen()
      expect(screen.queryAllByRole('radio')).toHaveLength(0)
      expect(api.open).not.toHaveBeenCalled()
      await fireEvent.press(
        screen.getByRole('button', { name: 'Tải lại trạng thái yêu cầu' }),
      )
      await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2))
    },
  )
})
