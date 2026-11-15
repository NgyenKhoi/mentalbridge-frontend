import { useEffect, useState } from 'react'
import { BackHandler, Pressable, StyleSheet, Text, View } from 'react-native'
import Animated from 'react-native-reanimated'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { useStaggerProps } from '@/components/motion'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import {
  describePaymentState,
  formatVnd,
  PLUS_BENEFITS,
  providerDisplayLabel,
  SAMPLE_PREVIEW_CONTENT,
  type CheckoutAvailability,
  type PreviewTab,
} from './plan-access-model'
import {
  canOpenHostedCheckoutUrl,
  type GuideOrigin,
  type PlanPayment,
} from './support-plan-access-contract'
import type { CheckoutErrorInfo } from './useSupportPlanAccess'

const TAB_LABELS: readonly Readonly<{ id: PreviewTab; label: string }>[] = [
  { id: 'today', label: 'Hôm nay' },
  { id: 'progress', label: 'Tiến trình' },
  { id: 'review', label: 'Nhìn lại' },
]

export type LockedPlanPreviewProps = Readonly<{
  variant: 'free' | 'expired'
  latestPayment: PlanPayment | null
  checkout: CheckoutAvailability
  offline: boolean
  isReconciling: boolean
  isStartingCheckout: boolean
  checkoutError: CheckoutErrorInfo | null
  externalCheckoutNotice: string | null
  origin?: GuideOrigin | undefined
  onStartUpgrade(): void
  onOpenHostedCheckout(): void
  onReconcilePayment(): void
  onRetryCheck?: (() => void) | undefined
  onBack?: (() => void) | undefined
  onNavigateGuide?: ((origin?: GuideOrigin) => void) | undefined
  onNavigateResources?: (() => void) | undefined
  onNavigateSpecialists?: (() => void) | undefined
  onNavigateSafety?: (() => void) | undefined
}>

function SecondaryActionButton({
  label,
  onPress,
  disabled = false,
  testID,
}: Readonly<{
  label: string
  onPress: () => void
  disabled?: boolean | undefined
  testID?: string | undefined
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.secondaryButton,
        pressed && !disabled && styles.secondaryButtonPressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  )
}

