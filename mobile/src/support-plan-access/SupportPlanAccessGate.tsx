import { useEffect, useRef, type ReactNode } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import { LockedPlanPreview } from './LockedPlanPreview'
import type { VerifiedPlanAccessContext } from './plan-access-model'
import type { SupportPlanAccessApi } from './support-plan-access-api'
import type {
  CareOwnedPlanProof,
  CareOwnershipAdapter,
  GuideOrigin,
} from './support-plan-access-contract'
import { useSupportPlanAccess } from './useSupportPlanAccess'

export type SupportPlanAccessGateProps = Readonly<{
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
  autoContinue?: boolean | undefined
  onBack?: (() => void) | undefined
  onContinueToPlan?: ((context: VerifiedPlanAccessContext) => void) | undefined
  onNavigateGuide?: ((origin?: GuideOrigin) => void) | undefined
  onNavigateResources?: (() => void) | undefined
  onNavigateSafety?: (() => void) | undefined
  onNavigateSpecialists?: (() => void) | undefined
  children?: ((context: VerifiedPlanAccessContext) => ReactNode) | undefined
}>

function ActionLinkButton({
  label,
  onPress,
  testID,
}: Readonly<{
  label: string
  onPress: () => void
  testID?: string | undefined
}>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.secondaryButton}
      testID={testID}
    >
      <Text style={styles.secondaryButtonText}>{label}</Text>
    </Pressable>
  )
}

/**
 * Isolated integration boundary for MB-703. Enforces Consultation entitlement,
 * clinical safety override, fail-closed retry, and PayOS upgrade/return before
 * entering Care's SupportPlan workspace (MB-701 / MB-702).
 */
