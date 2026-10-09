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

import type { SpecialistApi } from './specialist-api'
import { SpecialistAvailabilityScreen } from './SpecialistAvailabilityScreen'
import type {
  AvailabilitySlotList,
  SpecialistProfile,
} from './specialist-contract'
import {
  makeAvailabilityList,
  makeAvailabilitySlot,
  makeSpecialistProfile,
} from './specialist-test-fixtures'

jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn() },
}))

jest.mock('@/auth/session-context', () => ({
  useSession: () => ({
    session: {
      subject: '11111111-1111-4111-8111-111111111111',
      role: 'SPECIALIST',
    },
    signOut: jest.fn(),
  }),
}))

function makeApi(overrides: Partial<SpecialistApi> = {}): SpecialistApi {
  return {
    getProfile: jest
      .fn()
      .mockResolvedValue(makeSpecialistProfile({ approvalStatus: 'APPROVED' })),
    saveProfile: jest.fn(),
    submitProfile: jest.fn(),
    resubmitProfile: jest.fn(),
    listAvailability: jest.fn().mockResolvedValue(makeAvailabilityList()),
    publishAvailability: jest.fn().mockResolvedValue(makeAvailabilitySlot()),
    withdrawAvailability: jest.fn().mockResolvedValue(
      makeAvailabilitySlot({
        status: 'WITHDRAWN',
        readiness: 'WITHDRAWN',
        withdrawnAt: '2026-10-09T00:00:00.000Z',
        version: 3,
      }),
    ),
    ...overrides,
  }
}

async function renderScreen(ui: ReactElement) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  return await render(
    <QueryClientProvider client={client}>{ui}</QueryClientProvider>,
  )
}

async function enterSlot() {
  await fireEvent.changeText(
    screen.getByLabelText('Ngày khả dụng'),
    '2030-10-15',
  )
  await fireEvent.changeText(screen.getByLabelText('Giờ bắt đầu'), '09:00')
  await fireEvent.changeText(
    screen.getByLabelText('Múi giờ hiển thị'),
    'Asia/Ho_Chi_Minh',
  )
}

