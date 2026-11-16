import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { AppointmentRatingApi } from './appointment-rating-api'
import type { AppointmentRating } from './appointment-rating-contract'

function errorCopy(error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 404)
  )
    return 'Bạn không có quyền đánh giá lịch hẹn này, hoặc lịch hẹn chưa đủ điều kiện.'
  if (
    error instanceof ApiError &&
    error.status !== undefined &&
    [409, 412, 428].includes(error.status)
  )
    return 'Đánh giá đã thay đổi. Hãy tải lại bản mới nhất trước khi lưu.'
  return 'Chưa thể xác nhận đánh giá. Hãy tải lại và thử lần nữa.'
}

export function AppointmentRatingPanel({
  api,
  appointmentId,
}: Readonly<{ api: AppointmentRatingApi; appointmentId: string }>) {
  const queryClient = useQueryClient()
  const key = ['appointment-rating', appointmentId] as const
  const current = useQuery({
    queryKey: key,
    queryFn: () => api.current(appointmentId),
    retry: false,
    staleTime: 0,
  })
  const [draft, setDraft] = useState<number | null>(null)
  const [notice, setNotice] = useState('')
  const save = useMutation({
    mutationFn: (rating: number) =>
      api.save(appointmentId, rating, current.data?.version),
    onSuccess(value) {
      queryClient.setQueryData<AppointmentRating>(key, value)
      setDraft(null)
      setNotice('Đã lưu đánh giá theo trạng thái mới nhất từ hệ thống.')
    },
    async onError(error) {
      setNotice(errorCopy(error))
      if (
        error instanceof ApiError &&
        error.status !== undefined &&
        [409, 412, 428].includes(error.status)
      )
        await current.refetch()
    },
  })
  const chosen = draft ?? current.data?.rating ?? null
  const busy = current.isFetching || save.isPending

  return (
    <View style={styles.panel} testID="appointment-rating-panel">
      <Text accessibilityRole="header" style={styles.title}>
        Đánh giá buổi tư vấn
      </Text>
      {current.isPending ? (
        <Text style={styles.copy}>Đang tải đánh giá…</Text>
      ) : null}
      {current.isError ? (
        <>
          <Text accessibilityRole="alert" style={styles.copy}>
            {errorCopy(current.error)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void current.refetch()}
            style={styles.linkButton}
          >
            <Text style={styles.link}>Tải lại đánh giá</Text>
          </Pressable>
        </>
      ) : null}
      {current.isSuccess ? (
        <>
          <Text style={styles.copy}>
            {current.data
              ? `Đánh giá hiện tại: ${current.data.rating}/5`
              : 'Bạn chưa đánh giá buổi tư vấn này.'}
          </Text>
          <View accessibilityRole="radiogroup" style={styles.stars}>
            {[1, 2, 3, 4, 5].map((value) => (
              <Pressable
                accessibilityLabel={`${value} sao`}
                accessibilityRole="radio"
                accessibilityState={{
                  selected: chosen === value,
                  disabled: busy,
                }}
                disabled={busy}
                key={value}
                onPress={() => {
                  setDraft(value)
                  setNotice('')
                }}
                style={[styles.star, chosen === value && styles.starSelected]}
              >
                <Text
                  style={
                    chosen === value ? styles.starTextSelected : styles.starText
                  }
                >
                  {value} ★
                </Text>
              </Pressable>
            ))}
          </View>
          {current.data ? (
            <Text style={styles.meta}>
              Điểm công khai của chuyên gia:{' '}
              {current.data.specialistAggregate.averageRating.toFixed(2)}/5 ·{' '}
              {current.data.specialistAggregate.ratingCount} đánh giá
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{
              disabled:
                busy || draft === null || draft === current.data?.rating,
            }}
            disabled={busy || draft === null || draft === current.data?.rating}
            onPress={() => draft !== null && save.mutate(draft)}
            style={[
              styles.primary,
              (busy || draft === null || draft === current.data?.rating) &&
                styles.disabled,
            ]}
          >
            <Text style={styles.primaryText}>
              {current.data ? 'Cập nhật đánh giá' : 'Gửi đánh giá'}
            </Text>
          </Pressable>
        </>
      ) : null}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.copy}>
          {notice}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.md,
    padding: spacing.lg,
  },
  title: {
    color: colors.ink,
    fontSize: typography.body + 2,
    fontWeight: '700',
  },
  copy: {
    color: colors.ink,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  meta: { color: colors.inkSoft, fontSize: 14, lineHeight: 20 },
  stars: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  star: {
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  starSelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  starText: { color: colors.tealDeep, fontWeight: '700' },
  starTextSelected: { color: colors.white, fontWeight: '700' },
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
  disabled: { opacity: 0.5 },
})
