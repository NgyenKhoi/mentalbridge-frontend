import { useDashboardFonts } from '@/theme/useDashboardFonts'
import { EmotionCheckInScreen } from '@/emotion/EmotionCheckInScreen'
import type { Emotion } from '@/emotion/emotion-contract'
import type { EmotionApi } from '@/emotion/emotion-api'
import type { NotificationApi } from '@/notifications/notification-api'
import { useForegroundRefresh } from '@/api/use-foreground-refresh'
import type { ResourceApi } from '@/resources/resource-api'
import type { RewardApi } from '@/rewards/reward-api'
import { resourceArtwork } from '@/resources/resource-artwork'
import {
  localDateInTimeZone,
  resourceFormat,
  shiftLocalDate,
} from '@/resources/resource-model'
import {
  skipToken,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { router, useFocusEffect, type Href } from 'expo-router'
import { useCallback, useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextStyle,
  useWindowDimensions,
  View,
} from 'react-native'

import type { AppointmentApi } from '@/appointments/appointment-api'
import { matchesFilter } from '@/appointments/appointment-model'
import type { DiscoveryApi } from '@/discovery/discovery-api'
import { supportAreaLabels } from '@/discovery/discovery-model'
import { loadCareProfile, type CareProfileApi } from '@/profile/profile-api'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import { HomeShortcuts } from '@/home/HomeShortcuts'
import { MamHomePet } from '@/mam/MamHomePet'
import type { HomeApi } from '@/home/home-api'
import { homePresentation } from '@/home/home-model'
import {
  colors as baseColors,
  radii,
  spacing,
  typography,
} from '@/theme/tokens'

const colors = {
  ...baseColors,
  surfaceSoft: '#F2F4F2',
  ink: '#1A1C1E',
  inkSoft: '#5B6470',
  inkFaint: '#596573',
  teal: '#1F5C3F',
  tealDeep: '#174A32',
  tealPale: '#D9F3E4',
  line: 'rgba(26, 28, 30, 0.07)',
}

const appointmentTimeZone = 'Asia/Ho_Chi_Minh'
const appointmentClock = new Intl.DateTimeFormat('vi-VN', {
  timeZone: appointmentTimeZone,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
const appointmentCalendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: appointmentTimeZone,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

function appointmentDay(start: Date, now: Date) {
  const calendarDay = appointmentCalendar.format(start)
  if (calendarDay === appointmentCalendar.format(now)) return 'Hôm nay'
  if (calendarDay === appointmentCalendar.format(now.getTime() + 86_400_000))
    return 'Mai'
  const [day, month, year] = calendarDay.split('/')
  return day + ' Th' + month + ', ' + year
}

function deviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || undefined
  } catch {
    return undefined
  }
}

const moods = [
  { value: 'GREAT', label: 'Rất tốt', emoji: '😄', background: '#FDF3DC' },
  { value: 'GOOD', label: 'Tốt', emoji: '😊', background: '#DDF3F0' },
  { value: 'OKAY', label: 'Bình thường', emoji: '😌', background: '#E3EDF8' },
  { value: 'LOW', label: 'Không tốt', emoji: '🥱', background: '#F5DED2' },
  { value: 'VERY_LOW', label: 'Rất tệ', emoji: '😟', background: '#E5E3F1' },
] as const

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function SecondaryAction({
  label,
  href,
  light = false,
  styles = systemFontStyles,
}: Readonly<{
  label: string
  href: Href
  light?: boolean
  styles?: typeof systemFontStyles | typeof webFontStyles
}>) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      onPress={() => router.push(href)}
      style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
    >
      <Text style={[styles.linkLabel, light && styles.lightText]}>{label}</Text>
      <Text
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.arrow, light && styles.lightText]}
      >
        →
      </Text>
    </Pressable>
  )
}

