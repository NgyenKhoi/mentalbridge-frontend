import {
  describePaymentState,
  planAccessFrom,
  providerDisplayLabel,
  resolveSupportPlanAccessState,
  selectLatestRelevantPayment,
  selectPlusUpgradePlan,
} from './plan-access-model'
import {
  CARE_OWNERSHIP_INTEGRATION_BLOCKER,
  CARE_OWNERSHIP_STATES,
  canOpenHostedCheckoutUrl,
  careOwnedPlanProofSchema,
  careSupportPlanV3Schema,
  createCareOwnershipAdapter,
  guideOriginSchema,
  invalidateCareOwnershipForSubject,
  isAllowedCheckoutUrl,
  planPaymentSchema,
  resolveCareOwnershipFromApi,
  sanitizeGuideOrigin,
  serviceCreditEntitlementSchema,
  validateCareSupportPlanV3Snapshot,
  verifyCareOwnership,
  type CareOwnershipAdapter,
} from './support-plan-access-contract'
import {
  GUIDE_ID,
  PAYMENT_ID_1,
  PAYMENT_ID_2,
  PLUS_PLAN_VERSION_ID,
  PREMIUM_PLAN_VERSION_ID,
  SUPPORT_PLAN_ID_2,
  USER_A_SUBJECT,
  USER_B_SUBJECT,
  makeCareOwnershipAdapter,
  makeCareSupportPlanHistoryResponse,
  makeCareSupportPlanResponse,
  makeCatalogue,
  makeEntitlement,
  makePayment,
} from './support-plan-access-test-fixtures'
import {
  clearCheckoutAttempt,
  clearPendingUpgradeIntent,
  consumePendingUpgradeIntent,
  getCheckoutAttempt,
  getPendingUpgradeIntent,
  markCheckoutAttemptPending,
  markCheckoutAttemptTerminal,
  markCheckoutAttemptUncertain,
  saveCheckoutAttempt,
  setPendingUpgradeIntent,
} from './upgrade-intent-store'

