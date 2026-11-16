import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native'
import {
  AppState,
  BackHandler,
  Linking,
  Text,
  type AppStateStatus,
} from 'react-native'

import * as Crypto from 'expo-crypto'
import { ApiError } from '@/api/api-error'

import { SupportPlanAccessGate } from './SupportPlanAccessGate'
import type { SupportPlanAccessApi } from './support-plan-access-api'
import {
  careOwnedPlanProofSchema,
  createCareOwnershipAdapter,
  invalidateCareOwnershipForSubject,
  resolveCareOwnershipFromApi,
  verifyCareOwnership,
  type CareOwnedPlanProof,
  type CareOwnershipAdapter,
  type PlanPaymentHistory,
} from './support-plan-access-contract'
import {
  GUIDE_ID,
  PAYMENT_ID_1,
  PAYMENT_ID_2,
  PLUS_PLAN_VERSION_ID,
  SUPPORT_PLAN_ID_2,
  USER_A_SUBJECT,
  USER_B_SUBJECT,
  makeCareOwnershipAdapter,
  makeCareSupportPlanHistoryResponse,
  makeCareSupportPlanResponse,
  makeCatalogue,
  makeEntitlement,
  makePayment,
  makeVerifiedCareOwnership,
} from './support-plan-access-test-fixtures'
import {
  clearCheckoutAttempt,
  clearPendingUpgradeIntent,
  getCheckoutAttempt,
  getExpiredUnresolvedCheckoutAttempt,
  getPendingUpgradeIntent,
  saveCheckoutAttempt,
} from './upgrade-intent-store'
import { useSupportPlanAccess } from './useSupportPlanAccess'

function makeApi(overrides: Partial<SupportPlanAccessApi> = {}) {
  const api: SupportPlanAccessApi = {
    getEntitlement: jest.fn().mockResolvedValue(makeEntitlement()),
    getServicePlans: jest.fn().mockResolvedValue(makeCatalogue()),
    startCheckout: jest.fn().mockResolvedValue(makePayment()),
    getPaymentHistory: jest.fn().mockResolvedValue({
      items: [],
      count: 0,
      generatedAt: '2026-11-15T10:00:00Z',
    }),
    getPayment: jest.fn().mockResolvedValue(makePayment()),
    ...overrides,
  }
  return api
}

const activeClients: QueryClient[] = []

function makeQueryClient() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  })
  activeClients.push(client)
  return client
}

