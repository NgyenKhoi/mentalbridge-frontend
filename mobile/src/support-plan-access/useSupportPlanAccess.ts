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
  type GuideOrigin,
  type PlanPayment,
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
  hasOwnedPlanOrHistory?: boolean | undefined
  offline?: boolean | undefined
  origin?: GuideOrigin | undefined
}>

type SubjectScoped<T> = Readonly<{
  subject: string
  value: T
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
    hasOwnedPlanOrHistory = false,
    offline = false,
    origin,
  } = options
  const validatedOrigin = sanitizeGuideOrigin(origin)

  const queryClient = useQueryClient()
  const isMountedRef = useRef(true)
  const lifecycleEpochRef = useRef(0)
  const activeSubjectRef = useRef<string | null>(subject)

  const prevSubjectRef = useRef<string | null>(subject)
  const prevOfflineRef = useRef(offline)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const reconcileLockRef = useRef(false)
  const checkoutLockRef = useRef(false)
  const retryLockRef = useRef(false)

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

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      lifecycleEpochRef.current += 1
    }
  }, [])

  useEffect(() => {
    const previousSubject = prevSubjectRef.current
    activeSubjectRef.current = subject
    if (previousSubject !== subject) {
      lifecycleEpochRef.current += 1
      if (previousSubject) {
        clearPendingUpgradeIntent(previousSubject)
        clearCheckoutAttempt(previousSubject)
        queryClient.removeQueries({
          queryKey: ['support-plan-access', previousSubject],
        })
      }
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
      const current = queryClient.getQueryData(
        supportPlanAccessKey(subject, 'entitlement'),
      )
      if (
        !current ||
        planAccessFrom(current as Parameters<typeof planAccessFrom>[0]) ===
          'paid'
      ) {
        queryClient.removeQueries({
          queryKey: supportPlanAccessKey(subject, 'entitlement'),
          exact: true,
        })
      }
    }
  }, [offline, queryClient, subject])

  const entitlementQuery = useQuery({
    queryKey: supportPlanAccessKey(subject, 'entitlement'),
    enabled: queriesEnabled && !offline,
    retry: false,
    staleTime: 0,
    refetchOnMount: 'always',
    queryFn: async () => {
      if (!api) {
        throw new ApiError({
          code: 'ENTITLEMENT_UNAVAILABLE',
          message: 'Thiếu dịch vụ kiểm tra quyền gói.',
        })
      }
      return api.getEntitlement()
    },
  })

  const entitlementMatchesSubject =
    Boolean(subject) && entitlementQuery.data?.accountId === subject
  const cachedPlanStatus = entitlementMatchesSubject
    ? planAccessFrom(entitlementQuery.data)
    : 'unavailable'

  // Cached FREE/EXPIRED lock state may remain in-session when offline (buttons disabled);
  // cached PAID entitlement must NEVER be trusted offline or after any query error.
  const canUseOfflineLockedState =
    offline &&
    queriesEnabled &&
    !entitlementQuery.isError &&
    entitlementMatchesSubject &&
    (cachedPlanStatus === 'free' || cachedPlanStatus === 'expired')

  const canTrustEntitlement =
    (queriesEnabled &&
      !offline &&
      !entitlementQuery.isError &&
      entitlementQuery.status === 'success' &&
      entitlementMatchesSubject &&
      (entitlementQuery.isFetchedAfterMount || !entitlementQuery.isFetching)) ||
    canUseOfflineLockedState

  const rawStatus = !canTrustEntitlement
    ? 'unavailable'
    : planAccessFrom(entitlementQuery.data)
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
    !entitlementQuery.data &&
    !entitlementQuery.isError

  const resolvedErrorCode = !subject
    ? 'UNAUTHENTICATED'
    : offline && !canUseOfflineLockedState
      ? 'NETWORK_ERROR'
      : (entitlementError?.code ??
        (entitlementQuery.data && !entitlementMatchesSubject
          ? 'ENTITLEMENT_SUBJECT_MISMATCH'
          : entitlementMissingResult
            ? 'ENTITLEMENT_UNAVAILABLE'
            : undefined))

  const resolved = resolveSupportPlanAccessState({
    safetyOverride,
    loading:
      queriesEnabled &&
      !offline &&
      (entitlementQuery.isLoading ||
        (entitlementQuery.isFetching && !canTrustEntitlement)),
    offline,
    entitlement: canTrustEntitlement ? (entitlementQuery.data ?? null) : null,
    errorCode: resolvedErrorCode,
    hasOwnedPlanOrHistory,
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
    const isCurrentContext = () =>
      isMountedRef.current &&
      lifecycleEpochRef.current === capturedEpoch &&
      activeSubjectRef.current === capturedSubject

    reconcileLockRef.current = true
    setIsReconciling(true)

    try {
      const intent = getPendingUpgradeIntent(capturedSubject)
      const attempt = getCheckoutAttempt(capturedSubject)
      let pendingPaymentId: string | null =
        intent?.paymentId ??
        attempt?.paymentId ??
        (latestPayment?.status === 'PENDING' ? latestPayment.paymentId : null)

      let paymentCheckFailed = false
      let settledTrackedPayment: PlanPayment | null = null

      if (!pendingPaymentId && attempt?.status === 'uncertain') {
        try {
          const history = await api.getPaymentHistory()
          if (!isCurrentContext()) return
          queryClient.setQueryData(
            supportPlanAccessKey(capturedSubject, 'payments'),
            history,
          )
          const pendingFromHistory = history.items.find(
            (item) => item.status === 'PENDING',
          )
          if (pendingFromHistory) {
            pendingPaymentId = pendingFromHistory.paymentId
            markCheckoutAttemptPending(
              capturedSubject,
              pendingFromHistory.planVersionId,
              attempt.idempotencyKey,
              pendingFromHistory.paymentId,
            )
            setPendingUpgradeIntent({
              subject: capturedSubject,
              paymentId: pendingFromHistory.paymentId,
              origin: validatedOrigin,
            })
            setScopedPayment({
              subject: capturedSubject,
              value: pendingFromHistory,
            })
          }
        } catch (error) {
          if (!isCurrentContext()) return
          paymentCheckFailed = true
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              ...extractApiError(error),
              uncertain: true,
            },
          })
        }
      }

      if (pendingPaymentId) {
        try {
          const reconciled = await api.getPayment(pendingPaymentId)
          if (!isCurrentContext()) return
          if (reconciled.paymentId !== pendingPaymentId) {
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
            markCheckoutAttemptTerminal(capturedSubject, reconciled.paymentId)
          } else if (reconciled.status === 'SUCCEEDED') {
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

      const freshEntitlement = await entitlementQuery.refetch()
      if (!isCurrentContext()) return

      const freshValid =
        !freshEntitlement.isError &&
        freshEntitlement.data?.accountId === capturedSubject
      const freshAccess = freshValid
        ? planAccessFrom(freshEntitlement.data)
        : 'unavailable'

      const hasVerifiedTrackedSettlement = Boolean(
        freshAccess === 'paid' &&
        !paymentCheckFailed &&
        pendingPaymentId &&
        settledTrackedPayment &&
        settledTrackedPayment.paymentId === pendingPaymentId &&
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
    subject,
    validatedOrigin,
  ])

  const retryEntitlementCheck = useCallback(async () => {
    if (!subject || !api || safetyOverride || offline) return
    if (retryLockRef.current) return

    const capturedSubject = subject
    const capturedEpoch = lifecycleEpochRef.current
    const isCurrentContext = () =>
      isMountedRef.current &&
      lifecycleEpochRef.current === capturedEpoch &&
      activeSubjectRef.current === capturedSubject

    retryLockRef.current = true
    setIsRetrying(true)
    setScopedCheckoutError(null)
    setScopedExternalNotice(null)

    try {
      const fresh = await entitlementQuery.refetch()
      if (!isCurrentContext()) return
      const freshValid =
        !fresh.isError && fresh.data?.accountId === capturedSubject
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
    offline,
    paymentsQuery,
    safetyOverride,
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
      if (latestPayment?.status === 'PENDING') {
        setScopedCheckoutError(null)
        await reconcileStatus()
        return
      }

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

      if (existingAttempt?.status === 'uncertain') {
        try {
          const history = await api.getPaymentHistory()
          if (!isCurrentContext()) return
          queryClient.setQueryData(
            supportPlanAccessKey(capturedSubject, 'payments'),
            history,
          )
          const pendingFromHistory = history.items.find(
            (item) => item.status === 'PENDING',
          )
          if (pendingFromHistory) {
            markCheckoutAttemptPending(
              capturedSubject,
              pendingFromHistory.planVersionId,
              existingAttempt.idempotencyKey,
              pendingFromHistory.paymentId,
            )
            setPendingUpgradeIntent({
              subject: capturedSubject,
              paymentId: pendingFromHistory.paymentId,
              origin: validatedOrigin,
            })
            setScopedPayment({
              subject: capturedSubject,
              value: pendingFromHistory,
            })
            setScopedCheckoutError(null)
            return
          }
        } catch (historyError) {
          if (!isCurrentContext()) return
          const extracted = extractApiError(historyError)
          setScopedCheckoutError({
            subject: capturedSubject,
            value: {
              code: 'CHECKOUT_OUTCOME_UNCERTAIN',
              message: `${extracted.message} Chưa thể xác minh trạng thái giao dịch trước; mã idempotency được giữ nguyên để thử lại an toàn.`,
              uncertain: true,
            },
          })
          return
        }
      }

      if (existingAttempt?.status === 'pending' && existingAttempt.paymentId) {
        await reconcileStatus()
        return
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

        setScopedCheckoutError(null)
        setScopedPayment({ subject: capturedSubject, value: payment })

        if (payment.status === 'PENDING') {
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
        } else if (payment.status === 'SUCCEEDED') {
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
                'Chưa rõ máy chủ đã tạo giao dịch hay chưa do gián đoạn kết nối. Hệ thống giữ nguyên mã idempotency và sẽ đối chiếu /payments trước khi thử lại.',
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
  }, [latestPayment, offline, subject, validatedOrigin])

  useEffect(() => {
    const wasOffline = prevOfflineRef.current
    prevOfflineRef.current = offline
    if (wasOffline && !offline && queriesEnabled) {
      void retryEntitlementCheck()
    }
  }, [offline, queriesEnabled, retryEntitlementCheck])

  useEffect(() => {
    if (!queriesEnabled) return
    const subscription = AppState.addEventListener('change', (nextState) => {
      const prevState = appStateRef.current
      appStateRef.current = nextState
      if (
        (prevState === 'background' || prevState === 'inactive') &&
        nextState === 'active'
      ) {
        void reconcileStatus()
      }
    })
    return () => subscription.remove()
  }, [queriesEnabled, reconcileStatus])

  const clearUpgradeConfirmation = useCallback(() => {
    if (subject) {
      clearPendingUpgradeIntent(subject)
    }
    setConfirmedUpgrade(null)
  }, [subject])

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