describe('support-plan-access contracts and fail-closed state machine', () => {
  afterEach(() => {
    clearPendingUpgradeIntent()
    clearCheckoutAttempt()
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
      paymentProvider: 'PAYOS',
      plan: { planCode: 'PLUS', priceVnd: 5000 },
    })
    expect(
      selectPlusUpgradePlan(makeCatalogue({ paymentProvider: 'FAKE' })),
    ).toMatchObject({
      available: true,
      paymentProvider: 'FAKE',
      plan: { planCode: 'PLUS', priceVnd: 5000 },
    })
    expect(selectPlusUpgradePlan(makeCatalogue(), 'loading')).toMatchObject({
      available: false,
      code: 'PAYMENT_HISTORY_LOADING',
    })
    expect(selectPlusUpgradePlan(makeCatalogue(), 'unavailable')).toMatchObject(
      {
        available: false,
        code: 'PAYMENT_HISTORY_UNAVAILABLE',
      },
    )

    expect(
      canOpenHostedCheckoutUrl('https://pay.payos.vn/web/123', 'PAYOS'),
    ).toBe(true)
    expect(
      canOpenHostedCheckoutUrl('https://test.momo.vn/pay/123', 'MOMO'),
    ).toBe(false)
    expect(
      canOpenHostedCheckoutUrl('https://pay.payos.vn/web/123', 'FAKE'),
    ).toBe(false)
    expect(providerDisplayLabel('PAYOS')).toBe('PayOS')
    expect(providerDisplayLabel('FAKE')).toContain('FAKE')
    expect(providerDisplayLabel('MOMO')).toContain('MoMo')

    const fakePendingSummary = describePaymentState(
      makePayment({ provider: 'FAKE', checkoutUrl: null }),
    )
    expect(fakePendingSummary.title).not.toContain('PayOS')
    expect(fakePendingSummary.detail).not.toContain('PayOS')

    const momoFailedSummary = describePaymentState(
      makePayment({
        provider: 'MOMO',
        status: 'FAILED',
        terminalReason: 'PROVIDER_FAILED',
        checkoutUrl: null,
      }),
    )
    expect(momoFailedSummary.detail).not.toContain('PayOS')
  })

  it('orders PENDING payments ahead of older rows and resolves priority states correctly', async () => {
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
        careOwnership: 'NONE',
        hasConfirmedPaymentSettlement: false,
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
      careOwnership: 'VERIFIED_OWNED',
      hasConfirmedPaymentSettlement: false,
      catalogue: makeCatalogue(),
      latestPayment: null,
    })
    expect(expiredWithPlan).toMatchObject({
      kind: 'owned-plan',
      showExpiredUpgradeBanner: true,
      showUnavailableUpgradeBanner: false,
      context: {
        canCreatePlan: false,
        accessMode: 'read-only-owned',
        careOwnershipVerified: true,
        entitlementVerified: true,
      },
    })

    // Unconfirmed settlement with existing ACTIVE PLUS stays owned-plan (not upgrade-confirmed).
    const preExistingActive = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: false,
      entitlement: makeEntitlement({
        packageCode: 'PLUS',
        entitlementState: 'ACTIVE',
        supportPlanEnabled: true,
      }),
      careOwnership: 'NONE',
      hasConfirmedPaymentSettlement: false,
      catalogue: makeCatalogue(),
      latestPayment: activePending,
    })
    expect(preExistingActive).toMatchObject({
      kind: 'owned-plan',
      context: {
        upgradedNow: false,
        canCreatePlan: true,
        accessMode: 'full-create-and-read',
      },
    })

    // Offline must never grant canCreatePlan even if stale PLUS entitlement was passed.
    const offlineStalePaid = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: true,
      entitlement: makeEntitlement({
        packageCode: 'PLUS',
        entitlementState: 'ACTIVE',
        supportPlanEnabled: true,
      }),
      careOwnership: 'NONE',
      hasConfirmedPaymentSettlement: true,
      catalogue: makeCatalogue(),
      latestPayment: null,
    })
    expect(offlineStalePaid).toEqual({
      kind: 'unavailable',
      offline: true,
      errorCode: 'NETWORK_ERROR',
      origin: undefined,
    })

    // Verified owned Care Plan/history remains read-only under 503/offline without granting canCreatePlan.
    const unavailableOwnedPlan = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: false,
      entitlement: null,
      errorCode: 'HTTP_503',
      careOwnership: 'VERIFIED_OWNED',
      hasConfirmedPaymentSettlement: false,
      catalogue: null,
      latestPayment: null,
    })
    expect(unavailableOwnedPlan).toMatchObject({
      kind: 'owned-plan',
      showUnavailableUpgradeBanner: true,
      errorCode: 'HTTP_503',
      context: {
        canCreatePlan: false,
        accessMode: 'read-only-owned',
        careOwnershipVerified: true,
        entitlementVerified: false,
        hasOwnedPlanOrHistory: true,
      },
    })

    // Auth failure still fails closed even with VERIFIED_OWNED Care ownership.
    const unauthenticatedOwned = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: false,
      entitlement: null,
      errorCode: 'HTTP_401',
      careOwnership: 'VERIFIED_OWNED',
      hasConfirmedPaymentSettlement: false,
      catalogue: null,
      latestPayment: null,
    })
    expect(unauthenticatedOwned.kind).toBe('unavailable')

    // Unverified / unavailable Care ownership fails closed when not PAID.
    const unverifiedCareClaim = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: false,
      entitlement: makeEntitlement({
        packageCode: 'PLUS',
        entitlementState: 'EXPIRED',
        supportPlanEnabled: false,
      }),
      careOwnership: 'UNAVAILABLE',
      hasConfirmedPaymentSettlement: false,
      catalogue: makeCatalogue(),
      latestPayment: null,
    })
    expect(unverifiedCareClaim).toEqual({
      kind: 'unavailable',
      offline: false,
      errorCode: 'CARE_OWNERSHIP_UNAVAILABLE',
      origin: undefined,
    })

    const unavailableOnError = resolveSupportPlanAccessState({
      safetyOverride: false,
      loading: false,
      offline: false,
      entitlement: makeEntitlement(),
      errorCode: 'HTTP_503',
      careOwnership: 'NONE',
      hasConfirmedPaymentSettlement: false,
      catalogue: makeCatalogue(),
      latestPayment: null,
    })
    expect(unavailableOnError).toEqual({
      kind: 'unavailable',
      offline: false,
      errorCode: 'HTTP_503',
      origin: undefined,
    })

    expect(
      sanitizeGuideOrigin({ source: 'GUIDE', step: '   ' }),
    ).toBeUndefined()
    expect(
      sanitizeGuideOrigin({ source: 'GUIDE', guideId: GUIDE_ID, step: 'next' }),
    ).toEqual({ source: 'GUIDE', guideId: GUIDE_ID, step: 'next' })

    expect(CARE_OWNERSHIP_STATES).toEqual([
      'NONE',
      'VERIFIED_OWNED',
      'UNAVAILABLE',
    ])
    expect(CARE_OWNERSHIP_INTEGRATION_BLOCKER).toBe(
      'MB_702_CARE_OWNERSHIP_ADAPTER_HANDOFF_PENDING',
    )
    expect(verifyCareOwnership(undefined, USER_A_SUBJECT)).toBe('NONE')
    expect(verifyCareOwnership(undefined, USER_A_SUBJECT, true)).toBe(
      'UNAVAILABLE',
    )
    expect(
      verifyCareOwnership(
        {
          status: 'VERIFIED_OWNED',
          subject: USER_B_SUBJECT,
          source: 'CARE_AUTHENTICATED_READ',
          hasCurrentPlan: true,
        },
        USER_A_SUBJECT,
      ),
    ).toBe('UNAVAILABLE')
    expect(
      careOwnedPlanProofSchema.safeParse({
        status: 'VERIFIED_OWNED',
        subject: USER_A_SUBJECT,
        source: 'CARE_AUTHENTICATED_READ',
        hasCurrentPlan: true,
        hasHistory: false,
      }).success,
    ).toBe(true)
    // Forged object matching schema without Care API attestation MUST fail closed.
    expect(
      verifyCareOwnership(
        {
          status: 'VERIFIED_OWNED',
          subject: USER_A_SUBJECT,
          source: 'CARE_AUTHENTICATED_READ',
          hasCurrentPlan: false,
          hasHistory: true,
        },
        USER_A_SUBJECT,
      ),
    ).toBe('UNAVAILABLE')

    // Client-generated CanonicalSupportPlan v3 passes schema validation but NEVER grants ownership.
    const clientGeneratedV3Plan = makeCareSupportPlanResponse()
    expect(
      careSupportPlanV3Schema.safeParse(clientGeneratedV3Plan).success,
    ).toBe(true)
    expect(
      validateCareSupportPlanV3Snapshot({
        currentPlan: clientGeneratedV3Plan,
      }),
    ).toEqual({
      valid: true,
      hasCurrentPlan: true,
      hasCurrentDraft: false,
      hasHistory: false,
    })
    expect(verifyCareOwnership(clientGeneratedV3Plan, USER_A_SUBJECT)).toBe(
      'UNAVAILABLE',
    )

    // Unregistered adapter object passed to resolveCareOwnershipFromApi fails closed.
    const unregisteredProof = await resolveCareOwnershipFromApi(
      { subject: USER_A_SUBJECT } as unknown as CareOwnershipAdapter,
      USER_A_SUBJECT,
    )
    expect(unregisteredProof.status).toBe('UNAVAILABLE')

    // Trusted Care v3 adapter grants VERIFIED_OWNED for matching active subject only,
    // and revokes proof immediately when subject/session changes.
    let activeSubject: string | null = USER_A_SUBJECT
    const historyAdapter = createCareOwnershipAdapter(
      {
        getCurrent: async () => {
          throw { status: 404, code: 'HTTP_404' }
        },
        getDraft: async () => {
          throw { status: 404, code: 'HTTP_404' }
        },
        getHistory: async () =>
          makeCareSupportPlanHistoryResponse([
            makeCareSupportPlanResponse({
              supportPlanId: SUPPORT_PLAN_ID_2,
              status: 'COMPLETED',
              representationMode: 'V2_RESOURCE_ADAPTER',
            }),
          ]),
      },
      {
        subject: USER_A_SUBJECT,
        getActiveSubject: () => activeSubject,
      },
    )
    const attestedProof = await resolveCareOwnershipFromApi(
      historyAdapter,
      USER_A_SUBJECT,
    )
    expect(verifyCareOwnership(attestedProof, USER_A_SUBJECT)).toBe(
      'VERIFIED_OWNED',
    )
    expect(verifyCareOwnership(attestedProof, USER_B_SUBJECT)).toBe(
      'UNAVAILABLE',
    )

    // Session sign-out or subject change revokes previously minted proof.
    activeSubject = null
    expect(verifyCareOwnership(attestedProof, USER_A_SUBJECT)).toBe(
      'UNAVAILABLE',
    )
    activeSubject = USER_A_SUBJECT
    const freshProof = await resolveCareOwnershipFromApi(
      makeCareOwnershipAdapter(USER_A_SUBJECT),
      USER_A_SUBJECT,
    )
    expect(verifyCareOwnership(freshProof, USER_A_SUBJECT)).toBe(
      'VERIFIED_OWNED',
    )
    invalidateCareOwnershipForSubject(USER_A_SUBJECT)
    expect(verifyCareOwnership(freshProof, USER_A_SUBJECT)).toBe('UNAVAILABLE')
  })

  it('S2: globally revokes issued owned and NONE proofs on sign-out, even after re-login with the same subject', async () => {
    // No live-session callbacks: global invalidation must still revoke these proofs.
    const ownedAdapter = makeCareOwnershipAdapter(USER_A_SUBJECT)
    const ownedBeforeLogout = await resolveCareOwnershipFromApi(
      ownedAdapter,
      USER_A_SUBJECT,
    )
    const notFound = () => Promise.reject({ status: 404, code: 'HTTP_404' })
    const emptyAdapter = makeCareOwnershipAdapter(USER_A_SUBJECT, {
      getCurrent: notFound,
      getDraft: notFound,
      getHistory: async () => makeCareSupportPlanHistoryResponse([]),
    })
    const noneBeforeLogout = await resolveCareOwnershipFromApi(
      emptyAdapter,
      USER_A_SUBJECT,
    )

    expect(verifyCareOwnership(ownedBeforeLogout, USER_A_SUBJECT)).toBe(
      'VERIFIED_OWNED',
    )
    expect(verifyCareOwnership(noneBeforeLogout, USER_A_SUBJECT)).toBe('NONE')
    // Schema-valid but unregistered NONE must not masquerade as an API result.
    expect(
      verifyCareOwnership(
        Object.freeze({
          status: 'NONE',
          subject: USER_A_SUBJECT,
          source: 'CARE_AUTHENTICATED_READ',
          hasCurrentPlan: false,
          hasHistory: false,
        }),
        USER_A_SUBJECT,
      ),
    ).toBe('UNAVAILABLE')

    invalidateCareOwnershipForSubject()
    expect(verifyCareOwnership(ownedBeforeLogout, USER_A_SUBJECT)).toBe(
      'UNAVAILABLE',
    )
    expect(verifyCareOwnership(noneBeforeLogout, USER_A_SUBJECT)).toBe(
      'UNAVAILABLE',
    )

    // A new authenticated owner read in the new epoch is allowed, never old proof reuse.
    const ownedAfterLogin = await resolveCareOwnershipFromApi(
      makeCareOwnershipAdapter(USER_A_SUBJECT),
      USER_A_SUBJECT,
    )
    expect(verifyCareOwnership(ownedAfterLogin, USER_A_SUBJECT)).toBe(
      'VERIFIED_OWNED',
    )
    expect(verifyCareOwnership(ownedBeforeLogout, USER_A_SUBJECT)).toBe(
      'UNAVAILABLE',
    )
  })

  it('isolates ephemeral upgrade intent and checkout idempotency attempts per subject and TTL', () => {
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

    saveCheckoutAttempt({
      subject: USER_A_SUBJECT,
      planVersionId: PLUS_PLAN_VERSION_ID,
      idempotencyKey: 'key-1111111111111111',
      status: 'preparing',
      nowMs: 1_000,
    })
    markCheckoutAttemptUncertain(
      USER_A_SUBJECT,
      PLUS_PLAN_VERSION_ID,
      'key-1111111111111111',
      2_000,
    )
    expect(
      getCheckoutAttempt(USER_A_SUBJECT, PLUS_PLAN_VERSION_ID, 3_000),
    ).toMatchObject({
      status: 'uncertain',
      idempotencyKey: 'key-1111111111111111',
    })
    // Different planVersionId must not reuse uncertain key intended for PLUS.
    expect(
      getCheckoutAttempt(USER_A_SUBJECT, PREMIUM_PLAN_VERSION_ID, 3_000),
    ).toBeNull()
    markCheckoutAttemptPending(
      USER_A_SUBJECT,
      PLUS_PLAN_VERSION_ID,
      'key-1111111111111111',
      PAYMENT_ID_1,
      4_000,
    )
    markCheckoutAttemptTerminal(USER_A_SUBJECT, PAYMENT_ID_1)
    expect(
      getCheckoutAttempt(USER_A_SUBJECT, PLUS_PLAN_VERSION_ID, 5_000)?.status,
    ).toBe('terminal')
    expect(
      getCheckoutAttempt(USER_B_SUBJECT, PLUS_PLAN_VERSION_ID, 5_000),
    ).toBeNull()
  })
})

function activeId() {
  return PAYMENT_ID_2
}
