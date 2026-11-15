import type {
  EntitlementState,
  GuideOrigin,
  PackageCode,
  PlanPayment,
  ServiceCreditEntitlement,
  ServicePlanCatalogue,
  ServicePlanVersion,
} from './support-plan-access-contract'

export type PlanAccessStatus =
  'loading' | 'paid' | 'free' | 'expired' | 'unavailable'

export type PreviewTab = 'today' | 'progress' | 'review'

export type SampleCheckItem = Readonly<{
  id: string
  label: string
  timeLabel: string
  defaultDone: boolean
}>

export type SamplePreviewContent = Readonly<{
  badgeLabel: string
  disclaimerLabel: string
  cycleDays: number
  currentDayLabel: string
  baseCompletedCount: number
  totalCount: number
  todayItems: readonly SampleCheckItem[]
  progressSummary: string
  reviewSummary: string
}>

export const SAMPLE_PREVIEW_CONTENT: SamplePreviewContent = {
  badgeLabel: 'Ví dụ minh hoạ',
  disclaimerLabel: 'Ví dụ minh hoạ, không phải kế hoạch của bạn',
  cycleDays: 14,
  currentDayLabel: 'Ngày 3 trên 14',
  baseCompletedCount: 4,
  totalCount: 5,
  todayItems: [
    {
      id: 'sample-breathe',
      label: 'Thở chậm 5 phút buổi sáng',
      timeLabel: '08:00 · Gợi ý mẫu',
      defaultDone: false,
    },
    {
      id: 'sample-note',
      label: 'Ghi nhanh 1 điều giúp bạn giữ nhịp',
      timeLabel: '20:30 · Gợi ý mẫu',
      defaultDone: true,
    },
  ],
  progressSummary:
    'Mẫu nhịp 14 ngày chỉ dùng để hình dung cách theo dõi bước nhỏ theo tuần — không phải dữ liệu đánh giá sức khoẻ hay cam kết hồi phục.',
  reviewSummary:
    'Cuối chu kỳ mẫu 14 ngày, bạn chọn giữ nhịp hiện tại hoặc điều chỉnh cùng Care sau khi xem lại thực tế của mình.',
}

export const PLUS_BENEFITS: readonly string[] = [
  'Tạo và điều chỉnh Kế hoạch hỗ trợ 14 ngày phù hợp với Hướng dẫn của bạn.',
  'Theo dõi từng hoạt động trong ngày, check-in cảm xúc và nhìn lại theo chu kỳ.',
  'Gói miễn phí luôn mở Hướng dẫn hỗ trợ, Thư viện tài nguyên, Danh bạ chuyên gia và Hỗ trợ an toàn.',
]

/**
 * Derives fail-closed Plan entitlement status strictly from Consultation's
 * `/api/v1/service-credits` response. Contradictory, missing, or unknown fields
 * always map to `'unavailable'` and never fall back to `'free'`.
 */
export function planAccessFrom(
  account: ServiceCreditEntitlement | null | undefined,
): Exclude<PlanAccessStatus, 'loading'> {
  if (!account) return 'unavailable'
  const { entitlementState, supportPlanEnabled, packageCode } = account

  if (entitlementState == null || typeof supportPlanEnabled !== 'boolean') {
    return 'unavailable'
  }

  if (entitlementState === 'ACTIVE') {
    if (!supportPlanEnabled || packageCode === 'FREE') {
      return 'unavailable'
    }
    return 'paid'
  }

  if (entitlementState === 'DEFAULT_FREE') {
    if (supportPlanEnabled || packageCode !== 'FREE') {
      return 'unavailable'
    }
    return 'free'
  }

  if (entitlementState === 'EXPIRED') {
    if (supportPlanEnabled) {
      return 'unavailable'
    }
    return 'expired'
  }

  return 'unavailable'
}

export type CheckoutAvailability =
  | Readonly<{ available: true; plan: ServicePlanVersion }>
  | Readonly<{
      available: false
      code:
        | 'CATALOGUE_UNAVAILABLE'
        | 'PAYMENT_CHECKOUT_DISABLED'
        | 'PROVIDER_MOMO_DORMANT'
        | 'NO_ELIGIBLE_PLUS_PLAN'
      reason: string
    }>

