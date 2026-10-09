import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import type { ReactElement } from 'react'

import { ApiError } from '@/api/api-error'

import type { SpecialistAppointmentApi } from './specialist-appointment-api'
import type { SpecialistAppointmentList } from './specialist-appointment-contract'
import {
  APPOINTMENT_ID,
  makeAppointment,
  makeAppointmentList,
} from './specialist-appointment-test-fixtures'
import { SpecialistAppointmentsScreen } from './SpecialistAppointmentsScreen'

const mockPush = jest.fn()

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: (value: unknown) => mockPush(value) },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: {
      subject: '22222222-2222-4222-8222-222222222222',
      role: 'SPECIALIST',
    },
  }),
}))

function makeApi(
  overrides: Partial<SpecialistAppointmentApi> = {},
): SpecialistAppointmentApi {
  return {
    listAssigned: jest.fn().mockResolvedValue(makeAppointmentList()),
    decide: jest.fn().mockResolvedValue(
      makeAppointment({
        status: 'CONFIRMED',
        decisionReason: 'SPECIALIST_ACCEPTED',
        decidedAt: '2030-10-10T03:01:00.000Z',
        version: 2,
      }),
    ),
    ...overrides,
  }
}

function testClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
}

async function renderScreen(ui: ReactElement, client = testClient()) {
  return await render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

describe('SPECIALIST appointment workbench', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('loads pending, upcoming and history collections from Consultation state', async () => {
    const api = makeApi({
      listAssigned: jest.fn().mockResolvedValue(
        makeAppointmentList([
          makeAppointment(),
          makeAppointment({
            id: '11111111-1111-4111-8111-111111111112',
            status: 'CONFIRMED',
          }),
          makeAppointment({
            id: '11111111-1111-4111-8111-111111111113',
            status: 'COMPLETED',
            completionFactId: '66666666-6666-4666-8666-666666666666',
          }),
        ]),
      ),
    })
    await renderScreen(<SpecialistAppointmentsScreen api={api} />)

    expect(await screen.findByText('Chờ xác nhận · 1')).toBeOnTheScreen()
    expect(screen.getByText('Sắp tới · 1')).toBeOnTheScreen()
    expect(screen.getByText('Lịch sử · 1')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('tab', { name: 'Sắp tới · 1' }))
    expect(screen.getByText('Đã xác nhận')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('tab', { name: 'Lịch sử · 1' }))
    expect(screen.getByText('Đã hoàn thành')).toBeOnTheScreen()
  })

  it.each([
    ['accept', 'Xác nhận', 'Đã xác nhận lịch hẹn theo trạng thái mới nhất.'],
    ['reject', 'Từ chối', 'Đã từ chối yêu cầu lịch hẹn.'],
  ] as const)(
    'handles %s success and reconciles authority',
    async (decision, label, success) => {
      const updated = makeAppointment({
        status: decision === 'accept' ? 'CONFIRMED' : 'REJECTED',
        decisionReason:
          decision === 'accept' ? 'SPECIALIST_ACCEPTED' : 'SPECIALIST_REJECTED',
        decidedAt: '2030-10-10T03:01:00.000Z',
        version: 2,
      })
      const listAssigned = jest
        .fn()
        .mockResolvedValueOnce(makeAppointmentList())
        .mockResolvedValueOnce(makeAppointmentList([updated]))
      const decide = jest.fn().mockResolvedValue(updated)
      const api = makeApi({ listAssigned, decide })
      await renderScreen(<SpecialistAppointmentsScreen api={api} />)

      await fireEvent.press(await screen.findByRole('button', { name: label }))

      expect(await screen.findByText(success)).toBeOnTheScreen()
      expect(decide).toHaveBeenCalledWith(
        expect.objectContaining({ id: APPOINTMENT_ID, version: 1 }),
        decision,
        expect.any(String),
      )
      expect(listAssigned).toHaveBeenCalledTimes(2)
    },
  )

  it('keeps a stable command key for an ambiguous replay', async () => {
    const decide = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'NETWORK_ERROR', message: 'offline' }),
      )
      .mockResolvedValueOnce(
        makeAppointment({ status: 'CONFIRMED', version: 2 }),
      )
    const api = makeApi({ decide })
    await renderScreen(<SpecialistAppointmentsScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Xác nhận' }),
    )
    expect(await screen.findByText(/Chưa thể kết nối/)).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Xác nhận' }))

    await waitFor(() => expect(decide).toHaveBeenCalledTimes(2))
    expect(decide.mock.calls[0]?.[2]).toBe(decide.mock.calls[1]?.[2])
  })

  it('keeps every decision locked after success until authority is reconciled', async () => {
    const secondId = '11111111-1111-4111-8111-111111111112'
    const first = makeAppointment()
    const second = makeAppointment({ id: secondId })
    const accepted = makeAppointment({
      status: 'CONFIRMED',
      decisionReason: 'SPECIALIST_ACCEPTED',
      decidedAt: '2030-10-10T03:01:00.000Z',
      version: 2,
    })
    let resolveReload: (value: SpecialistAppointmentList) => void = () =>
      undefined
    const reload = new Promise<SpecialistAppointmentList>((resolve) => {
      resolveReload = resolve
    })
    const listAssigned = jest
      .fn()
      .mockResolvedValueOnce(makeAppointmentList([first, second]))
      .mockReturnValueOnce(reload)
    const decide = jest.fn().mockResolvedValue(accepted)
    await renderScreen(
      <SpecialistAppointmentsScreen api={makeApi({ listAssigned, decide })} />,
    )

    const acceptButtons = await screen.findAllByRole('button', {
      name: 'Xác nhận',
    })
    await fireEvent.press(acceptButtons[0]!)

    expect(
      await screen.findByText('Đang xác nhận lịch hẹn mới nhất…'),
    ).toBeOnTheScreen()
    const remainingAccept = screen.getByRole('button', { name: 'Xác nhận' })
    expect(remainingAccept).toBeDisabled()
    await fireEvent.press(remainingAccept)
    expect(decide).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveReload(makeAppointmentList([accepted, second]))
    })
    expect(
      await screen.findByRole('button', { name: 'Xác nhận' }),
    ).not.toBeDisabled()
  })

  it('locks every decision while stale authority is reloading', async () => {
    let resolveReload: (value: SpecialistAppointmentList) => void = () =>
      undefined
    const reload = new Promise<SpecialistAppointmentList>((resolve) => {
      resolveReload = resolve
    })
    const listAssigned = jest
      .fn()
      .mockResolvedValueOnce(makeAppointmentList())
      .mockReturnValueOnce(reload)
    const decide = jest.fn().mockRejectedValue(
      new ApiError({
        code: 'APPOINTMENT_VERSION_MISMATCH',
        message: 'stale',
        status: 412,
      }),
    )
    const api = makeApi({ listAssigned, decide })
    await renderScreen(<SpecialistAppointmentsScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Xác nhận' }),
    )
    expect(
      await screen.findByText('Đang xác nhận lịch hẹn mới nhất…'),
    ).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Xác nhận' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Từ chối' }))
    expect(decide).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveReload(
        makeAppointmentList([
          makeAppointment({ status: 'CONFIRMED', version: 2 }),
        ]),
      )
    })
    expect(await screen.findByText(/Lịch hẹn vừa thay đổi/)).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull()
  })

  it('does not grant decisions from cached data after refresh failure', async () => {
    const client = testClient()
    client.setQueryData(
      ['specialist-appointments', '22222222-2222-4222-8222-222222222222'],
      makeAppointmentList(),
    )
    const decide = jest.fn()
    const api = makeApi({
      listAssigned: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CONSULTATION_UNAVAILABLE',
          message: 'down',
          status: 503,
        }),
      ),
      decide,
    })
    await renderScreen(<SpecialistAppointmentsScreen api={api} />, client)

    expect(
      await screen.findByText(/Các thao tác đang được khóa/),
    ).toBeOnTheScreen()
    const accept = screen.getByRole('button', { name: 'Xác nhận' })
    expect(accept).toBeDisabled()
    await fireEvent.press(accept)
    expect(decide).not.toHaveBeenCalled()
  })

  it('fails closed for the wrong role or specialist', async () => {
    const decide = jest.fn()
    const api = makeApi({
      listAssigned: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'CONSULTATION_ROLE_REQUIRED',
          message: 'no',
          status: 403,
        }),
      ),
      decide,
    })
    await renderScreen(<SpecialistAppointmentsScreen api={api} />)

    expect(
      await screen.findByText(/không có quyền xem hoặc xử lý/),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Xác nhận' })).toBeNull()
    expect(decide).not.toHaveBeenCalled()
  })

  it('rejects a collection containing another specialist assignment', async () => {
    const decide = jest.fn()
    const api = makeApi({
      listAssigned: jest.fn().mockResolvedValue(
        makeAppointmentList([
          makeAppointment({
            specialistAccountId: '99999999-9999-4999-8999-999999999999',
          }),
        ]),
      ),
      decide,
    })
    await renderScreen(<SpecialistAppointmentsScreen api={api} />)

    expect(
      await screen.findByText(/không khớp với chuyên gia đang đăng nhập/),
    ).toBeOnTheScreen()
    expect(screen.queryByRole('button', { name: 'Xem chi tiết' })).toBeNull()
    expect(decide).not.toHaveBeenCalled()
  })

  it('opens only the selected appointment detail route', async () => {
    await renderScreen(<SpecialistAppointmentsScreen api={makeApi()} />)
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Xem chi tiết' }),
    )

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(specialist)/appointments/[appointmentId]',
      params: { appointmentId: APPOINTMENT_ID },
    })
  })
})
