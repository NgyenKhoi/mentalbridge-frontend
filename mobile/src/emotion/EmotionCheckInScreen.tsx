import { useQuery } from '@tanstack/react-query'
import { router } from 'expo-router'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { useSession } from '@/auth/session-context'
import { colors, radii, spacing, typography } from '@/theme/tokens'
import type { ResolvedEmotionPlanOrigin } from '@/support-plan/emotion-plan-context'

import type { EmotionApi } from './emotion-api'
import { EmotionCheckInForm } from './EmotionCheckInForm'
import { emotionByValue, emotions } from './emotion-presentation'
import {
  emotionKeys,
  useEmotionCheckIn,
  type EmotionCopy,
} from './use-emotion-check-in'

const periods = [7, 14, 30] as const
type Period = (typeof periods)[number]
const historyLimit = 30

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'UTC',
})

const displayDate = (localDate: string) =>
  dateFormatter.format(new Date(`${localDate}T00:00:00.000Z`))

function isUnauthorized(error: unknown) {
  return (
    error instanceof ApiError && (error.status === 401 || error.status === 403)
  )
}

function queryErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền xem dữ liệu cảm xúc.'
  }
  return 'Chưa thể tải dữ liệu cảm xúc lúc này. Dữ liệu đã lưu không bị thay đổi.'
}

function mutationErrorMessage(error: unknown) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Lựa chọn của bạn vẫn được giữ lại.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền thay đổi dữ liệu cảm xúc.'
  }
  return 'Chưa thể lưu thay đổi lúc này. Lựa chọn của bạn vẫn được giữ lại để thử lại.'
}

function StateMessage({
  children,
  tone = 'neutral',
}: Readonly<{
  children: string
  tone?: 'error' | 'neutral' | 'success'
}>) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'neutral' ? 'polite' : 'assertive'}
      style={[
        styles.message,
        tone === 'error' && styles.errorText,
        tone === 'success' && styles.successText,
      ]}
    >
      {children}
    </Text>
  )
}

const copy: EmotionCopy = {
  conflict:
    'Ghi nhận đã thay đổi ở nơi khác. Bản mới nhất đã được tải; hãy kiểm tra lại trước khi lưu.',
  failure: mutationErrorMessage,
}