describe('SPECIALIST availability screen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('publishes the exact online 60-minute slot for an approved profile', async () => {
    const api = makeApi()
    await renderScreen(<SpecialistAvailabilityScreen api={api} />)

    await screen.findByText('Đã được phê duyệt')
    await enterSlot()
    await fireEvent.press(screen.getByTestId('availability-publish'))

    await waitFor(() =>
      expect(api.publishAvailability).toHaveBeenCalledWith(
        {
          startAt: '2030-10-15T02:00:00.000Z',
          endAt: '2030-10-15T03:00:00.000Z',
          timezone: 'Asia/Ho_Chi_Minh',
          modality: 'IN_APP_CHAT',
        },
        '11111111-1111-4111-8111-111111111111',
      ),
    )
    expect(
      await screen.findByText('Đã xuất bản khung tư vấn trực tuyến 60 phút.'),
    ).toBeOnTheScreen()
  })

  it('keeps one idempotency key across an ambiguous publish retry', async () => {
    const publishAvailability = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'NETWORK_ERROR', message: 'offline' }),
      )
      .mockResolvedValueOnce(makeAvailabilitySlot())
    const api = makeApi({ publishAvailability })
    await renderScreen(<SpecialistAvailabilityScreen api={api} />)

    await screen.findByText('Đã được phê duyệt')
    await enterSlot()
    await fireEvent.press(screen.getByTestId('availability-publish'))
    expect(
      await screen.findByText(/Bạn có thể thử lại an toàn/),
    ).toBeOnTheScreen()
    await fireEvent.press(screen.getByTestId('availability-publish'))

    await waitFor(() => expect(publishAvailability).toHaveBeenCalledTimes(2))
    expect(publishAvailability.mock.calls[0]?.[1]).toBe(
      publishAvailability.mock.calls[1]?.[1],
    )
  })

  it('surfaces server-owned overlap without changing the form', async () => {
    const api = makeApi({
      publishAvailability: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'AVAILABILITY_SLOT_OVERLAP',
          message: 'overlap',
          status: 409,
        }),
      ),
    })
    await renderScreen(<SpecialistAvailabilityScreen api={api} />)

    await screen.findByText('Đã được phê duyệt')
    await enterSlot()
    await fireEvent.press(screen.getByTestId('availability-publish'))

    expect(
      await screen.findByText(/trùng với một khung giờ đang hoạt động/),
    ).toBeOnTheScreen()
    expect(screen.getByDisplayValue('2030-10-15')).toBeOnTheScreen()
  })

  it('withdraws an available slot only after inline confirmation', async () => {
    const slot = makeAvailabilitySlot()
    const api = makeApi({
      listAvailability: jest
        .fn()
        .mockResolvedValue(makeAvailabilityList([slot])),
    })
    await renderScreen(<SpecialistAvailabilityScreen api={api} />)

    const withdraw = await screen.findByRole('button', {
      name: 'Rút khung giờ',
    })
    await fireEvent.press(withdraw)
    expect(api.withdrawAvailability).not.toHaveBeenCalled()
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận rút khung giờ' }),
    )

    await waitFor(() =>
      expect(api.withdrawAvailability).toHaveBeenCalledWith(slot),
    )
  })

  it.each(['PENDING', 'REJECTED', 'SUSPENDED'] as const)(
    'keeps saved slots read-only while profile is %s',
    async (approvalStatus) => {
      const api = makeApi({
        getProfile: jest.fn().mockResolvedValue(
          makeSpecialistProfile({
            approvalStatus,
            submittedAt:
              approvalStatus === 'PENDING' ? '2026-10-09T00:00:00.000Z' : null,
          }),
        ),
        listAvailability: jest
          .fn()
          .mockResolvedValue(makeAvailabilityList([makeAvailabilitySlot()])),
      })
      await renderScreen(<SpecialistAvailabilityScreen api={api} />)

      await screen.findByText(
        /chỉ hồ sơ đã được phê duyệt mới có thể xuất bản hoặc rút khung giờ/,
      )
      expect(screen.queryByTestId('availability-publish')).toBeNull()
      expect(screen.queryByText('Rút khung giờ')).toBeNull()
      expect(api.publishAvailability).not.toHaveBeenCalled()
      expect(api.withdrawAvailability).not.toHaveBeenCalled()
    },
  )

  it('fails closed on a stale withdrawal until both authorities refresh', async () => {
    const slot = makeAvailabilitySlot()
    const suspended = makeSpecialistProfile({
      approvalStatus: 'SUSPENDED',
      version: 4,
    })
    const refreshedList = makeAvailabilityList([
      {
        ...slot,
        status: 'WITHDRAWN',
        readiness: 'WITHDRAWN',
        withdrawnAt: '2026-10-09T00:00:00.000Z',
        version: 3,
      },
    ])
    let resolveProfile: (value: SpecialistProfile) => void = () => undefined
    let resolveList: (value: AvailabilitySlotList) => void = () => undefined
    const pendingProfile = new Promise<SpecialistProfile>((resolve) => {
      resolveProfile = resolve
    })
    const pendingList = new Promise<AvailabilitySlotList>((resolve) => {
      resolveList = resolve
    })
    const withdrawAvailability = jest.fn().mockRejectedValue(
      new ApiError({
        code: 'AVAILABILITY_SLOT_VERSION_MISMATCH',
        message: 'stale',
        status: 412,
      }),
    )
    const api = makeApi({
      getProfile: jest
        .fn()
        .mockResolvedValueOnce(
          makeSpecialistProfile({ approvalStatus: 'APPROVED', version: 3 }),
        )
        .mockReturnValueOnce(pendingProfile),
      listAvailability: jest
        .fn()
        .mockResolvedValueOnce(makeAvailabilityList([slot]))
        .mockReturnValueOnce(pendingList),
      withdrawAvailability,
    })
    await renderScreen(<SpecialistAvailabilityScreen api={api} />)

    await fireEvent.press(
      await screen.findByRole('button', { name: 'Rút khung giờ' }),
    )
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xác nhận rút khung giờ' }),
    )
    expect(await screen.findByText(/Khung giờ vừa thay đổi/)).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeDisabled()
    await fireEvent.press(screen.getByRole('button', { name: 'Tải lại' }))
    expect(withdrawAvailability).toHaveBeenCalledTimes(1)

    await act(async () => {
      resolveProfile(suspended)
      resolveList(refreshedList)
    })

    expect(await screen.findByText('Đang tạm ngưng')).toBeOnTheScreen()
    expect(screen.queryByText('Rút khung giờ')).toBeNull()
    expect(screen.queryByTestId('availability-publish')).toBeNull()
  })
})