export function UserHomeScreen({
  api,
  profileApi,
  appointmentApi,
  discoveryApi,
  emotionApi,
  notificationApi,
  resourceApi,
  rewardApi,
}: Readonly<{
  api: HomeApi
  profileApi?: Pick<CareProfileApi, 'getProfile'>
  appointmentApi?:
    | (Pick<AppointmentApi, 'list'> & Partial<Pick<AppointmentApi, 'credits'>>)
    | undefined
  discoveryApi?: Pick<DiscoveryApi, 'detail'>
  emotionApi?: EmotionApi
  notificationApi?: Pick<NotificationApi, 'list'>
  resourceApi?: Pick<ResourceApi, 'listResources'>
  rewardApi?: Pick<
    RewardApi,
    'getBookmarks' | 'saveBookmark' | 'deleteBookmark'
  >
}>) {
  const fontsLoaded = useDashboardFonts()
  const styles = fontsLoaded ? webFontStyles : systemFontStyles
  const { session } = useSession()
  const { width } = useWindowDimensions()
  const queryClient = useQueryClient()
  const moodSize = Math.max(34, Math.min(48, Math.floor((width - 86) / 5)))
  const resourceWidth = Math.round(Math.min(width - 32, 560) * 0.66)
  const [searchVisible, setSearchVisible] = useState(false)
  const [search, setSearch] = useState('')
  const [inlineSelection, setInlineSelection] = useState<{
    mood: Emotion | null
  } | null>(null)
  const [showMore, setShowMore] = useState(false)
  const firstFocus = useRef(true)
  const timeZone = deviceTimeZone()
  const query = useQuery({
    queryKey: ['home-next-step', session?.subject, timeZone],
    queryFn: () => api.getNextStep(timeZone),
    enabled: Boolean(session?.subject),
    refetchOnMount: 'always',
  })
  const refetchHome = query.refetch

  const presentation = query.data ? homePresentation(query.data) : null
  const today = new Date()
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: appointmentTimeZone,
      hour: '2-digit',
      hourCycle: 'h23',
    }).format(today),
  )
  const localDate = localDateInTimeZone(today, appointmentTimeZone)
  const greeting =
    hour < 12
      ? 'Chào buổi sáng'
      : hour < 14
        ? 'Chào buổi trưa'
        : hour < 18
          ? 'Chào buổi chiều'
          : 'Chào buổi tối'
  const plan = query.data?.plan
  const safety = query.data?.journey.nextAction === 'REVIEW_SAFETY_SUPPORT'

  const profile = useQuery({
    queryKey: ['care-profile', session?.subject],
    queryFn: profileApi ? () => loadCareProfile(profileApi) : skipToken,
    enabled: Boolean(session?.subject),
  })
  const appointments = useQuery({
    queryKey: ['appointments', session?.subject],
    queryFn: appointmentApi ? () => appointmentApi.list() : skipToken,
    enabled: Boolean(session?.subject) && !safety,
  })
  const appointmentList = appointments.data
  const appointment = appointmentList?.items
    .filter(
      (item) =>
        matchesFilter(item, 'upcoming') &&
        item.status === 'CONFIRMED' &&
        item.replacedByAppointmentId === null &&
        Date.parse(item.scheduledStartAt) >=
          Math.max(Date.parse(appointmentList.generatedAt), today.getTime()),
    )
    .sort(
      (left, right) =>
        Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt),
    )[0]
  const specialist = useQuery({
    queryKey: [
      'home-appointment-specialist',
      session?.subject,
      appointment?.specialistAccountId,
    ],
    queryFn:
      discoveryApi && appointment
        ? () => discoveryApi.detail(appointment.specialistAccountId, {})
        : skipToken,
    enabled: Boolean(session?.subject) && !safety,
    retry: false,
  })
  const supportAreas = specialist.data?.supportAreas
    .map((area) => supportAreaLabels[area])
    .join(', ')
  const displayName = profile.data?.displayName
  const subject = session?.subject
  const dayIndex = (new Date(localDate + 'T00:00:00Z').getUTCDay() + 6) % 7
  const week = weekdays.map((label, index) => ({
    label,
    date: shiftLocalDate(localDate, index - dayIndex),
  }))
  const checkIns = useQuery({
    queryKey: ['emotion-check-in', subject, 'history', 30],
    queryFn: emotionApi ? () => emotionApi.listCheckIns(30) : skipToken,
    enabled: Boolean(subject) && !safety,
  })
  const byDate = new Map(
    checkIns.data?.items.map((item) => [item.localDate, item.emotion]),
  )
  const checkedDays = week.filter(
    ({ date }) => date <= localDate && byDate.has(date),
  ).length
  const notifications = useQuery({
    queryKey: ['notifications', subject, session?.role, 'home'],
    queryFn: notificationApi ? () => notificationApi.list() : skipToken,
    enabled: Boolean(subject),
  })
  useForegroundRefresh(
    () => {
      void notifications.refetch({ cancelRefetch: false })
    },
    Boolean(subject && notificationApi),
  )
  const resources = useQuery({
    queryKey: ['home-resources', subject, 'vi-VN'],
    queryFn: resourceApi
      ? () => resourceApi.listResources({ locale: 'vi-VN', limit: 8 })
      : skipToken,
    enabled: Boolean(subject) && !safety,
  })
  const bookmarkKey = ['resource-bookmarks', subject] as const
  const bookmarks = useQuery({
    queryKey: bookmarkKey,
    queryFn: rewardApi ? () => rewardApi.getBookmarks() : skipToken,
    enabled: Boolean(subject) && !safety,
  })
  const bookmarkMutation = useMutation({
    mutationFn: async ({ id, saved }: { id: string; saved: boolean }) => {
      if (!rewardApi) return
      if (saved) await rewardApi.deleteBookmark(id)
      else await rewardApi.saveBookmark(id)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: bookmarkKey }),
  })
  const credits = useQuery({
    queryKey: ['appointment-credits', subject],
    queryFn: appointmentApi?.credits ?? skipToken,
    enabled: Boolean(subject) && !safety,
  })
  const paidPlan =
    credits.data?.packageCode === 'PLUS' ||
    credits.data?.packageCode === 'PREMIUM'
  useFocusEffect(
    useCallback(() => {
      void queryClient.invalidateQueries({
        queryKey: ['notifications', subject, session?.role, 'home'],
      })
      void queryClient.invalidateQueries({
        queryKey: ['emotion-check-in', subject, 'history'],
      })
      if (firstFocus.current) {
        firstFocus.current = false
        return
      }
      void refetchHome()
    }, [queryClient, refetchHome, session?.role, subject]),
  )

  const searchTerm = search.trim().toLocaleLowerCase('vi')
  const featured = Boolean(presentation) && !safety
  const progress = plan?.today && plan.today.total > 0 ? plan.today : null

  const weekSummary = (
    <View style={styles.weekInset}>
      <View style={styles.sectionHeader}>
        <Text style={styles.weekTitle}>▣ Tuần này của bạn</Text>
        {checkIns.data && (
          <Text style={styles.cycle}>Nhịp điệu: {checkedDays}/7 ngày</Text>
        )}
      </View>
      {checkIns.isError && (
        <Pressable
          accessibilityRole="button"
          onPress={() => void checkIns.refetch()}
        >
          <Text style={styles.appointmentLinkLabel}>Tải lại lịch check-in</Text>
        </Pressable>
      )}
      <View style={styles.weekRow}>
        {week.map(({ label, date }) => {
          const active = date === localDate
          const checked = date <= localDate && byDate.has(date)
          return (
            <View
              key={date}
              accessible
              accessibilityLabel={
                label +
                ' ngày ' +
                date.slice(-2) +
                (active ? ', hôm nay' : '') +
                (checked ? ', đã ghi nhận' : '')
              }
              style={[styles.day, active && styles.dayActive]}
            >
              <Text style={[styles.dayLabel, active && styles.lightText]}>
                {label}
              </Text>
              <Text
                style={[
                  styles.dayDot,
                  checked && styles.dayChecked,
                  active && styles.dayToday,
                ]}
              >
                {active ? '●' : checked ? '✓' : '·'}
              </Text>
              <Text style={[styles.dayNumber, active && styles.lightText]}>
                {Number(date.slice(-2))}
              </Text>
            </View>
          )
        })}
      </View>
    </View>
  )

  const nextStepCard = (
    <View
      style={[styles.nextStep, featured && styles.featured]}
      testID="home-next-step"
    >
      {query.isPending && session ? (
        <View style={styles.loadingRow}>
          <ActivityIndicator
            accessibilityLabel="Đang tải bước tiếp theo"
            color={colors.tealDeep}
          />
          <Text style={styles.body}>Đang xem bước phù hợp tiếp theo…</Text>
        </View>
      ) : null}

      {!session ? (
        <>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Chưa thể xác nhận phiên của bạn
          </Text>
          <Text style={styles.body}>
            Hãy đăng nhập lại để xem bước tiếp theo. Không có hoạt động nào được
            thay đổi.
          </Text>
        </>
      ) : null}

      {query.isError && !query.data ? (
        <>
          <Text style={styles.cardEyebrow}>CHƯA TẢI ĐƯỢC</Text>
          <Text accessibilityRole="header" style={styles.cardTitle}>
            Bước tiếp theo tạm thời chưa khả dụng
          </Text>
          <Text accessibilityLiveRegion="polite" style={styles.body}>
            Kế hoạch và các ghi nhận trước đó vẫn được giữ nguyên. Bạn có thể
            thử tải lại hoặc mở tài nguyên miễn phí.
          </Text>
          <View style={styles.buttonGroup}>
            <PrimaryButton
              labelStyle={styles.ctaLabel}
              label="Tải lại bước tiếp theo"
              onPress={() => void refetchHome()}
            />
            <SecondaryAction
              styles={styles}
              label="Khám phá tài nguyên"
              href="/(user)/resources"
            />
          </View>
        </>
      ) : null}

      {presentation ? (
        <>
          {query.isRefetchError ? (
            <View style={styles.staleNotice}>
              <Text accessibilityLiveRegion="polite" style={styles.supporting}>
                Chưa cập nhật được thay đổi mới nhất. Bước đang hiển thị là lần
                tải gần nhất; bạn có thể thử lại.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void refetchHome()}
                style={({ pressed }) => [
                  styles.retryButton,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={styles.linkLabel}>Thử cập nhật</Text>
              </Pressable>
            </View>
          ) : null}
          <Text
            style={[styles.cardEyebrow, featured && styles.featuredEyebrow]}
          >
            {presentation.eyebrow}
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.cardTitle, featured && styles.featuredTitle]}
          >
            {presentation.title}
          </Text>
          <Text style={[styles.body, featured && styles.featuredBody]}>
            {presentation.description}
          </Text>
          {presentation.progress ? (
            <Text
              style={[styles.progress, featured && styles.featuredProgress]}
            >
              {presentation.progress}
            </Text>
          ) : null}
          {featured && progress && (
            <View
              accessibilityRole="progressbar"
              accessibilityLabel="Tiến độ hôm nay"
              accessibilityValue={{
                min: 0,
                max: progress.total,
                now: progress.completed,
              }}
              style={styles.progressTrack}
            >
              <View
                style={[
                  styles.progressFill,
                  {
                    width: `${(progress.completed / progress.total) * 100}%`,
                  },
                ]}
              />
            </View>
          )}
          <PrimaryButton
            tone={featured ? 'light' : 'default'}
            labelStyle={styles.ctaLabel}
            label={presentation.primaryLabel}
            testID="home-primary-action"
            onPress={() => router.push(presentation.primaryHref)}
          />
          {query.data?.journey.supportGuideId &&
          presentation.primaryHref !== '/(user)/assessment' ? (
            <SecondaryAction
              styles={styles}
              light={featured}
              label="Xem lại gợi ý sau sàng lọc"
              href="/(user)/assessment"
            />
          ) : null}
        </>
      ) : null}
    </View>
  )

  const dashboard = (
    <Screen layout="dashboard" backgroundColor="#F8FAF8">
      <View style={styles.masthead}>
        <View style={styles.avatar}>
          <Text accessible={false} style={styles.avatarText}>
            {displayName?.trim().charAt(0).toUpperCase() || 'M'}
          </Text>
          {session && <View style={styles.avatarDot} />}
        </View>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Hồ sơ cá nhân"
          onPress={() => router.push('/(user)/profile')}
          style={styles.heroCopy}
        >
          <Text style={[styles.sectionTitle, { fontSize: 16 }]}>
            MentalBridge <Text style={styles.cycle}>Health Tech</Text>
          </Text>
          <Text numberOfLines={1} style={styles.appointmentMeta}>
            {displayName ? displayName + ' • ' : ''}Hồ sơ cá nhân
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tìm tiện ích"
          onPress={() => {
            setSearchVisible(!searchVisible)
            if (searchVisible) setSearch('')
          }}
          style={styles.inbox}
        >
          <Text style={styles.searchMark}>⌕</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở thông báo"
          onPress={() => router.push('/(user)/notifications')}
          style={styles.inbox}
        >
          {notifications.data && notifications.data.unreadCount > 0 ? (
            <View style={styles.unreadDot} />
          ) : null}
          <View accessible={false} style={styles.bell}>
            <View style={styles.bellDome} />
            <View style={styles.bellRim} />
            <View style={styles.bellClapper} />
          </View>
        </Pressable>
      </View>
      {!safety && (
        <>
          {searchVisible && (
            <View style={styles.searchBox}>
              <Text accessible={false} style={styles.searchMark}>
                ⌕
              </Text>
              <TextInput
                autoFocus
                accessibilityLabel="Tìm lối tắt"
                placeholder="Tìm lối tắt chăm sóc…"
                placeholderTextColor={colors.inkFaint}
                returnKeyType="search"
                style={styles.searchInput}
                value={search}
                onChangeText={setSearch}
              />
              {search.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Xóa tìm kiếm"
                  onPress={() => setSearch('')}
                  style={styles.clearSearch}
                >
                  <Text style={styles.searchMark}>×</Text>
                </Pressable>
              )}
            </View>
          )}
          <View style={[styles.greetingCard, styles.greetingHero]}>
            <View accessible={false} style={styles.leafMedallion}>
              <Text style={styles.leafMark}>❧</Text>
            </View>
            <Text style={styles.featuredEyebrow}>
              ●{' '}
              {hour < 12
                ? 'Buổi sáng'
                : hour < 14
                  ? 'Buổi trưa'
                  : hour < 18
                    ? 'Buổi chiều'
                    : 'Buổi tối an yên'}
            </Text>
            <Text accessibilityRole="header" style={styles.featuredTitle}>
              {greeting}
              {displayName ? ', ' + displayName.trim().split(/\s+/).at(-1) : ''}
            </Text>
            <Text style={styles.heroNote}>“Một bước nhỏ hôm nay là đủ.”</Text>
          </View>
          <View style={styles.weekCard}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.weekTitle}>
                ☺ Bạn đang cảm thấy thế nào?
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: Boolean(inlineSelection) }}
                onPress={() =>
                  setInlineSelection(inlineSelection ? null : { mood: null })
                }
              >
                <Text style={styles.appointmentLinkLabel}>
                  {inlineSelection ? 'Thu gọn' : 'Chạm để ghi'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.weekRow}>
              {moods.map(({ value, label, emoji, background }) => {
                const selected =
                  (inlineSelection?.mood ?? byDate.get(localDate)) === value
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={label}
                    accessibilityState={{ selected }}
                    style={styles.moodItem}
                    onPress={() => setInlineSelection({ mood: value })}
                  >
                    <View
                      style={[
                        styles.moodCircle,
                        { width: moodSize, height: moodSize },
                        selected && styles.moodCircleSelected,
                        {
                          backgroundColor: selected
                            ? colors.tealDeep
                            : background,
                        },
                      ]}
                    >
                      <Text style={styles.moodEmoji}>{emoji}</Text>
                    </View>
                    <Text style={styles.quickLabel}>{label}</Text>
                  </Pressable>
                )
              })}
            </View>
            {emotionApi && inlineSelection && (
              <EmotionCheckInScreen
                api={emotionApi}
                timezone={appointmentTimeZone}
                inlineSelection={inlineSelection}
                useDashboardFont={fontsLoaded}
                beforeProgress={weekSummary}
                savedAppearance={{
                  surface: colors.surfaceSoft,
                  title: styles.moreTitle,
                  supporting: styles.appointmentMeta,
                  action: styles.appointmentLinkLabel,
                }}
              />
            )}
            {(!emotionApi || !inlineSelection) && weekSummary}
          </View>
        </>
      )}

      {safety && nextStepCard}
      {!safety && (
        <View style={styles.quickSection}>
          <View style={styles.connectionCard}>
            <View style={styles.connectionHeader}>
              <View style={styles.connectionIcon} accessible={false}>
                <View style={styles.chatBubble}>
                  <Text accessible={false} style={styles.robotFace}>
                    ••
                  </Text>
                </View>
              </View>
              <View style={styles.heroCopy}>
                <View style={styles.companionTitleRow}>
                  <Text
                    accessibilityRole="header"
                    style={styles.connectionTitle}
                  >
                    {paidPlan ? 'AI Companion Đặc Quyền' : 'AI Companion'}
                  </Text>
                  {paidPlan && (
                    <Text style={styles.companionBadge}>
                      {credits.data?.packageCode}
                    </Text>
                  )}
                </View>
                <Text style={styles.connectionSubtitle}>
                  Trợ lý thấu cảm &amp; xoa dịu tâm lý
                </Text>
              </View>
            </View>
            <View style={styles.connectionInset}>
              <Text style={styles.companionStarter}>
                “Mình cần ai đó lắng nghe”
              </Text>
            </View>
            <View style={styles.companionActions}>
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push('/(user)/ai-companion')}
                style={({ pressed }) => [
                  styles.companionCta,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.ctaLabel, styles.companionCtaText]}>
                  ▢ Trò chuyện ngay
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Mở AI Companion"
                onPress={() => router.push('/(user)/ai-companion')}
                style={({ pressed }) => [
                  styles.companionVoice,
                  pressed && styles.pressed,
                ]}
              >
                <Text accessible={false} style={styles.voiceMark}>
                  ≡
                </Text>
              </Pressable>
            </View>
          </View>
          <HomeShortcuts
            key={`home-shortcuts-${subject}`}
            subject={subject}
            searchTerm={searchTerm}
          />
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              ▤ Thực hành &amp; Bài đọc chọn lọc
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('/(user)/resources')}
            >
              <Text style={styles.appointmentLinkLabel}>Xem tất cả</Text>
            </Pressable>
          </View>
          {resources.data?.data.length ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={resources.data.data}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.carousel}
              extraData={bookmarks.data}
              renderItem={({ item }) => {
                const artwork = resourceArtwork(item)
                const saved =
                  bookmarks.data?.some(
                    (bookmark) => bookmark.resourceId === item.id,
                  ) ?? false
                return (
                  <View style={[styles.resourceTile, { width: resourceWidth }]}>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={item.title}
                      onPress={() =>
                        router.push({
                          pathname: '/(user)/resources/[resourceId]',
                          params: { resourceId: item.id },
                        })
                      }
                    >
                      <Image
                        source={artwork.src}
                        style={[
                          styles.resourceCover,
                          { height: Math.round(resourceWidth * 0.48) },
                        ]}
                        resizeMode="cover"
                        accessibilityLabel={artwork.alt}
                      />
                      <Text style={[styles.cycle, styles.resourceSource]}>
                        Từ thư viện
                      </Text>
                      <View style={styles.resourceCopy}>
                        <Text style={styles.appointmentMeta}>
                          {resourceFormat(item)} ·{' '}
                          {item.expectedDurationMinutes} phút
                        </Text>
                        <Text numberOfLines={2} style={styles.moreTitle}>
                          {item.title}
                        </Text>
                        <Text style={styles.appointmentLinkLabel}>
                          Làm ngay →
                        </Text>
                      </View>
                    </Pressable>
                    {bookmarks.isSuccess && (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={
                          saved ? 'Bỏ lưu ' + item.title : 'Lưu ' + item.title
                        }
                        accessibilityState={{
                          selected: saved,
                          disabled: bookmarkMutation.isPending,
                        }}
                        disabled={bookmarkMutation.isPending}
                        style={styles.resourceBookmark}
                        onPress={() =>
                          bookmarkMutation.mutate({ id: item.id, saved })
                        }
                      >
                        <Text style={styles.appointmentLinkLabel}>
                          {saved ? '★' : '☆'}
                        </Text>
                      </Pressable>
                    )}
                  </View>
                )
              }}
            />
          ) : resources.isError || resources.data?.fallback ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => void resources.refetch()}
            >
              <Text style={styles.appointmentLinkLabel}>Tải lại thư viện</Text>
            </Pressable>
          ) : resources.isFetching ? (
            <View
              accessible
              accessibilityLabel="Đang tải tài nguyên"
              style={styles.resourceSkeleton}
            />
          ) : (
            <Text style={styles.appointmentMeta}>Chưa có tài nguyên.</Text>
          )}
          {bookmarkMutation.isError && (
            <Text
              accessibilityLiveRegion="polite"
              style={styles.appointmentMeta}
            >
              Chưa cập nhật được mục đã lưu. Vui lòng thử lại.
            </Text>
          )}
        </View>
      )}
      <Text style={[styles.appointmentMeta, { marginTop: spacing.lg }]}>
        MentalBridge Health • Modern Bento Hub
      </Text>
      {!safety && nextStepCard}
      {!safety && (appointment || showMore) && (
        <View style={styles.quickSection}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>
            Dịch vụ chăm sóc
          </Text>
          <View style={styles.serviceCard}>
            {appointment ? (
              <>
                <View style={styles.appointmentHeader}>
                  <View
                    accessible
                    accessibilityLabel="Lịch tư vấn"
                    style={styles.appointmentIcon}
                  >
                    <Text style={styles.appointmentGlyph}>▣</Text>
                  </View>
                  <View style={styles.heroCopy}>
                    <Text style={styles.appointmentLabel}>
                      PHIÊN TƯ VẤN SẮP TỚI
                    </Text>
                    <Text numberOfLines={1} style={styles.moreTitle}>
                      {appointment.specialistDisplayName}
                    </Text>
                    {supportAreas ? (
                      <Text numberOfLines={1} style={styles.appointmentMeta}>
                        {supportAreas}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.appointmentTime}>
                    {appointmentClock.format(
                      new Date(appointment.scheduledStartAt),
                    )}{' '}
                    {appointmentDay(
                      new Date(appointment.scheduledStartAt),
                      today,
                    )}
                  </Text>
                </View>
                <View style={styles.appointmentLocation}>
                  <Text
                    accessible={false}
                    importantForAccessibility="no"
                    style={styles.appointmentLinkLabel}
                  >
                    ⌖
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[styles.appointmentMeta, styles.heroCopy]}
                  >
                    {appointment.modality === 'IN_APP_VIDEO'
                      ? 'Tư vấn video trong ứng dụng'
                      : 'Tư vấn qua tin nhắn trong ứng dụng'}
                  </Text>
                  <Pressable
                    accessibilityRole="link"
                    accessibilityLabel="Chi tiết lịch hẹn"
                    style={styles.appointmentLink}
                    onPress={() =>
                      router.push({
                        pathname: '/(user)/appointments',
                        params: { appointmentId: appointment.id },
                      })
                    }
                  >
                    <Text style={styles.appointmentLinkLabel}>Chi tiết</Text>
                  </Pressable>
                </View>
                <View style={styles.appointmentActions}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Kiểm tra phòng hẹn"
                    style={({ pressed }) => [
                      styles.roomButton,
                      pressed && styles.pressed,
                    ]}
                    onPress={() =>
                      router.push({
                        pathname:
                          appointment.modality === 'IN_APP_CHAT'
                            ? '/(user)/messages'
                            : '/(user)/appointments',
                        params: { appointmentId: appointment.id },
                      })
                    }
                  >
                    <Text style={styles.roomLabel}>▣ Kiểm tra phòng hẹn</Text>
                  </Pressable>
                  <View
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel="EMR chưa khả dụng"
                    accessibilityState={{ disabled: true }}
                    style={styles.emrButton}
                  >
                    <Text style={styles.appointmentMeta}>▤ EMR</Text>
                  </View>
                </View>
              </>
            ) : appointments.isPending && appointmentApi && session ? (
              <View
                accessible
                accessibilityLabel="Đang tải lịch hẹn"
                style={styles.appointmentSkeleton}
              >
                <View style={styles.skeletonLine} />
                <View style={[styles.skeletonLine, styles.skeletonShort]} />
              </View>
            ) : (
              <>
                <Text style={styles.moreTitle}>
                  {appointments.isError
                    ? 'Chưa tải được lịch hẹn'
                    : 'Chưa có lịch tư vấn sắp tới'}
                </Text>
                <PrimaryButton
                  label={
                    appointments.isError ? 'Tải lại lịch hẹn' : 'Xem lịch hẹn'
                  }
                  labelStyle={styles.ctaLabel}
                  tone="darkPill"
                  onPress={() =>
                    appointments.isError
                      ? void appointments.refetch()
                      : router.push('/(user)/appointments')
                  }
                />
              </>
            )}
          </View>
        </View>
      )}
      <View style={styles.moreSection}>
        <Pressable
          accessibilityLabel="Các khu vực khác"
          accessibilityRole="button"
          accessibilityState={{ expanded: showMore }}
          onPress={() => setShowMore((current) => !current)}
          style={({ pressed }) => [
            styles.moreToggle,
            pressed && styles.pressed,
          ]}
        >
          <View>
            <Text style={styles.moreTitle}>Các khu vực khác</Text>
            <Text style={styles.supporting}>
              Tin nhắn, lịch hẹn và công cụ tự chăm sóc
            </Text>
          </View>
          <Text style={styles.toggleLabel}>
            {showMore ? 'Thu gọn' : 'Xem thêm'}
          </Text>
        </Pressable>

        {showMore ? (
          <View style={styles.links}>
            <SecondaryAction
              styles={styles}
              label="Thông báo của tôi"
              href="/(user)/notifications"
            />
            <SecondaryAction
              styles={styles}
              label="Nhắc nhở của tôi"
              href="/(user)/reminders"
            />
            <SecondaryAction
              styles={styles}
              label="Lịch hẹn của tôi"
              href="/(user)/appointments"
            />
            {safety && (
              <SecondaryAction
                styles={styles}
                label="Tìm chuyên gia"
                href="/(user)/specialists"
              />
            )}
            <SecondaryAction
              styles={styles}
              label="Cộng đồng"
              href="/(user)/community"
            />
            {safety && (
              <SecondaryAction
                styles={styles}
                label="Nhật ký"
                href="/(user)/journal"
              />
            )}
            {safety && (
              <SecondaryAction
                styles={styles}
                label="Ghi nhận cảm xúc"
                href="/(user)/emotion"
              />
            )}
            <SecondaryAction
              styles={styles}
              label="Bộ sưu tập và Bingo"
              href="/(user)/rewards"
            />
            <SecondaryAction
              styles={styles}
              label="Hồ sơ cá nhân"
              href="/(user)/profile"
            />
          </View>
        ) : null}
      </View>
    </Screen>
  )

  return (
    <View style={dashboardStyles.homeContainer}>
      {dashboard}
      {!safety && <MamHomePet key={`mam-pet-${subject}`} />}
    </View>
  )
}