export function SupportPlanAccessGate({
  subject,
  api,
  safetyOverride = false,
  careOwnership,
  careOwnershipAdapter,
  hasOwnedPlanOrHistory,
  offline = false,
  origin,
  autoContinue = false,
  onBack,
  onContinueToPlan,
  onNavigateGuide,
  onNavigateResources,
  onNavigateSafety,
  onNavigateSpecialists,
  children,
}: SupportPlanAccessGateProps) {
  const controller = useSupportPlanAccess({
    subject,
    api,
    safetyOverride,
    careOwnership,
    careOwnershipAdapter,
    hasOwnedPlanOrHistory,
    offline,
    origin,
  })

  const { resolved } = controller
  const continuedSubjectRef = useRef<string | null>(null)

  useEffect(() => {
    continuedSubjectRef.current = null
  }, [subject])

  useEffect(() => {
    if (
      autoContinue &&
      resolved.kind === 'owned-plan' &&
      resolved.context.canCreatePlan &&
      resolved.context.entitlementVerified &&
      !children &&
      onContinueToPlan &&
      subject &&
      continuedSubjectRef.current !== subject
    ) {
      continuedSubjectRef.current = subject
      onContinueToPlan(resolved.context)
    }
  }, [autoContinue, children, onContinueToPlan, resolved, subject])

  if (resolved.kind === 'safety-override') {
    return (
      <Screen clearSafetyButton>
        <View style={styles.panel} testID="support-plan-safety-override">
          <Text style={styles.eyebrow}>ƯU TIÊN AN TOÀN</Text>
          <Text accessibilityRole="header" style={styles.heading}>
            Hãy ưu tiên hỗ trợ an toàn trước tiên
          </Text>
          <Text style={styles.bodyText}>
            Hệ thống tạm ẩn toàn bộ phần nâng cấp gói để bạn tập trung vào bước
            hỗ trợ an toàn theo Hướng dẫn của Care. Tài nguyên và Hỗ trợ an toàn
            luôn mở miễn phí.
          </Text>
          <View style={styles.buttonStack}>
            {onNavigateSafety ? (
              <PrimaryButton
                label="Mở hỗ trợ an toàn ngay"
                onPress={onNavigateSafety}
                testID="safety-override-safety-cta"
              />
            ) : null}
            {onNavigateGuide ? (
              <ActionLinkButton
                label="Quay lại Hướng dẫn hỗ trợ"
                onPress={() => onNavigateGuide(resolved.origin)}
                testID="safety-override-guide-cta"
              />
            ) : null}
            {onNavigateResources ? (
              <ActionLinkButton
                label="Mở Thư viện tài nguyên"
                onPress={onNavigateResources}
                testID="safety-override-resources-cta"
              />
            ) : null}
          </View>
        </View>
      </Screen>
    )
  }

  if (resolved.kind === 'loading') {
    return (
      <Screen clearSafetyButton>
        <View
          accessibilityLiveRegion="polite"
          style={styles.centeredPanel}
          testID="support-plan-access-loading"
        >
          <ActivityIndicator size="large" color={colors.tealDeep} />
          <Text style={styles.supportingText}>
            Đang kiểm tra quyền gói từ Consultation...
          </Text>
        </View>
      </Screen>
    )
  }

  if (resolved.kind === 'unavailable') {
    return (
      <Screen clearSafetyButton>
        <View style={styles.panel} testID="support-plan-access-unavailable">
          <Text style={styles.eyebrow}>CHƯA THỂ XÁC MINH QUYỀN GÓI</Text>
          <Text accessibilityRole="header" style={styles.heading}>
            {resolved.offline
              ? 'Thiết bị đang ngoại tuyến'
              : 'Chưa thể kiểm tra quyền truy cập Kế hoạch hỗ trợ'}
          </Text>
          <Text style={styles.supportingText}>
            {resolved.offline
              ? 'Vui lòng kết nối mạng và thử kiểm tra lại để mở đúng quyền gói từ máy chủ Consultation.'
              : 'Để tránh hiển thị sai quyền gói của bạn, hệ thống tạm giữ trạng thái chờ xác minh và không tự mở hay coi là gói miễn phí.'}
          </Text>
          {resolved.errorCode ? (
            <Text style={styles.mutedNote}>{`Mã: ${resolved.errorCode}`}</Text>
          ) : null}
          <View style={styles.buttonStack}>
            <PrimaryButton
              disabled={controller.isChecking}
              label={
                controller.isChecking
                  ? 'Đang kiểm tra lại...'
                  : 'Thử kiểm tra lại'
              }
              onPress={() => void controller.retryEntitlementCheck()}
              testID="support-plan-access-retry-button"
            />
            {onNavigateGuide ? (
              <ActionLinkButton
                label="Quay lại Hướng dẫn hỗ trợ"
                onPress={() => onNavigateGuide(resolved.origin)}
                testID="unavailable-guide-cta"
              />
            ) : null}
            {onNavigateResources ? (
              <ActionLinkButton
                label="Mở Thư viện tài nguyên"
                onPress={onNavigateResources}
                testID="unavailable-resources-cta"
              />
            ) : null}
            {onNavigateSpecialists ? (
              <ActionLinkButton
                label="Tìm chuyên gia phù hợp"
                onPress={onNavigateSpecialists}
                testID="unavailable-specialists-cta"
              />
            ) : null}
            {onNavigateSafety ? (
              <ActionLinkButton
                label="Cần hỗ trợ an toàn ngay"
                onPress={onNavigateSafety}
                testID="unavailable-safety-cta"
              />
            ) : null}
          </View>
        </View>
      </Screen>
    )
  }

  if (resolved.kind === 'upgrade-confirmed') {
    return (
      <Screen clearSafetyButton>
        <View style={styles.panel} testID="support-plan-upgrade-confirmed">
          <Text style={styles.eyebrow}>ĐÃ XÁC MINH NÂNG CẤP PLUS</Text>
          <Text accessibilityRole="header" style={styles.heading}>
            Gói Plus của bạn đã sẵn sàng
          </Text>
          <Text style={styles.bodyText}>
            {`Consultation đã xác nhận gói ${resolved.context.packageCode ?? 'PLUS'}. Bạn có thể tiếp tục sang Kế hoạch hỗ trợ để tự xác nhận tạo hoặc mở kế hoạch khi sẵn sàng.`}
          </Text>
          <View style={styles.buttonStack}>
            {onContinueToPlan ? (
              <PrimaryButton
                label="Tiếp tục tới Kế hoạch hỗ trợ"
                onPress={() => {
                  controller.clearUpgradeConfirmation()
                  onContinueToPlan(resolved.context)
                }}
                testID="upgrade-confirmed-continue-button"
              />
            ) : null}
            {onNavigateGuide ? (
              <ActionLinkButton
                label={
                  resolved.origin
                    ? resolved.origin.source === 'REASSESSMENT'
                      ? 'Quay lại đánh giá lại và Hướng dẫn'
                      : 'Quay lại bước Hướng dẫn trước đó'
                    : 'Quay lại Hướng dẫn hỗ trợ'
                }
                onPress={() => {
                  controller.clearUpgradeConfirmation()
                  onNavigateGuide(resolved.origin)
                }}
                testID="upgrade-confirmed-guide-cta"
              />
            ) : null}
          </View>
        </View>
      </Screen>
    )
  }

  if (resolved.kind === 'owned-plan') {
    return (
      <View style={styles.flexContainer} testID="support-plan-owned-access">
        {resolved.showExpiredUpgradeBanner ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.expiredBanner}
            testID="support-plan-expired-owned-banner"
          >
            <Text style={styles.itemTitle}>
              Gói Plus đã hết hạn — bạn vẫn xem được kế hoạch và lịch sử đã có.
            </Text>
            <Text style={styles.mutedNote}>
              Việc tạo hoặc kích hoạt chu kỳ kế hoạch mới cần gia hạn gói Plus
              qua Consultation.
            </Text>
          </View>
        ) : null}

        {resolved.showUnavailableUpgradeBanner ? (
          <View
            accessibilityLiveRegion="polite"
            style={styles.expiredBanner}
            testID="support-plan-unverified-owned-banner"
          >
            <Text style={styles.itemTitle}>
              {resolved.offline
                ? 'Đang ngoại tuyến — bạn vẫn xem được kế hoạch và lịch sử đã có.'
                : 'Chưa xác minh được quyền nâng cấp từ Consultation — bạn vẫn xem được kế hoạch đã có.'}
            </Text>
            <Text style={styles.mutedNote}>
              {`Quyền tạo chu kỳ kế hoạch mới tạm bị giữ ở trạng thái chờ xác minh (${resolved.errorCode ?? 'ENTITLEMENT_UNAVAILABLE'}).`}
            </Text>
            {!resolved.offline ? (
              <ActionLinkButton
                label={
                  controller.isChecking
                    ? 'Đang kiểm tra lại...'
                    : 'Thử xác minh lại quyền gói'
                }
                onPress={() => void controller.retryEntitlementCheck()}
                testID="owned-plan-retry-verify-button"
              />
            ) : null}
          </View>
        ) : null}

        {children ? (
          children(resolved.context)
        ) : (
          <Screen clearSafetyButton>
            <View style={styles.panel}>
              <Text
                style={styles.eyebrow}
                testID={
                  resolved.context.accessMode === 'read-only-owned'
                    ? 'owned-plan-read-only-badge'
                    : 'owned-plan-full-access-badge'
                }
              >
                {resolved.context.canCreatePlan
                  ? 'ĐÃ XÁC MINH QUYỀN KẾ HOẠCH'
                  : 'QUYỀN ĐỌC KẾ HOẠCH HIỆN CÓ'}
              </Text>
              <Text accessibilityRole="header" style={styles.heading}>
                {resolved.context.canCreatePlan
                  ? 'Quyền truy cập Kế hoạch hỗ trợ đã mở'
                  : 'Xem kế hoạch và lịch sử hỗ trợ đã có'}
              </Text>
              <Text style={styles.bodyText}>
                {resolved.context.entitlementVerified
                  ? `Trạng thái từ Consultation: ${resolved.context.packageCode ?? 'FREE'} (${resolved.context.entitlementState ?? 'EXPIRED'}).`
                  : 'Chưa xác minh lại quyền từ Consultation; hệ thống chỉ mở quyền đọc kế hoạch từ Care.'}
              </Text>
              {onContinueToPlan ? (
                <PrimaryButton
                  label={
                    resolved.context.canCreatePlan
                      ? 'Mở Kế hoạch hỗ trợ'
                      : 'Xem kế hoạch và lịch sử đã có'
                  }
                  onPress={() => onContinueToPlan(resolved.context)}
                  testID="owned-plan-continue-button"
                />
              ) : null}
            </View>
          </Screen>
        )}
      </View>
    )
  }

  return (
    <LockedPlanPreview
      variant={resolved.variant}
      latestPayment={resolved.latestPayment}
      checkout={resolved.checkout}
      offline={offline}
      isReconciling={controller.isReconciling}
      isStartingCheckout={controller.isStartingCheckout}
      checkoutError={controller.checkoutError}
      externalCheckoutNotice={controller.externalCheckoutNotice}
      origin={resolved.origin}
      onStartUpgrade={() => void controller.startPlusUpgrade()}
      onOpenHostedCheckout={() => void controller.openHostedCheckoutUrl()}
      onReconcilePayment={() => void controller.reconcileStatus()}
      onRetryCheck={() => void controller.retryEntitlementCheck()}
      onBack={onBack}
      onNavigateGuide={onNavigateGuide}
      onNavigateResources={onNavigateResources}
      onNavigateSpecialists={onNavigateSpecialists}
      onNavigateSafety={onNavigateSafety}
    />
  )
}

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
  },
  centeredPanel: {
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.xl,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.shell,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.xl,
  },
  expiredBanner: {
    backgroundColor: colors.surfaceSoft,
    borderBottomColor: colors.amber,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
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
  itemTitle: {
    color: colors.ink,
    fontSize: 15,
    fontWeight: '700',
  },
  bodyText: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  supportingText: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  mutedNote: {
    color: colors.inkFaint,
    fontSize: 13,
    lineHeight: 19,
  },
  buttonStack: {
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  secondaryButton: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  secondaryButtonText: {
    color: colors.tealDeep,
    fontSize: 15,
    fontWeight: '700',
  },
})
