import { useQuery } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SubscriptionApi } from './subscription-api'
import type { PlanPayment } from './subscription-contract'

type PendingCommand = { planVersionId: string; key: string; paymentId?: string }
const commands = new Map<string, PendingCommand>()

function paymentCopy(payment: PlanPayment) {
  if (payment.status === 'SUCCEEDED') return 'Đã xác nhận thanh toán'
  if (payment.status === 'CHARGEBACK') return 'Khoản thanh toán đã bị thu hồi'
  if (payment.status === 'FAILED') {
    if (payment.terminalReason === 'EXPIRED')
      return 'Yêu cầu thanh toán đã hết hạn'
    if (payment.terminalReason === 'CANCELLED')
      return 'Yêu cầu thanh toán đã hủy'
    return 'Thanh toán bị từ chối hoặc không thành công'
  }
  return 'Đang chờ hệ thống xác nhận thanh toán'
}

function errorCopy(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn.'
  if (error instanceof ApiError && error.status === 403)
    return 'Tài khoản này không được xem hoặc mua gói dịch vụ.'
  if (error instanceof ApiError && error.status === 409)
    return 'Yêu cầu không còn phù hợp với quyền lợi hiện tại. Hãy tải lại.'
  return 'Chưa thể xác nhận trạng thái thương mại. Không có quyền lợi mới nào được giả định.'
}