/**
 * Selects the eligible Plus plan only when Consultation reports checkout enabled
 * under an active gateway (`PAYOS` or deterministic `FAKE`). Rejects dormant `MOMO`.
 */
export function selectPlusUpgradePlan(
  catalogue: ServicePlanCatalogue | null | undefined,
): CheckoutAvailability {
  if (!catalogue) {
    return {
      available: false,
      code: 'CATALOGUE_UNAVAILABLE',
      reason: 'Chưa tải được bảng gói từ Consultation.',
    }
  }
  if (!catalogue.checkoutEnabled) {
    return {
      available: false,
      code: 'PAYMENT_CHECKOUT_DISABLED',
      reason:
        'Cổng nâng cấp trực tiếp hiện đang tạm khoá trên hệ thống Consultation.',
    }
  }
  if (catalogue.paymentProvider === 'MOMO') {
    return {
      available: false,
      code: 'PROVIDER_MOMO_DORMANT',
      reason:
        'Cổng MoMo đang tạm ngừng hoạt động. Hệ thống chỉ hỗ trợ thanh toán PayOS.',
    }
  }
  const plusPlan = catalogue.plans.find(
    (plan) =>
      plan.planCode === 'PLUS' &&
      plan.supportPlanEnabled &&
      plan.currency === 'VND',
  )
  if (!plusPlan) {
    return {
      available: false,
      code: 'NO_ELIGIBLE_PLUS_PLAN',
      reason: 'Chưa có phiên bản gói Plus hợp lệ từ Consultation.',
    }
  }
  return { available: true, plan: plusPlan }
}

/**
 * Returns the most recent payment relevant to displaying checkout state
 * (`PENDING` takes priority over older rows, then most recent timestamp).
 */
export function selectLatestRelevantPayment(
  items: readonly PlanPayment[],
): PlanPayment | null {
  if (items.length === 0) return null
  const pending = items
    .filter((item) => item.status === 'PENDING')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  if (pending.length > 0 && pending[0]) {
    return pending[0]
  }
  const sorted = [...items].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )
  return sorted[0] ?? null
}

export type VerifiedPlanAccessContext = Readonly<{
  packageCode: PackageCode
  entitlementState: EntitlementState
  supportPlanEnabled: boolean
  hasOwnedPlanOrHistory: boolean
  upgradedNow: boolean
  origin?: GuideOrigin | undefined
}>

export type ResolvedSupportPlanAccess =
  | Readonly<{
      kind: 'safety-override'
      origin?: GuideOrigin | undefined
    }>
  | Readonly<{
      kind: 'loading'
      origin?: GuideOrigin | undefined
    }>
  | Readonly<{
      kind: 'upgrade-confirmed'
      context: VerifiedPlanAccessContext
      origin?: GuideOrigin | undefined
    }>
  | Readonly<{
      kind: 'owned-plan'
      context: VerifiedPlanAccessContext
      showExpiredUpgradeBanner: boolean
      origin?: GuideOrigin | undefined
    }>
  | Readonly<{
      kind: 'locked-preview'
      variant: 'free' | 'expired'
      latestPayment: PlanPayment | null
      checkout: CheckoutAvailability
      origin?: GuideOrigin | undefined
    }>
  | Readonly<{
      kind: 'unavailable'
      offline: boolean
      errorCode?: string | undefined
      origin?: GuideOrigin | undefined
    }>

export type ResolveAccessInput = Readonly<{
  safetyOverride: boolean
  loading: boolean
  offline: boolean
  entitlement: ServiceCreditEntitlement | null
  errorCode?: string | undefined
  hasOwnedPlanOrHistory: boolean
  hasPendingUpgradeIntent: boolean
  catalogue: ServicePlanCatalogue | null
  latestPayment: PlanPayment | null
  origin?: GuideOrigin | undefined
}>

/**
 * Pure priority resolver enforcing safety override > fail-closed errors > verified access /
 * owned-plan continuity > locked 14-day preview. Never creates or activates a Plan.
 */
