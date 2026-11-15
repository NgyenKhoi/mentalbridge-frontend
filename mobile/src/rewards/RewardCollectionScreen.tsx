import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import type { ResourceApi } from '@/resources/resource-api'
import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import type { CanonicalSupportPlan } from '@/support-plan/support-plan-action-contract'
import { colors, radii, spacing, typography } from '@/theme/tokens'

import type { RewardApi } from './reward-api'
import type {
  AchievementCollection,
  ResourceBingoBoard,
  ResourceBingoPlanSync,
  ResourceBookmark,
  ResourceReward,
} from './reward-contract'

type BookmarkLookup =
  | { status: 'AVAILABLE'; title: string }
  | { status: 'DELETED' }
  | { status: 'LOOKUP_UNAVAILABLE' }
type BookmarkView = ResourceBookmark & { lookup: BookmarkLookup }
type SourceName = 'achievements' | 'rewards' | 'bookmarks' | 'bingo'
type Errors = Partial<Record<SourceName, string>>

const achievementStatus = {
  EARNED: 'Đã ghi nhận',
  UNEARNED: 'Chưa ghi nhận',
  SOURCE_UNAVAILABLE: 'Nguồn chưa thể xác minh',
  GRANDFATHERED: 'Được giữ theo quy tắc trước',
  DEFERRED: 'Chưa mở trong phiên bản này',
} as const

