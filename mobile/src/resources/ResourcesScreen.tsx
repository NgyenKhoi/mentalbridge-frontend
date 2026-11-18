import {
  skipToken,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { router, useFocusEffect } from 'expo-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { CRISIS_SUPPORT_CONTENT } from '@/crisis-support/crisis-support-content'
import type { EmotionApi } from '@/emotion/emotion-api'
import type { Emotion } from '@/emotion/emotion-contract'
import type { HomeApi } from '@/home/home-api'
import { homePresentation } from '@/home/home-model'
import type { RewardApi } from '@/rewards/reward-api'
import type { SupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import { colors, radii, spacing } from '@/theme/tokens'

import { ResourceBingoCard } from './ResourceBingoCard'
import { useResourceFonts } from './useResourceFonts'
import type { ResourceApi } from './resource-api'
import { resourceArtwork } from './resource-artwork'
import type { ResourceCategory } from './resource-contract'
import {
  localDateInTimeZone,
  progressFor,
  recentLocalDates,
  resourceCategories,
  resourceFormat,
} from './resource-model'

type SelectedCategory = ResourceCategory | 'ALL'
const emotionLabels: Record<Emotion, string> = {
  GREAT: 'Rất tốt',
  GOOD: 'Tốt',
  OKAY: 'Bình thường',
  LOW: 'Không tốt',
  VERY_LOW: 'Rất không tốt',
}
const emotionIcons: Record<Emotion, string> = {
  GREAT: '😄',
  GOOD: '😊',
  OKAY: '😌',
  LOW: '🥱',
  VERY_LOW: '😟',
}
const difficulty = {
  BREATHING: 'Nhẹ nhàng',
  MEDITATION: 'Vừa sức',
  ARTICLE: 'Nhẹ nhàng',
  VIDEO: 'Vừa sức',
  JOURNALING: 'Thử thách',
  COMMUNITY: 'Thử thách',
} as const
const emergency = CRISIS_SUPPORT_CONTENT.contacts[0]

function dateLabel(localDate: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${localDate}T00:00:00.000Z`))
}
function apiMessage(error: unknown, action: string) {
  if (error instanceof ApiError && error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục.'
  if (error instanceof ApiError && error.status === 403)
    return 'Tài khoản này không có quyền xem tài nguyên dành cho người dùng.'
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
      style={[baseStyles.copy, tone === 'error' && baseStyles.error]}
    >
      {children}
    </Text>
  )
}
function callEmergency() {
  void Linking.openURL(`tel:${emergency.phone}`).catch(() =>
    Alert.alert('Chưa thể mở ứng dụng gọi điện', emergency.phone),
  )
}

export function ResourcesScreen({
  api,
  emotionApi,
  homeApi,
  rewardApi,
  planApi,
  now = () => new Date(),
  timezone: timezoneOverride,
  initialDate,
  initialCategory = 'ALL',
  onBack,
  onHome,
  onOpenResource,
}: Readonly<{
  api: ResourceApi
  emotionApi?: EmotionApi
  homeApi?: HomeApi
  rewardApi?: RewardApi
  planApi?: SupportPlanActionApi
  now?: () => Date
  timezone?: string
  initialDate?: string
  initialCategory?: SelectedCategory
  onBack: () => void
  onHome?: () => void
  onOpenResource: (
    resourceId: string,
    localDate: string,
    category: SelectedCategory,
  ) => void
}>) {
  const { session, signOut } = useSession()
  const subject = session?.subject
  const isUser = session?.role === 'USER'
  const client = useQueryClient()
  const fontsLoaded = useResourceFonts()
  const styles = useMemo(() => {
    const sans = fontsLoaded ? { fontFamily: 'ResourceSans' } : {}
    return {
      ...baseStyles,
      white: { ...baseStyles.white, ...sans },
      brandCaption: { ...baseStyles.brandCaption, ...sans },
      sosText: { ...baseStyles.sosText, ...sans },
      homeText: { ...baseStyles.homeText, ...sans },
      eyebrow: { ...baseStyles.eyebrow, ...sans },
      label: { ...baseStyles.label, ...sans },
      small: { ...baseStyles.small, ...sans },
      copy: { ...baseStyles.copy, ...sans },
      link: { ...baseStyles.link, ...sans },
      searchInput: { ...baseStyles.searchInput, ...sans },
      heroBadge: { ...baseStyles.heroBadge, ...sans },
      heroCopy: { ...baseStyles.heroCopy, ...sans },
      startText: { ...baseStyles.startText, ...sans },
      source: { ...baseStyles.source, ...sans },
      status: { ...baseStyles.status, ...sans },
      call: { ...baseStyles.call, ...sans },
      disclaimer: { ...baseStyles.disclaimer, ...sans },
    }
  }, [fontsLoaded])
  const headingFont = fontsLoaded && styles.serif
  const timezone =
    timezoneOverride ??
    Intl.DateTimeFormat().resolvedOptions().timeZone ??
    'Asia/Ho_Chi_Minh'
  const today = localDateInTimeZone(now(), timezone)
  const dates = useMemo(() => recentLocalDates(today), [today])
  const [selectedDate, setSelectedDate] = useState(
    initialDate && dates.includes(initialDate) ? initialDate : today,
  )
  const [category, setCategory] = useState<SelectedCategory>(initialCategory)
  const [search, setSearch] = useState('')
  const [savedOnly, setSavedOnly] = useState(false)
  const [showDates, setShowDates] = useState(false)
  const catalogueRef = useRef<View>(null)
  const columnRef = useRef<View>(null)
  const scrollRef = useRef<ScrollView>(null)
  const searchRef = useRef<TextInput>(null)
  const bookmarkSaving = useRef(false)
  const enabled = Boolean(subject && isUser)

  const catalogueQuery = useInfiniteQuery({
    queryKey: ['resources', subject, category, 'vi-VN'] as const,
    enabled,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listResources({
        locale: 'vi-VN',
        limit: 100,
        ...(category === 'ALL' ? {} : { category }),
        ...(pageParam ? { cursor: pageParam } : {}),
      }),
    getNextPageParam: (page) => page.nextCursor,
  })
  const progressQuery = useQuery({
    queryKey: ['resource-progress', subject, dates[0], today] as const,
    enabled,
    queryFn: () => api.listProgress(dates[0]!, today),
  })
  const emotionQuery = useQuery({
    queryKey: ['emotion-check-in', subject, 'history', 30],
    enabled: enabled && Boolean(emotionApi),
    queryFn: emotionApi ? () => emotionApi.listCheckIns(30) : skipToken,
    retry: false,
  })
  const homeQuery = useQuery({
    queryKey: ['home-next-step', subject, timezone],
    enabled: enabled && Boolean(homeApi),
    queryFn: homeApi ? () => homeApi.getNextStep(timezone) : skipToken,
    retry: false,
  })
  const bookmarkKey = ['resource-bookmarks', subject] as const
  const bookmarks = useQuery({
    queryKey: bookmarkKey,
    enabled: enabled && Boolean(rewardApi),
    queryFn: rewardApi ? () => rewardApi.getBookmarks() : skipToken,
    retry: false,
  })
  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (!rewardApi) throw new Error('Bookmarks unavailable')
      if (saved) await rewardApi.deleteBookmark(id)
      else await rewardApi.saveBookmark(id)
    },
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: bookmarkKey })
      bookmarkSaving.current = false
    },
  })
  useFocusEffect(
    useCallback(() => {
      if (!enabled) return
      void client.invalidateQueries({
        queryKey: ['resource-progress', subject],
      })
      void client.invalidateQueries({
        queryKey: ['resource-bookmarks', subject],
      })
      void client.invalidateQueries({
        queryKey: ['emotion-check-in', subject, 'history'],
      })
      void client.invalidateQueries({
        queryKey: ['home-next-step', subject, timezone],
      })
      void client.invalidateQueries({
        queryKey: ['resources-bingo-plan', subject],
      })
    }, [client, enabled, subject, timezone]),
  )

  if (!enabled)
    return (
      <Screen>
        <Text accessibilityRole="header" style={styles.title}>
          Tài nguyên hỗ trợ
        </Text>
        <StateMessage tone="error">
          {!subject
            ? 'Bạn cần đăng nhập bằng tài khoản cá nhân để xem tài nguyên.'
            : 'Tài khoản này không có quyền xem tài nguyên dành cho người dùng.'}
        </StateMessage>
        <PrimaryButton
          label={!subject ? 'Đăng nhập lại' : 'Quay lại'}
          onPress={() => {
            if (!subject) void signOut()
            else onBack()
          }}
        />
      </Screen>
    )
  const pages = catalogueQuery.data?.pages ?? []
  const resources = pages
    .flatMap((page) => page.data)
    .filter(
      (item, index, all) =>
        all.findIndex((entry) => entry.id === item.id) === index,
    )
  const unavailable = pages.some((page) => page.fallback === 'unavailable')
  const fallbackMessage = pages.find((page) => page.message)?.message
  const progress = progressQuery.data ?? []
  // The web showcase highlights this published practice, then falls back to a practice or the first result.
  const feature =
    resources.find((resource) =>
      resource.title
        .toLocaleLowerCase('vi-VN')
        .includes('ba phút nhận biết hiện tại'),
    ) ??
    resources.find((resource) => resource.resourceKind === 'PRACTICE') ??
    resources[0]
  const savedIds = new Set(bookmarks.data?.map((item) => item.resourceId))
  const keyword = search.trim().toLocaleLowerCase('vi-VN')
  const filtered = resources.filter(
    (resource) =>
      (!savedOnly || savedIds.has(resource.id)) &&
      (!keyword ||
        `${resource.title} ${resource.summary}`
          .toLocaleLowerCase('vi-VN')
          .includes(keyword)),
  )
  const curated = [
    ...filtered
      .filter((resource) => resource.category === 'BREATHING')
      .slice(0, 1),
    ...filtered
      .filter((resource) => resource.category === 'MEDITATION')
      .slice(0, 1),
    ...filtered
      .filter((resource) => resource.category === 'COMMUNITY')
      .slice(0, 1),
    ...filtered
      .filter((resource) => resource.category === 'ARTICLE')
      .slice(0, 1),
    ...filtered.filter((resource) => resource.category === 'VIDEO').slice(0, 1),
    ...filtered,
  ].filter(
    (item, index, all) =>
      all.findIndex((entry) => entry.id === item.id) === index,
  )
  const emotion = emotionQuery.data?.items.find(
    (entry) => entry.localDate === today,
  )
  const plan = homeQuery.data?.plan
  const planPresentation = homeQuery.data
    ? homePresentation(homeQuery.data)
    : null
  const showCatalogue = () => {
    if (!catalogueRef.current || !columnRef.current) return
    catalogueRef.current.measureLayout(columnRef.current, (_x, y) =>
      scrollRef.current?.scrollTo({ y, animated: true }),
    )
  }

  return (
    <Screen
      layout="dashboard"
      backgroundColor="#f5faf7"
      scrollRef={scrollRef}
      contentRef={columnRef}
    >
      <View style={styles.stack}>
        <View style={styles.masthead}>
          <View style={styles.brandIcon}>
            <Text accessible={false} style={styles.white}>
              ✿
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={[styles.brand, headingFont]}>Resources</Text>
            <Text style={styles.brandCaption}>MENTALBRIDGE</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Gọi ${emergency.name}`}
            onPress={callEmergency}
            style={styles.sos}
          >
            <Text style={styles.sosText}>✻ SOS</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tìm tài nguyên"
            onPress={() => searchRef.current?.focus()}
            style={styles.iconButton}
          >
            <Text accessible={false} style={styles.icon}>
              ⌕
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Mở hồ sơ cá nhân"
            onPress={() => router.push('/(user)/profile')}
            style={[styles.iconButton, styles.primaryBackground]}
          >
            <Text accessible={false} style={styles.white}>
              ◎
            </Text>
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={onHome ?? (() => router.replace('/(user)/user'))}
          style={styles.home}
        >
          <Text style={styles.homeText}>⌂ Về trang chủ</Text>
        </Pressable>
        <View style={styles.headingRow}>
          <View style={styles.flex}>
            <Text style={styles.eyebrow}>TÀI NGUYÊN CHĂM SÓC</Text>
            <Text
              accessibilityRole="header"
              style={[styles.title, headingFont]}
            >
              Hộp Quà Nuôi Dưỡng
            </Text>
          </View>
          {rewardApi ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                savedOnly ? 'Xem tất cả tài nguyên' : 'Xem tài nguyên đã lưu'
              }
              accessibilityState={{ selected: savedOnly }}
              onPress={() => {
                setSavedOnly((value) => !value)
                showCatalogue()
              }}
              style={[
                styles.iconButton,
                styles.softBackground,
                savedOnly && styles.primaryBackground,
              ]}
            >
              <Text
                accessible={false}
                style={savedOnly ? styles.white : styles.icon}
              >
                ♡
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View style={styles.searchRow}>
          <Text accessible={false} style={styles.icon}>
            ⌕
          </Text>
          <TextInput
            ref={searchRef}
            accessibilityLabel="Tìm tài nguyên"
            value={search}
            onChangeText={setSearch}
            placeholder="Tìm kỹ thuật, âm thanh, bài tập…"
            placeholderTextColor={colors.inkFaint}
            style={styles.searchInput}
            returnKeyType="search"
            onSubmitEditing={showCatalogue}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ngày xem tiến độ"
            accessibilityState={{ expanded: showDates }}
            onPress={() => setShowDates((value) => !value)}
            style={styles.iconButton}
          >
            <Text accessible={false} style={styles.icon}>
              ☷
            </Text>
          </Pressable>
        </View>
        {showDates ? (
          <View style={styles.panel}>
            <Text style={styles.label}>Ngày bạn muốn xem tiến độ</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {dates.map((date) => (
                <Pressable
                  key={date}
                  accessibilityRole="button"
                  accessibilityLabel={dateLabel(date)}
                  accessibilityState={{ selected: selectedDate === date }}
                  onPress={() => setSelectedDate(date)}
                  style={[
                    styles.chip,
                    selectedDate === date && styles.primaryBackground,
                  ]}
                >
                  <Text
                    style={selectedDate === date ? styles.white : styles.small}
                  >
                    {dateLabel(date)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {feature && !unavailable ? (
          <ImageBackground
            source={resourceArtwork(feature).src}
            imageStyle={styles.heroImage}
            style={styles.hero}
          >
            <View style={styles.heroShade}>
              <Text style={styles.heroBadge}>✧ Nội dung nổi bật</Text>
              <Text
                accessibilityRole="header"
                style={[styles.heroTitle, headingFont]}
              >
                {feature.title}
              </Text>
              <Text numberOfLines={3} style={styles.heroCopy}>
                {feature.summary}
              </Text>
              <View style={styles.heroBottom}>
                <View style={styles.flex}>
                  <Text style={styles.heroCopy}>
                    ◷ {feature.expectedDurationMinutes} phút
                  </Text>
                  <Text style={styles.heroCopy}>
                    {difficulty[feature.category]}
                  </Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Bắt đầu ngay: ${feature.title}`}
                  onPress={() =>
                    onOpenResource(feature.id, selectedDate, category)
                  }
                  style={styles.startButton}
                >
                  <Text style={styles.startText}>▷ Bắt đầu ngay</Text>
                </Pressable>
              </View>
            </View>
          </ImageBackground>
        ) : catalogueQuery.isPending ? (
          <View style={styles.loadingPanel}>
            <ActivityIndicator
              accessibilityLabel="Đang tải tài nguyên"
              color={colors.tealDeep}
            />
          </View>
        ) : null}

        <View style={styles.summaryRow}>
          {emotionApi ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Ghi nhận cảm xúc hôm nay"
              onPress={() => router.push('/(user)/emotion')}
              style={[styles.panel, styles.summaryCard]}
            >
              <Text style={styles.eyebrow}>CẢM XÚC HÔM NAY ✎</Text>
              <Text style={styles.label}>
                {emotion
                  ? `${emotionIcons[emotion.emotion]}  ${emotionLabels[emotion.emotion]}`
                  : emotionQuery.isFetching
                    ? 'Đang tải…'
                    : emotionQuery.isError
                      ? 'Chưa tải được'
                      : 'Chạm để ghi'}
              </Text>
              {emotion ? (
                <Text style={styles.small}>
                  Mức cảm nhận {emotion.intensity}/5
                </Text>
              ) : (
                <Text style={styles.small}>Lắng nghe cảm xúc của bạn</Text>
              )}
              {emotion ? (
                <View style={styles.track}>
                  <View
                    style={[
                      styles.fill,
                      { width: `${emotion.intensity * 20}%` },
                    ]}
                  />
                </View>
              ) : null}
            </Pressable>
          ) : null}
          {homeApi ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Xem kế hoạch cá nhân"
              onPress={() => router.push('/(user)/support-plan')}
              style={[styles.panel, styles.summaryCard]}
            >
              <Text style={styles.eyebrow}>KẾ HOẠCH CÁ NHÂN</Text>
              <Text numberOfLines={2} style={styles.label}>
                {plan
                  ? plan.status === 'PAUSED'
                    ? 'Đang tạm dừng'
                    : `${Math.max(0, plan.today.total - plan.today.completed)} hoạt động đang chờ`
                  : homeQuery.isFetching
                    ? 'Đang tải…'
                    : homeQuery.isError
                      ? 'Chưa tải được'
                      : 'Xem kế hoạch của bạn'}
              </Text>
              {plan?.nextOccurrence ? (
                <Text numberOfLines={2} style={styles.small}>
                  {plan.nextOccurrence.title}
                </Text>
              ) : null}
              <Text numberOfLines={2} style={styles.link}>
                {planPresentation?.primaryLabel ?? 'Mở kế hoạch'} →
              </Text>
            </Pressable>
          ) : null}
        </View>

        <View ref={catalogueRef} style={styles.catalogue}>
          <View style={styles.headingRow}>
            <Text
              accessibilityRole="header"
              style={[styles.sectionTitle, styles.flex, headingFont]}
            >
              {savedOnly ? 'Tài nguyên đã lưu' : 'Thực hành & Bài đọc chọn lọc'}
            </Text>
            {savedOnly ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => setSavedOnly(false)}
                style={styles.textButton}
              >
                <Text style={styles.link}>Tất cả →</Text>
              </Pressable>
            ) : null}
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <View accessibilityRole="radiogroup" style={styles.chips}>
              {resourceCategories.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: category === option.value }}
                  onPress={() => setCategory(option.value)}
                  style={[
                    styles.chip,
                    category === option.value && styles.primaryBackground,
                  ]}
                >
                  <Text
                    style={
                      category === option.value ? styles.white : styles.small
                    }
                  >
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </ScrollView>
          {catalogueQuery.isError ? (
            <View style={styles.panel}>
              <StateMessage tone="error">
                {apiMessage(catalogueQuery.error, 'tải danh sách tài nguyên')}
              </StateMessage>
              <PrimaryButton
                label="Thử tải lại"
                tone="light"
                onPress={() => void catalogueQuery.refetch()}
              />
            </View>
          ) : null}
          {unavailable ? (
            <View style={styles.panel}>
              <StateMessage tone="error">
                {fallbackMessage ??
                  'Tài nguyên hỗ trợ tạm thời chưa khả dụng. Hãy thử lại sau.'}
              </StateMessage>
              <PrimaryButton
                label="Thử tải lại"
                tone="light"
                onPress={() => void catalogueQuery.refetch()}
              />
            </View>
          ) : null}
          {progressQuery.isError ? (
            <StateMessage tone="error">
              Chưa thể tải tiến độ. Bạn vẫn có thể mở các nội dung đã được rà
              soát.
            </StateMessage>
          ) : null}
          {savedOnly && bookmarks.isError ? (
            <View style={styles.panel}>
              <StateMessage tone="error">
                Chưa tải được danh sách tài nguyên đã lưu.
              </StateMessage>
              <PrimaryButton
                label="Tải lại tài nguyên đã lưu"
                tone="light"
                onPress={() => void bookmarks.refetch()}
              />
            </View>
          ) : null}
          {savedOnly && bookmarks.isPending ? (
            <ActivityIndicator
              accessibilityLabel="Đang tải tài nguyên đã lưu"
              color={colors.tealDeep}
            />
          ) : null}
          {!catalogueQuery.isPending &&
          !unavailable &&
          !catalogueQuery.isError &&
          !curated.length &&
          !(savedOnly && (bookmarks.isPending || bookmarks.isError)) ? (
            <StateMessage>
              {savedOnly
                ? 'Chưa có tài nguyên đã lưu trong danh sách này.'
                : keyword
                  ? 'Chưa tìm thấy nội dung phù hợp. Hãy thử từ khóa khác.'
                  : category === 'ALL'
                    ? 'Chưa có tài nguyên đã rà soát phù hợp để hiển thị.'
                    : 'Nhóm này chưa có tài nguyên phù hợp. Hãy chọn nhóm khác.'}
            </StateMessage>
          ) : null}
          {!unavailable && curated.length ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.resourceRail}
            >
              {curated.map((resource) => {
                const artwork = resourceArtwork(resource)
                const entry = progressFor(progress, resource.id, selectedDate)
                const status = progressQuery.isError
                  ? 'Chưa tải được tiến độ'
                  : progressQuery.isPending
                    ? 'Đang tải tiến độ…'
                    : entry?.status === 'COMPLETED'
                      ? 'Đã hoàn thành'
                      : entry?.status === 'IN_PROGRESS'
                        ? 'Đang thực hiện'
                        : 'Chưa bắt đầu'
                const saved = savedIds.has(resource.id)
                return (
                  <View key={resource.id} style={styles.resourceCard}>
                    <View>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Mở hình của ${resource.title}`}
                        onPress={() =>
                          onOpenResource(resource.id, selectedDate, category)
                        }
                      >
                        <Image
                          source={artwork.src}
                          accessibilityLabel={artwork.alt}
                          style={styles.cover}
                        />
                      </Pressable>
                      {resource.sourceOrganization ? (
                        <Text numberOfLines={1} style={styles.source}>
                          {resource.sourceOrganization}
                        </Text>
                      ) : null}
                      {rewardApi ? (
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={`${saved ? 'Bỏ lưu' : 'Lưu'} ${resource.title}`}
                          accessibilityState={{
                            selected: saved,
                            disabled:
                              bookmarks.isPending ||
                              bookmarks.isError ||
                              bookmarkMutation.isPending,
                          }}
                          disabled={
                            bookmarks.isPending ||
                            bookmarks.isError ||
                            bookmarkMutation.isPending
                          }
                          onPress={() => {
                            if (bookmarkSaving.current) return
                            bookmarkSaving.current = true
                            bookmarkMutation.mutate({ id: resource.id, saved })
                          }}
                          style={[
                            styles.saveButton,
                            saved && styles.primaryBackground,
                          ]}
                        >
                          <Text
                            accessible={false}
                            style={saved ? styles.white : styles.icon}
                          >
                            ♡
                          </Text>
                        </Pressable>
                      ) : null}
                    </View>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Mở ${resource.title}`}
                      testID={`resource-card-${resource.id}`}
                      onPress={() =>
                        onOpenResource(resource.id, selectedDate, category)
                      }
                      style={({ pressed }) => [
                        styles.resourceBody,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.small}>
                        {resourceFormat(resource)} ·{' '}
                        {resource.expectedDurationMinutes} phút
                      </Text>
                      <Text
                        numberOfLines={2}
                        style={[styles.cardTitle, headingFont]}
                      >
                        {resource.title}
                      </Text>
                      <Text numberOfLines={3} style={styles.copy}>
                        {resource.summary}
                      </Text>
                      <Text style={styles.status}>{status}</Text>
                      <View style={styles.cardFooter}>
                        <Text style={styles.link}>
                          {resource.interactionType === 'STRUCTURED_READER'
                            ? 'Đọc ngay'
                            : 'Bắt đầu tập'}
                        </Text>
                        <Text accessible={false} style={styles.icon}>
                          →
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                )
              })}
            </ScrollView>
          ) : null}
          {bookmarkMutation.isError ? (
            <StateMessage tone="error">
              Chưa thể lưu lựa chọn. Hãy thử lại khi danh sách đã được làm mới.
            </StateMessage>
          ) : null}
          {catalogueQuery.hasNextPage ? (
            <PrimaryButton
              disabled={catalogueQuery.isFetchingNextPage}
              label={
                catalogueQuery.isFetchingNextPage
                  ? 'Đang tải thêm…'
                  : 'Tải thêm tài nguyên'
              }
              tone="light"
              onPress={() => void catalogueQuery.fetchNextPage()}
            />
          ) : null}
        </View>
        {rewardApi && planApi ? (
          <ResourceBingoCard
            api={rewardApi}
            planApi={planApi}
            subject={subject!}
            today={today}
            timezone={timezone}
            fontsLoaded={fontsLoaded}
          />
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Gọi ${emergency.name}`}
          onPress={callEmergency}
          style={styles.emergency}
        >
          <View style={[styles.iconButton, styles.emergencyIcon]}>
            <Text accessible={false} style={styles.white}>
              ✆
            </Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.label}>Cần hỗ trợ tức thì?</Text>
            <Text style={styles.small}>{emergency.name}</Text>
          </View>
          <Text style={styles.call}>Gọi {emergency.phone}</Text>
        </Pressable>
        <Text style={styles.disclaimer}>
          Tiến độ chỉ ghi nhận hoạt động bạn đã thực hiện. Đây không phải mức độ
          tuân thủ kế hoạch hay đánh giá cải thiện sức khỏe.
        </Text>
      </View>
    </Screen>
  )
}

const baseStyles = StyleSheet.create({
  stack: { gap: spacing.lg, paddingBottom: 18 },
  serif: { fontFamily: 'ResourceSerif' },
  flex: { flex: 1 },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  brandIcon: {
    width: 38,
    height: 38,
    borderRadius: radii.pill,
    backgroundColor: colors.tealDeep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brand: { color: colors.ink, fontSize: 19, fontWeight: '600' },
  brandCaption: { color: colors.inkSoft, fontSize: 9, letterSpacing: 1 },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: colors.tealDeep, fontSize: 22 },
  white: { color: colors.white, fontSize: 13, fontWeight: '600' },
  sos: {
    backgroundColor: '#ffded0',
    paddingHorizontal: spacing.md,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  sosText: { color: '#733116', fontSize: 12, fontWeight: '700' },
  primaryBackground: { backgroundColor: colors.tealDeep },
  softBackground: { backgroundColor: '#e3eee7' },
  home: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: '#e9f3ed',
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
  },
  homeText: { color: colors.tealDeep, fontSize: 13, fontWeight: '700' },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  eyebrow: { color: colors.inkSoft, fontSize: 10, letterSpacing: 0.7 },
  title: { color: colors.ink, fontSize: 25, lineHeight: 34 },
  label: { color: colors.ink, fontSize: 14, lineHeight: 21, fontWeight: '700' },
  sectionTitle: { color: colors.ink, fontSize: 19, lineHeight: 27 },
  small: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  copy: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  error: { color: '#9b352d' },
  link: { color: colors.tealDeep, fontSize: 12, fontWeight: '600' },
  searchRow: {
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
    paddingLeft: spacing.md,
    paddingRight: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#edf1ee',
  },
  searchInput: { flex: 1, minHeight: 48, color: colors.ink, fontSize: 13 },
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: '#edf1ee',
  },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.md,
    minHeight: 40,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e8efea',
  },
  hero: {
    minHeight: 265,
    borderRadius: 26,
    overflow: 'hidden',
    backgroundColor: colors.tealDeep,
  },
  heroImage: { borderRadius: 26 },
  heroShade: {
    flex: 1,
    padding: spacing.lg,
    paddingTop: 44,
    justifyContent: 'flex-end',
    gap: spacing.md,
    backgroundColor: 'rgba(12, 59, 45, 0.73)',
  },
  heroBadge: {
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    color: colors.tealDeep,
    backgroundColor: '#e6f5ed',
    fontSize: 11,
  },
  heroTitle: { color: colors.white, fontSize: 21, lineHeight: 29 },
  heroCopy: { color: '#e0efe7', fontSize: 13, lineHeight: 20 },
  heroBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  startButton: {
    minHeight: 54,
    minWidth: 140,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.pill,
    backgroundColor: '#f7fff9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  startText: { color: colors.tealDeep, fontSize: 14, fontWeight: '700' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  summaryCard: { flex: 1, minWidth: 140 },
  track: {
    height: 4,
    backgroundColor: '#e9efeb',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.tealDeep },
  catalogue: { gap: spacing.md },
  resourceRail: { gap: spacing.md, paddingBottom: spacing.xs },
  resourceCard: {
    width: 236,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: '#e6eee8',
  },
  cover: { width: '100%', height: 150, resizeMode: 'cover' },
  source: {
    position: 'absolute',
    top: 10,
    left: 10,
    maxWidth: 156,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#f1f8f1',
    color: colors.tealDeep,
    fontSize: 10,
  },
  saveButton: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: colors.surface,
  },
  resourceBody: { padding: spacing.md, gap: spacing.sm, flex: 1 },
  cardTitle: { color: colors.ink, fontSize: 17, lineHeight: 24 },
  status: { color: colors.tealDeep, fontSize: 12, fontWeight: '600' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 'auto',
    paddingTop: spacing.sm,
  },
  textButton: { minHeight: 44, justifyContent: 'center' },
  loadingPanel: {
    minHeight: 160,
    backgroundColor: '#eaf2ed',
    borderRadius: 26,
    justifyContent: 'center',
  },
  emergency: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: '#ffded0',
    borderRadius: 22,
    padding: spacing.md,
  },
  emergencyIcon: { backgroundColor: '#733116' },
  call: {
    color: colors.white,
    backgroundColor: '#733116',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    overflow: 'hidden',
    fontSize: 12,
    fontWeight: '700',
  },
  disclaimer: { color: colors.inkSoft, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
})
