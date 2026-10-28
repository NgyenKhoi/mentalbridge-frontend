import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'

import { ApiError } from '@/api/api-error'
import {
  makeSessionSummary,
  makeSessionSummaryList,
} from '@/specialist-summary/specialist-summary-test-fixtures'
import { APPOINTMENT_ID } from '@/specialist-appointments/specialist-appointment-test-fixtures'

import type { UserSummaryApi } from './user-summary-api'
import { UserSessionSummaryPanel } from './UserSessionSummaryPanel'

function makeApi(
  overrides: Partial<UserSummaryApi> = {},
): jest.Mocked<UserSummaryApi> {
  return {
    list: jest.fn().mockResolvedValue(makeSessionSummaryList()),
    updateConsent: jest.fn().mockResolvedValue(makeSessionSummary()),
    updateStep: jest.fn().mockResolvedValue(makeSessionSummary()),
    ...overrides,
  } as jest.Mocked<UserSummaryApi>
}

async function mount(api = makeApi()) {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  const result = await render(
    <QueryClientProvider client={client}>
      <UserSessionSummaryPanel api={api} appointmentId={APPOINTMENT_ID} />
    </QueryClientProvider>,
  )
  await screen.findByText('Tóm tắt sau buổi tư vấn')
  return { ...result, api, client }
}