function localDate(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((value) => value.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function localWeekStart(date: string) {
  const monday = new Date(`${date}T00:00:00Z`)
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

function sourceMessage(source: SourceName, error: unknown) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'
  if (source === 'bingo' && error instanceof ApiError && error.status === 404)
    return ''
  const label = {
    achievements: 'bộ sưu tập',
    rewards: 'điểm ghi nhận',
    bookmarks: 'tài nguyên đã lưu',
    bingo: 'Bingo trong kế hoạch',
  }[source]
  return `Chưa thể tải ${label}. Không dùng dữ liệu cũ để suy đoán trạng thái hiện tại.`
}

function optionalPlan(request: Promise<CanonicalSupportPlan>) {
  return request.catch((error: unknown) => {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  })
}

function unavailableBookmark(error: unknown): BookmarkLookup {
  return error instanceof ApiError &&
    error.status !== undefined &&
    [404, 410].includes(error.status)
    ? { status: 'DELETED' }
    : { status: 'LOOKUP_UNAVAILABLE' }
}

function SectionState({ message }: Readonly<{ message: string }>) {
  return (
    <Text accessibilityLiveRegion="assertive" style={styles.error}>
      {message}
    </Text>
  )
}

export function RewardCollectionScreen({
  api,
  planApi,
  resourceApi,
  onBack,
  onOpenResource,
  timezone: timezoneOverride,
  now = () => new Date(),
  refreshToken = 0,
}: Readonly<{
  api: RewardApi
  planApi: Pick<SupportPlanActionApi, 'getCurrent'>
  resourceApi: Pick<ResourceApi, 'getResource'>
  onBack: () => void
  onOpenResource: (resourceId: string) => void
  timezone?: string
  now?: () => Date
  refreshToken?: number
}>) {
  const { session, signOut } = useSession()
  const timezone = useMemo(
    () =>
      timezoneOverride ??
      Intl.DateTimeFormat().resolvedOptions().timeZone ??
      'UTC',
    [timezoneOverride],
  )
  const weekStart = useMemo(
    () => localWeekStart(localDate(now(), timezone)),
    [now, timezone],
  )
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [working, setWorking] = useState<string | null>(null)
  const [errors, setErrors] = useState<Errors>({})
  const [achievements, setAchievements] = useState<{
    collection: AchievementCollection
    etag: string
  } | null>(null)
  const [rewards, setRewards] = useState<ResourceReward | null>(null)
  const [bookmarks, setBookmarks] = useState<BookmarkView[] | null>(null)
  const [bingo, setBingo] = useState<{
    board: ResourceBingoBoard
    etag: string
    planStatus: CanonicalSupportPlan['status'] | null
    context: 'CURRENT_PLAN' | 'HISTORICAL'
    unavailableActions: ResourceBingoPlanSync['unavailableActions']
  } | null>(null)
  const request = useRef(0)
  const hasLoaded = useRef(false)
  const loadedSubject = useRef<string | null>(null)

  const load = useCallback(
    async (clearSnapshot = false) => {
      const serial = ++request.current
      const isRefresh = hasLoaded.current && !clearSnapshot
      setLoading(!isRefresh)
      setRefreshing(isRefresh)
      setErrors({})
      if (!isRefresh) {
        setAchievements(null)
        setRewards(null)
        setBookmarks(null)
        setBingo(null)
      }

      const [achievementResult, rewardResult, bookmarkResult, planResult] =
        await Promise.allSettled([
          api.getAchievements(timezone),
          api.getResourceRewards(),
          api.getBookmarks(),
          optionalPlan(planApi.getCurrent()),
        ])
      if (serial !== request.current) return

      const nextErrors: Errors = {}
      if (achievementResult.status === 'fulfilled')
        setAchievements(achievementResult.value)
      else {
        setAchievements(null)
        nextErrors.achievements = sourceMessage(
          'achievements',
          achievementResult.reason,
        )
      }

      if (rewardResult.status === 'fulfilled') setRewards(rewardResult.value)
      else {
        setRewards(null)
        nextErrors.rewards = sourceMessage('rewards', rewardResult.reason)
      }

      if (bookmarkResult.status === 'fulfilled') {
        const detailed = await Promise.all(
          bookmarkResult.value.map(async (bookmark) => {
            try {
              const resource = await resourceApi.getResource(
                bookmark.resourceId,
                'vi-VN',
              )
              return {
                ...bookmark,
                lookup: { status: 'AVAILABLE', title: resource.title } as const,
              }
            } catch (error) {
              return { ...bookmark, lookup: unavailableBookmark(error) }
            }
          }),
        )
        if (serial !== request.current) return
        setBookmarks(detailed)
      } else {
        setBookmarks(null)
        nextErrors.bookmarks = sourceMessage('bookmarks', bookmarkResult.reason)
      }

      if (planResult.status === 'rejected') {
        setBingo(null)
        nextErrors.bingo = sourceMessage('bingo', planResult.reason)
      } else {
        const plan = planResult.value
        try {
          const planScoped =
            plan?.status === 'ACTIVE' || plan?.status === 'PAUSED'
          const result = planScoped
            ? await api.syncBingo(weekStart, timezone)
            : await api.getBingo(weekStart)
          if (serial !== request.current) return
          setBingo({
            board: result.board,
            etag: result.etag,
            planStatus: plan?.status ?? null,
            context: planScoped ? 'CURRENT_PLAN' : 'HISTORICAL',
            unavailableActions: planScoped
              ? (result.board as ResourceBingoPlanSync).unavailableActions
              : [],
          })
        } catch (error) {
          setBingo(null)
          const message = sourceMessage('bingo', error)
          if (message) nextErrors.bingo = message
        }
      }
      if (serial === request.current) {
        setErrors(nextErrors)
        setLoading(false)
        setRefreshing(false)
        hasLoaded.current = true
      }
    },
    [api, planApi, resourceApi, timezone, weekStart],
  )

  useEffect(() => {
    const subject = session?.subject ?? null
    const accountChanged = loadedSubject.current !== subject
    if (accountChanged) {
      loadedSubject.current = subject
      hasLoaded.current = false
    }
    void load(accountChanged)
    return () => {
      request.current += 1
    }
  }, [load, refreshToken, session?.subject])

  async function changeAchievementVisibility() {
    if (!achievements || working || refreshing) return
    setWorking('achievements')
    try {
      const result = await api.setAchievementVisibility(
        timezone,
        achievements.collection.visibilityState === 'VISIBLE'
          ? 'HIDDEN'
          : 'VISIBLE',
        achievements.etag,
      )
      setAchievements(result)
      setErrors((current) => {
        const next = { ...current }
        delete next.achievements
        return next
      })
    } catch (error) {
      setAchievements(null)
      setErrors((current) => ({
        ...current,
        achievements:
          error instanceof ApiError && error.status === 412
            ? 'Bộ sưu tập vừa thay đổi ở thiết bị khác. Hãy tải lại trước khi đổi quyền hiển thị.'
            : sourceMessage('achievements', error),
      }))
    } finally {
      setWorking(null)
    }
  }

  async function changeRewardVisibility() {
    if (!rewards || working || refreshing) return
    setWorking('rewards')
    try {
      setRewards(
        await api.setResourceRewardVisibility(
          rewards.visibilityState === 'VISIBLE' ? 'HIDDEN' : 'VISIBLE',
        ),
      )
      setErrors((current) => {
        const next = { ...current }
        delete next.rewards
        return next
      })
    } catch (error) {
      setRewards(null)
      setErrors((current) => ({
        ...current,
        rewards: sourceMessage('rewards', error),
      }))
    } finally {
      setWorking(null)
    }
  }

  async function removeBookmark(resourceId: string) {
    if (!bookmarks || working || refreshing) return
    setWorking(`bookmark:${resourceId}`)
    try {
      await api.deleteBookmark(resourceId)
      setBookmarks(
        (current) =>
          current?.filter((item) => item.resourceId !== resourceId) ?? null,
      )
    } catch (error) {
      setBookmarks(null)
      setErrors((current) => ({
        ...current,
        bookmarks: sourceMessage('bookmarks', error),
      }))
    } finally {
      setWorking(null)
    }
  }

  async function retryBookmarkLookup(resourceId: string) {
    if (!bookmarks || working || refreshing) return
    setWorking(`bookmark-lookup:${resourceId}`)
    try {
      const resource = await resourceApi.getResource(resourceId, 'vi-VN')
      setBookmarks(
        (current) =>
          current?.map((bookmark) =>
            bookmark.resourceId === resourceId
              ? {
                  ...bookmark,
                  lookup: {
                    status: 'AVAILABLE' as const,
                    title: resource.title,
                  },
                }
              : bookmark,
          ) ?? null,
      )
    } catch (error) {
      setBookmarks(
        (current) =>
          current?.map((bookmark) =>
            bookmark.resourceId === resourceId
              ? { ...bookmark, lookup: unavailableBookmark(error) }
              : bookmark,
          ) ?? null,
      )
    } finally {
      setWorking(null)
    }
  }

  async function toggleBingo(position: number, selfConfirmed: boolean) {
    if (
      !bingo ||
      working ||
      refreshing ||
      bingo.context !== 'CURRENT_PLAN' ||
      bingo.planStatus !== 'ACTIVE'
    )
      return
    setWorking(`bingo:${position}`)
    try {
      const result = await api.setBingoSelfConfirmation(
        bingo.board.weekStart,
        position,
        selfConfirmed,
        bingo.etag,
      )
      setBingo({ ...bingo, ...result })
    } catch (error) {
      setBingo(null)
      setErrors((current) => ({
        ...current,
        bingo:
          error instanceof ApiError && error.status === 412
            ? 'Bingo vừa thay đổi ở nơi khác. Hãy tải lại trước khi đánh dấu.'
            : sourceMessage('bingo', error),
      }))
    } finally {
      setWorking(null)
    }
  }

  if (!session || session.role !== 'USER') {
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Bộ sưu tập riêng tư
        </Text>
        <SectionState message="Bạn cần đăng nhập bằng tài khoản cá nhân để xem dữ liệu này." />
        <PrimaryButton label="Đăng nhập lại" onPress={() => void signOut()} />
      </Screen>
    )
  }

  return (
    <Screen>
      <Pressable
        accessibilityRole="button"
        onPress={onBack}
        style={({ pressed }) => [styles.back, pressed && styles.pressed]}
      >
        <Text style={styles.link}>← Quay lại</Text>
      </Pressable>
      <Text style={styles.eyebrow}>RIÊNG TƯ CHO BẠN</Text>
      <Text accessibilityRole="header" style={styles.title}>
        Bộ sưu tập và Bingo
      </Text>
      <Text style={styles.description}>
        Các dấu mốc và hoạt động dưới đây do hệ thống chủ quản xác nhận. Ứng
        dụng không tự tính điểm, suy đoán tiến bộ hay xem ngày bỏ lỡ là thất
        bại.
      </Text>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator
            accessibilityLabel="Đang tải bộ sưu tập"
            color={colors.tealDeep}
          />
          <Text style={styles.body}>Đang tải dữ liệu đã lưu…</Text>
        </View>
      ) : (
        <>
          {refreshing ? (
            <Text accessibilityLiveRegion="polite" style={styles.notice}>
              Đang xác nhận dữ liệu mới nhất. Thông tin bên dưới chỉ để tham
              khảo và tạm thời không thể chỉnh sửa.
            </Text>
          ) : null}
          <View style={styles.section} testID="reward-summary">
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Ghi nhận từ tài nguyên
            </Text>
            {errors.rewards ? (
              <SectionState message={errors.rewards} />
            ) : rewards?.visibilityState === 'HIDDEN' ? (
              <Text style={styles.body}>
                Bạn đã ẩn điểm và cấp độ. Tài nguyên cốt lõi vẫn sử dụng bình
                thường.
              </Text>
            ) : rewards ? (
              <>
                <Text style={styles.metric}>
                  Cấp {rewards.level} · {rewards.totalXp} XP
                </Text>
                <Text style={styles.supporting}>
                  Quy tắc {rewards.policyVersion} · nguồn{' '}
                  {rewards.sourceAvailability === 'AVAILABLE'
                    ? 'đang khả dụng'
                    : 'chưa khả dụng'}
                </Text>
                {rewards.recentGrants.map((grant) => (
                  <Text key={grant.grantId} style={styles.itemLine}>
                    +{grant.xp} XP · {grant.localDate} · {grant.ruleVersion}
                  </Text>
                ))}
              </>
            ) : null}
            {rewards ? (
              <PrimaryButton
                disabled={refreshing || working === 'rewards'}
                label={
                  rewards.visibilityState === 'VISIBLE'
                    ? 'Ẩn điểm ghi nhận'
                    : 'Hiện điểm ghi nhận'
                }
                onPress={() => void changeRewardVisibility()}
              />
            ) : null}
          </View>

          <View style={styles.section} testID="achievement-collection">
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Dấu mốc hành trình
            </Text>
            {errors.achievements ? (
              <SectionState message={errors.achievements} />
            ) : achievements?.collection.visibilityState === 'HIDDEN' ? (
              <Text style={styles.body}>
                Bộ sưu tập đang được ẩn. Việc ẩn không giới hạn Journal,
                Emotion, SupportPlan hoặc tài nguyên.
              </Text>
            ) : achievements ? (
              achievements.collection.items.length === 0 ? (
                <Text style={styles.body}>Chưa có dấu mốc để hiển thị.</Text>
              ) : (
                achievements.collection.items.map((item) => (
                  <View key={item.definitionId} style={styles.card}>
                    <Text style={styles.cardTitle}>{item.title}</Text>
                    <Text style={styles.body}>{item.description}</Text>
                    <Text style={styles.status}>
                      {achievementStatus[item.status]}
                      {item.progress
                        ? ` · ${item.progress.current}/${item.progress.target}`
                        : ''}
                    </Text>
                    <Text style={styles.supporting}>
                      {item.ruleVersion} · {item.privacy.toLowerCase()}
                    </Text>
                  </View>
                ))
              )
            ) : null}
            {achievements ? (
              <PrimaryButton
                disabled={refreshing || working === 'achievements'}
                label={
                  achievements.collection.visibilityState === 'VISIBLE'
                    ? 'Ẩn bộ sưu tập'
                    : 'Hiện bộ sưu tập'
                }
                onPress={() => void changeAchievementVisibility()}
              />
            ) : null}
          </View>

          <View style={styles.section} testID="reward-bookmarks">
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Tài nguyên đã lưu
            </Text>
            {errors.bookmarks ? (
              <SectionState message={errors.bookmarks} />
            ) : bookmarks?.length === 0 ? (
              <Text style={styles.body}>Bạn chưa lưu tài nguyên nào.</Text>
            ) : (
              bookmarks?.map((bookmark) => (
                <View key={bookmark.resourceId} style={styles.card}>
                  <Text style={styles.cardTitle}>
                    {bookmark.lookup.status === 'AVAILABLE'
                      ? bookmark.lookup.title
                      : bookmark.lookup.status === 'DELETED'
                        ? 'Tài nguyên đã lưu không còn khả dụng'
                        : 'Chưa thể kiểm tra tài nguyên đã lưu này'}
                  </Text>
                  <Text style={styles.supporting}>
                    Phiên bản đã lưu: {bookmark.contentVersion}
                  </Text>
                  {bookmark.lookup.status === 'AVAILABLE' ? (
                    <Pressable
                      accessibilityRole="button"
                      disabled={refreshing}
                      onPress={() => onOpenResource(bookmark.resourceId)}
                      style={({ pressed }) => [
                        styles.quietButton,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.link}>Mở tài nguyên</Text>
                    </Pressable>
                  ) : null}
                  {bookmark.lookup.status === 'LOOKUP_UNAVAILABLE' ? (
                    <>
                      <Text style={styles.body}>
                        Kết nối tới nguồn tài nguyên đang không chắc chắn. Không
                        xem mục này là đã bị xoá.
                      </Text>
                      <Pressable
                        accessibilityRole="button"
                        disabled={refreshing || working !== null}
                        onPress={() =>
                          void retryBookmarkLookup(bookmark.resourceId)
                        }
                        style={({ pressed }) => [
                          styles.quietButton,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.link}>Thử tải lại tài nguyên</Text>
                      </Pressable>
                    </>
                  ) : null}
                  <Pressable
                    accessibilityRole="button"
                    disabled={refreshing || working !== null}
                    onPress={() => void removeBookmark(bookmark.resourceId)}
                    style={({ pressed }) => [
                      styles.quietButton,
                      pressed && styles.pressed,
                    ]}
                  >
                    <Text style={styles.link}>Bỏ lưu</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          <View style={styles.section} testID="reward-bingo">
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              {bingo?.context === 'CURRENT_PLAN'
                ? 'Bingo trong kế hoạch tuần này'
                : bingo?.context === 'HISTORICAL'
                  ? 'Bảng Bingo đã lưu trước đó'
                  : 'Bingo trong kế hoạch'}
            </Text>
            {errors.bingo ? (
              <SectionState message={errors.bingo} />
            ) : !bingo || bingo.board.items.length === 0 ? (
              <Text style={styles.body}>
                Chưa có Bingo từ kế hoạch hiện tại. Bạn vẫn có thể dùng danh mục
                tài nguyên và các nội dung đã lưu.
              </Text>
            ) : (
              <>
                {bingo.planStatus === 'PAUSED' ? (
                  <Text style={styles.notice}>
                    Kế hoạch đang tạm dừng. Bingo chỉ đọc cho đến khi kế hoạch
                    hoạt động lại.
                  </Text>
                ) : null}
                {bingo.context === 'HISTORICAL' ? (
                  <Text style={styles.notice}>
                    Đây là bảng đã lưu từ một kế hoạch trước đó. Bảng chỉ đọc;
                    ứng dụng không coi đây là kế hoạch hiện tại và không suy
                    đoán kế hoạch nguồn khi chưa có dữ liệu xác nhận.
                  </Text>
                ) : null}
                {bingo.unavailableActions.some(
                  ({ reason }) => reason === 'RESOURCE_VERSION_UNAVAILABLE',
                ) ? (
                  <Text style={styles.notice}>
                    Một số hoạt động chưa thể thêm vì phiên bản tài nguyên không
                    còn khả dụng.
                  </Text>
                ) : null}
                {bingo.unavailableActions.some(
                  ({ reason }) => reason === 'BOARD_FULL',
                ) ? (
                  <Text style={styles.notice}>
                    Một số hoạt động chưa được thêm vì bảng tuần này đã đủ.
                  </Text>
                ) : null}
                {bingo.board.items.map((item) => {
                  const verified = item.evidence === 'CONTENT_VERIFIED'
                  const selfConfirmed =
                    Boolean(item.selfConfirmedAt) ||
                    item.evidence === 'SELF_CONFIRMED'
                  const interactive =
                    !refreshing &&
                    bingo.context === 'CURRENT_PLAN' &&
                    bingo.planStatus === 'ACTIVE' &&
                    !item.retired &&
                    (!verified || selfConfirmed)
                  return (
                    <Pressable
                      key={`${item.position}:${item.resourceId}`}
                      testID={`bingo-item-${item.position}`}
                      accessibilityRole={interactive ? 'checkbox' : undefined}
                      accessibilityState={
                        interactive
                          ? { checked: verified || selfConfirmed }
                          : undefined
                      }
                      disabled={!interactive || working !== null}
                      onPress={() =>
                        void toggleBingo(item.position, !selfConfirmed)
                      }
                      style={({ pressed }) => [
                        styles.bingoItem,
                        (verified || selfConfirmed) && styles.bingoMarked,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.cardTitle}>{item.label}</Text>
                      <Text style={styles.status}>
                        {item.retired
                          ? 'Không còn trong kế hoạch'
                          : verified
                            ? 'Content đã xác minh'
                            : selfConfirmed
                              ? 'Bạn đã tự đánh dấu'
                              : 'Chưa đánh dấu'}
                      </Text>
                    </Pressable>
                  )
                })}
              </>
            )}
          </View>

          <PrimaryButton
            disabled={refreshing || working !== null}
            label={refreshing ? 'Đang làm mới dữ liệu…' : 'Làm mới dữ liệu'}
            onPress={() => void load()}
          />
        </>
      )}
    </Screen>
  )
}

const styles = StyleSheet.create({
  back: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    marginBottom: spacing.lg,
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
  loading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 80,
  },
  section: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: spacing.md,
    paddingVertical: spacing.xl,
  },
  sectionTitle: {
    color: colors.ink,
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 29,
  },
  metric: {
    color: colors.tealDeep,
    fontSize: 25,
    fontWeight: '800',
  },
  body: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  supporting: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 20,
  },
  itemLine: {
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
  },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  status: {
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
  },
  notice: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
    padding: spacing.md,
  },
  bingoItem: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.control,
    borderWidth: 1,
    gap: spacing.xs,
    minHeight: 68,
    padding: spacing.md,
  },
  bingoMarked: {
    backgroundColor: colors.surfaceSoft,
    borderColor: colors.teal,
  },
  error: {
    color: '#9B352D',
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  quietButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
  },
  link: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
  },
  pressed: { opacity: 0.68 },
})
