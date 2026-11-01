import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
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
import {
  APPOINTMENT_ID,
  USER_ID,
} from '@/specialist-appointments/specialist-appointment-test-fixtures'

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

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((complete, fail) => {
    resolve = complete
    reject = fail
  })
  return { promise, reject, resolve }
}

async function mount(api = makeApi()) {
  const client = makeClient()
  const result = await render(
    <QueryClientProvider client={client}>
      <UserSessionSummaryPanel
        api={api}
        appointmentId={APPOINTMENT_ID}
        userAccountId={USER_ID}
      />
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

    await fireEvent.press(screen.getByTestId('user-summary-reload-required'))
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

  it('locks step commands after a lost response until a read confirms the committed state', async () => {
    const original = makeSessionSummary()
    const step = original.agreedNextSteps[0]
    if (!step) throw new Error('Missing step fixture')
    const committed = {
      ...step,
      state: 'COMPLETED' as const,
      stateVersion: 1,
      stateUpdatedAt: '2030-10-15T04:03:00.000Z',
    }
    const api = makeApi({
      list: jest
        .fn()
        .mockResolvedValueOnce(makeSessionSummaryList([original]))
        .mockResolvedValueOnce(
          makeSessionSummaryList([
            makeSessionSummary({ agreedNextSteps: [committed] }),
          ]),
        ),
      updateStep: jest.fn().mockRejectedValue(
        new ApiError({
          code: 'DEPENDENCY_UNAVAILABLE',
          message: 'lost response after commit',
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
      await screen.findByText(/Chưa xác minh được trạng thái bước/),
    ).toBeOnTheScreen()
    expect(screen.queryByText('Đã cập nhật bước tiếp theo.')).toBeNull()
    expect(
      screen.getByRole('radio', { name: `Đang thực hiện: ${step.title}` }).props
        .accessibilityState,
    ).toMatchObject({ disabled: true, selected: true })

    await fireEvent.press(
      screen.getByRole('radio', { name: `Bỏ qua: ${step.title}` }),
    )
    expect(api.updateStep).toHaveBeenCalledTimes(1)

    await fireEvent.press(screen.getByTestId('user-summary-reload-required'))
    await screen.findByText('Đã tải tóm tắt mới nhất.')
    expect(
      screen.getByRole('radio', { name: `Đã hoàn thành: ${step.title}` }).props
        .accessibilityState,
    ).toMatchObject({ disabled: false, selected: true })
  })

  it.each([
    ['approve', false, true, 0],
    ['revoke', true, false, 3],
  ] as const)(
    'locks an exact-summary consent %s after a lost response until authoritative reload',
    async (_label, initiallyApproved, committedApproved, version) => {
      const consent = initiallyApproved
        ? {
            approved: true,
            version,
            updatedAt: '2030-10-15T04:02:00.000Z',
          }
        : null
      const original = makeSessionSummary({ reuseConsent: consent })
      const committed = makeSessionSummary({
        reuseConsent: {
          approved: committedApproved,
          version: version + 1,
          updatedAt: '2030-10-15T04:04:00.000Z',
        },
      })
      const api = makeApi({
        list: jest
          .fn()
          .mockResolvedValueOnce(makeSessionSummaryList([original]))
          .mockResolvedValueOnce(makeSessionSummaryList([committed])),
        updateConsent: jest.fn().mockRejectedValue(
          new ApiError({
            code: 'NETWORK_ERROR',
            message: 'lost response after commit',
          }),
        ),
      })
      await mount(api)
      const consentSwitch = await screen.findByRole('switch', {
        name: 'Cho phép tái sử dụng tóm tắt này',
      })

      await fireEvent.press(consentSwitch)
      expect(
        await screen.findByText(/Chưa xác minh được quyền tái sử dụng/),
      ).toBeOnTheScreen()
      expect(api.updateConsent).toHaveBeenCalledWith(
        APPOINTMENT_ID,
        original.id,
        committedApproved,
        version,
      )
      expect(consentSwitch.props.accessibilityState).toMatchObject({
        checked: initiallyApproved,
        disabled: true,
      })

      await fireEvent.press(consentSwitch)
      expect(api.updateConsent).toHaveBeenCalledTimes(1)

      await fireEvent.press(screen.getByTestId('user-summary-reload-required'))
      await screen.findByText('Đã tải tóm tắt mới nhất.')
      expect(
        screen.getByRole('switch', {
          name: 'Cho phép tái sử dụng tóm tắt này',
        }).props.accessibilityState,
      ).toMatchObject({ checked: committedApproved, disabled: false })
    },
  )

  it.each([403, 404])(
    'evicts cached summary data and controls after a successful load refetches with %s',
    async (status) => {
      const original = makeSessionSummary()
      const topic = original.topicsDiscussed[0]
      const step = original.agreedNextSteps[0]
      if (!topic || !step) throw new Error('Missing summary fixture data')
      const api = makeApi({
        list: jest
          .fn()
          .mockResolvedValueOnce(makeSessionSummaryList([original]))
          .mockRejectedValueOnce(
            new ApiError({
              code: status === 403 ? 'FORBIDDEN' : 'NOT_FOUND',
              message: 'sensitive foreign detail',
              status,
            }),
          ),
      })
      const { client } = await mount(api)
      expect(await screen.findByText(topic)).toBeOnTheScreen()

      await act(async () => {
        await client.refetchQueries({
          queryKey: ['user-session-summaries', USER_ID, APPOINTMENT_ID],
          exact: true,
        })
      })

      expect(
        await screen.findByText(
          'Không thể xem hoặc thay đổi tóm tắt cho lịch hẹn này.',
        ),
      ).toBeOnTheScreen()
      expect(screen.queryByText(topic)).toBeNull()
      expect(screen.queryByTestId(`user-summary-step-${step.id}`)).toBeNull()
      expect(
        screen.queryByRole('switch', {
          name: 'Cho phép tái sử dụng tóm tắt này',
        }),
      ).toBeNull()
      expect(
        client.getQueryData([
          'user-session-summaries',
          USER_ID,
          APPOINTMENT_ID,
        ]),
      ).toMatchObject({ items: [], count: 0 })
      expect(api.updateStep).not.toHaveBeenCalled()
      expect(api.updateConsent).not.toHaveBeenCalled()
    },
  )

  it('removes the identity-scoped sensitive cache when the panel unmounts', async () => {
    const mounted = await mount()
    const queryKey = [
      'user-session-summaries',
      USER_ID,
      APPOINTMENT_ID,
    ] as const
    expect(mounted.client.getQueryData(queryKey)).toBeDefined()

    mounted.unmount()

    await waitFor(() =>
      expect(mounted.client.getQueryData(queryKey)).toBeUndefined(),
    )
  })

  it.each(['success', 'authorization failure'] as const)(
    'ignores a late mutation %s after switching identity',
    async (settlement) => {
      const otherUserId = '66666666-6666-4666-8666-666666666666'
      const pending = deferred<ReturnType<typeof makeSessionSummary>>()
      const original = makeSessionSummary()
      const nextIdentitySummary = makeSessionSummary({
        topicsDiscussed: ['Nội dung của tài khoản mới'],
        userAccountId: otherUserId,
      })
      const oldApi = makeApi({
        list: jest.fn().mockResolvedValue(makeSessionSummaryList([original])),
        updateConsent: jest.fn().mockReturnValue(pending.promise),
      })
      const nextApi = makeApi({
        list: jest
          .fn()
          .mockResolvedValue(makeSessionSummaryList([nextIdentitySummary])),
      })
      const client = makeClient()
      const view = await render(
        <QueryClientProvider client={client}>
          <UserSessionSummaryPanel
            key={USER_ID}
            api={oldApi}
            appointmentId={APPOINTMENT_ID}
            userAccountId={USER_ID}
          />
        </QueryClientProvider>,
      )
      await screen.findByText(original.topicsDiscussed[0] ?? '')

      await fireEvent.press(
        screen.getByRole('switch', {
          name: 'Cho phép tái sử dụng tóm tắt này',
        }),
      )
      await waitFor(() => expect(oldApi.updateConsent).toHaveBeenCalledTimes(1))

      await view.rerender(
        <QueryClientProvider client={client}>
          <UserSessionSummaryPanel
            key={otherUserId}
            api={nextApi}
            appointmentId={APPOINTMENT_ID}
            userAccountId={otherUserId}
          />
        </QueryClientProvider>,
      )
      expect(
        await screen.findByText('Nội dung của tài khoản mới'),
      ).toBeOnTheScreen()

      await act(async () => {
        if (settlement === 'success') {
          pending.resolve(
            makeSessionSummary({
              reuseConsent: {
                approved: true,
                version: 1,
                updatedAt: '2030-10-15T04:04:00.000Z',
              },
            }),
          )
          await pending.promise
        } else {
          pending.reject(
            new ApiError({
              code: 'FORBIDDEN',
              message: 'revoked after account switch',
              status: 403,
            }),
          )
          await pending.promise.catch(() => undefined)
        }
      })

      await waitFor(() =>
        expect(
          client.getQueryData([
            'user-session-summaries',
            USER_ID,
            APPOINTMENT_ID,
          ]),
        ).toBeUndefined(),
      )
      await waitFor(() =>
        expect(client.getMutationCache().getAll()).toHaveLength(0),
      )
      expect(screen.getByText('Nội dung của tài khoản mới')).toBeOnTheScreen()
      expect(screen.queryByText('Đã cập nhật quyền tái sử dụng.')).toBeNull()
      expect(
        screen.queryByText(
          'Không thể xem hoặc thay đổi tóm tắt cho lịch hẹn này.',
        ),
      ).toBeNull()
    },
  )

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