const dashboardStyles = {
  homeContainer: { flex: 1 },
  serviceLinks: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  utilityCard: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderColor: colors.line,
    borderWidth: 1,
    padding: spacing.xs,
  },
  connectionCard: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.tealDeep,
    borderRadius: radii.shell,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  connectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  connectionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#245749',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatBubble: {
    width: 19,
    height: 14,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: '#B7EED8',
  },
  robotFace: {
    color: '#B7EED8',
    textAlign: 'center',
    fontSize: 10,
    lineHeight: 11,
  },
  companionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  companionBadge: {
    color: '#B7EED8',
    backgroundColor: '#195744',
    fontSize: 10,
    fontWeight: '700',
    borderRadius: radii.pill,
    paddingHorizontal: 7,
    overflow: 'hidden',
  },
  companionStarter: {
    color: colors.inkSoft,
    fontSize: 13,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  companionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  companionCta: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    backgroundColor: colors.tealDeep,
  },
  companionCtaText: { color: colors.white, fontWeight: '700' },
  companionVoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMark: { color: colors.tealDeep, fontSize: 19 },
  connectionTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  connectionSubtitle: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  connectionInset: {
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSoft,
    minHeight: 54,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ctaLabel: { fontSize: 14, textAlign: 'center' },
  sectionMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
  avatarDot: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.surface,
    backgroundColor: '#388F72',
  },
  unreadDot: {
    position: 'absolute',
    right: 9,
    top: 8,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#B3402F',
  },
  greetingCard: {
    backgroundColor: '#103A30',
    borderRadius: radii.shell,
    padding: spacing.lg,
    gap: spacing.sm,
    overflow: 'hidden',
  },
  greetingHero: {
    minHeight: 122,
    marginBottom: spacing.lg,
    justifyContent: 'center',
    paddingRight: 100,
    backgroundColor: '#0D372C',
  },
  leafMedallion: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: '#41665A',
    backgroundColor: '#214A3E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  leafMark: { fontSize: 60, color: '#52796B' },
  heroNote: {
    color: colors.tealPale,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  moodItem: {
    flex: 1,
    minWidth: 0,
    minHeight: 64,
    alignItems: 'center',
    gap: spacing.xs,
  },
  moodCircle: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodCircleSelected: { borderWidth: 2, borderColor: '#8FB8A6' },
  moodEmoji: { fontSize: 20 },
  weekInset: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  dayDot: {
    width: 18,
    height: 18,
    textAlign: 'center',
    borderRadius: radii.pill,
    overflow: 'hidden',
    color: colors.inkSoft,
    backgroundColor: colors.surfaceSoft,
    fontSize: 12,
  },
  dayChecked: { backgroundColor: colors.tealPale, color: colors.tealDeep },
  dayToday: { backgroundColor: colors.white, color: colors.tealDeep },
  carousel: { gap: spacing.md },
  resourceTile: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  resourceCover: {
    width: '100%',
    backgroundColor: colors.surfaceSoft,
  },
  resourceCopy: { padding: spacing.md, gap: spacing.sm, minHeight: 116 },
  resourceSource: { position: 'absolute', top: spacing.sm, left: spacing.sm },
  resourceBookmark: {
    position: 'absolute',
    right: spacing.sm,
    top: spacing.sm,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderRadius: radii.pill,
  },
  resourceSkeleton: {
    height: 120,
    width: 226,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.panel,
  },
  masthead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  inbox: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  bell: { alignItems: 'center' },
  bellDome: {
    width: 13,
    height: 12,
    borderWidth: 1.5,
    borderBottomWidth: 0,
    borderColor: colors.tealDeep,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  bellRim: { width: 17, height: 1.5, backgroundColor: colors.tealDeep },
  bellClapper: {
    width: 4,
    height: 2,
    marginTop: 2,
    borderRadius: 2,
    backgroundColor: colors.tealDeep,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.teal,
    backgroundColor: colors.tealPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.tealDeep, fontWeight: '800', fontSize: 18 },
  heroCopy: { flex: 1, minWidth: 0 },
  greeting: { color: colors.inkSoft, fontSize: 14 },
  pageTitle: { color: colors.ink, fontSize: 17, fontWeight: '700' },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 48,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.pill,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 15, minHeight: 44 },
  searchMark: { fontSize: 22, color: colors.tealDeep },
  clearSearch: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.shell,
    borderColor: colors.line,
    borderWidth: 1,
    padding: spacing.lg,
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekTitle: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  cycle: {
    color: colors.tealDeep,
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 12,
    fontWeight: '700',
  },
  weekRow: { flexDirection: 'row', gap: spacing.xs },
  day: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 62,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  dayActive: { backgroundColor: colors.tealDeep },
  dayLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  dayNumber: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  lightText: { color: colors.white },
  featured: { backgroundColor: '#174E3E', borderRadius: radii.shell },
  featuredEyebrow: {
    color: colors.tealPale,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'flex-start',
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
  },
  featuredTitle: {
    color: colors.white,
    fontFamily: 'serif',
    fontSize: 21,
    fontWeight: '600',
  },
  featuredBody: { color: colors.tealPale },
  featuredProgress: { backgroundColor: '#32645A', color: colors.white },
  progressTrack: {
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: '#48746B',
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: colors.tealPale },
  appointmentHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  appointmentIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.control,
    backgroundColor: colors.tealPale,
    alignItems: 'center',
    justifyContent: 'center',
  },
  appointmentGlyph: { color: colors.tealDeep, fontSize: 18 },
  appointmentLabel: { color: colors.inkFaint, fontSize: 10, fontWeight: '700' },
  appointmentMeta: { color: colors.inkSoft, fontSize: 12 },
  appointmentTime: {
    color: colors.tealDeep,
    backgroundColor: colors.tealPale,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
    fontWeight: '700',
    maxWidth: '34%',
  },
  appointmentLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    paddingHorizontal: spacing.sm,
  },
  appointmentLink: { minHeight: 44, minWidth: 44, justifyContent: 'center' },
  appointmentLinkLabel: {
    color: colors.tealDeep,
    fontSize: 12,
    fontWeight: '700',
  },
  appointmentActions: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.sm,
  },
  roomButton: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.tealDeep,
    borderRadius: radii.pill,
    padding: spacing.sm,
  },
  roomLabel: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  emrButton: {
    minHeight: 44,
    justifyContent: 'center',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.sm,
  },
  appointmentSkeleton: {
    minHeight: 66,
    justifyContent: 'center',
    gap: spacing.sm,
  },
  skeletonLine: {
    width: '75%',
    height: 12,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
  },
  skeletonShort: { width: '45%' },
  serviceCard: {
    borderRadius: radii.shell,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  nextStep: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderRadius: radii.panel,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  cardEyebrow: {
    color: colors.teal,
    fontSize: typography.eyebrow,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  cardTitle: {
    color: colors.ink,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 31,
  },
  body: {
    color: colors.inkSoft,
    fontSize: typography.body,
    lineHeight: typography.bodyLineHeight,
  },
  progress: {
    alignSelf: 'flex-start',
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.pill,
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  staleNotice: {
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    padding: spacing.md,
  },
  retryButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    minHeight: 44,
    paddingTop: spacing.sm,
  },
  loadingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 56,
  },
  buttonGroup: {
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  linkButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    width: '100%',
  },
  linkLabel: {
    color: colors.tealDeep,
    flex: 1,
    fontSize: typography.body,
    fontWeight: '700',
  },
  arrow: {
    color: colors.tealDeep,
    fontSize: 20,
    marginLeft: spacing.md,
  },
  quickSection: { marginTop: spacing.lg, gap: spacing.md },
  sectionTitle: {
    fontFamily: 'serif',
    fontSize: 20,
    fontWeight: '600',
    color: colors.ink,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.sm,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.shell,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  quickCard: {
    width: '25%',
    minHeight: 76,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  quickCardLarge: { width: '50%' },
  quickHint: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: 4,
    textAlign: 'center',
    fontSize: 10,
  },

  quickLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.ink,
    textAlign: 'center',
  },
  moreSection: {
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.panel,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
  },
  moreToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 64,
    paddingVertical: spacing.md,
  },
  moreTitle: {
    color: colors.ink,
    fontSize: typography.body,
    fontWeight: '700',
  },
  supporting: {
    color: colors.inkFaint,
    fontSize: 14,
    lineHeight: 20,
    marginTop: spacing.xs,
  },
  toggleLabel: {
    color: colors.tealDeep,
    fontSize: 14,
    fontWeight: '700',
    marginLeft: spacing.md,
  },
  links: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  pressed: {
    opacity: 0.65,
  },
} satisfies Record<string, TextStyle>