describe('SupportPlanAccessGate', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined
  let backListener: (() => boolean) | undefined

  beforeEach(() => {
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
    appStateListener = undefined
    backListener = undefined

    let uuidSeq = 1
    jest
      .spyOn(Crypto, 'randomUUID')
      .mockImplementation(
        () =>
          `00000000-0000-4000-8000-${String(uuidSeq++).padStart(12, '0')}` as ReturnType<
            typeof Crypto.randomUUID
          >,
      )

    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appStateListener = listener as (state: AppStateStatus) => void
        return { remove: jest.fn() }
      })

    jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation((_event, listener) => {
        backListener = listener as () => boolean
        return { remove: jest.fn() }
      })

    jest.spyOn(Linking, 'canOpenURL').mockClear().mockResolvedValue(true)
    jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
  })

  it('shows non-personalized 14-day example preview for FREE user with local-only toggles, free paths, and Android Back', async () => {
    const api = makeApi()
    const onBack = jest.fn()
    const onNavigateGuide = jest.fn()
    const onNavigateResources = jest.fn()
    const onNavigateSpecialists = jest.fn()
    const onNavigateSafety = jest.fn()
    const origin = { source: 'GUIDE' as const, guideId: GUIDE_ID, step: 'next' }

    const queryClient = makeQueryClient()
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <SupportPlanAccessGate
          api={api}
          origin={origin}
          subject={USER_A_SUBJECT}
          onBack={onBack}
          onNavigateGuide={onNavigateGuide}
          onNavigateResources={onNavigateResources}
          onNavigateSpecialists={onNavigateSpecialists}
          onNavigateSafety={onNavigateSafety}
        >
          {() => <Text testID="private-plan-child">Private plan</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    expect(
      screen.getByText('Ví dụ minh hoạ, không phải kế hoạch của bạn'),
    ).toBeTruthy()

    expect(
      screen.getByTestId('locked-preview-tab-today').props.accessibilityState,
    ).toEqual({ selected: true })
    expect(
      screen.getByTestId('locked-preview-sample-item-sample-breathe').props
        .accessibilityState,
    ).toEqual({ checked: false })

    expect(screen.queryByTestId('private-plan-child')).toBeNull()
    expect(screen.getByText('Ngày 3 trên 14')).toBeTruthy()
    expect(screen.getByText('4/5 việc đã làm')).toBeTruthy()

    await fireEvent.press(
      screen.getByTestId('locked-preview-sample-item-sample-breathe'),
    )
    expect(screen.getByText('5/5 việc đã làm')).toBeTruthy()
    expect(
      screen.getByTestId('locked-preview-sample-item-sample-breathe').props
        .accessibilityState,
    ).toEqual({ checked: true })

    await fireEvent.press(screen.getByTestId('locked-preview-tab-progress'))
    expect(
      screen.getByText('Không hiển thị điểm phục hồi hay dự đoán điều trị.'),
    ).toBeTruthy()

    await fireEvent.press(screen.getByTestId('locked-preview-tab-review'))
    expect(screen.getByText('Nhìn lại chu kỳ mẫu')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('locked-preview-guide-cta'))
    expect(onNavigateGuide).toHaveBeenCalledWith(origin)
    await fireEvent.press(screen.getByTestId('locked-preview-resources-cta'))
    expect(onNavigateResources).toHaveBeenCalledTimes(1)
    await fireEvent.press(screen.getByTestId('locked-preview-specialists-cta'))
    expect(onNavigateSpecialists).toHaveBeenCalledTimes(1)
    await fireEvent.press(screen.getByTestId('locked-preview-safety-cta'))
    expect(onNavigateSafety).toHaveBeenCalledTimes(1)

    expect(backListener?.()).toBe(true)
    expect(onBack).toHaveBeenCalledTimes(1)

    // Simulate fresh app restart: Consultation entitlement must be re-queried.
    await view.unmount()
    const freshQueryClient = makeQueryClient()
    await render(
      <QueryClientProvider client={freshQueryClient}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(api.getEntitlement).toHaveBeenCalledTimes(2)
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
  })

  it('grants Care SupportPlan access immediately when Consultation verifies PLUS or PREMIUM', async () => {
    const api = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          packageCode: 'PREMIUM',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      ),
    })

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="unlocked-plan-child">
              {`PLAN:${ctx.packageCode}:${ctx.entitlementState}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('unlocked-plan-child')).toBeTruthy()
    })
    expect(screen.getByText('PLAN:PREMIUM:ACTIVE')).toBeTruthy()
    expect(screen.queryByTestId('locked-preview-example-banner')).toBeNull()
  })

  it('handles EXPIRED without owned Plan vs EXPIRED preserving owned Care Plan/history', async () => {
    const expiredApi = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          packageCode: 'PLUS',
          entitlementState: 'EXPIRED',
          supportPlanEnabled: false,
        }),
      ),
    })

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={expiredApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('GÓI PLUS ĐÃ HẾT HẠN')).toBeTruthy()
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={expiredApi}
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT)}
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="owned-history-child">Owned Plan History</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('owned-history-child')).toBeTruthy()
    })
    expect(screen.getByTestId('support-plan-expired-owned-banner')).toBeTruthy()
  })

  it('starts PayOS checkout, keeps Plan locked while PENDING, reconciles on AppState foreground return, and requires explicit confirmation CTA', async () => {
    const getEntitlementMock = jest.fn().mockResolvedValue(makeEntitlement())
    const getPaymentMock = jest
      .fn()
      .mockResolvedValueOnce(makePayment({ status: 'PENDING' }))
      .mockResolvedValueOnce(
        makePayment({
          status: 'SUCCEEDED',
          paidAt: '2026-11-15T10:05:00Z',
        }),
      )

    const api = makeApi({
      getEntitlement: getEntitlementMock,
      getPayment: getPaymentMock,
    })
    const onContinueToPlan = jest.fn()
    const origin = { source: 'GUIDE' as const, guideId: GUIDE_ID, step: 'cta' }

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={api}
          origin={origin}
          subject={USER_A_SUBJECT}
          onContinueToPlan={onContinueToPlan}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })

    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))

    await waitFor(() => {
      expect(api.startCheckout).toHaveBeenCalledWith(
        PLUS_PLAN_VERSION_ID,
        expect.stringMatching(/^[!-~]{16,128}$/),
      )
    })

    expect(screen.getByTestId('locked-preview-payment-status')).toBeTruthy()
    expect(screen.getByText('Thanh toán PayOS đang chờ xác nhận')).toBeTruthy()
    expect(screen.getByText('Số tài khoản: 0000000786')).toBeTruthy()

    await fireEvent.press(screen.getByTestId('locked-preview-open-payos-url'))
    await waitFor(() => {
      expect(Linking.openURL).toHaveBeenCalledWith(
        'https://pay.payos.vn/web/fixture-786',
      )
    })

    // First foreground return: still PENDING -> stays locked!
    await act(async () => {
      appStateListener?.('background')
      appStateListener?.('active')
    })

    await waitFor(() => {
      expect(getPaymentMock).toHaveBeenCalledWith(PAYMENT_ID_1)
    })
    expect(screen.getByTestId('locked-preview-panel')).toBeTruthy()
    expect(onContinueToPlan).not.toHaveBeenCalled()

    // Second foreground return: server settles SUCCEEDED + ACTIVE PLUS
    getEntitlementMock.mockResolvedValue(
      makeEntitlement({
        packageCode: 'PLUS',
        entitlementState: 'ACTIVE',
        supportPlanEnabled: true,
        source: 'PAID',
      }),
    )

    await act(async () => {
      appStateListener?.('background')
      appStateListener?.('active')
    })

    await waitFor(() => {
      expect(screen.getByTestId('support-plan-upgrade-confirmed')).toBeTruthy()
    })
    // Must NEVER auto-create or auto-continue to Care SupportPlan without explicit tap.
    expect(onContinueToPlan).not.toHaveBeenCalled()

    await fireEvent.press(
      screen.getByTestId('upgrade-confirmed-continue-button'),
    )
    expect(onContinueToPlan).toHaveBeenCalledWith({
      packageCode: 'PLUS',
      entitlementState: 'ACTIVE',
      supportPlanEnabled: true,
      entitlementVerified: true,
      canCreatePlan: true,
      accessMode: 'full-create-and-read',
      careOwnershipVerified: false,
      hasOwnedPlanOrHistory: false,
      upgradedNow: true,
      origin,
    })
  })

  it('shows failed payment notice, keeps Plan locked when checkout is disabled, and fails closed on 503 with retry recovery', async () => {
    const getEntitlementMock = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Consultation down',
        }),
      )
      .mockResolvedValueOnce(makeEntitlement())

    const api = makeApi({
      getEntitlement: getEntitlementMock,
      getServicePlans: jest
        .fn()
        .mockResolvedValue(makeCatalogue({ checkoutEnabled: false })),
      getPaymentHistory: jest.fn().mockResolvedValue({
        items: [
          makePayment({
            status: 'FAILED',
            terminalReason: 'CANCELLED',
            failedAt: '2026-11-15T10:02:00Z',
          }),
        ],
        count: 1,
        generatedAt: '2026-11-15T10:02:00Z',
      }),
    })

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-example-banner')).toBeNull()

    await fireEvent.press(
      screen.getByTestId('support-plan-access-retry-button'),
    )

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-payment-status')).toBeTruthy()
    })
    expect(
      screen.getByText('Giao dịch đã được huỷ trước khi hoàn tất.'),
    ).toBeTruthy()
    expect(
      screen.getByTestId('locked-preview-checkout-unavailable'),
    ).toBeTruthy()
    expect(screen.queryByTestId('locked-preview-upgrade-button')).toBeNull()
  })

  it('enforces clinical safety override above all entitlement states', async () => {
    const api = makeApi()
    const onNavigateSafety = jest.fn()

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={api}
          safetyOverride
          subject={USER_A_SUBJECT}
          onNavigateSafety={onNavigateSafety}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('support-plan-safety-override')).toBeTruthy()
    })
    expect(api.getEntitlement).not.toHaveBeenCalled()
    expect(screen.queryByTestId('locked-preview-example-banner')).toBeNull()

    await fireEvent.press(screen.getByTestId('safety-override-safety-cta'))
    expect(onNavigateSafety).toHaveBeenCalledTimes(1)
  })

  it('isolates entitlement cache on account switch and surfaces offline retry notice cleanly', async () => {
    const queryClient = makeQueryClient()
    const apiA = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      ),
    })
    const apiB = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          accountId: USER_B_SUBJECT,
          packageCode: 'FREE',
          entitlementState: 'DEFAULT_FREE',
          supportPlanEnabled: false,
        }),
      ),
    })

    const view = await render(
      <QueryClientProvider client={queryClient}>
        <SupportPlanAccessGate api={apiA} subject={USER_A_SUBJECT}>
          {() => <Text testID="unlocked-a">A unlocked</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('unlocked-a')).toBeTruthy()
    })

    await view.rerender(
      <QueryClientProvider client={queryClient}>
        <SupportPlanAccessGate api={apiB} offline subject={USER_B_SUBJECT}>
          {() => <Text testID="unlocked-b">B unlocked</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('unlocked-a')).toBeNull()
    expect(screen.queryByTestId('unlocked-b')).toBeNull()
    expect(screen.getByText('Thiết bị đang ngoại tuyến')).toBeTruthy()

    await view.rerender(
      <QueryClientProvider client={queryClient}>
        <SupportPlanAccessGate
          api={apiB}
          offline={false}
          subject={USER_B_SUBJECT}
        >
          {() => <Text testID="unlocked-b">B unlocked</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-panel')).toBeTruthy()
    })
  })

  it('F1: revokes cached PLUS immediately on offline, reconnect, AppState 503, and preserves owned read continuity without canCreatePlan', async () => {
    const queryClient = makeQueryClient()
    const getEntitlementMock = jest
      .fn()
      .mockResolvedValueOnce(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      )
      .mockResolvedValueOnce(makeEntitlement({ accountId: USER_A_SUBJECT }))
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Temporary outage',
        }),
      )

    const api = makeApi({ getEntitlement: getEntitlementMock })
    const view = await render(
      <QueryClientProvider client={queryClient}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="plan-ctx">
              {`CREATE:${ctx.canCreatePlan}:VERIFIED:${ctx.entitlementVerified}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('CREATE:true:VERIFIED:true')).toBeTruthy()
    })

    // Going offline MUST NOT leak cached PLUS entitlement.
    await view.rerender(
      <QueryClientProvider client={queryClient}>
        <SupportPlanAccessGate api={api} offline subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="plan-ctx">
              {`CREATE:${ctx.canCreatePlan}:VERIFIED:${ctx.entitlementVerified}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('plan-ctx')).toBeNull()

    // Reconnect forces fresh verification; Consultation downgraded to FREE -> locks cleanly.
    await view.rerender(
      <QueryClientProvider client={queryClient}>
        <SupportPlanAccessGate
          api={api}
          offline={false}
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="plan-ctx">Should stay locked</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-panel')).toBeTruthy()
    })
    expect(screen.queryByTestId('plan-ctx')).toBeNull()

    // Owned Care Plan/history remains readable under 503 with canCreatePlan: false.
    const ownedView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={makeApi({
            getEntitlement: jest.fn().mockRejectedValue(
              new ApiError({
                status: 503,
                code: 'HTTP_503',
                message: 'Down',
              }),
            ),
          })}
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT)}
          subject={USER_A_SUBJECT}
        >
          {(ctx) => (
            <Text testID="owned-unverified">
              {`OWNED_CREATE:${ctx.canCreatePlan}:VERIFIED:${ctx.entitlementVerified}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByTestId('support-plan-unverified-owned-banner'),
      ).toBeTruthy()
    })
    expect(screen.getByText('OWNED_CREATE:false:VERIFIED:false')).toBeTruthy()
    await ownedView.unmount()

    // AppState resume 503 after active PLUS must fail closed.
    const resumeQueryClient = makeQueryClient()
    const resumeEntitlementMock = jest
      .fn()
      .mockResolvedValueOnce(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
        }),
      )
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'HTTP_503',
          message: 'Consultation down',
        }),
      )
    await render(
      <QueryClientProvider client={resumeQueryClient}>
        <SupportPlanAccessGate
          api={makeApi({ getEntitlement: resumeEntitlementMock })}
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="resume-unlocked">Unlocked</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('resume-unlocked')).toBeTruthy()
    })
    await act(async () => {
      appStateListener?.('background')
      appStateListener?.('active')
    })
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('resume-unlocked')).toBeNull()
  })

  it('F2: blocks double-tap concurrency, preserves Idempotency-Key across timeout/retry, adopts pending /payments row, rotates key after terminal failure, and clears key on account switch', async () => {
    let resolveDeferredCheckout:
      ((p: ReturnType<typeof makePayment>) => void) | undefined
    const startCheckoutMock = jest.fn().mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveDeferredCheckout = resolve
        }),
    )

    const apiDoubleTap = makeApi({ startCheckout: startCheckoutMock })
    let triggerConcurrentUpgrade: (() => Promise<void>) | undefined
    function ConcurrentCheckoutHarness() {
      const controller = useSupportPlanAccess({
        api: apiDoubleTap,
        subject: USER_A_SUBJECT,
      })
      triggerConcurrentUpgrade = controller.startPlusUpgrade
      const ready =
        controller.resolved.kind === 'locked-preview' &&
        controller.resolved.checkout.available
      return (
        <Text testID="harness-status">
          {`${controller.resolved.kind}:${ready}`}
        </Text>
      )
    }
    const doubleTapView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <ConcurrentCheckoutHarness />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('locked-preview:true')).toBeTruthy()
    })

    // Fire two synchronous same-frame calls before first resolves: only 1 POST must occur.
    await act(async () => {
      void triggerConcurrentUpgrade?.()
      void triggerConcurrentUpgrade?.()
    })
    expect(startCheckoutMock).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveDeferredCheckout?.(makePayment({ status: 'PENDING' }))
    })
    await doubleTapView.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()

    // Timeout keeps exact same Idempotency-Key and replays POST /subscriptions/checkout directly on retry.
    const events: string[] = []
    const timeoutStartMock = jest
      .fn()
      .mockImplementationOnce(async () => {
        events.push('checkout:1')
        throw new ApiError({ code: 'REQUEST_TIMEOUT', message: 'Timeout' })
      })
      .mockImplementationOnce(async () => {
        events.push('checkout:2')
        return makePayment({ status: 'PENDING' })
      })
    const timeoutApi = makeApi({
      startCheckout: timeoutStartMock,
    })

    const timeoutView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={timeoutApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })

    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-checkout-error')).toBeTruthy()
    })
    expect(screen.getByText(/giữ nguyên mã idempotency/i)).toBeTruthy()

    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(timeoutStartMock).toHaveBeenCalledTimes(2)
    })
    expect(events).toEqual(['checkout:1', 'checkout:2'])
    const firstKey = timeoutStartMock.mock.calls[0]?.[1]
    const replayKey = timeoutStartMock.mock.calls[1]?.[1]
    expect(firstKey).toBe(replayKey)

    // Account switch after uncertain attempt clears user A key/state for user B.
    const apiSwitchB = makeApi({
      getEntitlement: jest
        .fn()
        .mockResolvedValue(makeEntitlement({ accountId: USER_B_SUBJECT })),
    })
    await timeoutView.rerender(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={apiSwitchB} subject={USER_B_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(apiSwitchB.startCheckout).toHaveBeenCalledTimes(1)
    })
    expect((apiSwitchB.startCheckout as jest.Mock).mock.calls[0]?.[1]).not.toBe(
      firstKey,
    )
    await timeoutView.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()
  })

  it('F3: never confirms upgrade from unconfirmed payment even if ACTIVE entitlement returns, or when SUCCEEDED payment lacks Consultation ACTIVE verification, and discards stale cross-account responses', async () => {
    const preExistingEntitlementMock = jest
      .fn()
      .mockResolvedValueOnce(makeEntitlement())
      .mockResolvedValueOnce(
        makeEntitlement({
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
        }),
      )
    const apiPreExisting = makeApi({
      getEntitlement: preExistingEntitlementMock,
      startCheckout: jest
        .fn()
        .mockResolvedValue(makePayment({ status: 'PENDING' })),
      getPayment: jest
        .fn()
        .mockResolvedValue(makePayment({ status: 'PENDING' })),
    })

    const v1 = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={apiPreExisting} subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="owned-after-pending">
              {`UPGRADED_NOW:${ctx.upgradedNow}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-payment-status')).toBeTruthy()
    })

    // Payment is STILL PENDING while Consultation says ACTIVE -> must NOT show upgrade-confirmed!
    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(screen.getByText('UPGRADED_NOW:false')).toBeTruthy()
    })
    expect(screen.queryByTestId('support-plan-upgrade-confirmed')).toBeNull()
    await v1.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()

    // Settled SUCCEEDED payment + 503 entitlement MUST keep plan unavailable (never unlocked).
    const lagEntitlementMock = jest
      .fn()
      .mockResolvedValueOnce(makeEntitlement())
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'HTTP_503',
          message: 'Delay',
        }),
      )
    const lagApi = makeApi({
      getEntitlement: lagEntitlementMock,
      startCheckout: jest
        .fn()
        .mockResolvedValue(makePayment({ status: 'PENDING' })),
      getPayment: jest.fn().mockResolvedValue(
        makePayment({
          status: 'SUCCEEDED',
          paidAt: '2026-11-15T10:05:00Z',
        }),
      ),
    })
    const v2 = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={lagApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-payment-status')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('support-plan-upgrade-confirmed')).toBeNull()
    await v2.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()

    // Stale async response after USER_A -> USER_B switch must be discarded cleanly.
    let resolveUserACheckout:
      ((p: ReturnType<typeof makePayment>) => void) | undefined
    const apiUserA = makeApi({
      startCheckout: jest.fn().mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUserACheckout = resolve
          }),
      ),
    })
    const apiUserB = makeApi({
      getEntitlement: jest
        .fn()
        .mockResolvedValue(makeEntitlement({ accountId: USER_B_SUBJECT })),
    })
    const sharedQc = makeQueryClient()
    const switchView = await render(
      <QueryClientProvider client={sharedQc}>
        <SupportPlanAccessGate api={apiUserA} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await switchView.rerender(
      <QueryClientProvider client={sharedQc}>
        <SupportPlanAccessGate api={apiUserB} subject={USER_B_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await act(async () => {
      resolveUserACheckout?.(makePayment({ status: 'PENDING' }))
    })
    expect(screen.queryByTestId('locked-preview-payment-status')).toBeNull()
  })

  it('F4 & F6: renders provider-accurate FAKE UI without PayOS copy/URLs and enforces VietQR text fallback disclaimer for PAYOS', async () => {
    const fakeApi = makeApi({
      getServicePlans: jest
        .fn()
        .mockResolvedValue(makeCatalogue({ paymentProvider: 'FAKE' })),
      startCheckout: jest.fn().mockResolvedValue(
        makePayment({
          provider: 'FAKE',
          checkoutUrl: null,
          qrCode: null,
          bin: null,
          accountNumber: null,
          accountName: null,
          description: null,
        }),
      ),
    })

    const fakeView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={fakeApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    expect(screen.queryAllByText(/PayOS/i)).toHaveLength(0)

    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(
        screen.getByTestId('locked-preview-provider-pending-note'),
      ).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-open-payos-url')).toBeNull()
    expect(screen.queryAllByText(/PayOS/i)).toHaveLength(0)
    await fakeView.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()

    // Tampered MOMO/FAKE URL passed to hook MUST never invoke Linking.openURL.
    const momoPayment = makePayment({
      provider: 'MOMO',
      checkoutUrl: 'https://test.momo.vn/pay',
      status: 'PENDING',
    })
    const momoHookApi = makeApi({
      getPaymentHistory: jest.fn().mockResolvedValue({
        items: [momoPayment],
        count: 1,
        generatedAt: '2026-11-15T10:00:00Z',
      }),
    })
    let openFn: (() => Promise<void>) | undefined
    function HookHarness() {
      const controller = useSupportPlanAccess({
        api: momoHookApi,
        subject: USER_A_SUBJECT,
      })
      openFn = controller.openHostedCheckoutUrl
      return (
        <Text testID="hook-notice">
          {controller.externalCheckoutNotice ?? 'NONE'}
        </Text>
      )
    }
    const harnessView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <HookHarness />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(momoHookApi.getPaymentHistory).toHaveBeenCalled()
    })
    await act(async () => {
      await openFn?.()
    })
    expect(Linking.openURL).not.toHaveBeenCalled()
    await harnessView.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()

    // F6 PAYOS VietQR fields + non-scannable QR disclaimer + allowlisted fallback.
    const payosApi = makeApi({
      getPaymentHistory: jest.fn().mockResolvedValue({
        items: [
          makePayment({
            provider: 'PAYOS',
            amountVnd: 5000,
            amount: 5000,
            expiredAt: '2026-11-15T10:30:00Z',
          }),
        ],
        count: 1,
        generatedAt: '2026-11-15T10:00:00Z',
      }),
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={payosApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-vietqr-note')).toBeTruthy()
    })
    expect(
      screen.getByText(/chưa dựng hình mã QR quét trực tiếp/i),
    ).toBeTruthy()
    expect(screen.getByText('Hạn giao dịch: 2026-11-15T10:30:00Z')).toBeTruthy()
    expect(screen.getByTestId('locked-preview-open-payos-url')).toBeTruthy()
  })

  it('F5: handles rejected promises safely during AppState/retry without stuck flags and falls back cleanly without claiming origin after process kill', async () => {
    const throwingApi = makeApi({
      getEntitlement: jest
        .fn()
        .mockRejectedValue(new Error('Unexpected socket reset')),
    })
    const onNavigateGuide = jest.fn()

    const retryView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={throwingApi}
          subject={USER_A_SUBJECT}
          onNavigateGuide={onNavigateGuide}
        />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    await fireEvent.press(
      screen.getByTestId('support-plan-access-retry-button'),
    )
    await waitFor(() => {
      expect(
        screen.getByTestId('support-plan-access-retry-button').props
          .accessibilityState?.disabled,
      ).not.toBe(true)
    })
    await retryView.unmount()

    // Cold render without in-memory origin falls back without claiming previous step restoration.
    const coldApi = makeApi({
      getEntitlement: jest
        .fn()
        .mockResolvedValueOnce(makeEntitlement())
        .mockResolvedValueOnce(
          makeEntitlement({
            packageCode: 'PLUS',
            entitlementState: 'ACTIVE',
            supportPlanEnabled: true,
          }),
        ),
      startCheckout: jest
        .fn()
        .mockResolvedValue(makePayment({ status: 'PENDING' })),
      getPayment: jest
        .fn()
        .mockResolvedValue(makePayment({ status: 'SUCCEEDED' })),
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={coldApi}
          subject={USER_A_SUBJECT}
          onNavigateGuide={onNavigateGuide}
        />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-reconcile-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-upgrade-confirmed')).toBeTruthy()
    })
    expect(screen.queryByText('Quay lại bước Hướng dẫn trước đó')).toBeNull()
    await fireEvent.press(screen.getByTestId('upgrade-confirmed-guide-cta'))
    expect(onNavigateGuide).toHaveBeenCalledWith(undefined)
  })
})

describe('MB-703 R1 — Cached PLUS entitlement fail-closed lifecycle', () => {
  let appStateListener: ((state: AppStateStatus) => void) | undefined

  beforeEach(() => {
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
    appStateListener = undefined
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation((_event, listener) => {
        appStateListener = listener as (state: AppStateStatus) => void
        return { remove: jest.fn() }
      })
  })

  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
  })

  it('R1.1: never unlocks create from seeded QueryClient PLUS cache while pending or on 503/offline', async () => {
    const seededClient = makeQueryClient()
    seededClient.setQueryData(
      ['support-plan-access', USER_A_SUBJECT, 'entitlement'],
      makeEntitlement({
        accountId: USER_A_SUBJECT,
        packageCode: 'PLUS',
        entitlementState: 'ACTIVE',
        supportPlanEnabled: true,
        source: 'PAID',
      }),
    )

    let rejectLive: ((err: Error) => void) | undefined
    const pendingThenFailApi = makeApi({
      getEntitlement: jest.fn(
        () =>
          new Promise((_, reject) => {
            rejectLive = reject
          }),
      ),
    })

    const onContinueToPlan = jest.fn()
    const v1 = await render(
      <QueryClientProvider client={seededClient}>
        <SupportPlanAccessGate
          api={pendingThenFailApi}
          autoContinue
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        >
          {(ctx) => (
            <Text testID="r1-create-flag">{String(ctx.canCreatePlan)}</Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    // While refetch is still pending: seeded QueryClient PLUS MUST NOT unlock.
    expect(screen.queryByTestId('r1-create-flag')).toBeNull()
    expect(onContinueToPlan).not.toHaveBeenCalled()

    await act(async () => {
      rejectLive?.(
        new ApiError({ status: 503, code: 'HTTP_503', message: 'Down' }),
      )
    })

    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('r1-create-flag')).toBeNull()
    await v1.unmount()

    // Even with offline + seeded PLUS cache, fail closed; VERIFIED_OWNED stays read-only only.
    const v2 = await render(
      <QueryClientProvider client={seededClient}>
        <SupportPlanAccessGate
          api={pendingThenFailApi}
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT)}
          offline
          subject={USER_A_SUBJECT}
        >
          {(ctx) => (
            <Text testID="r1-owned-ro">
              {`MODE:${ctx.accessMode}:CREATE:${ctx.canCreatePlan}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('MODE:read-only-owned:CREATE:false')).toBeTruthy()
    })
    await v2.unmount()

    // When isFetching=false (offline or post-error with cached PLUS in QueryClient), NEVER treat cache as verified.
    await render(
      <QueryClientProvider client={seededClient}>
        <SupportPlanAccessGate api={makeApi()} offline subject={USER_A_SUBJECT}>
          {() => <Text testID="r1-should-never-open">Should not open</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('r1-should-never-open')).toBeNull()
    expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
  })

  it('R1.2: revokes PLUS across unmount/remount sharing the same QueryClient when new live verification fails', async () => {
    const sharedClient = makeQueryClient()
    const getEntitlement = jest
      .fn()
      .mockResolvedValueOnce(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      )
      .mockRejectedValueOnce(
        new ApiError({ status: 503, code: 'HTTP_503', message: 'Unavailable' }),
      )

    const api = makeApi({ getEntitlement })
    const firstMount = await render(
      <QueryClientProvider client={sharedClient}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="r1-first-open">{String(ctx.canCreatePlan)}</Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('true')).toBeTruthy()
    })
    await firstMount.unmount()

    await render(
      <QueryClientProvider client={sharedClient}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="r1-second-open">{String(ctx.canCreatePlan)}</Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('r1-second-open')).toBeNull()
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('r1-second-open')).toBeNull()
  })

  it('R1.3: switching from PLUS account A to FREE account B never flashes A entitlement and locks B after live check', async () => {
    const sharedClient = makeQueryClient()
    let resolveB: ((e: ReturnType<typeof makeEntitlement>) => void) | undefined
    const apiA = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      ),
    })
    const apiB = makeApi({
      getEntitlement: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveB = resolve
          }),
      ),
    })

    const view = await render(
      <QueryClientProvider client={sharedClient}>
        <SupportPlanAccessGate api={apiA} subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="r1-switch-plan">{String(ctx.canCreatePlan)}</Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('true')).toBeTruthy()
    })

    await view.rerender(
      <QueryClientProvider client={sharedClient}>
        <SupportPlanAccessGate api={apiB} subject={USER_B_SUBJECT}>
          {(ctx) => (
            <Text testID="r1-switch-plan">{String(ctx.canCreatePlan)}</Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    expect(screen.queryByTestId('r1-switch-plan')).toBeNull()

    await act(async () => {
      resolveB?.(makeEntitlement({ accountId: USER_B_SUBJECT }))
    })
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-panel')).toBeTruthy()
    })
    expect(screen.queryByTestId('r1-switch-plan')).toBeNull()
  })

  it('R1.4: suspends live PLUS immediately during AppState foreground resume while refetch is still pending', async () => {
    let resolveResume:
      ((e: ReturnType<typeof makeEntitlement>) => void) | undefined
    const getEntitlement = jest
      .fn()
      .mockResolvedValueOnce(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      )
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveResume = resolve
          }),
      )

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={makeApi({ getEntitlement })}
          subject={USER_A_SUBJECT}
        >
          {(ctx) => (
            <Text testID="r1-live-plus">{String(ctx.canCreatePlan)}</Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('true')).toBeTruthy()
    })

    await act(async () => {
      appStateListener?.('background')
      appStateListener?.('active')
    })

    // While live re-verification is still in flight, old PLUS MUST NOT stay unlocked.
    expect(screen.queryByTestId('r1-live-plus')).toBeNull()
    expect(screen.getByTestId('support-plan-access-loading')).toBeTruthy()

    await act(async () => {
      resolveResume?.(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('true')).toBeTruthy()
    })
  })

  it('R1.5: revokes create immediately on 503 during foreground resume or retryEntitlementCheck while honoring Care read-only proof', async () => {
    const getEntitlement = jest
      .fn()
      .mockResolvedValueOnce(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      )
      .mockRejectedValueOnce(
        new ApiError({ status: 503, code: 'HTTP_503', message: 'Down' }),
      )

    const api = makeApi({ getEntitlement })
    const verifiedCare = await makeVerifiedCareOwnership(USER_A_SUBJECT)
    let triggerRetry: (() => Promise<void>) | undefined
    function RetryHarness() {
      const controller = useSupportPlanAccess({
        api,
        subject: USER_A_SUBJECT,
        careOwnership: verifiedCare,
      })
      triggerRetry = controller.retryEntitlementCheck
      return (
        <Text testID="r1-retry-state">
          {controller.resolved.kind === 'owned-plan'
            ? `KIND:owned-plan:MODE:${controller.resolved.context.accessMode}:CREATE:${controller.resolved.context.canCreatePlan}`
            : `KIND:${controller.resolved.kind}`}
        </Text>
      )
    }

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <RetryHarness />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(
        screen.getByText(
          'KIND:owned-plan:MODE:full-create-and-read:CREATE:true',
        ),
      ).toBeTruthy()
    })

    await act(async () => {
      await triggerRetry?.()
    })

    await waitFor(() => {
      expect(
        screen.getByText('KIND:owned-plan:MODE:read-only-owned:CREATE:false'),
      ).toBeTruthy()
    })
  })
})

