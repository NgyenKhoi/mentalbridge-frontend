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
  type ResolvedSupportPlanAccess,
} from './plan-access-model'
import type { SupportPlanAccessApi } from './support-plan-access-api'
import {
  canOpenHostedCheckoutUrl,
  sanitizeGuideOrigin,
  verifyCareOwnership,
  type CareOwnedPlanProof,
  type GuideOrigin,
  type PlanPayment,
  type ServiceCreditEntitlement,
} from './support-plan-access-contract'
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

export type UseSupportPlanAccessOptions = Readonly<{
  subject: string | null
  api: SupportPlanAccessApi | null
  safetyOverride?: boolean | undefined
  careOwnership?: CareOwnedPlanProof | undefined
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

function supportPlanAccessKey(
  subject: string | null,
  scope: 'entitlement' | 'catalogue' | 'payments',
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
    hasOwnedPlanOrHistory,
    offline = false,
    origin,
  } = options
  const validatedOrigin = sanitizeGuideOrigin(origin)
  const verifiedCareOwnership = verifyCareOwnership(
    careOwnership,
    subject,
    hasOwnedPlanOrHistory,
  )

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
  const pendingForegroundReconcileRef = useRef(false)
  const hadUncertainAttemptRef = useRef(false)

  const [verificationGen, setVerificationGen] = useState(0)
  const [verifiedEntitlement, setVerifiedEntitlement] =
    useState<VerifiedEntitlementState | null>(null)
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

  const invalidateLiveEntitlement = useCallback(() => {
    verificationGenRef.current += 1
    entitlementReqSeqRef.current += 1
    setVerificationGen(verificationGenRef.current)
    setVerifiedEntitlement(null)
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      lifecycleEpochRef.current += 1
      entitlementReqSeqRef.current += 1
    }
  }, [])

  useEffect(() => {
    const previousSubject = prevSubjectRef.current
    activeSubjectRef.current = subject
    if (previousSubject !== subject) {
      lifecycleEpochRef.current += 1
      verificationGenRef.current += 1
      entitlementReqSeqRef.current += 1
      pendingForegroundReconcileRef.current = false
      hadUncertainAttemptRef.current = false
      if (previousSubject) {
        clearPendingUpgradeIntent(previousSubject)
        clearCheckoutAttempt(previousSubject)
        queryClient.removeQueries({
          queryKey: ['support-plan-access', previousSubject],
        })
      }
      setVerificationGen(verificationGenRef.current)
      setVerifiedEntitlement(null)
      setScopedPayment(null)
      setScopedCheckoutError(null)
      setScopedExternalNotice(null)
      setConfirmedUpgrade(null)
      reconcileLockRef.current = false
      checkoutLockRef.current = false
      retryLockRef.current = false
      setIsReconciling(false)
      setIsRetrying(false)
      prevSubjectRef.current = subject
    }
    return () => {
      lifecycleEpochRef.current += 1
    }
  }, [queryClient, subject])

  const queriesEnabled = Boolean(subject && api && !safetyOverride)

  useEffect(() => {
    if (!subject) return
    if (offline) {
      queryClient.removeQueries({
        queryKey: supportPlanAccessKey(subject, 'entitlement'),
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
          setVerifiedEntitlement({
            subject: capturedSubject,
            generation: capturedGen,
            value: result,
          })
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
    queryFn: async () => {
      if (!api) {
        throw new ApiError({
          code: 'PAYMENTS_UNAVAILABLE',
          message: 'Thiếu dịch vụ lịch sử thanh toán.',
        })
      }
      return api.getPaymentHistory()
    },
  })

  const activeSubjectPayment =
    subject && scopedPayment?.subject === subject ? scopedPayment.value : null

  const paymentItems = paymentsQuery.data?.items ?? []
  const mergedPayments = activeSubjectPayment
    ? [
        activeSubjectPayment,
        ...paymentItems.filter(
          (item) => item.paymentId !== activeSubjectPayment.paymentId,
        ),
      ]
    : paymentItems
  const latestPayment = selectLatestRelevantPayment(mergedPayments)

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
      queriesEnabled &&
      !offline &&
      !activeVerifiedEntitlement &&
      !entitlementError &&
      (entitlementQuery.isLoading ||
        entitlementQuery.isFetching ||
        isReconciling ||
        isRetrying),
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
              uncertain: attempt?.status === 'uncertain',
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
          setScopedPayment({ subject: capturedSubject, value: reconciled })
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
        await paymentsQuery.refetch()
      } else if (freshAccess === 'free' || freshAccess === 'expired') {
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
      retryLockRef.current = false
      if (isMountedRef.current) {
        setIsRetrying(false)
      }
    }
  }, [
    api,
    catalogueQuery,
    entitlementQuery,
    invalidateLiveEntitlement,
    offline,
    paymentsQuery,
    queryClient,
    safetyOverride,
    setIsRetrying,
    setScopedCheckoutError,
    setScopedExternalNotice,
    subject,
  ])

  const startPlusUpgrade = useCallback(async () => {
    if (!subject || !api || safetyOverride || offline) return
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
        existingAttempt?.status === 'uncertain'

      if (!isReplayingUncertainAttempt && latestPayment?.status === 'PENDING') {
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

      // If an earlier uncertain attempt's TTL just expired in-session, verify `/payments`
      // from the server before minting any new idempotencyKey so a charge is never duplicated.
      if (!isReplayingUncertainAttempt && hadUncertainAttemptRef.current) {
        try {
          const refreshedHistory = await api.getPaymentHistory()
          if (!isCurrentContext()) return
          queryClient.setQueryData(
            supportPlanAccessKey(capturedSubject, 'payments'),
            refreshedHistory,
          )
          const unresolvedPending = refreshedHistory.items.find(
            (item) => item.status === 'PENDING',
          )
          if (unresolvedPending) {
            hadUncertainAttemptRef.current = false
            setScopedPayment({
              subject: capturedSubject,
              value: unresolvedPending,
            })
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
          hadUncertainAttemptRef.current = false
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

      const idempotencyKey =
        existingAttempt && existingAttempt.status === 'uncertain'
          ? existingAttempt.idempotencyKey
          : randomUUID()

      saveCheckoutAttempt({
        subject: capturedSubject,
        planVersionId,
        idempotencyKey,
        status: 'preparing',
      })

      try {
        const payment = await checkoutMutation.mutateAsync({
          planVersionId,
          idempotencyKey,
        })
        if (!isCurrentContext()) return

        const paymentAccountId = (payment as { accountId?: unknown }).accountId
        const expectedPaymentId = existingAttempt?.paymentId
        if (
          !payment.paymentId ||
          payment.planVersionId !== planVersionId ||
          (expectedPaymentId && payment.paymentId !== expectedPaymentId) ||
          (typeof paymentAccountId === 'string' &&
            paymentAccountId !== capturedSubject)
        ) {
          clearCheckoutAttempt(capturedSubject)
          clearPendingUpgradeIntent(capturedSubject)
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: 'PAYMENT_IDENTITY_MISMATCH',
              message:
                'Phản hồi giao dịch từ máy chủ không khớp gói nâng cấp hoặc tài khoản hiện tại.',
              uncertain: false,
            },
          })
          return
        }

        setScopedCheckoutError(null)
        hadUncertainAttemptRef.current = false
        setScopedPayment({ subject: capturedSubject, value: payment })

        if (payment.status === 'PENDING' || payment.status === 'SUCCEEDED') {
          markCheckoutAttemptPending(
            capturedSubject,
            payment.planVersionId,
            idempotencyKey,
            payment.paymentId,
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

        await queryClient.invalidateQueries({
          queryKey: supportPlanAccessKey(capturedSubject, 'payments'),
        })

        if (payment.status === 'SUCCEEDED') {
          await reconcileStatus()
        }
      } catch (error) {
        if (!isCurrentContext()) return
        const apiError = error instanceof ApiError ? error : toApiError(error)
        if (isPreCreationDeterministicRejection(apiError)) {
          hadUncertainAttemptRef.current = false
          clearCheckoutAttempt(capturedSubject)
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: apiError.code,
              message: apiError.message,
              uncertain: false,
            },
          })
          if (apiError.code === 'SUBSCRIPTION_PAYMENT_PENDING') {
            await paymentsQuery.refetch()
          }
        } else {
          hadUncertainAttemptRef.current = true
          markCheckoutAttemptUncertain(
            capturedSubject,
            planVersionId,
            idempotencyKey,
          )
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: apiError.code,
              message:
                'Chưa rõ máy chủ đã tạo giao dịch hay chưa do gián đoạn kết nối. Hệ thống giữ nguyên mã idempotency và sẽ dùng lại chính mã này khi thử lại.',
              uncertain: true,
            },
          })
        }
      }
    } finally {
      checkoutLockRef.current = false
    }
  }, [
    api,
    catalogueQuery.data,
    checkoutMutation,
    latestPayment?.paymentId,
    latestPayment?.status,
    offline,
    paymentsQuery,
    queryClient,
    reconcileStatus,
    safetyOverride,
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

  const activeError =
    subject && scopedCheckoutError?.subject === subject
      ? scopedCheckoutError.value
      : null
  const activeNotice =
    subject && scopedExternalNotice?.subject === subject
      ? scopedExternalNotice.value
      : null

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
    isStartingCheckout: checkoutMutation.isPending,
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