export function SubscriptionCommercialPanel({
  api,
  subject,
  currentPackageCode,
}: Readonly<{
  api: SubscriptionApi
  subject: string
  currentPackageCode?: 'FREE' | 'PLUS' | 'PREMIUM' | undefined
}>) {
  const catalogue = useQuery({
    queryKey: ['service-plans', subject],
    queryFn: () => api.catalogue(),
    retry: false,
    staleTime: 0,
  })
  const history = useQuery({
    queryKey: ['plan-payments', subject],
    queryFn: () => api.payments(),
    retry: false,
    staleTime: 0,
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [pending, setPending] = useState(() => commands.get(subject) ?? null)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const mounted = useRef(true)
  useEffect(
    () => () => {
      mounted.current = false
    },
    [],
  )
  const selectedPlan = catalogue.data?.plans.find(
    (plan) => plan.planVersionId === selected,
  )
  const currentPlan = catalogue.data?.plans.find(
    (plan) => plan.planCode === currentPackageCode,
  )
  const selectableCodes = new Set(currentPlan?.allowedUpgrades ?? [])
  const selectedAllowed = Boolean(
    selectedPlan &&
    selectableCodes.has(selectedPlan.planCode as 'PLUS' | 'PREMIUM'),
  )

  async function refresh() {
    await Promise.all([catalogue.refetch(), history.refetch()])
  }

  async function reconcile(command = pending) {
    if (!command || busy) return
    setBusy(true)
    setNotice('')
    try {
      let result: PlanPayment
      if (command.paymentId) result = await api.payment(command.paymentId)
      else {
        result = await api.checkout(command.planVersionId, command.key)
        command = { ...command, paymentId: result.paymentId }
        commands.set(subject, command)
        setPending(command)
      }
      setNotice(paymentCopy(result))
      if (result.status !== 'PENDING') {
        commands.delete(subject)
        setPending(null)
      }
      await refresh()
    } catch (error) {
      setNotice(errorCopy(error))
    } finally {
      if (mounted.current) setBusy(false)
    }
  }

  async function checkout() {
    if (
      !selectedPlan ||
      !selectedAllowed ||
      pending ||
      busy ||
      !catalogue.data?.checkoutEnabled
    )
      return
    const command = {
      planVersionId: selectedPlan.planVersionId,
      key: `subscription-${randomUUID()}`,
    }
    commands.set(subject, command)
    setPending(command)
    await reconcile(command)
  }

  const denied =
    (catalogue.error instanceof ApiError &&
      [401, 403].includes(catalogue.error.status ?? 0)) ||
    (history.error instanceof ApiError &&
      [401, 403].includes(history.error.status ?? 0))
  return (
    <View style={styles.panel} testID="subscription-commercial-panel">
      <Text accessibilityRole="header" style={styles.title}>
        Gói dịch vụ và thanh toán
      </Text>
      <Text style={styles.copy}>
        Quyền đặt lịch chỉ được mở theo lượt tư vấn mà máy chủ xác nhận ở phía
        trên.
      </Text>
      {catalogue.isPending || history.isPending ? (
        <Text style={styles.copy}>Đang tải gói và trạng thái thanh toán…</Text>
      ) : null}
      {catalogue.isError || history.isError ? (
        <>
          <Text accessibilityRole="alert" style={styles.copy}>
            {errorCopy(catalogue.error ?? history.error)}
          </Text>
          {!denied ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={styles.linkButton}
            >
              <Text style={styles.link}>Tải lại trạng thái</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {!denied && catalogue.data ? (
        <>
          {!catalogue.data.checkoutEnabled ? (
            <Text style={styles.warning}>
              Thanh toán hiện chưa sẵn sàng. Bạn vẫn có thể xem gói và quyền
              lợi.
            </Text>
          ) : null}
          <View style={styles.options}>
            {catalogue.data.plans.map((plan) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{
                  selected: selected === plan.planVersionId,
                  disabled:
                    busy ||
                    Boolean(pending) ||
                    !selectableCodes.has(plan.planCode as 'PLUS' | 'PREMIUM'),
                }}
                disabled={
                  busy ||
                  Boolean(pending) ||
                  !selectableCodes.has(plan.planCode as 'PLUS' | 'PREMIUM')
                }
                key={plan.planVersionId}
                onPress={() => setSelected(plan.planVersionId)}
                style={[
                  styles.option,
                  selected === plan.planVersionId && styles.selected,
                ]}
              >
                <Text style={styles.optionTitle}>{plan.displayName}</Text>
                <Text style={styles.copy}>
                  {plan.priceVnd.toLocaleString('vi-VN')} VND ·{' '}
                  {plan.consultationCredits} lượt tư vấn
                </Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled:
                busy ||
                Boolean(pending) ||
                !selectedPlan ||
                !selectedAllowed ||
                !catalogue.data.checkoutEnabled,
            }}
            disabled={
              busy ||
              Boolean(pending) ||
              !selectedPlan ||
              !selectedAllowed ||
              !catalogue.data.checkoutEnabled
            }
            onPress={() => void checkout()}
            style={[
              styles.primary,
              (busy ||
                Boolean(pending) ||
                !selectedPlan ||
                !selectedAllowed ||
                !catalogue.data.checkoutEnabled) &&
                styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>Tạo yêu cầu thanh toán</Text>
          </Pressable>
        </>
      ) : null}
      {pending ? (
        <View style={styles.pending}>
          <Text style={styles.copy}>
            Yêu cầu trước chưa có kết quả cuối cùng. Giữ nguyên mã yêu cầu và
            đối soát trước khi thử thao tác khác.
          </Text>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void reconcile()}
            style={styles.linkButton}
          >
            <Text style={styles.link}>Kiểm tra yêu cầu đang chờ</Text>
          </Pressable>
        </View>
      ) : null}
      {history.data?.items.map((payment) => (
        <View key={payment.paymentId} style={styles.payment}>
          <Text style={styles.optionTitle}>
            {payment.planCode} · {payment.amountVnd.toLocaleString('vi-VN')} VND
          </Text>
          <Text style={styles.copy}>{paymentCopy(payment)}</Text>
        </View>
      ))}
      {history.isSuccess && history.data.items.length === 0 ? (
        <Text style={styles.copy}>Chưa có yêu cầu thanh toán nào.</Text>
      ) : null}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.warning}>
          {notice}
        </Text>
      ) : null}
    </View>
  )
}

export const subscriptionCommands = { clear: () => commands.clear() }

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: typography.body + 4,
    fontWeight: '700',
  },
  copy: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  warning: { color: colors.terracotta, fontSize: 14, lineHeight: 20 },
  options: { gap: spacing.sm },
  option: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 60,
    padding: spacing.md,
  },
  selected: { borderColor: colors.tealDeep, borderWidth: 2 },
  optionTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  primary: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  primaryText: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '700',
  },
  disabled: { opacity: 0.5 },
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  link: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pending: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.md,
  },
  payment: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.xs,
    paddingTop: spacing.md,
  },
})