describe('MB-703 R2 — Strict checkout attempt & payment correlation', () => {
  beforeEach(() => {
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
    let uuidSeq = 100
    jest
      .spyOn(Crypto, 'randomUUID')
      .mockImplementation(
        () =>
          `00000000-0000-4000-9000-${String(uuidSeq++).padStart(12, '0')}` as ReturnType<
            typeof Crypto.randomUUID
          >,
      )
  })

  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
  })

  it('R2.1: reconcileStatus never attaches an unrelated /payments PENDING item onto an uncertain attempt or idempotencyKey', async () => {
    const foreignPending = makePayment({
      paymentId: PAYMENT_ID_2,
      status: 'PENDING',
    })
    const startCheckout = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'REQUEST_TIMEOUT', message: 'Timeout' }),
      )
    const getPaymentHistory = jest
      .fn()
      .mockResolvedValueOnce({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:00:00Z',
      })
      .mockResolvedValue({
        items: [foreignPending],
        count: 1,
        generatedAt: '2026-11-15T10:01:00Z',
      })
    const api = makeApi({ startCheckout, getPaymentHistory })

    let controllerRef: ReturnType<typeof useSupportPlanAccess> | undefined
    function Harness() {
      const controller = useSupportPlanAccess({ api, subject: USER_A_SUBJECT })
      controllerRef = controller
      const ready =
        controller.resolved.kind === 'locked-preview' &&
        controller.resolved.checkout.available
      return (
        <Text testID="r2-1-kind">{`${controller.resolved.kind}:${ready}`}</Text>
      )
    }

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <Harness />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('locked-preview:true')).toBeTruthy()
    })

    await act(async () => {
      await controllerRef?.startPlusUpgrade()
    })
    const keyBefore = getCheckoutAttempt(USER_A_SUBJECT)?.idempotencyKey
    expect(keyBefore).toBeTruthy()
    expect(getCheckoutAttempt(USER_A_SUBJECT)?.status).toBe('uncertain')

    await act(async () => {
      await controllerRef?.reconcileStatus()
    })

    expect(api.getPayment).not.toHaveBeenCalled()
    expect(getCheckoutAttempt(USER_A_SUBJECT)).toMatchObject({
      status: 'uncertain',
      idempotencyKey: keyBefore,
      paymentId: undefined,
    })
    expect(getPendingUpgradeIntent(USER_A_SUBJECT)).toBeNull()
  })

  it('R2.2: direct retry after uncertain timeout replays exact Idempotency-Key and handles both PlanPayment and 409 SUBSCRIPTION_PAYMENT_PENDING', async () => {
    const foreignPending = makePayment({
      paymentId: PAYMENT_ID_2,
      status: 'PENDING',
    })
    const replayPayment = makePayment({
      paymentId: PAYMENT_ID_1,
      status: 'PENDING',
    })
    const startCheckout = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'REQUEST_TIMEOUT', message: 'Timeout' }),
      )
      .mockResolvedValueOnce(replayPayment)
    const getPaymentHistory = jest
      .fn()
      .mockResolvedValueOnce({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:00:00Z',
      })
      .mockResolvedValue({
        items: [foreignPending],
        count: 1,
        generatedAt: '2026-11-15T10:01:00Z',
      })
    const apiSuccess = makeApi({ startCheckout, getPaymentHistory })

    let c1: ReturnType<typeof useSupportPlanAccess> | undefined
    function ReplayHarness({ api }: Readonly<{ api: SupportPlanAccessApi }>) {
      const controller = useSupportPlanAccess({ api, subject: USER_A_SUBJECT })
      c1 = controller
      const ready =
        controller.resolved.kind === 'locked-preview' &&
        controller.resolved.checkout.available
      return (
        <Text testID="r2-2-err">
          {`${ready}:${controller.checkoutError?.code ?? 'NONE'}`}
        </Text>
      )
    }

    const vReplay = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <ReplayHarness api={apiSuccess} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('true:NONE')).toBeTruthy()
    })
    await act(async () => {
      await c1?.startPlusUpgrade()
    })
    const preservedKey = getCheckoutAttempt(USER_A_SUBJECT)?.idempotencyKey
    expect(preservedKey).toBeTruthy()

    // Even after /payments reports a foreign PENDING row during reconcile, retrying replays SAME_KEY directly.
    await act(async () => {
      await c1?.reconcileStatus()
    })
    await act(async () => {
      await c1?.startPlusUpgrade()
    })
    expect(startCheckout).toHaveBeenCalledTimes(2)
    expect(startCheckout.mock.calls[1]).toEqual([
      PLUS_PLAN_VERSION_ID,
      preservedKey,
    ])
    expect(getCheckoutAttempt(USER_A_SUBJECT)).toMatchObject({
      status: 'pending',
      paymentId: PAYMENT_ID_1,
      idempotencyKey: preservedKey,
    })
    await vReplay.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()

    // Outcome B: replay returns 409 SUBSCRIPTION_PAYMENT_PENDING
    const conflictStart = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'REQUEST_TIMEOUT', message: 'Timeout' }),
      )
      .mockRejectedValueOnce(
        new ApiError({
          status: 409,
          code: 'SUBSCRIPTION_PAYMENT_PENDING',
          message: 'Đã có giao dịch chờ xác nhận.',
        }),
      )
    const conflictHistory = jest
      .fn()
      .mockResolvedValueOnce({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:00:00Z',
      })
      .mockResolvedValue({
        items: [foreignPending],
        count: 1,
        generatedAt: '2026-11-15T10:01:00Z',
      })
    const conflictApi = makeApi({
      startCheckout: conflictStart,
      getPaymentHistory: conflictHistory,
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <ReplayHarness api={conflictApi} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('true:NONE')).toBeTruthy()
    })
    await act(async () => {
      await c1?.startPlusUpgrade()
    })
    const conflictKey = getCheckoutAttempt(USER_A_SUBJECT)?.idempotencyKey
    await act(async () => {
      await c1?.startPlusUpgrade()
    })
    expect(conflictStart).toHaveBeenCalledTimes(2)
    expect(conflictStart.mock.calls[1]?.[1]).toBe(conflictKey)
    expect(screen.getByText('true:SUBSCRIPTION_PAYMENT_PENDING')).toBeTruthy()
    expect(getCheckoutAttempt(USER_A_SUBJECT)).toBeNull()
  })

  it('R2.3: blocks concurrent double-tap so startCheckout fires only once', async () => {
    let resolveDeferred:
      ((p: ReturnType<typeof makePayment>) => void) | undefined
    const startCheckout = jest.fn(
      () =>
        new Promise<ReturnType<typeof makePayment>>((resolve) => {
          resolveDeferred = resolve
        }),
    )
    const api = makeApi({ startCheckout })
    let startFn: (() => Promise<void>) | undefined
    function DoubleTapHarness() {
      const controller = useSupportPlanAccess({ api, subject: USER_A_SUBJECT })
      startFn = controller.startPlusUpgrade
      const ready =
        controller.resolved.kind === 'locked-preview' &&
        controller.resolved.checkout.available
      return <Text testID="r2-3">{`${controller.resolved.kind}:${ready}`}</Text>
    }
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <DoubleTapHarness />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('locked-preview:true')).toBeTruthy()
    })
    await act(async () => {
      void startFn?.()
      void startFn?.()
      void startFn?.()
    })
    expect(startCheckout).toHaveBeenCalledTimes(1)
    await act(async () => {
      resolveDeferred?.(makePayment({ status: 'PENDING' }))
    })
  })

  it('R2.4 & R2.5: blocks duplicate startCheckout after restart/TTL expiry with server PENDING, and supports reconcile recovery to ACTIVE or FAILED', async () => {
    // Subcase A: App restart (no in-memory attempt) + server PENDING -> blocker UI, no new startCheckout, reconcile -> SUCCEEDED + ACTIVE
    const pendingRow = makePayment({
      paymentId: PAYMENT_ID_2,
      status: 'PENDING',
    })
    const getEntitlement = jest
      .fn()
      .mockResolvedValueOnce(makeEntitlement())
      .mockResolvedValueOnce(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      )
    const getPaymentHistory = jest.fn().mockResolvedValue({
      items: [pendingRow],
      count: 1,
      generatedAt: '2026-11-15T10:00:00Z',
    })
    const getPayment = jest.fn().mockResolvedValue(
      makePayment({
        paymentId: PAYMENT_ID_2,
        status: 'SUCCEEDED',
        paidAt: '2026-11-15T10:05:00Z',
      }),
    )
    const startCheckout = jest.fn()
    const restartApi = makeApi({
      getEntitlement,
      getPaymentHistory,
      getPayment,
      startCheckout,
    })

    const vRestart = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={restartApi} subject={USER_A_SUBJECT}>
          {(ctx) => (
            <Text testID="r2-5-recovered">
              {`MODE:${ctx.accessMode}:CREATE:${ctx.canCreatePlan}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-pending-blocker')).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-upgrade-button')).toBeNull()
    expect(startCheckout).not.toHaveBeenCalled()

    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(
        screen.getByText('MODE:full-create-and-read:CREATE:true'),
      ).toBeTruthy()
    })
    expect(getPayment).toHaveBeenCalledWith(PAYMENT_ID_2)
    expect(startCheckout).not.toHaveBeenCalled()
    await vRestart.unmount()

    // Subcase B: Reconcile after restart resolves FAILED -> re-opens checkout CTA safely; plus TTL expiry after uncertain attempt blocks duplicate charge.
    const failedRecoveryApi = makeApi({
      getPaymentHistory: jest
        .fn()
        .mockResolvedValueOnce({
          items: [pendingRow],
          count: 1,
          generatedAt: '2026-11-15T10:00:00Z',
        })
        .mockResolvedValue({
          items: [
            makePayment({
              paymentId: PAYMENT_ID_2,
              status: 'FAILED',
              terminalReason: 'EXPIRED',
            }),
          ],
          count: 1,
          generatedAt: '2026-11-15T10:20:00Z',
        }),
      getPayment: jest.fn().mockResolvedValue(
        makePayment({
          paymentId: PAYMENT_ID_2,
          status: 'FAILED',
          terminalReason: 'EXPIRED',
        }),
      ),
    })

    const vFailed = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={failedRecoveryApi}
          subject={USER_A_SUBJECT}
        />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-pending-blocker')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-pending-blocker')).toBeNull()
    await vFailed.unmount()

    // Subcase C: TTL expiry in-session after uncertain attempt checks /payments and blocks new POST if PENDING exists.
    let nowMs = 1_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs)
    const ttlStart = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({ code: 'REQUEST_TIMEOUT', message: 'Timeout' }),
      )
    const ttlHistory = jest
      .fn()
      .mockResolvedValueOnce({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:00:00Z',
      })
      .mockResolvedValue({
        items: [makePayment({ paymentId: PAYMENT_ID_2, status: 'PENDING' })],
        count: 1,
        generatedAt: '2026-11-15T10:35:00Z',
      })
    const ttlApi = makeApi({
      startCheckout: ttlStart,
      getPaymentHistory: ttlHistory,
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={ttlApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-checkout-error')).toBeTruthy()
    })
    nowMs += 31 * 60 * 1000
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(
        screen.getByText('Mã: PENDING_PAYMENT_RECOVERY_REQUIRED'),
      ).toBeTruthy()
    })
    expect(ttlStart).toHaveBeenCalledTimes(1)
  })

  it('R2.6 & R2.7: reconciles exact paymentId from startCheckout and fails closed on payment identity mismatch', async () => {
    const mismatchStart = jest.fn().mockResolvedValue(
      makePayment({
        paymentId: PAYMENT_ID_1,
        planVersionId: '99999999-9999-4999-8999-999999999999',
        status: 'PENDING',
      }),
    )
    const apiMismatchStart = makeApi({ startCheckout: mismatchStart })
    const vStart = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={apiMismatchStart}
          subject={USER_A_SUBJECT}
        />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByText('Mã: PAYMENT_IDENTITY_MISMATCH')).toBeTruthy()
    })
    expect(getPendingUpgradeIntent(USER_A_SUBJECT)).toBeNull()
    await vStart.unmount()

    // Reconcile mismatch on getPayment(trackedId) returning wrong paymentId
    const reconcileMismatchApi = makeApi({
      startCheckout: jest
        .fn()
        .mockResolvedValue(
          makePayment({ paymentId: PAYMENT_ID_1, status: 'PENDING' }),
        ),
      getPayment: jest
        .fn()
        .mockResolvedValue(
          makePayment({ paymentId: PAYMENT_ID_2, status: 'SUCCEEDED' }),
        ),
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={reconcileMismatchApi}
          subject={USER_A_SUBJECT}
        />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-reconcile-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(reconcileMismatchApi.getPayment).toHaveBeenCalledWith(PAYMENT_ID_1)
      expect(screen.getByText('Mã: PAYMENT_IDENTITY_MISMATCH')).toBeTruthy()
    })
    expect(screen.queryByTestId('support-plan-upgrade-confirmed')).toBeNull()
  })
})

describe('MB-703 R3 — Verified Care ownership & read-only contract', () => {
  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
  })

  it('R3.1 & R3.2: grants full-create-and-read when Consultation ACTIVE and allows autoContinue strictly when verified canCreatePlan=true', async () => {
    const api = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      ),
    })
    const onContinueToPlan = jest.fn()

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={api}
          autoContinue
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(onContinueToPlan).toHaveBeenCalledTimes(1)
    })
    expect(onContinueToPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        accessMode: 'full-create-and-read',
        canCreatePlan: true,
        entitlementVerified: true,
      }),
    )
  })

  it('R3.3: Care VERIFIED_OWNED with EXPIRED or UNAVAILABLE opens read-only mode with canCreatePlan=false and suppresses autoContinue', async () => {
    const expiredApi = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'EXPIRED',
          supportPlanEnabled: false,
        }),
      ),
    })
    const onContinueToPlan = jest.fn()

    const v1 = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={expiredApi}
          autoContinue
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT, {
            hasCurrentPlan: false,
            hasHistory: true,
          })}
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('owned-plan-read-only-badge')).toBeTruthy()
    })
    expect(onContinueToPlan).not.toHaveBeenCalled()
    await fireEvent.press(screen.getByTestId('owned-plan-continue-button'))
    expect(onContinueToPlan).toHaveBeenCalledWith(
      expect.objectContaining({
        accessMode: 'read-only-owned',
        canCreatePlan: false,
        careOwnershipVerified: true,
      }),
    )
    await v1.unmount()

    const unavailableApi = makeApi({
      getEntitlement: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ status: 503, code: 'HTTP_503', message: 'Down' }),
        ),
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={unavailableApi}
          autoContinue
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT)}
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        >
          {(ctx) => (
            <Text testID="r3-ro-child">
              {`${ctx.accessMode}:${ctx.canCreatePlan}:${ctx.careOwnershipVerified}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByText('read-only-owned:false:true')).toBeTruthy()
    })
    expect(onContinueToPlan).toHaveBeenCalledTimes(1)
  })

  it('R3.4 & R3.5: fails closed on forged boolean hasOwnedPlanOrHistory, wrong-subject proof, or malformed proof without rendering children or calling onContinueToPlan', async () => {
    const expiredApi = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'EXPIRED',
          supportPlanEnabled: false,
        }),
      ),
    })
    const onContinueToPlan = jest.fn()

    const forgedView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={expiredApi}
          autoContinue
          hasOwnedPlanOrHistory
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="r3-forged-child">Bypass</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('r3-forged-child')).toBeNull()
    expect(onContinueToPlan).not.toHaveBeenCalled()
    await forgedView.unmount()

    // Wrong-subject CareOwnedPlanProof fails closed.
    const wrongSubjectView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={expiredApi}
          autoContinue
          careOwnership={await makeVerifiedCareOwnership(USER_B_SUBJECT)}
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="r3-wrong-subj-child">Bypass</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('r3-wrong-subj-child')).toBeNull()
    expect(onContinueToPlan).not.toHaveBeenCalled()
    await wrongSubjectView.unmount()

    // Malformed proof object also fails closed.
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={expiredApi}
          careOwnership={
            {
              status: 'VERIFIED_OWNED',
              subject: USER_A_SUBJECT,
              source: 'FAKE_SOURCE',
              hasCurrentPlan: true,
            } as unknown as CareOwnedPlanProof
          }
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="r3-malformed-child">Bypass</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('r3-malformed-child')).toBeNull()
    expect(onContinueToPlan).not.toHaveBeenCalled()
  })

  it('R3.6 & R3.7: safetyOverride overrides verified PLUS and Care ownership, and 401/missing auth fails closed even with VERIFIED_OWNED proof', async () => {
    const plusApi = makeApi({
      getEntitlement: jest.fn().mockResolvedValue(
        makeEntitlement({
          accountId: USER_A_SUBJECT,
          packageCode: 'PLUS',
          entitlementState: 'ACTIVE',
          supportPlanEnabled: true,
          source: 'PAID',
        }),
      ),
    })
    const onContinueToPlan = jest.fn()

    const safetyView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={plusApi}
          autoContinue
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT)}
          onContinueToPlan={onContinueToPlan}
          safetyOverride
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="r3-safety-child">Should stay hidden</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-safety-override')).toBeTruthy()
    })
    expect(screen.queryByTestId('r3-safety-child')).toBeNull()
    expect(onContinueToPlan).not.toHaveBeenCalled()
    await safetyView.unmount()

    // 401 fails closed even with VERIFIED_OWNED Care ownership
    const unauthorizedApi = makeApi({
      getEntitlement: jest.fn().mockRejectedValue(
        new ApiError({
          status: 401,
          code: 'HTTP_401',
          message: 'Unauthorized',
        }),
      ),
    })
    const authView = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={unauthorizedApi}
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT)}
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="r3-auth-child">Hidden</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    })
    expect(screen.queryByTestId('r3-auth-child')).toBeNull()
    await authView.unmount()

    // Missing session subject fails closed
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={plusApi}
          careOwnership={await makeVerifiedCareOwnership(USER_A_SUBJECT)}
          subject={null}
        >
          {() => <Text testID="r3-nosubj-child">Hidden</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )
    expect(screen.getByTestId('support-plan-access-unavailable')).toBeTruthy()
    expect(screen.queryByTestId('r3-nosubj-child')).toBeNull()
  })
})