export function LockedPlanPreview({
  variant,
  latestPayment,
  checkout,
  offline,
  isReconciling,
  isStartingCheckout,
  checkoutError,
  externalCheckoutNotice,
  origin,
  onStartUpgrade,
  onOpenHostedCheckout,
  onReconcilePayment,
  onRetryCheck,
  onBack,
  onNavigateGuide,
  onNavigateResources,
  onNavigateSpecialists,
  onNavigateSafety,
}: LockedPlanPreviewProps) {
  const [activeTab, setActiveTab] = useState<PreviewTab>('today')
  const [localDoneIds, setLocalDoneIds] = useState<ReadonlySet<string>>(() => {
    const initial = new Set<string>()
    for (const item of SAMPLE_PREVIEW_CONTENT.todayItems) {
      if (item.defaultDone) initial.add(item.id)
    }
    return initial
  })

  const headerMotion = useStaggerProps(0)
  const previewMotion = useStaggerProps(1)
  const upgradeMotion = useStaggerProps(2)

  useEffect(() => {
    if (!onBack) return
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onBack()
        return true
      },
    )
    return () => subscription.remove()
  }, [onBack])

  const toggleSampleItem = (id: string) => {
    setLocalDoneIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const completedDelta = localDoneIds.size - 1
  const displayedCompletedCount = Math.max(
    0,
    Math.min(
      SAMPLE_PREVIEW_CONTENT.totalCount,
      SAMPLE_PREVIEW_CONTENT.baseCompletedCount + completedDelta,
    ),
  )

  const paymentSummary = latestPayment
    ? describePaymentState(latestPayment)
    : null
  const hasPendingPayment = latestPayment?.status === 'PENDING'
  const hasAllowedHostedUrl = Boolean(
    hasPendingPayment &&
    latestPayment &&
    canOpenHostedCheckoutUrl(latestPayment.checkoutUrl, latestPayment.provider),
  )
  const pendingTransferAmount =
    latestPayment?.amount ?? latestPayment?.amountVnd ?? 0
  const pendingExpiry =
    latestPayment?.expiredAt ?? latestPayment?.expiresAt ?? ''
  const hasBankTransferFields = Boolean(
    latestPayment?.accountName ||
    latestPayment?.accountNumber ||
    latestPayment?.bin ||
    latestPayment?.description,
  )

  return (
    <Screen layout="dashboard" clearSafetyButton>
      <Animated.View {...headerMotion} style={styles.headerBlock}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={onBack}
            style={styles.backLink}
            testID="locked-preview-back"
          >
            <Text style={styles.backLinkText}>← Quay lại</Text>
          </Pressable>
        ) : null}

        <Text style={styles.eyebrow}>
          {variant === 'expired'
            ? 'GÓI PLUS ĐÃ HẾT HẠN'
            : 'KẾ HOẠCH HỖ TRỢ · BẢN XEM THỬ'}
        </Text>
        <Text accessibilityRole="header" style={styles.heading}>
          {variant === 'expired'
            ? 'Nâng cấp lại để mở Kế hoạch hỗ trợ cá nhân'
            : 'Xem trước Kế hoạch hỗ trợ 14 ngày'}
        </Text>
        <Text style={styles.supportingText}>
          {variant === 'expired'
            ? 'Gói Plus của bạn đã hết hạn. Bạn vẫn xem được Hướng dẫn hỗ trợ, Thư viện tài nguyên, Danh bạ chuyên gia và Hỗ trợ an toàn bất kỳ lúc nào.'
            : 'Kế hoạch hỗ trợ cá nhân thuộc gói Plus. Bạn có thể thử tương tác với bản minh hoạ bên dưới hoặc tiếp tục dùng các hỗ trợ miễn phí.'}
        </Text>
      </Animated.View>

      <Animated.View
        {...previewMotion}
        style={styles.previewPanel}
        testID="locked-preview-panel"
      >
        <View style={styles.bannerBox} testID="locked-preview-example-banner">
          <Text style={styles.badgeText}>
            {SAMPLE_PREVIEW_CONTENT.badgeLabel}
          </Text>
          <Text style={styles.disclaimerText}>
            {SAMPLE_PREVIEW_CONTENT.disclaimerLabel}
          </Text>
        </View>

        <View
          accessibilityRole="tablist"
          style={styles.tabRow}
          testID="locked-preview-tabs"
        >
          {TAB_LABELS.map((tab) => {
            const selected = activeTab === tab.id
            return (
              <Pressable
                key={tab.id}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setActiveTab(tab.id)}
                style={[styles.tabButton, selected && styles.tabButtonActive]}
                testID={`locked-preview-tab-${tab.id}`}
              >
                <Text
                  style={[
                    styles.tabButtonText,
                    selected && styles.tabButtonTextActive,
                  ]}
                >
                  {tab.label}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {activeTab === 'today' ? (
          <View style={styles.tabContent} testID="locked-preview-content-today">
            <View style={styles.rowBetween}>
              <Text style={styles.sectionTitle}>
                {SAMPLE_PREVIEW_CONTENT.currentDayLabel}
              </Text>
              <Text style={styles.progressCounter}>
                {`${displayedCompletedCount}/${SAMPLE_PREVIEW_CONTENT.totalCount} việc đã làm`}
              </Text>
            </View>
            <Text style={styles.mutedNote}>
              Chạm vào một mục mẫu để thử đánh dấu hoàn thành cục bộ (chỉ minh
              hoạ trên màn hình này, không lưu vào máy chủ).
            </Text>
            {SAMPLE_PREVIEW_CONTENT.todayItems.map((item) => {
              const checked = localDoneIds.has(item.id)
              return (
                <Pressable
                  key={item.id}
                  accessibilityRole="checkbox"
                  accessibilityLabel={item.label}
                  accessibilityState={{ checked }}
                  onPress={() => toggleSampleItem(item.id)}
                  style={[styles.sampleCard, checked && styles.sampleCardDone]}
                  testID={`locked-preview-sample-item-${item.id}`}
                >
                  <View style={styles.sampleCardHeader}>
                    <Text style={styles.itemTitle}>
                      {checked ? `✓ ${item.label}` : item.label}
                    </Text>
                    <Text style={styles.timeBadge}>{item.timeLabel}</Text>
                  </View>
                </Pressable>
              )
            })}
          </View>
        ) : null}

        {activeTab === 'progress' ? (
          <View
            style={styles.tabContent}
            testID="locked-preview-content-progress"
          >
            <Text style={styles.sectionTitle}>Nhịp 14 ngày minh hoạ</Text>
            <Text style={styles.bodyText}>
              {SAMPLE_PREVIEW_CONTENT.progressSummary}
            </Text>
            <Text style={styles.mutedNote}>
              Không hiển thị điểm phục hồi hay dự đoán điều trị.
            </Text>
          </View>
        ) : null}

        {activeTab === 'review' ? (
          <View
            style={styles.tabContent}
            testID="locked-preview-content-review"
          >
            <Text style={styles.sectionTitle}>Nhìn lại chu kỳ mẫu</Text>
            <Text style={styles.bodyText}>
              {SAMPLE_PREVIEW_CONTENT.reviewSummary}
            </Text>
          </View>
        ) : null}
      </Animated.View>

      <Animated.View
        {...upgradeMotion}
        style={styles.upgradePanel}
        testID="locked-preview-upgrade-panel"
      >
        <Text style={styles.eyebrow}>QUYỀN PLUS TỪ CONSULTATION</Text>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          {checkout.available
            ? `${checkout.plan.displayName} · ${formatVnd(checkout.plan.priceVnd)}`
            : 'Nâng cấp gói Plus'}
        </Text>

        {PLUS_BENEFITS.map((benefit) => (
          <Text key={benefit} style={styles.benefitItem}>
            {`• ${benefit}`}
          </Text>
        ))}

        {offline ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.noticeBox}
            testID="locked-preview-offline-notice"
          >
            <Text style={styles.noticeError}>
              Thiết bị đang ngoại tuyến. Không thể khởi tạo thanh toán hoặc đối
              chiếu gói lúc này.
            </Text>
          </View>
        ) : null}

        {paymentSummary ? (
          <View
            accessibilityLiveRegion="polite"
            style={[
              styles.noticeBox,
              paymentSummary.tone === 'failed' && styles.noticeErrorBox,
              paymentSummary.tone === 'pending' && styles.noticePendingBox,
            ]}
            testID="locked-preview-payment-status"
          >
            <Text style={styles.itemTitle}>{paymentSummary.title}</Text>
            <Text style={styles.supportingText}>{paymentSummary.detail}</Text>

            {hasPendingPayment && latestPayment ? (
              <View style={styles.transferDetails}>
                {latestPayment.provider === 'PAYOS' ? (
                  <>
                    <Text style={styles.transferHeading}>
                      Thông tin chuyển khoản VietQR (PayOS)
                    </Text>
                    {latestPayment.accountName ? (
                      <Text selectable style={styles.transferLine}>
                        {`Người nhận: ${latestPayment.accountName}`}
                      </Text>
                    ) : null}
                    {latestPayment.accountNumber ? (
                      <Text selectable style={styles.transferLine}>
                        {`Số tài khoản: ${latestPayment.accountNumber}`}
                      </Text>
                    ) : null}
                    {latestPayment.bin ? (
                      <Text selectable style={styles.transferLine}>
                        {`Mã ngân hàng (BIN): ${latestPayment.bin}`}
                      </Text>
                    ) : null}
                    <Text selectable style={styles.transferLine}>
                      {`Số tiền: ${formatVnd(pendingTransferAmount)}`}
                    </Text>
                    {latestPayment.description ? (
                      <Text selectable style={styles.transferLine}>
                        {`Nội dung chuyển khoản: ${latestPayment.description}`}
                      </Text>
                    ) : null}
                    <Text
                      selectable
                      style={styles.mutedNote}
                      testID="locked-preview-vietqr-note"
                    >
                      {latestPayment.qrCode || latestPayment.qrCodeUrl
                        ? 'Ứng dụng hiện chưa dựng hình mã QR quét trực tiếp (chờ thư viện QR); vui lòng sao chép thông tin chuyển khoản VietQR bên trên để thanh toán.'
                        : hasBankTransferFields
                          ? 'Vui lòng chuyển khoản theo đúng thông tin VietQR bên trên và đối chiếu sau khi hoàn tất.'
                          : 'Chưa nhận được đủ thông tin tài khoản VietQR từ PayOS. Bạn có thể kiểm tra lại trạng thái hoặc dùng trang PayOS dự phòng nếu có.'}
                    </Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.transferHeading}>
                      {`Giao dịch qua ${providerDisplayLabel(latestPayment.provider)}`}
                    </Text>
                    <Text selectable style={styles.transferLine}>
                      {`Số tiền: ${formatVnd(pendingTransferAmount)}`}
                    </Text>
                    <Text
                      style={styles.mutedNote}
                      testID="locked-preview-provider-pending-note"
                    >
                      {latestPayment.provider === 'FAKE'
                        ? 'Đây là giao dịch mô phỏng chế độ thử nghiệm (FAKE), không phát sinh chuyển khoản ngân hàng thật.'
                        : 'Cổng MoMo hiện tạm ngừng; chỉ giữ theo dõi trạng thái lịch sử giao dịch.'}
                    </Text>
                  </>
                )}
                <Text style={styles.mutedNote}>
                  {`Hạn giao dịch: ${pendingExpiry}`}
                </Text>
              </View>
            ) : null}

            <View style={styles.buttonStack}>
              {hasAllowedHostedUrl ? (
                <SecondaryActionButton
                  disabled={offline || isReconciling}
                  label="Mở trang thanh toán PayOS (dự phòng)"
                  onPress={onOpenHostedCheckout}
                  testID="locked-preview-open-payos-url"
                />
              ) : null}
              <SecondaryActionButton
                disabled={offline || isReconciling}
                label={
                  isReconciling
                    ? 'Đang đối chiếu thanh toán...'
                    : 'Kiểm tra lại thanh toán'
                }
                onPress={onReconcilePayment}
                testID="locked-preview-reconcile-button"
              />
            </View>
          </View>
        ) : null}

        {externalCheckoutNotice ? (
          <Text
            accessibilityLiveRegion="polite"
            style={styles.supportingText}
            testID="locked-preview-external-notice"
          >
            {externalCheckoutNotice}
          </Text>
        ) : null}

        {checkoutError ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.noticeErrorBox}
            testID="locked-preview-checkout-error"
          >
            <Text style={styles.noticeError}>{checkoutError.message}</Text>
            <Text style={styles.mutedNote}>{`Mã: ${checkoutError.code}`}</Text>
          </View>
        ) : null}

        {!checkout.available ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.noticeBox}
            testID="locked-preview-checkout-unavailable"
          >
            <Text style={styles.supportingText}>{checkout.reason}</Text>
            <Text style={styles.mutedNote}>{`Mã: ${checkout.code}`}</Text>
            {checkout.code === 'CATALOGUE_UNAVAILABLE' && onRetryCheck ? (
              <SecondaryActionButton
                disabled={offline || isReconciling}
                label="Tải lại bảng gói từ Consultation"
                onPress={onRetryCheck}
                testID="locked-preview-retry-catalogue-button"
              />
            ) : null}
          </View>
        ) : hasPendingPayment && !checkoutError?.uncertain ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.noticeBox}
            testID="locked-preview-pending-blocker"
          >
            <Text style={styles.itemTitle}>
              Đang tạm khoá tạo giao dịch mới để tránh trùng lặp
            </Text>
            <Text style={styles.supportingText}>
              Trên máy chủ vẫn còn giao dịch đang chờ xác nhận. Vui lòng dùng
              nút “Kiểm tra lại thanh toán” ở trên để đối chiếu trạng thái trước
              khi thực hiện thao tác khác.
            </Text>
          </View>
        ) : (
          <PrimaryButton
            disabled={offline || isStartingCheckout}
            label={
              isStartingCheckout
                ? checkout.paymentProvider === 'FAKE'
                  ? 'Đang tạo giao dịch thử nghiệm...'
                  : 'Đang tạo giao dịch...'
                : checkoutError?.uncertain
                  ? 'Kiểm tra và thử lại nâng cấp Plus'
                  : checkout.paymentProvider === 'FAKE'
                    ? variant === 'expired'
                      ? 'Gia hạn gói Plus (Thử nghiệm FAKE)'
                      : 'Nâng cấp gói Plus (Thử nghiệm FAKE)'
                    : variant === 'expired'
                      ? 'Gia hạn gói Plus qua PayOS'
                      : 'Nâng cấp gói Plus qua PayOS'
            }
            onPress={onStartUpgrade}
            testID="locked-preview-upgrade-button"
          />
        )}
      </Animated.View>

      <View style={styles.freeRoutesPanel} testID="locked-preview-free-routes">
        <Text style={styles.eyebrow}>HỖ TRỢ MIỄN PHÍ LUÔN MỞ</Text>
        <View style={styles.buttonStack}>
          {onNavigateGuide ? (
            <SecondaryActionButton
              label={
                origin?.source === 'REASSESSMENT'
                  ? 'Quay lại đánh giá lại và Hướng dẫn'
                  : 'Quay lại Hướng dẫn hỗ trợ'
              }
              onPress={() => onNavigateGuide(origin)}
              testID="locked-preview-guide-cta"
            />
          ) : null}
          {onNavigateResources ? (
            <SecondaryActionButton
              label="Mở Thư viện tài nguyên"
              onPress={onNavigateResources}
              testID="locked-preview-resources-cta"
            />
          ) : null}
          {onNavigateSpecialists ? (
            <SecondaryActionButton
              label="Tìm chuyên gia phù hợp"
              onPress={onNavigateSpecialists}
              testID="locked-preview-specialists-cta"
            />
          ) : null}
          {onNavigateSafety ? (
            <SecondaryActionButton
              label="Cần hỗ trợ an toàn ngay"
              onPress={onNavigateSafety}
              testID="locked-preview-safety-cta"
            />
          ) : null}
        </View>
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  headerBlock: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  backLink: {
    alignSelf: 'flex-start',
    paddingVertical: spacing.xs,
  },
  backLinkText: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.tealDeep,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1,
  },
  heading: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  itemTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  supportingText: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  mutedNote: {
    color: colors.inkFaint,
    fontSize: 13,
    lineHeight: 19,
  },
  previewPanel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  bannerBox: {
    backgroundColor: colors.tealPale,
    borderRadius: radii.panel,
    gap: spacing.xs,
    padding: spacing.md,
  },
  badgeText: {
    color: colors.tealDeep,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  disclaimerText: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  tabRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  tabButton: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    flex: 1,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
  },
  tabButtonActive: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  tabButtonText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  tabButtonTextActive: {
    color: colors.white,
  },
  tabContent: {
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  progressCounter: {
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  sampleCard: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    padding: spacing.md,
  },
  sampleCardDone: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  sampleCardHeader: {
    gap: spacing.xs,
  },
  timeBadge: {
    color: colors.inkFaint,
    fontSize: 13,
  },
  upgradePanel: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  benefitItem: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  noticeBox: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.md,
  },
  noticePendingBox: {
    borderColor: colors.amber,
  },
  noticeErrorBox: {
    backgroundColor: '#F8E8DF',
    borderColor: '#9B352D',
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.xs,
    padding: spacing.md,
  },
  noticeError: {
    color: '#9B352D',
    fontSize: typography.body,
    fontWeight: '700',
    lineHeight: typography.bodyLineHeight,
  },
  transferDetails: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.sm,
  },
  transferHeading: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  transferLine: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  freeRoutesPanel: {
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  buttonStack: {
    gap: spacing.sm,
  },
  secondaryButton: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonPressed: {
    opacity: 0.8,
  },
  secondaryButtonText: {
    color: colors.tealDeep,
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.55,
  },
})
