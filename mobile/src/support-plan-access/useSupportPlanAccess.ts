import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Linking, type AppStateStatus } from 'react-native'

import { ApiError, toApiError } from '@/api/api-error'

import {
  planAccessFrom,
  resolveSupportPlanAccessState,
  selectLatestRelevantPayment,
  selectPlusUpgradePlan,
  type ResolvedSupportPlanAccess,
} from './plan-access-model'
import type { SupportPlanAccessApi } from './support-plan-access-api'
import {
  isAllowedCheckoutUrl,
  type GuideOrigin,
  type PlanPayment,
} from './support-plan-access-contract'
import {
  clearPendingUpgradeIntent,
  consumePendingUpgradeIntent,
  getPendingUpgradeIntent,
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

export type SupportPlanAccessController = Readonly<{
  resolved: ResolvedSupportPlanAccess
  isChecking: boolean
  isReconciling: boolean
  isStartingCheckout: boolean
  checkoutError: Readonly<{ code: string; message: string }> | null
  externalCheckoutNotice: string | null
  activePayment: PlanPayment | null
  reconcileStatus(): Promise<void>
  retryEntitlementCheck(): Promise<void>
  startPlusUpgrade(): Promise<void>
  openHostedCheckoutUrl(): Promise<void>
  clearUpgradeConfirmation(): void
}>

/**
 * Orchestrates authoritative Consultation entitlement checks, PayOS checkout initiation,
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

  const queryClient = useQueryClient()
  const prevSubjectRef = useRef<string | null>(subject)
  const appStateRef = useRef<AppStateStatus>(AppState.currentState)
  const reconcileLockRef = useRef(false)

  const [scopedPayment, setScopedPayment] =
    useState<SubjectScoped<PlanPayment> | null>(null)
  const [scopedCheckoutError, setScopedCheckoutError] = useState<SubjectScoped<
    Readonly<{ code: string; message: string }>
  > | null>(null)
  const [scopedExternalNotice, setScopedExternalNotice] =
    useState<SubjectScoped<string> | null>(null)
  const [confirmedUpgrade, setConfirmedUpgrade] = useState<SubjectScoped<
    GuideOrigin | undefined
  > | null>(null)
  const [isReconciling, setIsReconciling] = useState(false)

  useEffect(() => {
    const previousSubject = prevSubjectRef.current
    if (previousSubject !== subject) {
      if (previousSubject) {
        clearPendingUpgradeIntent(previousSubject)
        queryClient.removeQueries({
          queryKey: ['support-plan-access', previousSubject],
        })
      }
      setScopedPayment(null)
      setScopedCheckoutError(null)
      setScopedExternalNotice(null)
      setConfirmedUpgrade(null)
      reconcileLockRef.current = false
      prevSubjectRef.current = subject
    }
  }, [queryClient, subject])

  const queriesEnabled = Boolean(subject && api && !safetyOverride)

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

  const rawStatus =
    entitlementQuery.isError || !queriesEnabled
      ? 'unavailable'
      : planAccessFrom(entitlementQuery.data)
  const shouldLoadBilling =
    queriesEnabled &&
    !offline &&
    !entitlementQuery.isError &&
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

  const activePendingIntent = subject ? getPendingUpgradeIntent(subject) : null
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
    !entitlementQuery.isLoading &&
    !entitlementQuery.isFetching &&
    !entitlementQuery.data &&
    !entitlementQuery.isError

  const resolved = resolveSupportPlanAccessState({
    safetyOverride,
    loading:
      queriesEnabled &&
      (entitlementQuery.isLoading ||
        (entitlementQuery.isFetching && !entitlementQuery.data)),
    offline,
    entitlement:
      queriesEnabled && !entitlementQuery.isError
        ? (entitlementQuery.data ?? null)
        : null,
    errorCode: !subject
      ? 'UNAUTHENTICATED'
      : offline && (entitlementQuery.isError || !entitlementQuery.data)
        ? 'NETWORK_ERROR'
        : (entitlementError?.code ??
          (entitlementMissingResult ? 'ENTITLEMENT_UNAVAILABLE' : undefined)),
    hasOwnedPlanOrHistory,
    hasPendingUpgradeIntent:
      isConfirmedForSubject || Boolean(activePendingIntent),
    catalogue: catalogueQuery.data ?? null,
    latestPayment,
    origin: confirmedOrigin ?? origin,
  })

  const checkoutMutation = useMutation({
    retry: false,
    mutationFn: async (planVersionId: string) => {
      if (!api || !subject) {
        throw new ApiError({
          code: 'UNAUTHENTICATED',
          message: 'Cần đăng nhập tài khoản để tạo giao dịch.',
        })
      }
      const key = randomUUID()
      return api.startCheckout(planVersionId, key)
    },
    onSuccess: (payment) => {
      if (!subject) return
      setScopedCheckoutError(null)
      setScopedPayment({ subject, value: payment })
      if (payment.status === 'PENDING') {
        setPendingUpgradeIntent({
          subject,
          paymentId: payment.paymentId,
          origin,
        })
      }
      void queryClient.invalidateQueries({
        queryKey: supportPlanAccessKey(subject, 'payments'),
      })
    },
    onError: (error) => {
      if (!subject) return
      setScopedCheckoutError({
        subject,
        value: extractApiError(error),
      })
    },
  })

  const reconcileStatus = useCallback(async () => {
    if (!subject || !api || safetyOverride || offline) return
    if (reconcileLockRef.current) return
    reconcileLockRef.current = true
    setIsReconciling(true)

    try {
      const intent = getPendingUpgradeIntent(subject)
      const pendingPaymentId =
        intent?.paymentId ??
        (latestPayment?.status === 'PENDING' ? latestPayment.paymentId : null)

      if (pendingPaymentId) {
        try {
          const reconciled = await api.getPayment(pendingPaymentId)
          setScopedPayment({ subject, value: reconciled })
          if (
            reconciled.status === 'FAILED' ||
            reconciled.status === 'CHARGEBACK'
          ) {
            clearPendingUpgradeIntent(subject)
          }
        } catch (error) {
          setScopedCheckoutError({
            subject,
            value: extractApiError(error),
          })
        }
      }

      const freshEntitlement = await entitlementQuery.refetch()
      const freshAccess = freshEntitlement.data
        ? planAccessFrom(freshEntitlement.data)
        : 'unavailable'

      if (freshAccess === 'paid' && (intent || pendingPaymentId)) {
        const consumed = consumePendingUpgradeIntent(subject)
        setConfirmedUpgrade({
          subject,
          value: consumed?.origin ?? origin,
        })
        setScopedCheckoutError(null)
      } else if (freshAccess === 'free' || freshAccess === 'expired') {
        await paymentsQuery.refetch()
      }
    } finally {
      reconcileLockRef.current = false
      setIsReconciling(false)
    }
  }, [
    api,
    entitlementQuery,
    latestPayment,
    offline,
    origin,
    paymentsQuery,
    safetyOverride,
    subject,
  ])

  const retryEntitlementCheck = useCallback(async () => {
    if (!subject || !api || safetyOverride) return
    setScopedCheckoutError(null)
    setScopedExternalNotice(null)
    const fresh = await entitlementQuery.refetch()
    const freshStatus = fresh.data ? planAccessFrom(fresh.data) : 'unavailable'
    if (freshStatus === 'free' || freshStatus === 'expired') {
      await Promise.all([catalogueQuery.refetch(), paymentsQuery.refetch()])
    }
  }, [
    api,
    catalogueQuery,
    entitlementQuery,
    paymentsQuery,
    safetyOverride,
    subject,
  ])

  const startPlusUpgrade = useCallback(async () => {
    if (!subject || !api || safetyOverride || offline) return
    if (checkoutMutation.isPending) return
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
    setScopedExternalNotice(null)
    try {
      await checkoutMutation.mutateAsync(availability.plan.planVersionId)
    } catch {
      // Captured into scopedCheckoutError via onError.
    }
  }, [
    api,
    catalogueQuery.data,
    checkoutMutation,
    offline,
    safetyOverride,
    subject,
  ])

  const openHostedCheckoutUrl = useCallback(async () => {
    if (!subject || !latestPayment?.checkoutUrl || offline) return
    if (
      !isAllowedCheckoutUrl(latestPayment.checkoutUrl, latestPayment.provider)
    ) {
      setScopedExternalNotice({
        subject,
        value:
          'Liên kết thanh toán ngoài không thuộc tên miền được phép. Vui lòng dùng thông tin chuyển khoản VietQR bên dưới.',
      })
      return
    }
    setPendingUpgradeIntent({
      subject,
      paymentId: latestPayment.paymentId,
      origin,
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
          'Đã mở cổng PayOS. Sau khi hoàn tất, vui lòng quay lại ứng dụng MentalBridge để hệ thống đối chiếu quyền Plus.',
      })
    } catch {
      setScopedExternalNotice({
        subject,
        value:
          'Không thể mở trang PayOS lúc này. Bạn có thể chuyển khoản bằng thông tin VietQR bên dưới rồi bấm kiểm tra lại.',
      })
    }
  }, [latestPayment, offline, origin, subject])

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
      (entitlementQuery.isFetching ||
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