describe('MB-703 P1 — Cold-start payment-history race & authoritative submit verification', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
    let uuidSeq = 200
    jest
      .spyOn(Crypto, 'randomUUID')
      .mockImplementation(
        () =>
          `00000000-0000-4000-a000-${String(uuidSeq++).padStart(12, '0')}` as ReturnType<
            typeof Crypto.randomUUID
          >,
      )
  })

  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
  })

  it('P1.1 & P1.4: blocks checkout when catalogue resolves before payment history, then allows single checkout once history verifies no PENDING', async () => {
    let resolveHistory:
      | ((value: {
          items: ReturnType<typeof makePayment>[]
          count: number
          generatedAt: string
        }) => void)
      | undefined

    const startCheckout = jest
      .fn()
      .mockResolvedValue(makePayment({ status: 'PENDING' }))
    const getPaymentHistory = jest.fn(
      () =>
        new Promise<{
          items: ReturnType<typeof makePayment>[]
          count: number
          generatedAt: string
        }>((resolve) => {
          resolveHistory = resolve
        }),
    )
    const api = makeApi({ startCheckout, getPaymentHistory })

    let controllerRef: ReturnType<typeof useSupportPlanAccess> | undefined
    function RaceHarness() {
      const controller = useSupportPlanAccess({ api, subject: USER_A_SUBJECT })
      controllerRef = controller
      return <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
    }

    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <RaceHarness />
      </QueryClientProvider>,
    )

    // Catalogue has resolved, but payment history is still in flight -> Upgrade CTA must NOT be available!
    await waitFor(() => {
      expect(api.getServicePlans).toHaveBeenCalled()
      expect(screen.getByText('Mã: PAYMENT_HISTORY_LOADING')).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-upgrade-button')).toBeNull()

    // Even an imperative call to startPlusUpgrade() while history is pending must NOT POST or mint a key.
    await act(async () => {
      await controllerRef?.startPlusUpgrade()
    })
    expect(startCheckout).not.toHaveBeenCalled()
    expect(Crypto.randomUUID).not.toHaveBeenCalled()

    // Once payment history resolves with no PENDING payments, checkout becomes available and posts once.
    await act(async () => {
      resolveHistory?.({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:00:00Z',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(startCheckout).toHaveBeenCalledTimes(1)
    })
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('P1.2 & P1.5: ignores cached empty QueryClient history when fresh history is pending or returns PENDING, showing blocker/reconcile without adopting attempt', async () => {
    const seededClient = makeQueryClient()
    seededClient.setQueryData(
      ['support-plan-access', USER_A_SUBJECT, 'payments'],
      {
        items: [],
        count: 0,
        generatedAt: '2026-11-15T09:00:00Z',
      },
    )

    let resolveFreshHistory:
      | ((value: {
          items: ReturnType<typeof makePayment>[]
          count: number
          generatedAt: string
        }) => void)
      | undefined
    const startCheckout = jest.fn()
    const pendingRow = makePayment({
      paymentId: PAYMENT_ID_2,
      status: 'PENDING',
    })
    const getPaymentHistory = jest.fn(
      () =>
        new Promise<{
          items: ReturnType<typeof makePayment>[]
          count: number
          generatedAt: string
        }>((resolve) => {
          resolveFreshHistory = resolve
        }),
    )
    const getPayment = jest
      .fn()
      .mockResolvedValue(
        makePayment({ paymentId: PAYMENT_ID_2, status: 'PENDING' }),
      )
    const api = makeApi({ startCheckout, getPaymentHistory, getPayment })

    let controllerRef: ReturnType<typeof useSupportPlanAccess> | undefined
    function CachedHistoryHarness() {
      const controller = useSupportPlanAccess({ api, subject: USER_A_SUBJECT })
      controllerRef = controller
      return <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
    }

    await render(
      <QueryClientProvider client={seededClient}>
        <CachedHistoryHarness />
      </QueryClientProvider>,
    )

    // Despite cached empty history in QueryClient, fresh history is still pending -> must NOT allow checkout!
    await waitFor(() => {
      expect(screen.getByText('Mã: PAYMENT_HISTORY_LOADING')).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-upgrade-button')).toBeNull()

    await act(async () => {
      await controllerRef?.startPlusUpgrade()
    })
    expect(startCheckout).not.toHaveBeenCalled()

    // Fresh history resolves with a server PENDING payment.
    await act(async () => {
      resolveFreshHistory?.({
        items: [pendingRow],
        count: 1,
        generatedAt: '2026-11-15T10:00:00Z',
      })
    })

    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-pending-blocker')).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-upgrade-button')).toBeNull()
    // Must NOT auto-adopt the server PENDING payment as a local CheckoutAttemptRecord.
    expect(getCheckoutAttempt(USER_A_SUBJECT)).toBeNull()

    // Reconcile button checks the exact server paymentId via Consultation.
    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(getPayment).toHaveBeenCalledWith(PAYMENT_ID_2)
    })
    expect(startCheckout).not.toHaveBeenCalled()
  })

  it('P1.3 & P1.6: fails closed on payment history 503/timeout with retry recovery, and discards stale in-flight history across account switch', async () => {
    const startCheckout = jest
      .fn()
      .mockResolvedValue(makePayment({ status: 'PENDING' }))
    const getPaymentHistory = jest
      .fn()
      .mockRejectedValueOnce(
        new ApiError({
          status: 503,
          code: 'HTTP_503',
          message: 'Payments history down',
        }),
      )
      .mockResolvedValueOnce({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:02:00Z',
      })
    const api = makeApi({ startCheckout, getPaymentHistory })

    const view = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByText('Mã: PAYMENT_HISTORY_UNAVAILABLE')).toBeTruthy()
    })
    expect(screen.queryByTestId('locked-preview-upgrade-button')).toBeNull()
    expect(startCheckout).not.toHaveBeenCalled()

    // Retry button re-verifies entitlement + catalogue + payment history and unlocks upgrade CTA.
    await fireEvent.press(
      screen.getByTestId('locked-preview-retry-catalogue-button'),
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await view.unmount()

    // P1.6: Account switch while User A's history request is in flight -> User A's PENDING history never leaks into User B.
    let resolveHistoryA:
      | ((value: {
          items: ReturnType<typeof makePayment>[]
          count: number
          generatedAt: string
        }) => void)
      | undefined
    const apiA = makeApi({
      getPaymentHistory: jest.fn(
        () =>
          new Promise((resolve) => {
            resolveHistoryA = resolve
          }),
      ),
    })
    const apiB = makeApi({
      getEntitlement: jest
        .fn()
        .mockResolvedValue(makeEntitlement({ accountId: USER_B_SUBJECT })),
      getPaymentHistory: jest.fn().mockResolvedValue({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:03:00Z',
      }),
    })

    const sharedClient = makeQueryClient()
    const switchView = await render(
      <QueryClientProvider client={sharedClient}>
        <SupportPlanAccessGate api={apiA} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(apiA.getPaymentHistory).toHaveBeenCalled()
    })

    await switchView.rerender(
      <QueryClientProvider client={sharedClient}>
        <SupportPlanAccessGate api={apiB} subject={USER_B_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })

    // Resolve User A's pending payment history late -> User B must NOT see User A's PENDING payment.
    await act(async () => {
      resolveHistoryA?.({
        items: [makePayment({ paymentId: PAYMENT_ID_1, status: 'PENDING' })],
        count: 1,
        generatedAt: '2026-11-15T10:04:00Z',
      })
    })
    expect(screen.queryByTestId('locked-preview-pending-blocker')).toBeNull()
    expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
  })
})

