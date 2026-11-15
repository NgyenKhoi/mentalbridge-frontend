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

import { ApiError } from '@/api/api-error'

import { SupportPlanAccessGate } from './SupportPlanAccessGate'
import type { SupportPlanAccessApi } from './support-plan-access-api'
import {
  GUIDE_ID,
  PAYMENT_ID_1,
  PLUS_PLAN_VERSION_ID,
  USER_A_SUBJECT,
  USER_B_SUBJECT,
  makeCatalogue,
  makeEntitlement,
  makePayment,
} from './support-plan-access-test-fixtures'
import { clearPendingUpgradeIntent } from './upgrade-intent-store'

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
    appStateListener = undefined
    backListener = undefined

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

    jest.spyOn(Linking, 'canOpenURL').mockResolvedValue(true)
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined)
  })

  afterEach(() => {
    cleanup()
    for (const client of activeClients.splice(0)) {
      client.clear()
    }
    jest.restoreAllMocks()
    clearPendingUpgradeIntent()
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
        <SupportPlanAccessGate
          api={expiredApi}
          hasOwnedPlanOrHistory={false}
          subject={USER_A_SUBJECT}
        />
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
          hasOwnedPlanOrHistory
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
})