describe('MB-724 USER SessionSummary controls', () => {
  it('renders authoritative content and applies server-confirmed step and consent updates', async () => {
    const original = makeSessionSummary()
    const step = original.agreedNextSteps[0]
    if (!step) throw new Error('Missing step fixture')
    const completed = {
      ...step,
      state: 'COMPLETED' as const,
      stateVersion: 1,
      stateUpdatedAt: '2030-10-15T04:03:00.000Z',
    }
    const api = makeApi({
      list: jest.fn().mockResolvedValue(makeSessionSummaryList([original])),
      updateStep: jest
        .fn()
        .mockResolvedValue(
          makeSessionSummary({ agreedNextSteps: [completed] }),
        ),
      updateConsent: jest.fn().mockResolvedValue(
        makeSessionSummary({
          agreedNextSteps: [completed],
          reuseConsent: {
            approved: true,
            version: 1,
            updatedAt: '2030-10-15T04:04:00.000Z',
          },
        }),
      ),
    })
    await mount(api)

    const topic = original.topicsDiscussed[0]
    if (!topic) throw new Error('Missing topic fixture')
    expect(await screen.findByText(topic)).toBeOnTheScreen()
    await fireEvent.press(
      screen.getByRole('radio', {
        name: `Đã hoàn thành: ${step.title}`,
      }),
    )
    await waitFor(() =>
      expect(api.updateStep).toHaveBeenCalledWith(
        APPOINTMENT_ID,
        step.id,
        { state: 'COMPLETED', hidden: false },
        0,
      ),
    )
    expect(
      await screen.findByText('Đã cập nhật bước tiếp theo.'),
    ).toBeOnTheScreen()

    await fireEvent.press(
      screen.getByRole('switch', {
        name: 'Cho phép tái sử dụng tóm tắt này',
      }),
    )
    await waitFor(() =>
      expect(api.updateConsent).toHaveBeenCalledWith(
        APPOINTMENT_ID,
        original.id,
        true,
        0,
      ),
    )
    expect(await screen.findByText('Đang cho phép')).toBeOnTheScreen()
  })

  it('keeps confirmed state and locks commands after a stale response until reload', async () => {
    const original = makeSessionSummary()
    const step = original.agreedNextSteps[0]
    if (!step) throw new Error('Missing step fixture')
    const freshStep = {
      ...step,
      state: 'COMPLETED' as const,
      stateVersion: 2,
      stateUpdatedAt: '2030-10-15T04:05:00.000Z',
    }
    const api = makeApi({
      list: jest
        .fn()
        .mockResolvedValueOnce(makeSessionSummaryList([original]))
        .mockResolvedValueOnce(
          makeSessionSummaryList([
            makeSessionSummary({ agreedNextSteps: [freshStep] }),
          ]),
        ),
      updateStep: jest
        .fn()
        .mockRejectedValueOnce(
          new ApiError({
            code: 'SESSION_SUMMARY_VERSION_MISMATCH',
            message: 'synthetic',
            status: 412,
          }),
        )
        .mockResolvedValueOnce(
          makeSessionSummary({
            agreedNextSteps: [
              {
                ...freshStep,
                state: 'SKIPPED',
                stateVersion: 3,
              },
            ],
          }),
        ),
    })
    await mount(api)
    await screen.findByTestId('user-session-summary')

    await fireEvent.press(
      screen.getByRole('radio', {
        name: `Đã hoàn thành: ${step.title}`,
      }),
    )
    expect(
      await screen.findByText(
        'Nội dung vừa thay đổi. Hãy tải lại tóm tắt trước khi thử tiếp.',
      ),
    ).toBeOnTheScreen()
    expect(
      screen.getByRole('radio', { name: `Đang thực hiện: ${step.title}` }).props
        .accessibilityState,
    ).toMatchObject({ selected: true })

    await fireEvent.press(
      screen.getByRole('radio', { name: `Bỏ qua: ${step.title}` }),
    )
    expect(api.updateStep).toHaveBeenCalledTimes(1)

    await fireEvent.press(screen.getByTestId('user-summary-reload-stale'))
    await screen.findByText('Đã tải tóm tắt mới nhất.')
    expect(
      screen.getByRole('radio', { name: `Đã hoàn thành: ${step.title}` }).props
        .accessibilityState,
    ).toMatchObject({ selected: true })

    await fireEvent.press(
      screen.getByRole('radio', { name: `Bỏ qua: ${step.title}` }),
    )
    await waitFor(() =>
      expect(api.updateStep).toHaveBeenLastCalledWith(
        APPOINTMENT_ID,
        step.id,
        { state: 'SKIPPED', hidden: false },
        2,
      ),
    )
  })

  it('retains the confirmed state and never reports success for a failed mutation', async () => {
    const original = makeSessionSummary()
    const step = original.agreedNextSteps[0]
    if (!step) throw new Error('Missing step fixture')
    const api = makeApi({
      updateStep: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'synthetic',
          status: 503,
        }),
      ),
    })
    await mount(api)
    await screen.findByTestId('user-session-summary')

    await fireEvent.press(
      screen.getByRole('radio', {
        name: `Đã hoàn thành: ${step.title}`,
      }),
    )
    expect(
      await screen.findByText(/Nội dung đã xác nhận vẫn được giữ nguyên/),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Đã cập nhật bước tiếp theo.')).toBeNull()
    expect(
      screen.getByRole('radio', { name: `Đang thực hiện: ${step.title}` }).props
        .accessibilityState,
    ).toMatchObject({ selected: true })
  })

  it('lets the user revoke reuse for an older exact summary without exposing versions', async () => {
    const previous = makeSessionSummary({
      reuseConsent: {
        approved: true,
        version: 3,
        updatedAt: '2030-10-15T04:02:00.000Z',
      },
    })
    const latest = makeSessionSummary({
      id: '77777777-7777-4777-8777-777777777777',
      version: 2,
      amendsSummaryId: previous.id,
      agreedNextSteps: [],
      publishedAt: '2030-10-16T04:00:00.000Z',
    })
    const api = makeApi({
      list: jest
        .fn()
        .mockResolvedValue(makeSessionSummaryList([latest, previous])),
      updateConsent: jest.fn().mockResolvedValue({
        ...previous,
        reuseConsent: {
          approved: false,
          version: 4,
          updatedAt: '2030-10-16T04:03:00.000Z',
        },
      }),
    })
    await mount(api)
    await screen.findByRole('button', {
      name: 'Xem 1 bản tóm tắt trước',
    })
    await fireEvent.press(
      screen.getByRole('button', { name: 'Xem 1 bản tóm tắt trước' }),
    )
    const switches = screen.getAllByRole('switch', {
      name: 'Cho phép tái sử dụng tóm tắt này',
    })
    const previousSwitch = switches.find(
      (item) => item.props.accessibilityState?.checked,
    )
    if (!previousSwitch) throw new Error('Approved previous summary missing')
    await fireEvent.press(previousSwitch)

    await waitFor(() =>
      expect(api.updateConsent).toHaveBeenCalledWith(
        APPOINTMENT_ID,
        previous.id,
        false,
        3,
      ),
    )
    expect(screen.queryByText(/phiên bản/i)).toBeNull()
  })

  it('renders truthful empty and safe unavailable states with reload', async () => {
    const empty = makeApi({
      list: jest.fn().mockResolvedValue(makeSessionSummaryList([])),
    })
    const first = await mount(empty)
    expect(
      await screen.findByText('Chưa có tóm tắt được chia sẻ'),
    ).toBeOnTheScreen()
    await first.unmount()

    const forbidden = makeApi({
      list: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'FORBIDDEN',
          message: 'synthetic foreign detail',
          status: 403,
        }),
      ),
    })
    await mount(forbidden)
    expect(
      await screen.findByText(
        'Không thể xem hoặc thay đổi tóm tắt cho lịch hẹn này.',
      ),
    ).toBeOnTheScreen()
    expect(screen.queryByText('synthetic foreign detail')).toBeNull()
    expect(screen.getByRole('button', { name: 'Tải lại' })).toBeOnTheScreen()
  })
})