describe('MB-703 P2 — In-flight preparing attempt survival across remount & single-flight idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
    let uuidSeq = 300
    jest
      .spyOn(Crypto, 'randomUUID')
      .mockImplementation(
        () =>
          `00000000-0000-4000-b000-${String(uuidSeq++).padStart(12, '0')}` as ReturnType<
            typeof Crypto.randomUUID
          >,
      )
  })

  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
  })

  it('P2.1, P2.2, P2.3, P2.4: preserves in-flight preparing attempt across unmount/remount without minting a second key or POST, and replays exact key after timeout', async () => {
    let rejectInFlightCheckout: ((err: Error) => void) | undefined
    const startCheckout = jest
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<ReturnType<typeof makePayment>>((_, reject) => {
            rejectInFlightCheckout = reject
          }),
      )
      .mockResolvedValueOnce(
        makePayment({ paymentId: PAYMENT_ID_1, status: 'PENDING' }),
      )

    const api = makeApi({ startCheckout })
    const sharedClient = makeQueryClient()

    const mount1 = await render(
      <QueryClientProvider client={sharedClient}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })

    // Start checkout on Mount 1 -> status becomes 'preparing', POST is in-flight.
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    expect(startCheckout).toHaveBeenCalledTimes(1)
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1)
    const originalKey = getCheckoutAttempt(USER_A_SUBJECT)?.idempotencyKey
    expect(originalKey).toBe('00000000-0000-4000-b000-000000000300')
    expect(getCheckoutAttempt(USER_A_SUBJECT)?.status).toBe('preparing')

    // Unmount Mount 1 while POST is still pending, then mount Mount 2!
    await mount1.unmount()

    let mount2Controller: ReturnType<typeof useSupportPlanAccess> | undefined
    function RemountHarness() {
      const controller = useSupportPlanAccess({ api, subject: USER_A_SUBJECT })
      mount2Controller = controller
      return <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
    }

    const mount2 = await render(
      <QueryClientProvider client={sharedClient}>
        <RemountHarness />
      </QueryClientProvider>,
    )

    // Mount 2 recognizes the in-flight attempt and disables the button while joining it.
    await waitFor(() => {
      expect(mount2Controller?.isStartingCheckout).toBe(true)
    })

    // Calling startPlusUpgrade() on Mount 2 while first POST is still pending MUST NOT mint a new key or fire a second POST.
    await act(async () => {
      void mount2Controller?.startPlusUpgrade()
      void mount2Controller?.startPlusUpgrade()
    })
    expect(startCheckout).toHaveBeenCalledTimes(1)
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1)

    // Now the first in-flight POST times out -> transitions to 'uncertain' with the SAME key.
    await act(async () => {
      rejectInFlightCheckout?.(
        new ApiError({ code: 'REQUEST_TIMEOUT', message: 'Network timeout' }),
      )
    })

    await waitFor(() => {
      expect(getCheckoutAttempt(USER_A_SUBJECT)).toMatchObject({
        status: 'uncertain',
        idempotencyKey: originalKey,
      })
      expect(screen.getByTestId('locked-preview-checkout-error')).toBeTruthy()
    })

    // Retrying on Mount 2 replays the exact same Idempotency-Key.
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(startCheckout).toHaveBeenCalledTimes(2)
    })
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1)
    expect(startCheckout.mock.calls[1]).toEqual([
      PLUS_PLAN_VERSION_ID,
      originalKey,
    ])
    expect(getCheckoutAttempt(USER_A_SUBJECT)).toMatchObject({
      status: 'pending',
      paymentId: PAYMENT_ID_1,
      idempotencyKey: originalKey,
    })
    await mount2.unmount()

    // Also verify that an orphaned 'preparing' attempt record in store reuses its key and never calls randomUUID.
    saveCheckoutAttempt({
      subject: USER_A_SUBJECT,
      planVersionId: PLUS_PLAN_VERSION_ID,
      idempotencyKey: 'orphaned-preparing-key-9999',
      status: 'preparing',
    })
    const orphanApi = makeApi({
      startCheckout: jest
        .fn()
        .mockResolvedValue(
          makePayment({ paymentId: PAYMENT_ID_2, status: 'PENDING' }),
        ),
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={orphanApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(orphanApi.startCheckout).toHaveBeenCalledWith(
        PLUS_PLAN_VERSION_ID,
        'orphaned-preparing-key-9999',
      )
    })
    expect(Crypto.randomUUID).toHaveBeenCalledTimes(1)
  })

  it('P2.5, P2.6, P2.7: rotates key only after verified FAILED/CHARGEBACK, isolates in-flight attempt on account switch, and recovers safely after preparing TTL expiry', async () => {
    // P2.5: Verified CHARGEBACK allows rotating to a new key on the next attempt.
    const startCheckout = jest
      .fn()
      .mockResolvedValueOnce(
        makePayment({ paymentId: PAYMENT_ID_1, status: 'PENDING' }),
      )
      .mockResolvedValueOnce(
        makePayment({ paymentId: PAYMENT_ID_2, status: 'PENDING' }),
      )
    const getPayment = jest.fn().mockResolvedValue(
      makePayment({
        paymentId: PAYMENT_ID_1,
        status: 'CHARGEBACK',
      }),
    )
    const getPaymentHistory = jest
      .fn()
      .mockResolvedValueOnce({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:00:00Z',
      })
      .mockResolvedValue({
        items: [makePayment({ paymentId: PAYMENT_ID_1, status: 'CHARGEBACK' })],
        count: 1,
        generatedAt: '2026-11-15T10:05:00Z',
      })
    const api = makeApi({ startCheckout, getPayment, getPaymentHistory })

    const v1 = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-reconcile-button')).toBeTruthy()
    })
    const firstKey = startCheckout.mock.calls[0]?.[1]

    // Reconcile confirms CHARGEBACK -> marks attempt terminal -> next upgrade rotates key.
    await fireEvent.press(screen.getByTestId('locked-preview-reconcile-button'))
    await waitFor(() => {
      expect(getCheckoutAttempt(USER_A_SUBJECT)?.status).toBe('terminal')
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(startCheckout).toHaveBeenCalledTimes(2)
    })
    const secondKey = startCheckout.mock.calls[1]?.[1]
    expect(secondKey).not.toBe(firstKey)
    await v1.unmount()
    clearCheckoutAttempt()
    clearPendingUpgradeIntent()

    // P2.7: TTL expiry of an in-session 'preparing' attempt forces server /payments check and blocks duplicate charge.
    let nowMs = 5_000_000
    jest.spyOn(Date, 'now').mockImplementation(() => nowMs)
    saveCheckoutAttempt({
      subject: USER_A_SUBJECT,
      planVersionId: PLUS_PLAN_VERSION_ID,
      idempotencyKey: 'ttl-preparing-key-0001',
      status: 'preparing',
      nowMs,
    })
    nowMs += 31 * 60 * 1000

    const ttlCheckout = jest.fn()
    const ttlApi = makeApi({
      startCheckout: ttlCheckout,
      getPaymentHistory: jest
        .fn()
        .mockResolvedValueOnce({
          items: [],
          count: 0,
          generatedAt: '2026-11-15T10:00:00Z',
        })
        .mockResolvedValueOnce({
          items: [makePayment({ paymentId: PAYMENT_ID_2, status: 'PENDING' })],
          count: 1,
          generatedAt: '2026-11-15T10:35:00Z',
        }),
    })
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate api={ttlApi} subject={USER_A_SUBJECT} />
      </QueryClientProvider>,
    )
    await waitFor(() => {
      expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
    })
    await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
    await waitFor(() => {
      expect(
        screen.getByText('Mã: PENDING_PAYMENT_RECOVERY_REQUIRED'),
      ).toBeTruthy()
    })
    expect(ttlCheckout).not.toHaveBeenCalled()
  })
})

