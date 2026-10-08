import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { ResourceApi } from './resource-api'
import type { ResourceCategory } from './resource-contract'
import {
  localDateInTimeZone,
  progressFor,
  recentLocalDates,
  resourceCategories,
  resourceFormat,
} from './resource-model'

type SelectedCategory = ResourceCategory | 'ALL'

function dateLabel(localDate: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T00:00:00.000Z`))
}

function apiMessage(error: unknown, action: string) {
  if (error instanceof ApiError && error.status === 401) {
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  }
  if (error instanceof ApiError && error.status === 403) {
    return 'Tài khoản này không có quyền xem tài nguyên dành cho người dùng.'
  }
  return `Chưa thể ${action} lúc này. Hãy thử lại sau.`
}

function StateMessage({
  children,
  tone = 'neutral',
}: Readonly<{
  children: string
  tone?: 'neutral' | 'error'
}>) {
  return (
    <Text
      accessibilityLiveRegion={tone === 'error' ? 'assertive' : 'polite'}
      style={[styles.message, tone === 'error' && styles.errorText]}
    >
      {children}
    </Text>
  )
}

export function ResourcesScreen({
  api,
  now = () => new Date(),
  timezone: timezoneOverride,
  initialDate,
  initialCategory = 'ALL',
  onBack,
  onOpenResource,
}: Readonly<{
  api: ResourceApi
  now?: () => Date
  timezone?: string
  initialDate?: string
  initialCategory?: SelectedCategory
  onBack: () => void
  onOpenResource: (
    resourceId: string,
    localDate: string,
    category: SelectedCategory,
  ) => void
}>) {
  const { session, signOut } = useSession()
  const subject = session?.subject
  const isUser = session?.role === 'USER'
  const timezone = useMemo(
    () =>
      timezoneOverride ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      'UTC',
    [timezoneOverride],
  )
  const today = useMemo(
    () => localDateInTimeZone(now(), timezone),
    [now, timezone],
  )
  const dates = useMemo(() => recentLocalDates(today), [today])
  const [selectedDate, setSelectedDate] = useState(
    initialDate && dates.includes(initialDate) ? initialDate : today,
  )
  const [category, setCategory] = useState<SelectedCategory>(initialCategory)

  const catalogueQuery = useInfiniteQuery({
    queryKey: ['resources', subject, category, 'vi-VN'] as const,
    enabled: Boolean(subject && isUser),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listResources({
        locale: 'vi-VN',
        limit: 20,
        ...(category === 'ALL' ? {} : { category }),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor,
  })
  const progressQuery = useQuery({
    queryKey: ['resource-progress', subject, dates[0], today] as const,
    enabled: Boolean(subject && isUser),
    queryFn: () => api.listProgress(dates[0]!, today),
  })

  if (!subject || !isUser) {
    const unauthenticated = !subject
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Tài nguyên hỗ trợ
        </Text>
        <StateMessage tone="error">
          {unauthenticated
            ? 'Bạn cần đăng nhập bằng tài khoản cá nhân để xem tài nguyên.'
            : 'Tài khoản này không có quyền xem tài nguyên dành cho người dùng.'}
        </StateMessage>
        <PrimaryButton
          label={unauthenticated ? 'Đăng nhập lại' : 'Quay lại'}
          onPress={() => {
            if (unauthenticated) void signOut()
            else onBack()
          }}
        />
      </Screen>
    )
  }

  const pages = catalogueQuery.data?.pages ?? []
  const resources = pages.flatMap((page) => page.data)
  const unavailable = pages.some((page) => page.fallback === 'unavailable')
  const fallbackMessage = pages.find((page) => page.message)?.message
  const progress = progressQuery.data ?? []

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
      >
        <Text style={styles.backLabel}>← Quay lại</Text>
      </Pressable>

      <Text style={styles.eyebrow}>GÓC TÀI NGUYÊN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Chọn một nội dung phù hợp lúc này
      </Text>
      <Text style={styles.description}>
        Khám phá bài đọc, video và hoạt động đã được rà soát. Bạn có thể quay
        lại tiến độ của từng ngày.
      </Text>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Ngày bạn muốn xem
        </Text>
        <View style={styles.dateRow}>
          {dates.map((date) => {
            const selected = selectedDate === date
            return (
              <Pressable
                key={date}
                accessibilityLabel={dateLabel(date)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                onPress={() => setSelectedDate(date)}
                style={({ pressed }) => [
                  styles.dateButton,
                  selected && styles.selectedButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.dateText, selected && styles.selectedText]}
                >
                  {dateLabel(date)}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Lọc theo nội dung
        </Text>
        <View accessibilityRole="radiogroup" style={styles.filterRow}>
          {resourceCategories.map((option) => {
            const selected = category === option.value
            return (
              <Pressable
                key={option.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                onPress={() => setCategory(option.value)}
                style={({ pressed }) => [
                  styles.filterButton,
                  selected && styles.selectedButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  style={[styles.filterText, selected && styles.selectedText]}
                >
                  {option.label}
                </Text>
              </Pressable>
            )
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.sectionTitle}>
          Nội dung đã rà soát
        </Text>

        {catalogueQuery.isPending ? (
          <View accessibilityLiveRegion="polite" style={styles.loadingRow}>
            <ActivityIndicator
              accessibilityLabel="Đang tải tài nguyên"
              color={colors.tealDeep}
            />
            <Text style={styles.supporting}>Đang tải tài nguyên…</Text>
          </View>
        ) : catalogueQuery.isError && resources.length === 0 ? (
          <View>
            <StateMessage tone="error">
              {apiMessage(catalogueQuery.error, 'tải danh sách tài nguyên')}
            </StateMessage>
            <PrimaryButton
              label="Thử tải lại"
              onPress={() => void catalogueQuery.refetch()}
            />
          </View>
        ) : unavailable ? (
          <View>
            <StateMessage tone="error">
              {fallbackMessage ??
                'Tài nguyên hỗ trợ tạm thời chưa khả dụng. Hãy thử lại sau.'}
            </StateMessage>
            <PrimaryButton
              label="Thử tải lại"
              onPress={() => void catalogueQuery.refetch()}
            />
          </View>
        ) : resources.length === 0 ? (
          <StateMessage>
            {category === 'ALL'
              ? 'Chưa có tài nguyên đã rà soát phù hợp để hiển thị.'
              : 'Nhóm này chưa có tài nguyên phù hợp. Hãy chọn nhóm khác.'}
          </StateMessage>
        ) : (
          <View style={styles.list}>
            {catalogueQuery.isError && (
              <StateMessage tone="error">
                Chưa thể làm mới danh sách. Các tài nguyên đã tải vẫn được giữ
                nguyên.
              </StateMessage>
            )}
            {progressQuery.isError && (
              <StateMessage tone="error">
                Chưa thể tải tiến độ. Bạn vẫn có thể đọc nội dung, nhưng chưa
                nên cập nhật hoạt động lúc này.
              </StateMessage>
            )}
            {resources.map((resource) => {
              const item = progressFor(progress, resource.id, selectedDate)
              const status =
                item?.status === 'COMPLETED'
                  ? 'Đã hoàn thành'
                  : item?.status === 'IN_PROGRESS'
                    ? 'Đang thực hiện'
                    : 'Chưa bắt đầu'
              return (
                <Pressable
                  key={resource.id}
                  accessibilityLabel={`Mở ${resource.title}`}
                  accessibilityRole="button"
                  onPress={() =>
                    onOpenResource(resource.id, selectedDate, category)
                  }
                  testID={`resource-card-${resource.id}`}
                  style={({ pressed }) => [
                    styles.card,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.cardMeta}>
                    <Text style={styles.badge}>{resourceFormat(resource)}</Text>
                    <Text style={styles.duration}>
                      {resource.expectedDurationMinutes} phút
                    </Text>
                  </View>
                  <Text style={styles.cardTitle}>{resource.title}</Text>
                  <Text style={styles.supporting}>{resource.summary}</Text>
                  <Text style={styles.status}>{status}</Text>
                </Pressable>
              )
            })}
            {catalogueQuery.hasNextPage && (
              <PrimaryButton
                disabled={catalogueQuery.isFetchingNextPage}
                label={
                  catalogueQuery.isFetchingNextPage
                    ? 'Đang tải thêm…'
                    : 'Tải thêm tài nguyên'
                }
                onPress={() => void catalogueQuery.fetchNextPage()}
              />
            )}
          </View>
        )}
      </View>

      <Text style={styles.disclaimer}>
        Tiến độ chỉ ghi nhận hoạt động bạn đã thực hiện. Đây không phải mức độ
        tuân thủ kế hoạch hay đánh giá cải thiện sức khỏe.
      </Text>
    </Screen>
  )
}

const styles = StyleSheet.create({
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
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.ink,
    fontSize: typography.heading,
    fontWeight: '700',
    lineHeight: typography.headingLineHeight,
    marginBottom: spacing.md,
  },
  description: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.xl,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: spacing.md,
  },
  dateRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  dateButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dateText: {
    color: colors.inkSoft,
    fontSize: 14,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: spacing.lg,
  },
  filterText: {
    color: colors.inkSoft,
    fontSize: 15,
    fontWeight: '700',
  },
  selectedButton: {
    backgroundColor: colors.tealDeep,
    borderColor: colors.tealDeep,
  },
  selectedText: {
    color: colors.white,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
  },
  list: {
    gap: spacing.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    padding: spacing.lg,
  },
  cardMeta: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badge: {
    color: colors.tealDeep,
    fontSize: 13,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  duration: {
    color: colors.inkFaint,
    fontSize: 14,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 26,
    marginBottom: spacing.sm,
  },
  status: {
    color: colors.tealDeep,
    fontSize: 15,
    fontWeight: '700',
    marginTop: spacing.md,
  },
  supporting: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  message: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
    marginBottom: spacing.md,
  },
  errorText: {
    color: '#9B352D',
  },
  disclaimer: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 21,
    marginTop: spacing.sm,
  },
  pressed: {
    opacity: 0.7,
  },
})
