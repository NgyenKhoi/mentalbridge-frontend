import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, type AppStateStatus } from 'react-native'

import { ApiError, toApiError } from '@/api/api-error'

import {
  planAccessFrom,
  providerDisplayLabel,
  resolveSupportPlanAccessState,
  selectLatestRelevantPayment,
  selectPlusUpgradePlan,
  type PaymentHistoryVerificationStatus,
  type ResolvedSupportPlanAccess,
} from './plan-access-model'
import type { SupportPlanAccessApi } from './support-plan-access-api'
import {
  canOpenHostedCheckoutUrl,
  invalidateCareOwnershipForSubject,
  resolveCareOwnershipFromApi,
  sanitizeGuideOrigin,
  verifyCareOwnership,
  type CareOwnedPlanProof,
  type CareOwnershipAdapter,
  type GuideOrigin,
  type PlanPayment,
  type PlanPaymentHistory,
  type ServiceCreditEntitlement,
} from './support-plan-access-contract'
import {
  clearCheckoutAttempt,
  clearExpiredUnresolvedCheckoutAttempt,
  clearInFlightCheckout,
  clearPendingUpgradeIntent,
  consumePendingUpgradeIntent,
  getCheckoutAttempt,
  getInFlightCheckout,
  getPendingUpgradeIntent,
  hasExpiredUnresolvedCheckoutAttempt,
  markCheckoutAttemptPending,
  markCheckoutAttemptTerminal,
  markCheckoutAttemptUncertain,
  saveCheckoutAttempt,
  setInFlightCheckout,
  setPendingUpgradeIntent,
} from './upgrade-intent-store'

export type UseSupportPlanAccessOptions = Readonly<{
  subject: string | null
  api: SupportPlanAccessApi | null
  safetyOverride?: boolean | undefined
  careOwnership?: CareOwnedPlanProof | undefined
  careOwnershipAdapter?: CareOwnershipAdapter | null | undefined
  /**
   * @deprecated Unverified boolean hints fail closed to `UNAVAILABLE` unless paired
   * with a valid `careOwnership` proof for the active `subject`.
   */
  hasOwnedPlanOrHistory?: boolean | undefined
  offline?: boolean | undefined
  origin?: GuideOrigin | undefined
}>

type SubjectScoped<T> = Readonly<{
  subject: string
  value: T
}>

type VerifiedEntitlementState = Readonly<{
  subject: string
  generation: number
  value: ServiceCreditEntitlement
}>

type VerifiedPaymentHistoryState = Readonly<{
  subject: string
  generation: number
  value: PlanPaymentHistory
}>

type VerifiedCareProofState = Readonly<{
  subject: string
  generation: number
  value: CareOwnedPlanProof
}>

type CheckoutSettlementOutcome =
  | Readonly<{ kind: 'aborted' }>
  | Readonly<{ kind: 'success'; payment: PlanPayment }>
  | Readonly<{
      kind: 'error'
      error: CheckoutErrorInfo
      refreshPayments?: boolean | undefined
    }>

function supportPlanAccessKey(
  subject: string | null,
  scope: 'entitlement' | 'catalogue' | 'payments' | 'care-ownership',
) {
  return ['support-plan-access', subject ?? 'anonymous', scope] as const
}

function extractApiError(error: unknown): Readonly<{
  code: string
  message: string
}> {
  const apiError = error instanceof ApiError ? error : toApiError(error)
  return {
    code: apiError.code,
    message: apiError.message,
  }
}

export type CheckoutErrorInfo = Readonly<{
  code: string
  message: string
  uncertain?: boolean | undefined
}>

const PRE_CREATION_ERROR_CODES = new Set([
  'PAYMENT_CHECKOUT_DISABLED',
  'FREE_PLAN_CHECKOUT_NOT_REQUIRED',
  'SUBSCRIPTION_NOT_MANAGED',
  'IDEMPOTENCY_KEY_REUSED',
  'UNAUTHENTICATED',
  'SUBSCRIPTION_PAYMENT_PENDING',
])

function isPreCreationDeterministicRejection(error: ApiError): boolean {
  if (PRE_CREATION_ERROR_CODES.has(error.code)) return true
  if (
    error.status === 400 ||
    error.status === 401 ||
    error.status === 403 ||
    error.status === 404 ||
    error.status === 409 ||
    error.status === 422
  ) {
    return true
  }
  return false
}

export type SupportPlanAccessController = Readonly<{
  resolved: ResolvedSupportPlanAccess
  isChecking: boolean
  isReconciling: boolean
  isStartingCheckout: boolean
  checkoutError: CheckoutErrorInfo | null
  externalCheckoutNotice: string | null
  activePayment: PlanPayment | null
  reconcileStatus(): Promise<void>
  retryEntitlementCheck(): Promise<void>
  startPlusUpgrade(): Promise<void>
  openHostedCheckoutUrl(): Promise<void>
  clearUpgradeConfirmation(): void
}>

/**
 * Orchestrates authoritative Consultation entitlement checks, idempotent checkout initiation,
 * AppState foreground return reconciliation, subject-scoped isolation, and fail-closed states.
 */