describe('MB-703 S1/S2/S3 — Care v3 Contract & Ownership Security Boundary', () => {
  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
    invalidateCareOwnershipForSubject()
  })

  it('S1.1–S1.5: verifies NATIVE_V3 current, V2_RESOURCE_ADAPTER, current DRAFT, terminal history (including paginated cursor pages), and empty current/draft/history -> NONE', async () => {
    const notFound = () => Promise.reject({ status: 404, code: 'HTTP_404' })

    // 1. Valid NATIVE_V3 current ACTIVE Plan -> VERIFIED_OWNED
    const nativeCurrentAdapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
      getCurrent: () =>
        Promise.resolve(
          makeCareSupportPlanResponse({
            status: 'ACTIVE',
            representationMode: 'NATIVE_V3',
          }),
        ),
      getDraft: notFound,
      getHistory: () => Promise.resolve(makeCareSupportPlanHistoryResponse([])),
    })
    const nativeCurrentProof = await resolveCareOwnershipFromApi(
      nativeCurrentAdapter,
      USER_A_SUBJECT,
    )
    expect(nativeCurrentProof.status).toBe('VERIFIED_OWNED')
    expect(verifyCareOwnership(nativeCurrentProof, USER_A_SUBJECT)).toBe(
      'VERIFIED_OWNED',
    )

    // 2. Valid V2_RESOURCE_ADAPTER PAUSED Plan -> VERIFIED_OWNED
    const v2Adapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
      getCurrent: () =>
        Promise.resolve(
          makeCareSupportPlanResponse({
            status: 'PAUSED',
            representationMode: 'V2_RESOURCE_ADAPTER',
          }),
        ),
      getDraft: notFound,
      getHistory: () => Promise.resolve(makeCareSupportPlanHistoryResponse([])),
    })
    const v2Proof = await resolveCareOwnershipFromApi(v2Adapter, USER_A_SUBJECT)
    expect(v2Proof.status).toBe('VERIFIED_OWNED')
    expect(verifyCareOwnership(v2Proof, USER_A_SUBJECT)).toBe('VERIFIED_OWNED')

    // 3. Valid current DRAFT -> VERIFIED_OWNED
    const draftAdapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
      getCurrent: notFound,
      getDraft: () =>
        Promise.resolve(
          makeCareSupportPlanResponse({
            status: 'DRAFT',
            representationMode: 'NATIVE_V3',
          }),
        ),
      getHistory: () => Promise.resolve(makeCareSupportPlanHistoryResponse([])),
    })
    const draftProof = await resolveCareOwnershipFromApi(
      draftAdapter,
      USER_A_SUBJECT,
    )
    expect(draftProof.status).toBe('VERIFIED_OWNED')
    expect(verifyCareOwnership(draftProof, USER_A_SUBJECT)).toBe(
      'VERIFIED_OWNED',
    )

    // 4. Valid terminal history (COMPLETED / SUPERSEDED / DISCARDED + pagination preservation) -> VERIFIED_OWNED
    const getHistoryPaginated = jest
      .fn()
      .mockResolvedValueOnce(
        makeCareSupportPlanHistoryResponse([], {
          hasMore: true,
          nextCursor: 'cursor-page-2',
        }),
      )
      .mockResolvedValueOnce(
        makeCareSupportPlanHistoryResponse(
          [
            makeCareSupportPlanResponse({
              supportPlanId: SUPPORT_PLAN_ID_2,
              status: 'SUPERSEDED',
              representationMode: 'V2_RESOURCE_ADAPTER',
            }),
          ],
          { hasMore: false, nextCursor: null },
        ),
      )
    const historyAdapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
      getCurrent: notFound,
      getDraft: notFound,
      getHistory: getHistoryPaginated,
    })
    const historyProof = await resolveCareOwnershipFromApi(
      historyAdapter,
      USER_A_SUBJECT,
    )
    expect(getHistoryPaginated).toHaveBeenNthCalledWith(1)
    expect(getHistoryPaginated).toHaveBeenNthCalledWith(2, 'cursor-page-2')
    expect(historyProof.status).toBe('VERIFIED_OWNED')
    expect(verifyCareOwnership(historyProof, USER_A_SUBJECT)).toBe(
      'VERIFIED_OWNED',
    )

    // 5. Empty current (404) + empty draft (404) + empty history -> NONE
    const emptyAdapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
      getCurrent: notFound,
      getDraft: notFound,
      getHistory: () =>
        Promise.resolve(
          makeCareSupportPlanHistoryResponse([], {
            hasMore: false,
            nextCursor: null,
          }),
        ),
    })
    const emptyProof = await resolveCareOwnershipFromApi(
      emptyAdapter,
      USER_A_SUBJECT,
    )
    expect(emptyProof.status).toBe('NONE')
    expect(verifyCareOwnership(emptyProof, USER_A_SUBJECT)).toBe('NONE')
  })

  it('S1.6, S2.7, S2.8, S2.9, S2.10: fails closed on malformed v3 response, forged proof/navigation/client-generated Plan, wrong subject/account switch, Care 401/403/503, and stale async response after sign-out', async () => {
    const notFound = () => Promise.reject({ status: 404, code: 'HTTP_404' })

    // 6. Malformed v3 response (e.g. legacy v1 payload or wrong status on current) -> UNAVAILABLE
    const malformedV1Adapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
      getCurrent: () =>
        Promise.resolve({
          supportPlanId: SUPPORT_PLAN_ID_2,
          status: 'ACTIVE',
          version: 1,
          slots: [{ slotId: 'slot-1' }],
        }),
      getDraft: notFound,
      getHistory: () => Promise.resolve(makeCareSupportPlanHistoryResponse([])),
    })
    const malformedProof = await resolveCareOwnershipFromApi(
      malformedV1Adapter,
      USER_A_SUBJECT,
    )
    expect(malformedProof.status).toBe('UNAVAILABLE')

    const wrongStatusOnCurrentAdapter = makeCareOwnershipAdapter(
      USER_A_SUBJECT,
      {
        getCurrent: () =>
          Promise.resolve(makeCareSupportPlanResponse({ status: 'DRAFT' })),
        getDraft: notFound,
        getHistory: () =>
          Promise.resolve(makeCareSupportPlanHistoryResponse([])),
      },
    )
    const wrongStatusProof = await resolveCareOwnershipFromApi(
      wrongStatusOnCurrentAdapter,
      USER_A_SUBJECT,
    )
    expect(wrongStatusProof.status).toBe('UNAVAILABLE')

    // 7. Plain forged proof, navigation params, or client-generated Plan -> UNAVAILABLE
    const forgedSchemaValidObject: CareOwnedPlanProof = {
      status: 'VERIFIED_OWNED',
      subject: USER_A_SUBJECT,
      source: 'CARE_AUTHENTICATED_READ',
      hasCurrentPlan: true,
      hasHistory: true,
    }
    expect(
      careOwnedPlanProofSchema.safeParse(forgedSchemaValidObject).success,
    ).toBe(true)
    expect(verifyCareOwnership(forgedSchemaValidObject, USER_A_SUBJECT)).toBe(
      'UNAVAILABLE',
    )
    expect(
      verifyCareOwnership(
        { source: 'GUIDE', guideId: GUIDE_ID },
        USER_A_SUBJECT,
      ),
    ).toBe('UNAVAILABLE')
    expect(
      verifyCareOwnership(makeCareSupportPlanResponse(), USER_A_SUBJECT),
    ).toBe('UNAVAILABLE')
    const unregisteredAdapterProof = await resolveCareOwnershipFromApi(
      { subject: USER_A_SUBJECT } as unknown as CareOwnershipAdapter,
      USER_A_SUBJECT,
    )
    expect(unregisteredAdapterProof.status).toBe('UNAVAILABLE')

    // 8. Wrong subject & account switch invalidation -> UNAVAILABLE
    const userBProof = await makeVerifiedCareOwnership(USER_B_SUBJECT)
    expect(verifyCareOwnership(userBProof, USER_A_SUBJECT)).toBe('UNAVAILABLE')

    // 9. Care 401 / 403 / 503 -> fail-closed UNAVAILABLE
    for (const status of [401, 403, 503]) {
      const errorAdapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
        getCurrent: () =>
          Promise.reject(
            new ApiError({
              status,
              code: `HTTP_${status}`,
              message: `Care ${status}`,
            }),
          ),
        getDraft: notFound,
        getHistory: () =>
          Promise.resolve(makeCareSupportPlanHistoryResponse([])),
      })
      const errorProof = await resolveCareOwnershipFromApi(
        errorAdapter,
        USER_A_SUBJECT,
      )
      expect(errorProof.status).toBe('UNAVAILABLE')
    }

    // 10. Stale async Care response completing after sign-out -> does NOT grant ownership
    let activeSessionSubject: string | null = USER_A_SUBJECT
    let sessionGeneration = 1
    let resolveDeferredCurrent: ((value: unknown) => void) | undefined
    const staleAdapter = createCareOwnershipAdapter(
      {
        getCurrent: () =>
          new Promise((resolve) => {
            resolveDeferredCurrent = resolve
          }),
        getDraft: notFound,
        getHistory: () =>
          Promise.resolve(makeCareSupportPlanHistoryResponse([])),
      },
      {
        subject: USER_A_SUBJECT,
        getActiveSubject: () => activeSessionSubject,
        getSessionGeneration: () => sessionGeneration,
      },
    )

    const inFlightPromise = resolveCareOwnershipFromApi(
      staleAdapter,
      USER_A_SUBJECT,
    )
    // User signs out before Care response arrives
    activeSessionSubject = null
    sessionGeneration += 1
    invalidateCareOwnershipForSubject(USER_A_SUBJECT)

    resolveDeferredCurrent?.(
      makeCareSupportPlanResponse({
        status: 'ACTIVE',
        representationMode: 'NATIVE_V3',
      }),
    )
    const staleProof = await inFlightPromise
    expect(staleProof.status).toBe('UNAVAILABLE')
    expect(verifyCareOwnership(staleProof, USER_A_SUBJECT)).toBe('UNAVAILABLE')
  })

  it('S2.11, S2.12, S2.13: Consultation 503 + verified Care-owned via careOwnershipAdapter enters read-only with canCreatePlan=false and no autoContinue, while safetyOverride takes absolute priority', async () => {
    const notFound = () => Promise.reject({ status: 404, code: 'HTTP_404' })
    let currentSubject: string | null = USER_A_SUBJECT

    const trustedAdapter = createCareOwnershipAdapter(
      {
        getCurrent: notFound,
        getDraft: notFound,
        getHistory: () =>
          Promise.resolve(
            makeCareSupportPlanHistoryResponse([
              makeCareSupportPlanResponse({
                supportPlanId: SUPPORT_PLAN_ID_2,
                status: 'COMPLETED',
                representationMode: 'NATIVE_V3',
              }),
            ]),
          ),
      },
      {
        subject: USER_A_SUBJECT,
        getActiveSubject: () => currentSubject,
      },
    )

    const unavailableConsultationApi = makeApi({
      getEntitlement: jest
        .fn()
        .mockRejectedValue(
          new ApiError({ status: 503, code: 'HTTP_503', message: 'Down' }),
        ),
    })
    const onContinueToPlan = jest.fn()

    // 11 & 12: Consultation 503 + verified Care-owned -> read-only, canCreatePlan=false, autoContinue=true does NOT auto-navigate
    const vReadOnly = await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={unavailableConsultationApi}
          autoContinue
          careOwnershipAdapter={trustedAdapter}
          onContinueToPlan={onContinueToPlan}
          subject={USER_A_SUBJECT}
        >
          {(ctx) => (
            <Text testID="s2-verified-readonly">
              {`MODE:${ctx.accessMode}:CREATE:${ctx.canCreatePlan}:VERIFIED_CARE:${ctx.careOwnershipVerified}`}
            </Text>
          )}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(
        screen.getByText(
          'MODE:read-only-owned:CREATE:false:VERIFIED_CARE:true',
        ),
      ).toBeTruthy()
    })
    expect(onContinueToPlan).not.toHaveBeenCalled()
    await vReadOnly.unmount()

    // 13: Safety override takes absolute priority over verified Care ownership
    await render(
      <QueryClientProvider client={makeQueryClient()}>
        <SupportPlanAccessGate
          api={unavailableConsultationApi}
          autoContinue
          careOwnershipAdapter={trustedAdapter}
          onContinueToPlan={onContinueToPlan}
          safetyOverride
          subject={USER_A_SUBJECT}
        >
          {() => <Text testID="s2-safety-hidden">Hidden</Text>}
        </SupportPlanAccessGate>
      </QueryClientProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('support-plan-safety-override')).toBeTruthy()
    })
    expect(screen.queryByTestId('s2-safety-hidden')).toBeNull()
    expect(onContinueToPlan).not.toHaveBeenCalled()
  })

  describe('MB-703 C1, C2, C3: Final Standalone Security & Checkout Hardening', () => {
    afterEach(() => {
      jest.restoreAllMocks()
    })

    it('C1.1: prevents duplicate checkout after unresolved TTL when history is empty, and reuses exact idempotency key on explicit retry', async () => {
      let nowMs = 1_000_000
      jest.spyOn(Date, 'now').mockImplementation(() => nowMs)

      saveCheckoutAttempt({
        subject: USER_A_SUBJECT,
        planVersionId: PLUS_PLAN_VERSION_ID,
        idempotencyKey: 'idemp-c1-original-key',
        status: 'uncertain',
        nowMs,
      })

      // Fast-forward 31 minutes so attempt expires in getCheckoutAttempt()
      nowMs += 31 * 60 * 1000

      const startCheckout = jest.fn().mockResolvedValue(
        makePayment({
          paymentId: PAYMENT_ID_1,
          planVersionId: PLUS_PLAN_VERSION_ID,
          status: 'PENDING',
        }),
      )
      const getPaymentHistory = jest.fn().mockResolvedValue({
        items: [],
        count: 0,
        generatedAt: '2026-11-15T10:35:00Z',
      })
      const api = makeApi({ startCheckout, getPaymentHistory })

      await render(
        <QueryClientProvider client={makeQueryClient()}>
          <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
      })

      // Press 1: History is checked, empty items -> unproven failure -> blocks with CHECKOUT_RECOVERY_REQUIRED
      await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
      await waitFor(() => {
        expect(screen.getByText('Mã: CHECKOUT_RECOVERY_REQUIRED')).toBeTruthy()
      })
      // startCheckout MUST NOT be called!
      expect(startCheckout).not.toHaveBeenCalled()

      // Press 2: User explicitly retries ("Kiểm tra và thử lại nâng cấp Plus")
      await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
      await waitFor(() => {
        expect(startCheckout).toHaveBeenCalledTimes(1)
      })

      // Key must be exact reused expired idempotencyKey, NEVER a newly minted random UUID!
      expect(startCheckout).toHaveBeenCalledWith(
        PLUS_PLAN_VERSION_ID,
        'idemp-c1-original-key',
      )
    })

    it('C1.2: when history has SUCCEEDED payment after TTL expiry, reconciles to active plan and never mints new checkout', async () => {
      let nowMs = 1_000_000
      jest.spyOn(Date, 'now').mockImplementation(() => nowMs)

      saveCheckoutAttempt({
        subject: USER_A_SUBJECT,
        planVersionId: PLUS_PLAN_VERSION_ID,
        idempotencyKey: 'idemp-c1-succ-key',
        paymentId: PAYMENT_ID_1,
        status: 'uncertain',
        nowMs,
      })
      nowMs += 31 * 60 * 1000

      const startCheckout = jest.fn()
      const getPaymentHistory = jest.fn().mockResolvedValue({
        items: [
          makePayment({
            paymentId: PAYMENT_ID_1,
            planVersionId: PLUS_PLAN_VERSION_ID,
            status: 'SUCCEEDED',
          }),
        ],
        count: 1,
        generatedAt: '2026-11-15T10:35:00Z',
      })
      const getEntitlement = jest
        .fn()
        .mockResolvedValueOnce(makeEntitlement())
        .mockResolvedValue(
          makeEntitlement({
            packageCode: 'PLUS',
            entitlementState: 'ACTIVE',
            supportPlanEnabled: true,
          }),
        )
      const api = makeApi({ startCheckout, getPaymentHistory, getEntitlement })

      await render(
        <QueryClientProvider client={makeQueryClient()}>
          <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
      })

      await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))

      // Must never call startCheckout
      expect(startCheckout).not.toHaveBeenCalled()
      // Expired unresolved attempt must be cleared
      expect(
        getExpiredUnresolvedCheckoutAttempt(
          USER_A_SUBJECT,
          PLUS_PLAN_VERSION_ID,
        ),
      ).toBeNull()
    })

    it('C1.3: when history has FAILED payment after TTL expiry, terminal failure is proven and allows minting new attempt', async () => {
      let nowMs = 1_000_000
      jest.spyOn(Date, 'now').mockImplementation(() => nowMs)

      saveCheckoutAttempt({
        subject: USER_A_SUBJECT,
        planVersionId: PLUS_PLAN_VERSION_ID,
        idempotencyKey: 'idemp-c1-failed-key',
        paymentId: PAYMENT_ID_1,
        status: 'uncertain',
        nowMs,
      })
      nowMs += 31 * 60 * 1000

      const startCheckout = jest.fn().mockResolvedValue(
        makePayment({
          paymentId: PAYMENT_ID_2,
          planVersionId: PLUS_PLAN_VERSION_ID,
          status: 'PENDING',
        }),
      )
      const getPaymentHistory = jest.fn().mockResolvedValue({
        items: [
          makePayment({
            paymentId: PAYMENT_ID_1,
            planVersionId: PLUS_PLAN_VERSION_ID,
            status: 'FAILED',
          }),
        ],
        count: 1,
        generatedAt: '2026-11-15T10:35:00Z',
      })
      const api = makeApi({ startCheckout, getPaymentHistory })

      await render(
        <QueryClientProvider client={makeQueryClient()}>
          <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
      })

      await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))

      await waitFor(() => {
        expect(startCheckout).toHaveBeenCalledTimes(1)
      })

      // Terminal failure proven -> fresh attempt minted -> key is different from old failed key
      expect(startCheckout.mock.calls[0][1]).not.toBe('idemp-c1-failed-key')
    })

    it('C2.1: revalidates lifecycle: AppState background/foreground during async history preflight aborts before POST', async () => {
      let resolveHistory: (val: PlanPaymentHistory) => void = () => {}
      const historyPromise = new Promise<PlanPaymentHistory>((resolve) => {
        resolveHistory = resolve
      })

      let nowMs = 1_000_000
      jest.spyOn(Date, 'now').mockImplementation(() => nowMs)
      saveCheckoutAttempt({
        subject: USER_A_SUBJECT,
        planVersionId: PLUS_PLAN_VERSION_ID,
        idempotencyKey: 'idemp-c2-key',
        status: 'uncertain',
        nowMs,
      })
      nowMs += 31 * 60 * 1000

      const startCheckout = jest.fn()
      const getPaymentHistory = jest
        .fn()
        .mockResolvedValueOnce({
          items: [],
          count: 0,
          generatedAt: '2026-11-15T10:00:00Z',
        })
        .mockImplementation(() => historyPromise)
      const api = makeApi({ startCheckout, getPaymentHistory })

      let appStateListener: ((state: AppStateStatus) => void) | undefined
      jest
        .spyOn(AppState, 'addEventListener')
        .mockImplementation((_, handler) => {
          appStateListener = handler as (state: AppStateStatus) => void
          return { remove: jest.fn() } as unknown as ReturnType<
            typeof AppState.addEventListener
          >
        })

      await render(
        <QueryClientProvider client={makeQueryClient()}>
          <SupportPlanAccessGate api={api} subject={USER_A_SUBJECT} />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
      })

      // Trigger startPlusUpgrade
      await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
      expect(getPaymentHistory).toHaveBeenCalledTimes(2)

      // While history is in-flight, simulate AppState resume (background -> active)
      // which increments verificationGenRef
      await act(async () => {
        appStateListener?.('active')
      })

      // Now history resolves
      await act(async () => {
        resolveHistory({
          items: [],
          count: 0,
          generatedAt: '2026-11-15T10:35:00Z',
        })
      })

      // Preflight finishes, but context changed (verificationGen incremented) -> MUST NOT POST!
      expect(startCheckout).not.toHaveBeenCalled()
    })

    it('C2.2: revalidates lifecycle: offline during async history preflight aborts before POST', async () => {
      let resolveHistory: (val: PlanPaymentHistory) => void = () => {}
      const historyPromise = new Promise<PlanPaymentHistory>((resolve) => {
        resolveHistory = resolve
      })

      let nowMs = 1_000_000
      jest.spyOn(Date, 'now').mockImplementation(() => nowMs)
      saveCheckoutAttempt({
        subject: USER_A_SUBJECT,
        planVersionId: PLUS_PLAN_VERSION_ID,
        idempotencyKey: 'idemp-c2-offline-key',
        status: 'uncertain',
        nowMs,
      })
      nowMs += 31 * 60 * 1000

      const startCheckout = jest.fn()
      const getPaymentHistory = jest
        .fn()
        .mockResolvedValueOnce({
          items: [],
          count: 0,
          generatedAt: '2026-11-15T10:00:00Z',
        })
        .mockImplementation(() => historyPromise)
      const api = makeApi({ startCheckout, getPaymentHistory })

      const { rerender } = await render(
        <QueryClientProvider client={makeQueryClient()}>
          <SupportPlanAccessGate
            api={api}
            offline={false}
            subject={USER_A_SUBJECT}
          />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(screen.getByTestId('locked-preview-upgrade-button')).toBeTruthy()
      })

      await fireEvent.press(screen.getByTestId('locked-preview-upgrade-button'))
      expect(getPaymentHistory).toHaveBeenCalledTimes(2)

      // Go offline while preflight is waiting
      await rerender(
        <QueryClientProvider client={makeQueryClient()}>
          <SupportPlanAccessGate
            api={api}
            offline={true}
            subject={USER_A_SUBJECT}
          />
        </QueryClientProvider>,
      )

      // Now history resolves
      await act(async () => {
        resolveHistory({
          items: [],
          count: 0,
          generatedAt: '2026-11-15T10:35:00Z',
        })
      })

      // Offline changed -> MUST NOT POST!
      expect(startCheckout).not.toHaveBeenCalled()
    })

    it('C3.1: prevents stale PayOS URL navigation when account switches during canOpenURL await', async () => {
      let resolveCanOpen: (val: boolean) => void = () => {}
      const canOpenPromise = new Promise<boolean>((resolve) => {
        resolveCanOpen = resolve
      })

      const canOpen = jest
        .spyOn(Linking, 'canOpenURL')
        .mockImplementation(() => canOpenPromise)
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined as unknown as void)
      canOpen.mockClear()
      openURL.mockClear()

      let controllerRef: ReturnType<typeof useSupportPlanAccess> | undefined
      function Probe({
        api,
        subject,
      }: {
        api: SupportPlanAccessApi
        subject: string | null
      }) {
        const controller = useSupportPlanAccess({ api, subject })
        controllerRef = controller
        return <Text testID="probe">{subject ?? 'none'}</Text>
      }

      const pendingPayOSPayment = makePayment({
        paymentId: PAYMENT_ID_1,
        provider: 'PAYOS',
        status: 'PENDING',
        checkoutUrl: 'https://pay.payos.vn/web/checkout-session-c3-1',
      })

      const api = makeApi({
        getPaymentHistory: jest.fn().mockResolvedValue({
          items: [pendingPayOSPayment],
          count: 1,
          generatedAt: '2026-11-15T10:00:00Z',
        }),
      })

      const { rerender } = await render(
        <QueryClientProvider client={makeQueryClient()}>
          <Probe api={api} subject={USER_A_SUBJECT} />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(controllerRef?.activePayment?.paymentId).toBe(PAYMENT_ID_1)
      })

      // Start opening URL for USER_A
      void controllerRef?.openHostedCheckoutUrl()
      expect(canOpen).toHaveBeenCalledTimes(1)

      // Switch account to USER_B while canOpenURL is waiting
      await rerender(
        <QueryClientProvider client={makeQueryClient()}>
          <Probe api={api} subject={USER_B_SUBJECT} />
        </QueryClientProvider>,
      )

      // Now canOpenURL resolves true
      await act(async () => {
        resolveCanOpen(true)
      })

      // Linking.openURL MUST NOT be called because subject changed!
      expect(openURL).not.toHaveBeenCalled()
      // Pending upgrade intent must NOT be set for USER_B
      expect(getPendingUpgradeIntent(USER_B_SUBJECT)).toBeNull()
    })

    it('C3.2: prevents stale PayOS URL navigation when unmounted during canOpenURL await', async () => {
      let resolveCanOpen: (val: boolean) => void = () => {}
      const canOpenPromise = new Promise<boolean>((resolve) => {
        resolveCanOpen = resolve
      })

      const canOpen = jest
        .spyOn(Linking, 'canOpenURL')
        .mockImplementation(() => canOpenPromise)
      const openURL = jest
        .spyOn(Linking, 'openURL')
        .mockResolvedValue(undefined as unknown as void)
      canOpen.mockClear()
      openURL.mockClear()

      let controllerRef: ReturnType<typeof useSupportPlanAccess> | undefined
      function Probe({
        api,
        subject,
      }: {
        api: SupportPlanAccessApi
        subject: string | null
      }) {
        const controller = useSupportPlanAccess({ api, subject })
        controllerRef = controller
        return <Text testID="probe">{subject ?? 'none'}</Text>
      }

      const pendingPayOSPayment = makePayment({
        paymentId: PAYMENT_ID_1,
        provider: 'PAYOS',
        status: 'PENDING',
        checkoutUrl: 'https://pay.payos.vn/web/checkout-session-c3-2',
      })

      const api = makeApi({
        getPaymentHistory: jest.fn().mockResolvedValue({
          items: [pendingPayOSPayment],
          count: 1,
          generatedAt: '2026-11-15T10:00:00Z',
        }),
      })

      const { unmount } = await render(
        <QueryClientProvider client={makeQueryClient()}>
          <Probe api={api} subject={USER_A_SUBJECT} />
        </QueryClientProvider>,
      )

      await waitFor(() => {
        expect(controllerRef?.activePayment?.paymentId).toBe(PAYMENT_ID_1)
      })

      void controllerRef?.openHostedCheckoutUrl()
      expect(canOpen).toHaveBeenCalledTimes(1)

      // Unmount while canOpenURL is waiting
      await unmount()

      // Resolve canOpenURL
      await act(async () => {
        resolveCanOpen(true)
      })

      // Linking.openURL MUST NOT be called on unmounted component!
      expect(openURL).not.toHaveBeenCalled()
    })
  })
})