const systemFontStyles = StyleSheet.create(dashboardStyles)

const sans = { fontFamily: 'DashboardSans' }
const serif = { fontFamily: 'DashboardSerif' }

const webFontStyles = StyleSheet.create({
  ...dashboardStyles,
  heroNote: { ...dashboardStyles.heroNote, ...serif },
  companionStarter: { ...dashboardStyles.companionStarter, ...sans },
  appointmentLabel: { ...dashboardStyles.appointmentLabel, ...sans },
  appointmentMeta: { ...dashboardStyles.appointmentMeta, ...sans },
  appointmentTime: { ...dashboardStyles.appointmentTime, ...sans },
  appointmentLinkLabel: { ...dashboardStyles.appointmentLinkLabel, ...sans },
  roomLabel: { ...dashboardStyles.roomLabel, ...sans },
  connectionTitle: { ...dashboardStyles.connectionTitle, ...sans },
  connectionSubtitle: { ...dashboardStyles.connectionSubtitle, ...sans },
  ctaLabel: { ...dashboardStyles.ctaLabel, ...sans },
  sectionMeta: { ...dashboardStyles.sectionMeta, ...sans },
  avatarText: { ...dashboardStyles.avatarText, ...sans },
  greeting: { ...dashboardStyles.greeting, ...sans },
  pageTitle: { ...dashboardStyles.pageTitle, ...sans },
  searchInput: { ...dashboardStyles.searchInput, ...sans },
  searchMark: { ...dashboardStyles.searchMark, ...sans },
  weekTitle: { ...dashboardStyles.weekTitle, ...sans },
  cycle: { ...dashboardStyles.cycle, ...sans },
  dayLabel: { ...dashboardStyles.dayLabel, ...sans },
  dayNumber: { ...dashboardStyles.dayNumber, ...sans },
  featuredEyebrow: { ...dashboardStyles.featuredEyebrow, ...sans },
  featuredTitle: { ...dashboardStyles.featuredTitle, ...serif },
  cardEyebrow: { ...dashboardStyles.cardEyebrow, ...sans },
  cardTitle: { ...dashboardStyles.cardTitle, ...sans },
  body: { ...dashboardStyles.body, ...sans },
  progress: { ...dashboardStyles.progress, ...sans },
  linkLabel: { ...dashboardStyles.linkLabel, ...sans },
  arrow: { ...dashboardStyles.arrow, ...sans },
  sectionTitle: { ...dashboardStyles.sectionTitle, ...serif },
  quickHint: { ...dashboardStyles.quickHint, ...sans },
  quickLabel: { ...dashboardStyles.quickLabel, ...sans },
  moreTitle: { ...dashboardStyles.moreTitle, ...sans },
  supporting: { ...dashboardStyles.supporting, ...sans },
  toggleLabel: { ...dashboardStyles.toggleLabel, ...sans },
})