export function useSupportPlanAccess(
  options: UseSupportPlanAccessOptions,
): SupportPlanAccessController {
  const {
    subject,
    api,
    safetyOverride = false,
    careOwnership,
    careOwnershipAdapter,
    hasOwnedPlanOrHistory,
    offline = false,
    origin,
  } = options
  const validatedOrigin = sanitizeGuideOrigin(origin)

  const queryClient = useQueryClient()
  const isMountedRef = useRef(true)
  const lifecycleEpochRef = useRef(0)
  const activeSubjectRef = useRef<string | null>(subject)

  const prevSubjectRef = useRef<string | null>(subject)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const reconcileLockRef = useRef(false)
  const checkoutLockRef = useRef(false)
  const retryLockRef = useRef(false)
  const verificationGenRef = useRef(0)
  const entitlementReqSeqRef = useRef(0)
  const paymentsReqSeqRef = useRef(0)
  const careOwnershipReqSeqRef = useRef(0)
  const verifiedEntitlementRef = useRef<VerifiedEntitlementState | null>(null)
  const verifiedPaymentHistoryRef = useRef<VerifiedPaymentHistoryState | null>(
    null,
  )
  const scopedPaymentRef = useRef<SubjectScoped<PlanPayment> | null>(null)
  const pendingForegroundReconcileRef = useRef(false)
  const hadUncertainAttemptRef = useRef(false)

  const [verificationGen, setVerificationGen] = useState(0)
  const [verifiedEntitlement, setVerifiedEntitlement] =
    useState<VerifiedEntitlementState | null>(null)
  const [verifiedPaymentHistory, setVerifiedPaymentHistory] =
    useState<VerifiedPaymentHistoryState | null>(null)
  const [verifiedCareProof, setVerifiedCareProof] =
    useState<VerifiedCareProofState | null>(null)
  const [scopedPayment, setScopedPayment] =
    useState<SubjectScoped<PlanPayment> | null>(null)
  const [scopedCheckoutError, setScopedCheckoutError] =
    useState<SubjectScoped<CheckoutErrorInfo> | null>(null)
  const [scopedExternalNotice, setScopedExternalNotice] =
    useState<SubjectScoped<string> | null>(null)
  const [confirmedUpgrade, setConfirmedUpgrade] = useState<SubjectScoped<
    GuideOrigin | undefined
  > | null>(null)
  const [isReconciling, setIsReconciling] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)
  const [isJoiningInFlight, setIsJoiningInFlight] = useState(false)
  const [, setInFlightSettlementTick] = useState(0)

  const invalidateLiveEntitlement = useCallback(() => {
    verificationGenRef.current += 1
    entitlementReqSeqRef.current += 1
    paymentsReqSeqRef.current += 1
    careOwnershipReqSeqRef.current += 1
    verifiedEntitlementRef.current = null
    verifiedPaymentHistoryRef.current = null
    setVerificationGen(verificationGenRef.current)
    setVerifiedEntitlement(null)
    setVerifiedPaymentHistory(null)
    setVerifiedCareProof(null)
  }, [
    setVerificationGen,
    setVerifiedCareProof,
    setVerifiedEntitlement,
    setVerifiedPaymentHistory,
  ])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      lifecycleEpochRef.current += 1
      entitlementReqSeqRef.current += 1
      paymentsReqSeqRef.current += 1
      careOwnershipReqSeqRef.current += 1
    }
  }, [])

  useEffect(() => {
    const previousSubject = prevSubjectRef.current
    activeSubjectRef.current = subject
    if (previousSubject !== subject) {
      lifecycleEpochRef.current += 1
      verificationGenRef.current += 1
      entitlementReqSeqRef.current += 1
      paymentsReqSeqRef.current += 1
      careOwnershipReqSeqRef.current += 1
      verifiedEntitlementRef.current = null
      verifiedPaymentHistoryRef.current = null
      scopedPaymentRef.current = null
      pendingForegroundReconcileRef.current = false
      hadUncertainAttemptRef.current = false
      invalidateCareOwnershipForSubject(previousSubject)
      if (!subject) {
        invalidateCareOwnershipForSubject()
      }
      if (previousSubject) {
        clearPendingUpgradeIntent(previousSubject)
        clearCheckoutAttempt(previousSubject)
        queryClient.removeQueries({
          queryKey: ['support-plan-access', previousSubject],
        })
      }
      setVerificationGen(verificationGenRef.current)
      setVerifiedEntitlement(null)
      setVerifiedPaymentHistory(null)
      setVerifiedCareProof(null)
      setScopedPayment(null)
      setScopedCheckoutError(null)
      setScopedExternalNotice(null)
      setConfirmedUpgrade(null)
      reconcileLockRef.current = false
      checkoutLockRef.current = false
      retryLockRef.current = false
      setIsReconciling(false)
      setIsRetrying(false)
      setIsJoiningInFlight(false)
      prevSubjectRef.current = subject
    }
    return () => {
      lifecycleEpochRef.current += 1
    }
  }, [queryClient, subject])

  const queriesEnabled = Boolean(subject && api && !safetyOverride)
  const careOwnershipQueryEnabled = Boolean(
    subject && careOwnershipAdapter && !careOwnership && !safetyOverride,
  )

  const careOwnershipQuery = useQuery({
    queryKey: supportPlanAccessKey(subject, 'care-ownership'),
    enabled: careOwnershipQueryEnabled,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!careOwnershipAdapter || !subject) {
        return Object.freeze({ status: 'UNAVAILABLE' as const })
      }
      const capturedSubject = subject
      const capturedEpoch = lifecycleEpochRef.current
      const capturedGen = verificationGenRef.current
      const reqSeq = (careOwnershipReqSeqRef.current += 1)

      const proof = await resolveCareOwnershipFromApi(
        careOwnershipAdapter,
        capturedSubject,
      )

      const stillCurrent =
        isMountedRef.current &&
        lifecycleEpochRef.current === capturedEpoch &&
        activeSubjectRef.current === capturedSubject &&
        verificationGenRef.current === capturedGen &&
        careOwnershipReqSeqRef.current === reqSeq

      if (stillCurrent) {
        setVerifiedCareProof({
          subject: capturedSubject,
          generation: capturedGen,
          value: proof,
        })
      }
      return proof
    },
  })

  const activeAdapterCareProof =
    subject &&
    verifiedCareProof &&
    verifiedCareProof.subject === subject &&
    verifiedCareProof.generation === verificationGen
      ? verifiedCareProof.value
      : undefined

  const isCareOwnershipAdapterPending =
    careOwnershipQueryEnabled &&
    !activeAdapterCareProof &&
    (careOwnershipQuery.isLoading || careOwnershipQuery.isFetching)

  const verifiedCareOwnership = verifyCareOwnership(
    careOwnership ?? activeAdapterCareProof,
    subject,
    hasOwnedPlanOrHistory,
  )

  useEffect(() => {
    if (!subject) return
    if (offline) {
      verifiedPaymentHistoryRef.current = null
      queryClient.removeQueries({
        queryKey: supportPlanAccessKey(subject, 'entitlement'),
        exact: true,
      })
      queryClient.removeQueries({
        queryKey: supportPlanAccessKey(subject, 'payments'),
        exact: true,
      })
    }
  }, [offline, queryClient, subject])

  const entitlementQuery = useQuery({
    queryKey: supportPlanAccessKey(subject, 'entitlement'),
    enabled: queriesEnabled && !offline,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!api || !subject) {
        throw new ApiError({
          code: 'ENTITLEMENT_UNAVAILABLE',
          message: 'Thiếu dịch vụ kiểm tra quyền gói.',
        })
      }
      const capturedSubject = subject
      const capturedEpoch = lifecycleEpochRef.current
      const capturedGen = verificationGenRef.current
      const reqSeq = (entitlementReqSeqRef.current += 1)

      try {
        const result = await api.getEntitlement()
        if (result.accountId !== capturedSubject) {
          throw new ApiError({
            code: 'ENTITLEMENT_SUBJECT_MISMATCH',
            message: 'Thông tin quyền gói không khớp tài khoản đang đăng nhập.',
          })
        }

        const stillCurrent =
          isMountedRef.current &&
          lifecycleEpochRef.current === capturedEpoch &&
          activeSubjectRef.current === capturedSubject &&
          verificationGenRef.current === capturedGen &&
          entitlementReqSeqRef.current === reqSeq

        if (stillCurrent) {
          const verified: VerifiedEntitlementState = {
            subject: capturedSubject,
            generation: capturedGen,
            value: result,
          }
          verifiedEntitlementRef.current = verified
          setVerifiedEntitlement(verified)
        }

        return result
      } catch (error) {
        const stillSameSubjectAndEpoch =
          isMountedRef.current &&
          lifecycleEpochRef.current === capturedEpoch &&
          activeSubjectRef.current === capturedSubject

        if (
          stillSameSubjectAndEpoch &&
          entitlementReqSeqRef.current === reqSeq
        ) {
          verifiedEntitlementRef.current = null
          setVerifiedEntitlement(null)
        }
        throw error
      }
    },
  })

  // Cached/stale TanStack Query data MUST NEVER unlock entitlement.
  // Authorization only reads `verifiedEntitlement` written inside live `queryFn`.
  // When online, the underlying query entry must also still be active & succeeded
  // (e.g. not wiped by an offline cache eviction pending re-verification).
  const activeVerifiedEntitlement =
    subject &&
    verifiedEntitlement &&
    verifiedEntitlement.subject === subject &&
    verifiedEntitlement.generation === verificationGen &&
    verifiedEntitlement.value.accountId === subject &&
    (offline ||
      (entitlementQuery.status === 'success' && !entitlementQuery.isError))
      ? verifiedEntitlement.value
      : null

  const verifiedPlanStatus = activeVerifiedEntitlement
    ? planAccessFrom(activeVerifiedEntitlement)
    : 'unavailable'

  // Live in-session FREE/EXPIRED lock state may remain visible offline (actions disabled);
  // PLUS entitlement NEVER carries into offline or unverified states.
  const canUseOfflineLockedState =
    offline &&
    queriesEnabled &&
    !entitlementQuery.isError &&
    Boolean(activeVerifiedEntitlement) &&
    (verifiedPlanStatus === 'free' || verifiedPlanStatus === 'expired')

  const canTrustEntitlement =
    (queriesEnabled &&
      !offline &&
      !entitlementQuery.isError &&
      Boolean(activeVerifiedEntitlement)) ||
    canUseOfflineLockedState

  const rawStatus = !canTrustEntitlement ? 'unavailable' : verifiedPlanStatus
  const shouldLoadBilling =
    queriesEnabled &&
    !offline &&
    canTrustEntitlement &&
    (rawStatus === 'free' || rawStatus === 'expired')

  const catalogueQuery = useQuery({
    queryKey: supportPlanAccessKey(subject, 'catalogue'),
    enabled: shouldLoadBilling,
    retry: false,
    staleTime: 30 * 1000,
    queryFn: async () => {
      if (!api) {
        throw new ApiError({
          code: 'CATALOGUE_UNAVAILABLE',
          message: 'Thiếu dịch vụ danh sách gói.',
        })
      }
      return api.getServicePlans()
    },
  })

  const paymentsQuery = useQuery({
    queryKey: supportPlanAccessKey(subject, 'payments'),
    enabled: shouldLoadBilling,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!api || !subject) {
        throw new ApiError({
          code: 'PAYMENTS_UNAVAILABLE',
          message: 'Thiếu dịch vụ lịch sử thanh toán.',
        })
      }
      const capturedSubject = subject
      const capturedEpoch = lifecycleEpochRef.current
      const capturedGen = verificationGenRef.current
      const reqSeq = (paymentsReqSeqRef.current += 1)

      try {
        const result = await api.getPaymentHistory()
        for (const item of result.items) {
          const itemAccountId = (item as { accountId?: unknown }).accountId
          if (
            typeof itemAccountId === 'string' &&
            itemAccountId !== capturedSubject
          ) {
            throw new ApiError({
              code: 'PAYMENT_IDENTITY_MISMATCH',
              message:
                'Lịch sử thanh toán không khớp tài khoản đang đăng nhập.',
            })
          }
        }

        const stillCurrent =
          isMountedRef.current &&
          lifecycleEpochRef.current === capturedEpoch &&
          activeSubjectRef.current === capturedSubject &&
          verificationGenRef.current === capturedGen &&
          paymentsReqSeqRef.current === reqSeq

        if (stillCurrent) {
          const verified: VerifiedPaymentHistoryState = {
            subject: capturedSubject,
            generation: capturedGen,
            value: result,
          }
          verifiedPaymentHistoryRef.current = verified
          setVerifiedPaymentHistory(verified)
        }

        return result
      } catch (error) {
        const stillSameSubjectAndEpoch =
          isMountedRef.current &&
          lifecycleEpochRef.current === capturedEpoch &&
          activeSubjectRef.current === capturedSubject

        if (stillSameSubjectAndEpoch && paymentsReqSeqRef.current === reqSeq) {
          verifiedPaymentHistoryRef.current = null
          setVerifiedPaymentHistory(null)
        }
        throw error
      }
    },
  })

  const activeVerifiedPaymentHistory =
    subject &&
    !offline &&
    verifiedPaymentHistory &&
    verifiedPaymentHistory.subject === subject &&
    verifiedPaymentHistory.generation === verificationGen &&
    paymentsQuery.status === 'success' &&
    !paymentsQuery.isError
      ? verifiedPaymentHistory.value
      : null

  const currentSubjectAttempt = getCheckoutAttempt(subject)
  const activeSubjectPayment =
    subject && scopedPayment?.subject === subject
      ? scopedPayment.value
      : (currentSubjectAttempt?.payment ?? null)

  const paymentItems = activeVerifiedPaymentHistory?.items ?? []
  const mergedPayments = activeSubjectPayment
    ? [
        activeSubjectPayment,
        ...paymentItems.filter(
          (item) => item.paymentId !== activeSubjectPayment.paymentId,
        ),
      ]
    : paymentItems
  const latestPayment = selectLatestRelevantPayment(mergedPayments)

  const hasUnresolvedLocalAttempt =
    currentSubjectAttempt?.status === 'uncertain' ||
    currentSubjectAttempt?.status === 'preparing'

  const paymentHistoryStatus: PaymentHistoryVerificationStatus =
    offline || hasUnresolvedLocalAttempt
      ? 'verified'
      : paymentsQuery.isError
        ? 'unavailable'
        : !activeVerifiedPaymentHistory || paymentsQuery.isLoading
          ? 'loading'
          : 'verified'

  const isConfirmedForSubject =
    Boolean(subject) && confirmedUpgrade?.subject === subject
  const confirmedOrigin = isConfirmedForSubject
    ? confirmedUpgrade?.value
    : undefined

  const entitlementError = entitlementQuery.error
    ? extractApiError(entitlementQuery.error)
    : null

  const entitlementMissingResult =
    queriesEnabled &&
    !offline &&
    !entitlementQuery.isLoading &&
    !entitlementQuery.isFetching &&
    !isReconciling &&
    !isRetrying &&
    !activeVerifiedEntitlement &&
    !entitlementQuery.isError

  const resolvedErrorCode = !subject
    ? 'UNAUTHENTICATED'
    : offline && !canUseOfflineLockedState
      ? 'NETWORK_ERROR'
      : (entitlementError?.code ??
        (entitlementMissingResult ? 'ENTITLEMENT_UNAVAILABLE' : undefined))

  const resolved = resolveSupportPlanAccessState({
    safetyOverride,
    loading:
      (queriesEnabled &&
        !offline &&
        !activeVerifiedEntitlement &&
        !entitlementError &&
        (entitlementQuery.isLoading ||
          entitlementQuery.isFetching ||
          isReconciling ||
          isRetrying)) ||
      (isCareOwnershipAdapterPending && verifiedPlanStatus !== 'paid'),
    offline,
    entitlement: canTrustEntitlement ? activeVerifiedEntitlement : null,
    errorCode: resolvedErrorCode,
    careOwnership: verifiedCareOwnership,
    hasConfirmedPaymentSettlement: isConfirmedForSubject,
    catalogue:
      queriesEnabled && !entitlementQuery.isError
        ? (catalogueQuery.data ?? null)
        : null,
    latestPayment,
    paymentHistoryStatus,
    origin: confirmedOrigin ?? validatedOrigin,
  })

  const checkoutMutation = useMutation({
    retry: false,
    mutationFn: async (
      params: Readonly<{ planVersionId: string; idempotencyKey: string }>,
    ) => {
      if (!api || !subject) {
        throw new ApiError({
          code: 'UNAUTHENTICATED',
          message: 'Cần đăng nhập tài khoản để tạo giao dịch.',
        })
      }
      return api.startCheckout(params.planVersionId, params.idempotencyKey)
    },
  })

  const reconcileStatus = useCallback(async () => {
    if (!subject || !api || safetyOverride || offline) return
    if (reconcileLockRef.current) return

    const capturedSubject = subject
    const capturedEpoch = lifecycleEpochRef.current
    const capturedGen = verificationGenRef.current
    const isCurrentContext = () =>
      isMountedRef.current &&
      lifecycleEpochRef.current === capturedEpoch &&
      activeSubjectRef.current === capturedSubject &&
      verificationGenRef.current === capturedGen

    reconcileLockRef.current = true
    setIsReconciling(true)

    try {
      const intent = getPendingUpgradeIntent(capturedSubject)
      const attempt = getCheckoutAttempt(capturedSubject)
      const explicitlyTrackedPaymentId =
        intent?.paymentId ?? attempt?.paymentId ?? null
      // Never auto-correlate any `/payments` PENDING row onto an `uncertain` attempt
      // or `idempotencyKey`. When local attempt/intent state was lost (restart / TTL),
      // surface and check the server pending payment only for safe recovery.
      const recoveryPendingPaymentId =
        !explicitlyTrackedPaymentId &&
        attempt?.status !== 'uncertain' &&
        attempt?.status !== 'preparing' &&
        !intent &&
        latestPayment?.status === 'PENDING'
          ? latestPayment.paymentId
          : null
      const paymentIdToCheck =
        explicitlyTrackedPaymentId ?? recoveryPendingPaymentId

      let paymentCheckFailed = false
      let settledTrackedPayment: PlanPayment | null = null

      if (!paymentIdToCheck) {
        try {
          const history = await api.getPaymentHistory()
          if (!isCurrentContext()) return
          for (const item of history.items) {
            const itemAccountId = (item as { accountId?: unknown }).accountId
            if (
              typeof itemAccountId === 'string' &&
              itemAccountId !== capturedSubject
            ) {
              throw new ApiError({
                code: 'PAYMENT_IDENTITY_MISMATCH',
                message:
                  'Lịch sử thanh toán không khớp tài khoản đang đăng nhập.',
              })
            }
          }
          const verifiedHistory: VerifiedPaymentHistoryState = {
            subject: capturedSubject,
            generation: verificationGenRef.current,
            value: history,
          }
          verifiedPaymentHistoryRef.current = verifiedHistory
          setVerifiedPaymentHistory(verifiedHistory)
          queryClient.setQueryData(
            supportPlanAccessKey(capturedSubject, 'payments'),
            history,
          )
        } catch (error) {
          if (!isCurrentContext()) return
          paymentCheckFailed = true
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              ...extractApiError(error),
              uncertain:
                attempt?.status === 'uncertain' ||
                attempt?.status === 'preparing',
            },
          })
        }
      }

      if (paymentIdToCheck) {
        try {
          const reconciled = await api.getPayment(paymentIdToCheck)
          if (!isCurrentContext()) return
          const reconciledAccountId = (reconciled as { accountId?: unknown })
            .accountId
          if (
            reconciled.paymentId !== paymentIdToCheck ||
            (typeof reconciledAccountId === 'string' &&
              reconciledAccountId !== capturedSubject)
          ) {
            throw new ApiError({
              code: 'PAYMENT_IDENTITY_MISMATCH',
              message: 'Mã giao dịch đối chiếu không khớp.',
            })
          }
          const nextScoped: SubjectScoped<PlanPayment> = {
            subject: capturedSubject,
            value: reconciled,
          }
          scopedPaymentRef.current = nextScoped
          setScopedPayment(nextScoped)
          if (
            reconciled.status === 'FAILED' ||
            reconciled.status === 'CHARGEBACK'
          ) {
            clearPendingUpgradeIntent(capturedSubject)
            if (attempt?.paymentId === reconciled.paymentId) {
              markCheckoutAttemptTerminal(capturedSubject, reconciled.paymentId)
            }
          } else if (
            reconciled.status === 'SUCCEEDED' &&
            explicitlyTrackedPaymentId === reconciled.paymentId
          ) {
            settledTrackedPayment = reconciled
          }
        } catch (error) {
          if (!isCurrentContext()) return
          paymentCheckFailed = true
          setScopedCheckoutError({
            subject: capturedSubject,
            value: extractApiError(error),
          })
        }
      }

      await queryClient.cancelQueries({
        queryKey: supportPlanAccessKey(capturedSubject, 'entitlement'),
        exact: true,
      })
      const freshEntitlement = await entitlementQuery.refetch()
      if (!isCurrentContext()) return

      const freshValid =
        !freshEntitlement.isError &&
        freshEntitlement.status === 'success' &&
        freshEntitlement.data?.accountId === capturedSubject
      const freshAccess = freshValid
        ? planAccessFrom(freshEntitlement.data)
        : 'unavailable'

      const hasVerifiedTrackedSettlement = Boolean(
        freshAccess === 'paid' &&
        !paymentCheckFailed &&
        explicitlyTrackedPaymentId &&
        settledTrackedPayment &&
        settledTrackedPayment.paymentId === explicitlyTrackedPaymentId &&
        settledTrackedPayment.status === 'SUCCEEDED',
      )

      if (hasVerifiedTrackedSettlement) {
        const consumed = consumePendingUpgradeIntent(capturedSubject)
        clearCheckoutAttempt(capturedSubject)
        setConfirmedUpgrade({
          subject: capturedSubject,
          value: sanitizeGuideOrigin(
            consumed?.origin ?? intent?.origin ?? validatedOrigin,
          ),
        })
        setScopedCheckoutError(null)
        await queryClient.cancelQueries({
          queryKey: supportPlanAccessKey(capturedSubject, 'payments'),
          exact: true,
        })
        await paymentsQuery.refetch()
      } else if (freshAccess === 'free' || freshAccess === 'expired') {
        await queryClient.cancelQueries({
          queryKey: supportPlanAccessKey(capturedSubject, 'payments'),
          exact: true,
        })
        await Promise.all([catalogueQuery.refetch(), paymentsQuery.refetch()])
      }
    } catch (error) {
      if (isCurrentContext()) {
        setScopedCheckoutError({
          subject: capturedSubject,
          value: extractApiError(error),
        })
      }
    } finally {
      reconcileLockRef.current = false
      if (isMountedRef.current) {
        setIsReconciling(false)
        if (
          pendingForegroundReconcileRef.current &&
          activeSubjectRef.current === capturedSubject &&
          !safetyOverride &&
          !offline
        ) {
          pendingForegroundReconcileRef.current = false
          await queryClient.cancelQueries({
            queryKey: supportPlanAccessKey(capturedSubject, 'entitlement'),
            exact: true,
          })
          await entitlementQuery.refetch()
        }
      }
    }
  }, [
    api,
    catalogueQuery,
    entitlementQuery,
    latestPayment,
    offline,
    paymentsQuery,
    queryClient,
    safetyOverride,
    setConfirmedUpgrade,
    setIsReconciling,
    setScopedCheckoutError,
    setScopedPayment,
    setVerifiedPaymentHistory,
    subject,
    validatedOrigin,
  ])

  const retryEntitlementCheck = useCallback(async () => {
    if (!subject || !api || safetyOverride || offline) return
    if (retryLockRef.current) return

    invalidateLiveEntitlement()

    const capturedSubject = subject
    const capturedEpoch = lifecycleEpochRef.current
    const capturedGen = verificationGenRef.current
    const isCurrentContext = () =>
      isMountedRef.current &&
      lifecycleEpochRef.current === capturedEpoch &&
      activeSubjectRef.current === capturedSubject &&
      verificationGenRef.current === capturedGen

    retryLockRef.current = true
    setIsRetrying(true)
    setScopedCheckoutError(null)
    setScopedExternalNotice(null)

    try {
      await queryClient.cancelQueries({
        queryKey: supportPlanAccessKey(capturedSubject, 'entitlement'),
        exact: true,
      })
      const fresh = await entitlementQuery.refetch()
      if (!isCurrentContext()) return
      const freshValid =
        !fresh.isError &&
        fresh.status === 'success' &&
        fresh.data?.accountId === capturedSubject
      const freshStatus = freshValid
        ? planAccessFrom(fresh.data)
        : 'unavailable'
      if (freshStatus === 'free' || freshStatus === 'expired') {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: supportPlanAccessKey(capturedSubject, 'catalogue'),
            exact: true,
          }),
          queryClient.invalidateQueries({
            queryKey: supportPlanAccessKey(capturedSubject, 'payments'),
            exact: true,
          }),
        ])
      }
    } catch (error) {
      if (isCurrentContext()) {
        setScopedCheckoutError({
          subject: capturedSubject,
          value: extractApiError(error),
        })
      }
    } finally {
      retryLockRef.current = false
      if (isMountedRef.current) {
        setIsRetrying(false)
      }
    }
  }, [
    api,
    entitlementQuery,
    invalidateLiveEntitlement,
    offline,
    queryClient,
    safetyOverride,
    setIsRetrying,
    setScopedCheckoutError,
    setScopedExternalNotice,
    subject,
  ])

  const applySettlementToCurrentMount = useCallback(
    async (
      capturedSubject: string,
      capturedEpoch: number,
      outcome: CheckoutSettlementOutcome,
    ) => {
      const isStillCurrent = () =>
        isMountedRef.current &&
        lifecycleEpochRef.current === capturedEpoch &&
        activeSubjectRef.current === capturedSubject

      if (!isStillCurrent() || outcome.kind === 'aborted') return

      if (outcome.kind === 'error') {
        hadUncertainAttemptRef.current = Boolean(outcome.error.uncertain)
        setScopedCheckoutError({
          subject: capturedSubject,
          value: outcome.error,
        })
        if (outcome.refreshPayments) {
          await queryClient.cancelQueries({
            queryKey: supportPlanAccessKey(capturedSubject, 'payments'),
            exact: true,
          })
          await paymentsQuery.refetch()
        }
        return
      }

      hadUncertainAttemptRef.current = false
      setScopedCheckoutError(null)
      const nextScoped: SubjectScoped<PlanPayment> = {
        subject: capturedSubject,
        value: outcome.payment,
      }
      scopedPaymentRef.current = nextScoped
      setScopedPayment(nextScoped)

      await queryClient.invalidateQueries({
        queryKey: supportPlanAccessKey(capturedSubject, 'payments'),
      })

      if (outcome.payment.status === 'SUCCEEDED') {
        await reconcileStatus()
      }
    },
    [
      paymentsQuery,
      queryClient,
      reconcileStatus,
      setScopedCheckoutError,
      setScopedPayment,
    ],
  )

  useEffect(() => {
    if (!subject) return
    const existingInFlight =
      getInFlightCheckout<CheckoutSettlementOutcome>(subject)
    if (!existingInFlight) return

    const capturedSubject = subject
    const capturedEpoch = lifecycleEpochRef.current

    void existingInFlight.promise
      .then(async (outcome) => {
        await applySettlementToCurrentMount(
          capturedSubject,
          capturedEpoch,
          outcome,
        )
      })
      .finally(() => {
        if (
          isMountedRef.current &&
          activeSubjectRef.current === capturedSubject
        ) {
          setIsJoiningInFlight(false)
          setInFlightSettlementTick((tick) => tick + 1)
        }
      })
  }, [applySettlementToCurrentMount, subject])

  const startPlusUpgrade = useCallback(async () => {
    if (!subject || !api || safetyOverride || offline) return

    const existingInFlight =
      getInFlightCheckout<CheckoutSettlementOutcome>(subject)
    if (existingInFlight) {
      if (checkoutLockRef.current) return
      const capturedSubject = subject
      const capturedEpoch = lifecycleEpochRef.current
      checkoutLockRef.current = true
      setIsJoiningInFlight(true)
      try {
        const outcome = await existingInFlight.promise
        await applySettlementToCurrentMount(
          capturedSubject,
          capturedEpoch,
          outcome,
        )
      } finally {
        checkoutLockRef.current = false
        if (isMountedRef.current) {
          setIsJoiningInFlight(false)
        }
      }
      return
    }

    if (checkoutLockRef.current || checkoutMutation.isPending) return

    const availability = selectPlusUpgradePlan(catalogueQuery.data ?? null)
    if (!availability.available) {
      setScopedCheckoutError({
        subject,
        value: {
          code: availability.code,
          message: availability.reason,
        },
      })
      return
    }

    const capturedSubject = subject
    const capturedEpoch = lifecycleEpochRef.current
    const isCurrentContext = () =>
      isMountedRef.current &&
      lifecycleEpochRef.current === capturedEpoch &&
      activeSubjectRef.current === capturedSubject

    checkoutLockRef.current = true
    setScopedExternalNotice(null)

    try {
      const planVersionId = availability.plan.planVersionId
      let existingAttempt = getCheckoutAttempt(capturedSubject, planVersionId)
      if (
        existingAttempt?.status === 'pending' &&
        existingAttempt.paymentId &&
        latestPayment?.paymentId === existingAttempt.paymentId &&
        (latestPayment.status === 'FAILED' ||
          latestPayment.status === 'CHARGEBACK')
      ) {
        markCheckoutAttemptTerminal(capturedSubject, latestPayment.paymentId)
        existingAttempt = getCheckoutAttempt(capturedSubject, planVersionId)
      }

      if (existingAttempt?.status === 'pending' && existingAttempt.paymentId) {
        setScopedCheckoutError(null)
        await reconcileStatus()
        return
      }

      const isReplayingUncertainAttempt =
        existingAttempt?.status === 'uncertain' ||
        existingAttempt?.status === 'preparing'

      // When creating a new checkout attempt (not replaying an in-session uncertain/preparing
      // Idempotency-Key), enforce authoritative entitlement + live payment history verification
      // at submit time to prevent cold-start and TOCTOU duplicate checkouts.
      if (!isReplayingUncertainAttempt) {
        const liveEntitlement = verifiedEntitlementRef.current
        const liveEntitlementAccess =
          liveEntitlement &&
          liveEntitlement.subject === capturedSubject &&
          liveEntitlement.generation === verificationGenRef.current
            ? planAccessFrom(liveEntitlement.value)
            : 'unavailable'
        if (
          liveEntitlementAccess !== 'free' &&
          liveEntitlementAccess !== 'expired'
        ) {
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: 'ENTITLEMENT_UNAVAILABLE',
              message:
                'Chưa xác minh được quyền gói hiện tại từ Consultation trước khi tạo giao dịch.',
              uncertain: false,
            },
          })
          return
        }

        // If an earlier uncertain/preparing attempt's TTL expired in-session, verify `/payments`
        // from the server before minting any new idempotencyKey so a charge is never duplicated.
        if (
          hadUncertainAttemptRef.current ||
          hasExpiredUnresolvedCheckoutAttempt(capturedSubject)
        ) {
          try {
            const refreshedHistory = await api.getPaymentHistory()
            if (!isCurrentContext()) return
            const verifiedHistory: VerifiedPaymentHistoryState = {
              subject: capturedSubject,
              generation: verificationGenRef.current,
              value: refreshedHistory,
            }
            verifiedPaymentHistoryRef.current = verifiedHistory
            setVerifiedPaymentHistory(verifiedHistory)
            queryClient.setQueryData(
              supportPlanAccessKey(capturedSubject, 'payments'),
              refreshedHistory,
            )
            const unresolvedPending = refreshedHistory.items.find(
              (item) => item.status === 'PENDING',
            )
            if (unresolvedPending) {
              hadUncertainAttemptRef.current = false
              clearExpiredUnresolvedCheckoutAttempt(capturedSubject)
              const nextScoped: SubjectScoped<PlanPayment> = {
                subject: capturedSubject,
                value: unresolvedPending,
              }
              scopedPaymentRef.current = nextScoped
              setScopedPayment(nextScoped)
              setScopedCheckoutError({
                subject: capturedSubject,
                value: {
                  code: 'PENDING_PAYMENT_RECOVERY_REQUIRED',
                  message:
                    'Trên máy chủ đang có giao dịch nâng cấp Plus chưa hoàn tất. Vui lòng đối chiếu thanh toán thay vì mở giao dịch mới.',
                  uncertain: false,
                },
              })
              return
            }
            hadUncertainAttemptRef.current = false
            clearExpiredUnresolvedCheckoutAttempt(capturedSubject)
          } catch {
            if (!isCurrentContext()) return
            setScopedCheckoutError({
              subject: capturedSubject,
              value: {
                code: 'PENDING_PAYMENT_RECOVERY_REQUIRED',
                message:
                  'Không thể kiểm tra lịch sử giao dịch sau khi phiên thử lại hết hạn. Vui lòng đối chiếu lại thanh toán trước khi thử mở giao dịch mới.',
                uncertain: false,
              },
            })
            return
          }
        }

        if (paymentsQuery.isError) {
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: 'PAYMENT_HISTORY_UNAVAILABLE',
              message:
                'Chưa tải được lịch sử giao dịch từ Consultation để xác minh không có thanh toán đang chờ.',
              uncertain: false,
            },
          })
          return
        }

        const liveHistory = verifiedPaymentHistoryRef.current
        if (
          !liveHistory ||
          liveHistory.subject !== capturedSubject ||
          liveHistory.generation !== verificationGenRef.current ||
          paymentsQuery.isLoading ||
          paymentsQuery.isFetching ||
          reconcileLockRef.current
        ) {
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: 'PAYMENT_HISTORY_LOADING',
              message:
                'Đang kiểm tra lịch sử giao dịch từ Consultation trước khi mở nâng cấp.',
              uncertain: false,
            },
          })
          return
        }

        const scopedForSubject =
          scopedPaymentRef.current?.subject === capturedSubject
            ? scopedPaymentRef.current.value
            : null
        const livePendingItem =
          (scopedForSubject?.status === 'PENDING' ? scopedForSubject : null) ??
          liveHistory.value.items.find((item) => item.status === 'PENDING') ??
          (latestPayment?.status === 'PENDING' ? latestPayment : null)

        if (livePendingItem) {
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: 'PENDING_PAYMENT_RECOVERY_REQUIRED',
              message:
                'Trên máy chủ đang có giao dịch nâng cấp Plus chưa hoàn tất. Vui lòng đối chiếu thanh toán thay vì mở giao dịch mới.',
              uncertain: false,
            },
          })
          await reconcileStatus()
          return
        }
      }

      const idempotencyKey =
        existingAttempt &&
        (existingAttempt.status === 'uncertain' ||
          existingAttempt.status === 'preparing')
          ? existingAttempt.idempotencyKey
          : randomUUID()
      const expectedPaymentId = existingAttempt?.paymentId

      saveCheckoutAttempt({
        subject: capturedSubject,
        planVersionId,
        idempotencyKey,
        status: 'preparing',
        paymentId: expectedPaymentId,
      })

      const settlementPromise =
        (async (): Promise<CheckoutSettlementOutcome> => {
          try {
            const payment = await checkoutMutation.mutateAsync({
              planVersionId,
              idempotencyKey,
            })
            const currentAttempt = getCheckoutAttempt(
              capturedSubject,
              planVersionId,
            )
            if (
              !currentAttempt ||
              currentAttempt.idempotencyKey !== idempotencyKey
            ) {
              return { kind: 'aborted' }
            }

            const paymentAccountId = (payment as { accountId?: unknown })
              .accountId
            if (
              !payment.paymentId ||
              payment.planVersionId !== planVersionId ||
              (expectedPaymentId && payment.paymentId !== expectedPaymentId) ||
              (typeof paymentAccountId === 'string' &&
                paymentAccountId !== capturedSubject)
            ) {
              clearCheckoutAttempt(capturedSubject)
              clearPendingUpgradeIntent(capturedSubject)
              clearExpiredUnresolvedCheckoutAttempt(capturedSubject)
              return {
                kind: 'error',
                error: {
                  code: 'PAYMENT_IDENTITY_MISMATCH',
                  message:
                    'Phản hồi giao dịch từ máy chủ không khớp gói nâng cấp hoặc tài khoản hiện tại.',
                  uncertain: false,
                },
              }
            }

            clearExpiredUnresolvedCheckoutAttempt(capturedSubject)
            if (
              payment.status === 'PENDING' ||
              payment.status === 'SUCCEEDED'
            ) {
              markCheckoutAttemptPending(
                capturedSubject,
                payment.planVersionId,
                idempotencyKey,
                payment.paymentId,
                Date.now(),
                payment,
              )
              setPendingUpgradeIntent({
                subject: capturedSubject,
                paymentId: payment.paymentId,
                origin: validatedOrigin,
              })
            } else {
              markCheckoutAttemptTerminal(capturedSubject, payment.paymentId)
              clearPendingUpgradeIntent(capturedSubject)
            }

            return { kind: 'success', payment }
          } catch (error) {
            const currentAttempt = getCheckoutAttempt(
              capturedSubject,
              planVersionId,
            )
            if (
              !currentAttempt ||
              currentAttempt.idempotencyKey !== idempotencyKey
            ) {
              return { kind: 'aborted' }
            }

            const apiError =
              error instanceof ApiError ? error : toApiError(error)
            if (isPreCreationDeterministicRejection(apiError)) {
              clearExpiredUnresolvedCheckoutAttempt(capturedSubject)
              clearCheckoutAttempt(capturedSubject)
              return {
                kind: 'error',
                error: {
                  code: apiError.code,
                  message: apiError.message,
                  uncertain: false,
                },
                refreshPayments:
                  apiError.code === 'SUBSCRIPTION_PAYMENT_PENDING',
              }
            }

            markCheckoutAttemptUncertain(
              capturedSubject,
              planVersionId,
              idempotencyKey,
            )
            return {
              kind: 'error',
              error: {
                code: apiError.code,
                message:
                  'Chưa rõ máy chủ đã tạo giao dịch hay chưa do gián đoạn kết nối. Hệ thống giữ nguyên mã idempotency và sẽ dùng lại chính mã này khi thử lại.',
                uncertain: true,
              },
            }
          } finally {
            clearInFlightCheckout(capturedSubject, idempotencyKey)
          }
        })()

      setInFlightCheckout({
        subject: capturedSubject,
        planVersionId,
        idempotencyKey,
        promise: settlementPromise,
      })

      const outcome = await settlementPromise
      await applySettlementToCurrentMount(
        capturedSubject,
        capturedEpoch,
        outcome,
      )
    } finally {
      checkoutLockRef.current = false
    }
  }, [
    api,
    applySettlementToCurrentMount,
    catalogueQuery.data,
    checkoutMutation,
    latestPayment,
    offline,
    paymentsQuery.isError,
    paymentsQuery.isFetching,
    paymentsQuery.isLoading,
    queryClient,
    reconcileStatus,
    safetyOverride,
    setIsJoiningInFlight,
    setScopedCheckoutError,
    setScopedExternalNotice,
    setScopedPayment,
    setVerifiedPaymentHistory,
    subject,
    validatedOrigin,
  ])

  const openHostedCheckoutUrl = useCallback(async () => {
    if (!subject || !latestPayment?.checkoutUrl || offline) return
    if (
      !canOpenHostedCheckoutUrl(
        latestPayment.checkoutUrl,
        latestPayment.provider,
      )
    ) {
      setScopedExternalNotice({
        subject,
        value:
          latestPayment.provider === 'PAYOS'
            ? 'Liên kết thanh toán ngoài không thuộc tên miền được phép. Vui lòng dùng thông tin chuyển khoản VietQR bên dưới.'
            : `Nhà cung cấp ${providerDisplayLabel(latestPayment.provider)} không hỗ trợ mở liên kết thanh toán ngoài.`,
      })
      return
    }
    setPendingUpgradeIntent({
      subject,
      paymentId: latestPayment.paymentId,
      origin: validatedOrigin,
    })
    try {
      const supported = await Linking.canOpenURL(latestPayment.checkoutUrl)
      if (!supported) {
        setScopedExternalNotice({
          subject,
          value:
            'Thiết bị không mở được trình duyệt ngoài cho PayOS. Vui lòng chuyển khoản bằng thông tin VietQR bên dưới.',
        })
        return
      }
      await Linking.openURL(latestPayment.checkoutUrl)
      setScopedExternalNotice({
        subject,
        value:
          'Đã mở trang thanh toán PayOS. Sau khi hoàn tất, vui lòng quay lại ứng dụng MentalBridge để đối chiếu với Consultation.',
      })
    } catch {
      setScopedExternalNotice({
        subject,
        value:
          'Không thể mở trang PayOS lúc này. Bạn có thể chuyển khoản bằng thông tin VietQR bên dưới rồi bấm kiểm tra lại.',
      })
    }
  }, [
    latestPayment,
    offline,
    setScopedExternalNotice,
    subject,
    validatedOrigin,
  ])

  useEffect(() => {
    if (!queriesEnabled) return
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current
      appStateRef.current = nextState
      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active'
      ) {
        if (!offline) {
          invalidateLiveEntitlement()
          if (reconcileLockRef.current) {
            pendingForegroundReconcileRef.current = true
            return
          }
        }
        void reconcileStatus()
      }
    })
    return () => subscription.remove()
  }, [invalidateLiveEntitlement, offline, queriesEnabled, reconcileStatus])

  const clearUpgradeConfirmation = useCallback(() => {
    if (subject) {
      clearPendingUpgradeIntent(subject)
    }
    setConfirmedUpgrade(null)
  }, [setConfirmedUpgrade, subject])

  const fallbackUncertainError: CheckoutErrorInfo | null =
    currentSubjectAttempt?.status === 'uncertain'
      ? {
          code: 'CHECKOUT_OUTCOME_UNCERTAIN',
          message:
            'Chưa rõ máy chủ đã tạo giao dịch hay chưa do gián đoạn kết nối. Hệ thống giữ nguyên mã idempotency và sẽ dùng lại chính mã này khi thử lại.',
          uncertain: true,
        }
      : null

  const activeError =
    subject && scopedCheckoutError?.subject === subject
      ? scopedCheckoutError.value
      : fallbackUncertainError
  const activeNotice =
    subject && scopedExternalNotice?.subject === subject
      ? scopedExternalNotice.value
      : null
  const hasActiveInFlightCheckout = Boolean(
    subject && getInFlightCheckout(subject),
  )

  return {
    resolved,
    isChecking:
      queriesEnabled &&
      !offline &&
      (isRetrying ||
        entitlementQuery.isFetching ||
        catalogueQuery.isFetching ||
        paymentsQuery.isFetching),
    isReconciling,
    isStartingCheckout:
      checkoutMutation.isPending ||
      isJoiningInFlight ||
      hasActiveInFlightCheckout,
    checkoutError: activeError,
    externalCheckoutNotice: activeNotice,
    activePayment: latestPayment,
    reconcileStatus,
    retryEntitlementCheck,
    startPlusUpgrade,
    openHostedCheckoutUrl,
    clearUpgradeConfirmation,
  }
}