export function EmotionCheckInScreen({
  api,
  now,
  timezone: timezoneOverride,
  planOrigin,
  onReturnToPlan,
}: Readonly<{
  api: EmotionApi
  now?: () => Date
  timezone?: string
  planOrigin?: ResolvedEmotionPlanOrigin
  onReturnToPlan?: () => void
}>) {
  const { signOut } = useSession()
  const {
    subject,
    timezone,
    localDate,
    scope,
    todayQuery,
    current,
    draft,
    notice,
    saveDisabled: draftSaveDisabled,
    pendingDeleteDate,
    setPendingDeleteDate,
    saveMutation,
    deleteMutation,
    editDraft,
    save,
    remove,
  } = useEmotionCheckIn({
    api,
    ...(now ? { now } : {}),
    timezone: timezoneOverride,
    copy,
  })
  const [period, setPeriod] = useState<Period>(7)

  const historyQuery = useQuery({
    queryKey: emotionKeys.history(subject, historyLimit),
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: () => api.listCheckIns(historyLimit),
  })
  const progressQuery = useQuery({
    queryKey: emotionKeys.progress(subject, timezone),
    enabled: Boolean(subject),
    refetchOnMount: 'always',
    queryFn: () => api.getProgress(timezone),
  })
  if (!subject) {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Ghi nhận cảm xúc
        </Text>
        <StateMessage tone="error">
          Bạn cần đăng nhập bằng tài khoản cá nhân để xem dữ liệu cảm xúc.
        </StateMessage>
        <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
      </Screen>
    )
  }

  const permissionError = [
    todayQuery.error,
    historyQuery.error,
    progressQuery.error,
  ].find(isUnauthorized)

  if (permissionError) {
    const unauthorized =
      permissionError instanceof ApiError && permissionError.status === 401
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Ghi nhận cảm xúc
        </Text>
        <StateMessage tone="error">
          {queryErrorMessage(permissionError)}
        </StateMessage>
        <PrimaryButton
          label={unauthorized ? 'Đăng nhập lại' : 'Quay lại'}
          onPress={() => {
            if (unauthorized) void signOut()
            else router.back()
          }}
        />
      </Screen>
    )
  }

  const saveDisabled =
    Boolean(planOrigin && planOrigin.occurrence.localDate !== localDate) ||
    draftSaveDisabled
  const emotionCopy = emotionByValue
  const selectedWindow = progressQuery.data?.windows.find(
    ({ days }) => days === period,
  )

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={() => router.back()}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backLabel}>← Quay lại</Text>
      </Pressable>

      <Text style={styles.eyebrow}>NHỊP GHI NHẬN CỦA BẠN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Ghi nhận cảm xúc
      </Text>
      <Text style={styles.description}>
        Chọn cảm xúc và mức độ bạn tự cảm nhận hôm nay. Dữ liệu được lưu theo
        tài khoản của bạn và có thể cập nhật trong cùng ngày.
      </Text>

      <View style={styles.panel}>
        {planOrigin && onReturnToPlan && (
          <View style={styles.planOrigin} testID="emotion-plan-origin">
            <Text style={styles.supporting}>
              Đang ghi nhận cho hoạt động trong kế hoạch
            </Text>
            <Text style={styles.sectionTitle}>{planOrigin.title}</Text>
            <Text accessibilityLiveRegion="polite" style={styles.supporting}>
              {saveMutation.isSuccess && saveMutation.variables?.scope === scope
                ? 'Đã lưu ghi nhận cảm xúc. Quay lại để kiểm tra hoạt động trong kế hoạch.'
                : 'Lưu cảm xúc xong, bạn có thể quay lại để kiểm tra hoạt động.'}
            </Text>
            {planOrigin.occurrence.localDate !== localDate && (
              <Text style={styles.supporting}>
                Ngày của hoạt động vừa mở đã qua. Ghi nhận đã lưu được giữ
                nguyên; quay lại để kiểm tra đúng hoạt động này.
              </Text>
            )}
            {current && current.timezone !== planOrigin.timezone && (
              <Text style={styles.supporting}>
                Ghi nhận hôm nay dùng múi giờ khác với hoạt động này. Bạn vẫn có
                thể xem và sửa cảm xúc; việc hoàn thành sẽ được kiểm tra riêng
                khi quay lại.
              </Text>
            )}
            <PrimaryButton
              label="Quay lại hoạt động"
              testID="emotion-return-to-plan"
              disabled={saveMutation.isPending || deleteMutation.isPending}
              onPress={onReturnToPlan}
            />
          </View>
        )}
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Cảm xúc hôm nay
        </Text>
        {todayQuery.isPending ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator
              accessibilityLabel="Đang tải ghi nhận hôm nay"
              color={colors.tealDeep}
            />
            <Text style={styles.supporting}>Đang tải ghi nhận hôm nay…</Text>
          </View>
        ) : todayQuery.isError && todayQuery.data === undefined ? (
          <View>
            <StateMessage tone="error">
              {queryErrorMessage(todayQuery.error)}
            </StateMessage>
            <PrimaryButton
              label="Thử tải lại"
              onPress={() => void todayQuery.refetch()}
            />
          </View>
        ) : (
          <>
            <Text style={styles.supporting}>
              {current
                ? 'Bạn có thể điều chỉnh lựa chọn đã lưu trong hôm nay.'
                : 'Hôm nay bạn chưa ghi nhận cảm xúc.'}
            </Text>
            <EmotionCheckInForm
              draft={draft}
              onChange={editDraft}
              onSave={() => save()}
              saving={saveMutation.isPending}
              saveDisabled={saveDisabled}
              saveLabel={current ? 'Cập nhật ghi nhận' : 'Lưu ghi nhận'}
            />
          </>
        )}
      </View>

      {notice && (
        <StateMessage tone={notice.tone}>{notice.message}</StateMessage>
      )}

      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Tiến độ ghi nhận
        </Text>
        <Text style={styles.supporting}>
          Các con số chỉ phản ánh những ngày bạn đã tự ghi nhận.
        </Text>
        {progressQuery.isPending ? (
          <ActivityIndicator
            accessibilityLabel="Đang tải tiến độ ghi nhận"
            color={colors.tealDeep}
          />
        ) : progressQuery.isError && !progressQuery.data ? (
          <View>
            <StateMessage tone="error">
              Chưa thể tải tiến độ ghi nhận lúc này.
            </StateMessage>
            <PrimaryButton
              label="Thử tải tiến độ"
              onPress={() => void progressQuery.refetch()}
            />
          </View>
        ) : progressQuery.data && selectedWindow ? (
          <>
            {progressQuery.isError && (
              <StateMessage tone="error">
                Chưa thể làm mới tiến độ. Số liệu đã tải vẫn được giữ nguyên.
              </StateMessage>
            )}
            <View style={styles.streakRow}>
              <View style={styles.streakItem}>
                <Text style={styles.metricLabel}>Chuỗi hiện tại</Text>
                <Text style={styles.metricValue}>
                  {progressQuery.data.currentStreak} ngày
                </Text>
              </View>
              <View style={styles.streakItem}>
                <Text style={styles.metricLabel}>Chuỗi dài nhất</Text>
                <Text style={styles.metricValue}>
                  {progressQuery.data.longestStreak} ngày
                </Text>
              </View>
            </View>
            <View style={styles.periodRow}>
              {periods.map((days) => (
                <Pressable
                  key={days}
                  accessibilityRole="button"
                  accessibilityState={{ selected: period === days }}
                  onPress={() => setPeriod(days)}
                  style={({ pressed }) => [
                    styles.periodButton,
                    period === days && styles.periodSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[
                      styles.periodLabel,
                      period === days && styles.periodLabelSelected,
                    ]}
                  >
                    {days} ngày
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.coverage}>
              Đã ghi nhận {selectedWindow.checkedInDays}/
              {selectedWindow.totalDays} ngày
            </Text>
            <Text style={styles.missingNote}>
              Những ngày không có ghi nhận được để trống, không dùng để kết luận
              cảm xúc tốt lên hay xấu đi.
            </Text>
            {selectedWindow.checkedInDays > 0 && (
              <View style={styles.distribution}>
                {emotions.map((item) => (
                  <View key={item.value} style={styles.distributionRow}>
                    <Text style={styles.distributionLabel}>
                      {item.emoji} {item.label}
                    </Text>
                    <Text style={styles.distributionCount}>
                      {selectedWindow.distribution[item.value]} ngày
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </View>

      <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Lịch sử gần đây
        </Text>
        {historyQuery.isPending ? (
          <ActivityIndicator
            accessibilityLabel="Đang tải lịch sử cảm xúc"
            color={colors.tealDeep}
          />
        ) : historyQuery.isError && !historyQuery.data ? (
          <View>
            <StateMessage tone="error">
              Chưa thể tải lịch sử cảm xúc lúc này.
            </StateMessage>
            <PrimaryButton
              label="Thử tải lịch sử"
              onPress={() => void historyQuery.refetch()}
            />
          </View>
        ) : historyQuery.data?.items.length === 0 ? (
          <Text style={styles.supporting}>
            Lịch sử sẽ xuất hiện sau lần lưu đầu tiên.
          </Text>
        ) : (
          <View style={styles.historyList}>
            {historyQuery.isError && (
              <StateMessage tone="error">
                Chưa thể làm mới lịch sử. Các ghi nhận đã tải vẫn được giữ
                nguyên.
              </StateMessage>
            )}
            {historyQuery.data?.items.map((item) => {
              const copy = emotionCopy.get(item.emotion)
              const confirming = pendingDeleteDate === item.localDate
              return (
                <View key={item.id} style={styles.historyItem}>
                  <Text style={styles.historyDate}>
                    {displayDate(item.localDate)}
                  </Text>
                  <Text style={styles.historyEmotion}>
                    {copy?.emoji} {copy?.label}
                  </Text>
                  <Text style={styles.supporting}>
                    Mức cảm nhận {item.intensity}/5
                  </Text>
                  {confirming ? (
                    <View style={styles.deleteConfirm}>
                      <StateMessage tone="error">
                        Xóa ghi nhận này sẽ loại nó khỏi lịch sử và tiến độ.
                      </StateMessage>
                      <View style={styles.inlineActions}>
                        <Pressable
                          accessibilityRole="button"
                          disabled={deleteMutation.isPending}
                          onPress={() => remove(item.localDate)}
                          style={({ pressed }) => [
                            styles.dangerButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.dangerLabel}>
                            {deleteMutation.isPending
                              ? 'Đang xóa…'
                              : 'Xác nhận xóa'}
                          </Text>
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          disabled={deleteMutation.isPending}
                          onPress={() => setPendingDeleteDate(null)}
                          style={({ pressed }) => [
                            styles.textButton,
                            pressed && styles.pressed,
                          ]}
                        >
                          <Text style={styles.textButtonLabel}>Giữ lại</Text>
                        </Pressable>
                      </View>
                    </View>
                  ) : (
                    <Pressable
                      accessibilityLabel={`Xóa ghi nhận ngày ${displayDate(item.localDate)}`}
                      accessibilityRole="button"
                      onPress={() => setPendingDeleteDate(item.localDate)}
                      style={({ pressed }) => [
                        styles.deleteButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.deleteLabel}>Xóa ghi nhận</Text>
                    </Pressable>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </View>

      <Text style={styles.disclaimer}>
        Đây là dữ liệu tự ghi nhận, không phải chẩn đoán, điểm sức khỏe hay đánh
        giá mức độ hồi phục.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
  planOrigin: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    padding: spacing.lg,
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  backButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    marginBottom: spacing.lg,
    paddingRight: spacing.lg,
  },
  backLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  eyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: spacing.md,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.sm,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.xl,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 22,
    fontWeight: '700',
  },
  supporting: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  choice: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: 'transparent',
    borderRadius: radii.control,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 78,
    minWidth: 88,
    padding: spacing.sm,
  },
  choiceSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  choiceLabel: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    marginTop: spacing.xs,
  },
  fieldLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
    marginTop: spacing.sm,
  },
  intensity: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: 'transparent',
    borderRadius: radii.control,
    borderWidth: 2,
    justifyContent: 'center',
    minHeight: 48,
    minWidth: 48,
  },
  intensitySelected: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  intensityLabel: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  contextToggle: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    marginTop: spacing.sm,
    paddingTop: spacing.md,
  },
  contextToggleLabel: {
    color: colors.tealDeep,
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  contextToggleIcon: {
    color: colors.tealDeep,
    fontSize: 22,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  contextPrivacy: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 21,
  },
  factorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  factorChip: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  factorSelected: {
    backgroundColor: colors.tealPale,
    borderColor: colors.tealDeep,
  },
  noteInput: {
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    color: colors.ink,
    fontSize: typography.body,
    minHeight: 96,
    padding: spacing.md,
  },
  noteCount: {
    alignSelf: 'flex-end',
    color: colors.inkSoft,
    fontSize: 12,
  },
  message: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.lg,
  },
  errorText: { color: '#9B352D' },
  successText: { color: colors.tealDeep },
  streakRow: { flexDirection: 'row', gap: spacing.md },
  streakItem: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    flex: 1,
    padding: spacing.md,
  },
  metricLabel: { color: colors.inkSoft, fontSize: 14 },
  metricValue: {
    color: colors.tealDeep,
    fontSize: 20,
    fontWeight: '800',
    marginTop: spacing.xs,
  },
  periodRow: { flexDirection: 'row', gap: spacing.sm },
  periodButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  periodSelected: { backgroundColor: colors.tealDeep },
  periodLabel: { color: colors.ink, fontWeight: '700' },
  periodLabelSelected: { color: colors.white },
  coverage: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  missingNote: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  distribution: { gap: spacing.sm },
  distributionRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  distributionLabel: { color: colors.ink, fontSize: 15 },
  distributionCount: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  historyList: { gap: spacing.md },
  historyItem: {
    borderBottomColor: colors.line,
    borderBottomWidth: 1,
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  historyDate: { color: colors.inkSoft, fontSize: 14 },
  historyEmotion: {
    color: colors.ink,
    fontSize: 18,
    fontWeight: '700',
  },
  deleteButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  deleteLabel: { color: '#9B352D', fontSize: 15, fontWeight: '700' },
  deleteConfirm: {
    backgroundColor: '#FCEBE8',
    borderRadius: radii.control,
    marginTop: spacing.sm,
    padding: spacing.md,
  },
  inlineActions: { flexDirection: 'row', gap: spacing.md },
  dangerButton: {
    alignItems: 'center',
    backgroundColor: '#9B352D',
    borderRadius: radii.control,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  dangerLabel: { color: colors.white, fontWeight: '700' },
  textButton: {
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  textButtonLabel: { color: colors.tealDeep, fontWeight: '700' },
  disclaimer: {
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
  },
  pressed: { opacity: 0.65 },
})
