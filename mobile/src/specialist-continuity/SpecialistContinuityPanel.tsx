import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { ApiError } from '@/api/api-error'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { SpecialistContinuityApi } from './specialist-continuity-api'

function accessMessage(state: string | undefined) {
  switch (state) {
    case 'NOT_SHARED':
      return 'Người dùng chưa chia sẻ thông tin chuẩn bị cho lịch hẹn này.'
    case 'REVOKED':
      return 'Người dùng đã thu hồi quyền xem thông tin chuẩn bị.'
    case 'STALE':
      return 'Lịch hẹn đã thay đổi. Cần một bản chia sẻ mới cho lịch hiện tại.'
    case 'TOO_EARLY':
      return 'Thông tin chuẩn bị chưa đến thời gian được phép xem.'
    case 'EXPIRED':
      return 'Thời gian xem thông tin chuẩn bị đã kết thúc.'
    case 'UNAVAILABLE':
      return 'Thông tin chuẩn bị hiện không còn khả dụng.'
    default:
      return 'Không có thông tin chuẩn bị được phép xem cho lịch hẹn này.'
  }
}

function continuityError(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn.'
  }
  if (
    error instanceof ApiError &&
    (error.status === 403 || error.status === 404)
  ) {
    return 'Bạn không có quyền xem thông tin chuẩn bị của lịch hẹn này.'
  }
  return 'Chưa thể xác nhận quyền truy cập mới nhất. Nội dung riêng tư đang được ẩn.'
}

export function SpecialistContinuityPanel({
  api,
  appointmentId,
  appointmentVersion,
}: Readonly<{
  api: SpecialistContinuityApi
  appointmentId: string
  appointmentVersion: number
}>) {
  const queryClient = useQueryClient()
  const [briefRequested, setBriefRequested] = useState(false)
  const continuityKey = ['specialist-continuity'] as const
  const briefKey = useMemo(
    () => ['specialist-consultation-brief', appointmentId] as const,
    [appointmentId],
  )
  const continuityQuery = useQuery({
    queryKey: continuityKey,
    queryFn: () => api.list(),
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })
  const relationship = continuityQuery.data?.items.find(
    (item) => item.appointmentId === appointmentId,
  )
  const accessConfirmed =
    continuityQuery.isSuccess &&
    !continuityQuery.isFetching &&
    relationship?.briefAccessState === 'AVAILABLE' &&
    relationship.appointmentVersion === appointmentVersion

  const briefQuery = useQuery({
    queryKey: briefKey,
    queryFn: () => api.getBrief(appointmentId),
    enabled: briefRequested && accessConfirmed,
    staleTime: 0,
    gcTime: 0,
    refetchOnMount: 'always',
    retry: false,
  })

  useEffect(() => {
    if (!accessConfirmed || briefQuery.isError) {
      queryClient.removeQueries({ queryKey: briefKey, exact: true })
    }
  }, [accessConfirmed, briefKey, briefQuery.isError, queryClient])

  const briefVisible =
    accessConfirmed &&
    briefQuery.isSuccess &&
    !briefQuery.isFetching &&
    briefQuery.data.appointmentId === appointmentId

  return (
    <View style={styles.panel}>
      <View style={styles.heading}>
        <Text style={styles.title}>Thông tin chuẩn bị được chia sẻ</Text>
        <Text style={styles.copy}>
          Chỉ hiển thị bản người dùng đã duyệt cho đúng lịch hẹn và trong thời
          gian được phép.
        </Text>
      </View>

      {continuityQuery.isFetching ? (
        <Text accessibilityLiveRegion="polite" style={styles.state}>
          Đang xác nhận quyền truy cập…
        </Text>
      ) : null}

      {continuityQuery.isError ? (
        <View style={styles.notice}>
          <Text accessibilityRole="alert" style={styles.copy}>
            {continuityError(continuityQuery.error)}
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => void continuityQuery.refetch()}
            style={styles.linkButton}
          >
            <Text style={styles.linkLabel}>Thử xác nhận lại</Text>
          </Pressable>
        </View>
      ) : null}

      {continuityQuery.isSuccess && !continuityQuery.isFetching ? (
        <>
          {relationship ? (
            <Text style={styles.clientName}>
              {relationship.userDisplayName}
            </Text>
          ) : null}
          {!accessConfirmed ? (
            <Text style={styles.state}>
              {relationship?.appointmentVersion !== appointmentVersion
                ? accessMessage('STALE')
                : accessMessage(relationship?.briefAccessState)}
            </Text>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={briefQuery.isFetching}
              onPress={() => {
                setBriefRequested(true)
                if (briefRequested) void briefQuery.refetch()
              }}
              style={styles.primaryButton}
            >
              <Text style={styles.primaryLabel}>
                {briefQuery.isFetching
                  ? 'Đang tải…'
                  : briefRequested
                    ? 'Tải lại thông tin được chia sẻ'
                    : 'Xem thông tin được chia sẻ'}
              </Text>
            </Pressable>
          )}
        </>
      ) : null}

      {briefQuery.isError ? (
        <Text accessibilityRole="alert" style={styles.state}>
          {continuityError(briefQuery.error)}
        </Text>
      ) : null}

      {briefVisible ? (
        <View style={styles.snapshot}>
          <View style={styles.section}>
            <Text style={styles.label}>Điều người dùng muốn bạn biết</Text>
            <Text style={styles.copy}>{briefQuery.data.currentSituation}</Text>
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Mục tiêu trao đổi</Text>
            {briefQuery.data.userGoals.map((goal) => (
              <Text key={goal} style={styles.copy}>
                • {goal}
              </Text>
            ))}
          </View>
          <View style={styles.section}>
            <Text style={styles.label}>Bối cảnh sàng lọc đã chia sẻ</Text>
            {briefQuery.data.screeningContext.map((item) => (
              <Text key={item.instrument} style={styles.copy}>
                {item.instrument} · {item.screeningLevel}
              </Text>
            ))}
            <Text style={styles.footnote}>
              Kết quả sàng lọc là thông tin mô tả, không phải chẩn đoán.
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xl,
  },
  heading: { gap: spacing.sm },
  title: { color: colors.ink, fontSize: 20, fontWeight: '700' },
  copy: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  state: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  notice: { gap: spacing.sm },
  clientName: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  linkButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
  },
  linkLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  primaryButton: {
    alignSelf: 'flex-start',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.control,
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  primaryLabel: {
    color: colors.white,
    fontSize: typography.body,
    fontWeight: '700',
  },
  snapshot: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    gap: spacing.lg,
    padding: spacing.lg,
  },
  section: { gap: spacing.sm },
  label: { color: colors.ink, fontSize: typography.body, fontWeight: '700' },
  footnote: { color: colors.inkFaint, fontSize: 13, lineHeight: 19 },
})
