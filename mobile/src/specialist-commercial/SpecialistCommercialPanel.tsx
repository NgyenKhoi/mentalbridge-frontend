import { useQuery } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SpecialistCommercialApi } from './specialist-commercial-api'

function errorCopy(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn.'
  if (error instanceof ApiError && error.status === 403)
    return 'Chỉ chuyên gia đã được phê duyệt mới xem được số liệu này.'
  return 'Chưa thể xác nhận số liệu chuyên gia. Không hiển thị số liệu ước tính.'
}

const money = (value: number) => `${value.toLocaleString('vi-VN')} VND`

export function SpecialistCommercialPanel({
  api,
  subject,
}: Readonly<{ api: SpecialistCommercialApi; subject: string }>) {
  const analytics = useQuery({
    queryKey: ['specialist-analytics', subject],
    queryFn: () => api.analytics(),
    retry: false,
    staleTime: 0,
  })
  const earnings = useQuery({
    queryKey: ['specialist-earnings', subject],
    queryFn: () => api.earnings(),
    retry: false,
    staleTime: 0,
  })
  const denied =
    (analytics.error instanceof ApiError &&
      [401, 403].includes(analytics.error.status ?? 0)) ||
    (earnings.error instanceof ApiError &&
      [401, 403].includes(earnings.error.status ?? 0))
  const refresh = () => Promise.all([analytics.refetch(), earnings.refetch()])
  return (
    <View style={styles.panel} testID="specialist-commercial-panel">
      <Text accessibilityRole="header" style={styles.title}>
        Đánh giá và tài chính
      </Text>
      {analytics.isPending || earnings.isPending ? (
        <Text style={styles.copy}>Đang tải số liệu đã xác nhận…</Text>
      ) : null}
      {analytics.isError || earnings.isError ? (
        <>
          <Text accessibilityRole="alert" style={styles.copy}>
            {errorCopy(analytics.error ?? earnings.error)}
          </Text>
          {!denied ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void refresh()}
              style={styles.linkButton}
            >
              <Text style={styles.link}>Tải lại số liệu</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}
      {analytics.data ? (
        <View style={styles.section}>
          <Text style={styles.label}>Đánh giá đã công bố</Text>
          {analytics.data.rating.state === 'AVAILABLE' &&
          analytics.data.rating.averageRating !== null &&
          analytics.data.rating.ratingCount !== null ? (
            <Text style={styles.value}>
              {analytics.data.rating.averageRating.toFixed(2)}/5 ·{' '}
              {analytics.data.rating.ratingCount} đánh giá
            </Text>
          ) : (
            <Text style={styles.copy}>
              {analytics.data.rating.state === 'EMPTY'
                ? 'Chưa có đánh giá đã công bố.'
                : `Số liệu đánh giá: ${analytics.data.rating.state}`}
            </Text>
          )}
          <Text style={styles.copy}>
            Phiên hoàn thành trong kỳ:{' '}
            {analytics.data.appointments.completedCount ?? 'Không khả dụng'}
          </Text>
        </View>
      ) : null}
      {earnings.data ? (
        <View style={styles.section}>
          <Text style={styles.label}>Số dư do hệ thống xác nhận</Text>
          <Text style={styles.copy}>
            Chờ quyết toán: {money(earnings.data.balance.pendingSettlementVnd)}
          </Text>
          <Text style={styles.copy}>
            Có thể rút: {money(earnings.data.balance.availableVnd)}
          </Text>
          <Text style={styles.copy}>
            Đang xử lý: {money(earnings.data.balance.processingVnd)}
          </Text>
          <Text style={styles.copy}>
            Đã thanh toán: {money(earnings.data.balance.paidVnd)}
          </Text>
          {(earnings.data.balance.retryPendingVnd ?? 0) > 0 ? (
            <Text style={styles.copy}>
              Chờ thử lại theo giao dịch cũ:{' '}
              {money(earnings.data.balance.retryPendingVnd ?? 0)}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: typography.body + 4,
    fontWeight: '700',
  },
  section: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.sm,
    padding: spacing.md,
  },
  label: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  value: { color: colors.tealDeep, fontSize: 22, fontWeight: '800' },
  copy: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
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
})
