import {
  planAccessFrom,
  resolveSupportPlanAccessState,
  selectLatestRelevantPayment,
  selectPlusUpgradePlan,
} from './plan-access-model'
import {
  guideOriginSchema,
  isAllowedCheckoutUrl,
  planPaymentSchema,
  serviceCreditEntitlementSchema,
} from './support-plan-access-contract'
import {
  GUIDE_ID,
  PAYMENT_ID_2,
  USER_A_SUBJECT,
  USER_B_SUBJECT,
  makeCatalogue,
  makeEntitlement,
  makePayment,
} from './support-plan-access-test-fixtures'
import {
  clearPendingUpgradeIntent,
  consumePendingUpgradeIntent,
  getPendingUpgradeIntent,
  setPendingUpgradeIntent,
} from './upgrade-intent-store'

describe('support-plan-access contracts and fail-closed state machine', () => {
  afterEach(() => {
    clearPendingUpgradeIntent()
  })

  it('derives entitlement strictly and fails closed on missing or contradictory fields', () => {
    expect(planAccessFrom(null)).toBe('unavailable')
    expect(planAccessFrom(undefined)).toBe('unavailable')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'DEFAULT_FREE',
          packageCode: 'FREE',
          supportPlanEnabled: false,
        }),
      ),
    ).toBe('free')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'ACTIVE',
          packageCode: 'PLUS',
          supportPlanEnabled: true,
        }),
      ),
    ).toBe('paid')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'ACTIVE',
          packageCode: 'PREMIUM',
          supportPlanEnabled: true,
        }),
      ),
    ).toBe('paid')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'EXPIRED',
          packageCode: 'PLUS',
          supportPlanEnabled: false,
        }),
      ),
    ).toBe('expired')

    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: undefined,
          supportPlanEnabled: undefined,
        }),
      ),
    ).toBe('unavailable')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'ACTIVE',
          packageCode: 'FREE',
          supportPlanEnabled: true,
        }),
      ),
    ).toBe('unavailable')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'ACTIVE',
          packageCode: 'PLUS',
          supportPlanEnabled: false,
        }),
      ),
    ).toBe('unavailable')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'EXPIRED',
          packageCode: 'PLUS',
          supportPlanEnabled: true,
        }),
      ),
    ).toBe('unavailable')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'DEFAULT_FREE',
          packageCode: 'PLUS',
          supportPlanEnabled: false,
        }),
      ),
    ).toBe('unavailable')
    expect(
      planAccessFrom(
        makeEntitlement({
          entitlementState: 'DEFAULT_FREE',
          packageCode: 'FREE',
          supportPlanEnabled: true,
        }),
      ),
    ).toBe('unavailable')
  })

  it('validates allowed checkout URLs and rejects untrusted hosts or invariants', () => {
    expect(isAllowedCheckoutUrl('https://pay.payos.vn/web/123', 'PAYOS')).toBe(
      true,
    )
    expect(isAllowedCheckoutUrl('http://pay.payos.vn/web/123', 'PAYOS')).toBe(
      false,
    )
    expect(isAllowedCheckoutUrl('https://evil.example/payos.vn', 'PAYOS')).toBe(
      false,
    )
    expect(
      isAllowedCheckoutUrl('https://user:pass@pay.payos.vn/web/123', 'PAYOS'),
    ).toBe(false)
    expect(isAllowedCheckoutUrl('https://pay.payos.vn/web/123', 'FAKE')).toBe(
      false,
    )

    expect(planPaymentSchema.safeParse(makePayment()).success).toBe(true)
    expect(
      planPaymentSchema.safeParse(
        makePayment({ checkoutUrl: 'https://evil.example/redirect' }),
      ).success,
    ).toBe(false)
    expect(
      planPaymentSchema.safeParse(
        makePayment({ status: 'PENDING', terminalReason: 'CANCELLED' }),
      ).success,
    ).toBe(false)
    expect(
      planPaymentSchema.safeParse(
        makePayment({ amountVnd: 5000, amount: 10000 }),
      ).success,
    ).toBe(false)

    expect(
      serviceCreditEntitlementSchema.safeParse({ accountId: 'not-a-uuid' })
        .success,
    ).toBe(false)
    expect(
      guideOriginSchema.safeParse({
        source: 'GUIDE',
        guideId: GUIDE_ID,
        step: 'next-action',
      }).success,
    ).toBe(true)
  })

  it('rejects disabled checkout and dormant MoMo provider in service catalogue', () => {
    expect(selectPlusUpgradePlan(null)).toMatchObject({
      available: false,
      code: 'CATALOGUE_UNAVAILABLE',
    })
    expect(
      selectPlusUpgradePlan(makeCatalogue({ checkoutEnabled: false })),
    ).toMatchObject({
      available: false,
      code: 'PAYMENT_CHECKOUT_DISABLED',
    })
    expect(
      selectPlusUpgradePlan(makeCatalogue({ paymentProvider: 'MOMO' })),
    ).toMatchObject({
      available: false,
      code: 'PROVIDER_MOMO_DORMANT',
    })
    expect(selectPlusUpgradePlan(makeCatalogue())).toMatchObject({
      available: true,
      plan: { planCode: 'PLUS', priceVnd: 5000 },
    })
  })

  it('orders PENDING payments ahead of older rows and resolves priority states correctly', () => {
    const olderSucceeded = makePayment({
      paymentId: PAYMENT_ID_2,
      status: 'SUCCEEDED',
      createdAt: '2026-11-14T10:00:00Z',
      paidAt: '2026-11-14T10:05:00Z',
    })
    const activePending = makePayment({
      status: 'PENDING',
      createdAt: '2026-11-15T09:00:00Z',
    })
    expect(
      selectLatestRelevantPayment([olderSucceeded, activePending])?.paymentId,
    ).toBe(activePending.paymentId)

    expect(
      resolveSupportPlanAccessState({
        safetyOverride: true,
        loading: false,
        offline: false,
        entitlement: makeEntitlement(),
        hasOwnedPlanOrHistory: false,
        hasPendingUpgradeIntent: false,
        catalogue: makeCatalogue(),
        latestPayment: null,
      }).kind,
    ).toBe('safety-override')

    const expiredWithPlan = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: false,
      entitlement: makeEntitlement({
        packageCode: 'PLUS',
        entitlementState: 'EXPIRED',
        supportPlanEnabled: false,
      }),
      hasOwnedPlanOrHistory: true,
      hasPendingUpgradeIntent: false,
      catalogue: makeCatalogue(),
      latestPayment: null,
    })
    expect(expiredWithPlan).toMatchObject({
      kind: 'owned-plan',
      showExpiredUpgradeBanner: true,
    })

    const unavailableOnError = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: false,
      entitlement: makeEntitlement(),
      errorCode: 'HTTP_503',
      hasOwnedPlanOrHistory: false,
      hasPendingUpgradeIntent: false,
      catalogue: makeCatalogue(),
      latestPayment: null,
    })
    expect(unavailableOnError).toEqual({
      kind: 'unavailable',
      offline: false,
      errorCode: 'HTTP_503',
      origin: undefined,
    })
  })

  it('isolates ephemeral upgrade intent per subject and expires after TTL', () => {
    setPendingUpgradeIntent({
      subject: USER_A_SUBJECT,
      paymentId: activeId(),
      origin: { source: 'GUIDE', guideId: GUIDE_ID },
      nowMs: 1_000,
    })

    expect(getPendingUpgradeIntent(USER_B_SUBJECT, 2_000)).toBeNull()
    expect(getPendingUpgradeIntent(USER_A_SUBJECT, 2_000)).toBeNull()

    setPendingUpgradeIntent({
      subject: USER_A_SUBJECT,
      paymentId: activeId(),
      nowMs: 1_000,
    })
    expect(getPendingUpgradeIntent(USER_A_SUBJECT, 31 * 60 * 1000)).toBeNull()

    setPendingUpgradeIntent({
      subject: USER_A_SUBJECT,
      paymentId: activeId(),
      nowMs: 1_000,
    })
    expect(consumePendingUpgradeIntent(USER_A_SUBJECT, 5_000)?.paymentId).toBe(
      activeId(),
    )
    expect(getPendingUpgradeIntent(USER_A_SUBJECT, 6_000)).toBeNull()
  })
})

function activeId() {
  return PAYMENT_ID_2
}