export function resolveSupportPlanAccessState(
  input: ResolveAccessInput,
): ResolvedSupportPlanAccess {
  if (input.safetyOverride) {
    return { kind: 'safety-override', origin: input.origin }
  }

  if (input.loading && !input.entitlement && !input.errorCode) {
    return { kind: 'loading', origin: input.origin }
  }

  const status = input.errorCode
    ? 'unavailable'
    : planAccessFrom(input.entitlement)

  if (status === 'paid' && input.entitlement?.entitlementState === 'ACTIVE') {
    const context: VerifiedPlanAccessContext = {
      packageCode: input.entitlement.packageCode,
      entitlementState: input.entitlement.entitlementState,
      supportPlanEnabled: Boolean(input.entitlement.supportPlanEnabled),
      hasOwnedPlanOrHistory: input.hasOwnedPlanOrHistory,
      upgradedNow: input.hasPendingUpgradeIntent,
      origin: input.origin,
    }
    if (input.hasPendingUpgradeIntent) {
      return {
        kind: 'upgrade-confirmed',
        context,
        origin: input.origin,
      }
    }
    return {
      kind: 'owned-plan',
      context,
      showExpiredUpgradeBanner: false,
      origin: input.origin,
    }
  }

  if (status === 'expired' && input.hasOwnedPlanOrHistory) {
    const context: VerifiedPlanAccessContext = {
      packageCode: input.entitlement?.packageCode ?? 'FREE',
      entitlementState: 'EXPIRED',
      supportPlanEnabled: false,
      hasOwnedPlanOrHistory: true,
      upgradedNow: false,
      origin: input.origin,
    }
    return {
      kind: 'owned-plan',
      context,
      showExpiredUpgradeBanner: true,
      origin: input.origin,
    }
  }

  if (status === 'free' || status === 'expired') {
    return {
      kind: 'locked-preview',
      variant: status,
      latestPayment: input.latestPayment,
      checkout: selectPlusUpgradePlan(input.catalogue),
      origin: input.origin,
    }
  }

  return {
    kind: 'unavailable',
    offline: input.offline || input.errorCode === 'NETWORK_ERROR',
    errorCode: input.errorCode ?? 'ENTITLEMENT_UNAVAILABLE',
    origin: input.origin,
  }
}

export function describePaymentState(payment: PlanPayment): Readonly<{
  title: string
  detail: string
  tone: 'pending' | 'failed' | 'succeeded'
}> {
  if (payment.status === 'PENDING') {
    return {
      title: 'Thanh toán PayOS đang chờ xác nhận',
      detail:
        'Kế hoạch vẫn đang khoá cho đến khi máy chủ Consultation xác nhận giao dịch thành công. Sau khi chuyển khoản hoặc quay lại từ PayOS, hãy kiểm tra lại trạng thái.',
      tone: 'pending',
    }
  }
  if (payment.status === 'SUCCEEDED') {
    return {
      title: 'Giao dịch đã được ghi nhận',
      detail: 'Đang đối chiếu quyền gói Plus với máy chủ Consultation.',
      tone: 'succeeded',
    }
  }
  if (payment.status === 'CHARGEBACK') {
    return {
      title: 'Giao dịch đã bị hoàn trả hoặc tra soát',
      detail:
        'Quyền Plus chưa được mở. Bạn có thể tạo giao dịch mới nếu cổng thanh toán đang mở.',
      tone: 'failed',
    }
  }
  const reasonMap = {
    EXPIRED: 'Liên kết thanh toán đã hết hạn trước khi xác nhận.',
    CANCELLED: 'Giao dịch đã được huỷ trước khi hoàn tất.',
    PROVIDER_FAILED: 'Cổng PayOS báo giao dịch không thành công.',
  } as const
  return {
    title: 'Thanh toán chưa hoàn tất',
    detail: payment.terminalReason
      ? reasonMap[payment.terminalReason]
      : 'Giao dịch trước đó chưa thành công. Kế hoạch vẫn giữ trạng thái khoá.',
    tone: 'failed',
  }
}

export function formatVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString('en-US')} đ`
}
