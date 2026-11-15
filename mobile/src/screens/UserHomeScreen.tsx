import * as Linking from 'expo-linking'
import { skipToken, useQuery } from '@tanstack/react-query'
import { router, useFocusEffect, type Href } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
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

function useDashboardFonts() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let active = true
    // Older development builds can keep rendering with the system fonts.
    void import('expo-font')
      .then(({ loadAsync }) =>
        loadAsync({
          DashboardSans: require('../../assets/fonts/PlusJakartaSans.ttf'),
          DashboardSerif: require('../../assets/fonts/Lora.ttf'),
        }),
      )
      .then(() => {
        if (active) setLoaded(true)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])
  return loaded
}

function openCompanion() {
  void Linking.openURL(
    'https://staging.mentalbridge.online/ai-companion',
  ).catch(() => Alert.alert('Chưa mở được AI Companion', 'Vui lòng thử lại.'))
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

const quickActions = [
  {
    label: 'Nhật ký',
    href: '/(user)/journal',
    mark: '✎',
    hint: 'Viết ngay',
    tint: { backgroundColor: '#E3F7EF', color: '#20584A' },
  },
  {
    label: 'Sàng lọc',
    href: '/(user)/assessment',
    mark: '▤',
    hint: 'Bảng hỏi',
    tint: { backgroundColor: '#FFF4DA', color: '#855314' },
  },
  {
    label: 'Tìm chuyên gia',
    href: '/(user)/specialists',
    mark: '✚',
    hint: 'Tìm lịch',
    tint: { backgroundColor: '#E4F4F6', color: '#145864' },
  },
  {
    label: 'Tài nguyên',
    href: '/(user)/resources',
    mark: '✦',
    hint: 'Bài tập',
    tint: { backgroundColor: '#E4F7F6', color: '#145864' },
  },
  {
    label: 'Kế hoạch',
    href: '/(user)/support-plan',
    mark: '✓',
    hint: 'Hôm nay',
    tint: { backgroundColor: '#EDF4DD', color: '#495927' },
  },
  {
    label: 'Bộ sưu tập',
    href: '/(user)/rewards',
    mark: '❋',
    hint: 'Bingo',
    tint: { backgroundColor: '#FBEFE4', color: '#874925' },
  },
  {
    label: 'Cộng đồng',
    href: '/(user)/community',
    mark: '♧',
    hint: 'Thảo luận',
    tint: { backgroundColor: '#E7F2F9', color: '#1D526A' },
  },
  {
    label: 'Ghi nhận cảm xúc',
    href: '/(user)/emotion',
    mark: '♡',
    hint: 'Check-in',
    tint: { backgroundColor: '#EFECFA', color: '#4D4081' },
  },
] as const

const navigation = [
  { label: 'Trang chủ', mark: '⌂', href: '/(user)/user' },
  { label: 'Kế hoạch', mark: '✓', href: '/(user)/support-plan' },
  { label: 'Nhật ký', mark: '▤', href: '/(user)/journal' },
  { label: 'Chuyên gia', mark: '✚', href: '/(user)/specialists' },
  { label: 'Cá nhân', mark: '◎', href: '/(user)/profile' },
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
}: Readonly<{
  api: HomeApi
  profileApi?: Pick<CareProfileApi, 'getProfile'>
  appointmentApi?: Pick<AppointmentApi, 'list'> | undefined
  discoveryApi?: Pick<DiscoveryApi, 'detail'>
}>) {
  const fontsLoaded = useDashboardFonts()
  const styles = fontsLoaded ? webFontStyles : systemFontStyles
  const { session, signOut } = useSession()
  const { width, fontScale } = useWindowDimensions()
  const [search, setSearch] = useState('')
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

  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false
        return
      }
      void refetchHome()
    }, [refetchHome]),
  )

  const presentation = query.data ? homePresentation(query.data) : null
  const today = new Date()
  const hour = today.getHours()
  const greeting =
    hour >= 5 && hour < 12
      ? 'Chào buổi sáng'
      : hour >= 12 && hour < 18
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
  const dayIndex = (today.getDay() + 6) % 7
  const visibleActions = quickActions.filter(({ label }) =>
    label
      .toLocaleLowerCase('vi')
      .includes(search.trim().toLocaleLowerCase('vi')),
  )
  const featured = Boolean(presentation) && !safety
  const progress = plan?.today && plan.today.total > 0 ? plan.today : null

  return (
    <Screen
      layout="dashboard"
      backgroundColor="#F8FAF8"
      footer={
        !safety && (
          <View style={styles.navBar}>
            <View accessibilityRole="tablist" style={styles.nav}>
              {navigation.map(({ label, mark, href }, index) => (
                <Pressable
                  key={href}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: index === 0 }}
                  onPress={() => {
                    if (index !== 0) router.push(href)
                  }}
                  style={styles.navItem}
                >
                  <Text
                    accessible={false}
                    style={[styles.navMark, index === 0 && styles.navActive]}
                  >
                    {mark}
                  </Text>
                  <Text
                    maxFontSizeMultiplier={1.2}
                    style={[
                      styles.navLabel,
                      index === 0 && styles.navLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        )
      }
    >
      <View style={styles.masthead}>
        <View style={styles.avatar}>
          <Text accessible={false} style={styles.avatarText}>
            {displayName?.trim().charAt(0).toUpperCase() || 'M'}
          </Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.greeting}>{greeting}</Text>
          <Text accessibilityRole="header" style={styles.pageTitle}>
            {displayName || 'Hôm nay của bạn'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Mở thông báo"
          onPress={() => router.push('/(user)/notifications')}
          style={styles.inbox}
        >
          <View accessible={false} style={styles.bell}>
            <View style={styles.bellDome} />
            <View style={styles.bellRim} />
            <View style={styles.bellClapper} />
          </View>
        </Pressable>
      </View>
      {!safety && (
        <>
          <View style={styles.searchBox}>
            <Text accessible={false} style={styles.searchMark}>
              ⌕
            </Text>
            <TextInput
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
          <View style={styles.weekCard}>
            <View style={styles.sectionHeader}>
              <Text accessibilityRole="header" style={styles.weekTitle}>
                Nhịp điệu tuần
              </Text>
              {plan?.cycleDay != null && plan.cycleLengthDays != null && (
                <Text style={styles.cycle}>
                  Chu kỳ {plan.cycleDay}/{plan.cycleLengthDays} ngày
                </Text>
              )}
            </View>
            <View style={styles.weekRow}>
              {weekdays.map((label, index) => {
                const date = new Date(
                  today.getFullYear(),
                  today.getMonth(),
                  today.getDate() + index - dayIndex,
                )
                const active = index === dayIndex
                return (
                  <View
                    key={label}
                    style={[styles.day, active && styles.dayActive]}
                  >
                    <Text style={[styles.dayLabel, active && styles.lightText]}>
                      {active ? 'Nay' : label}
                    </Text>
                    <Text
                      style={[styles.dayNumber, active && styles.lightText]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                )
              })}
            </View>
          </View>
        </>
      )}

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
              Hãy đăng nhập lại để xem bước tiếp theo. Không có hoạt động nào
              được thay đổi.
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
                <Text
                  accessibilityLiveRegion="polite"
                  style={styles.supporting}
                >
                  Chưa cập nhật được thay đổi mới nhất. Bước đang hiển thị là
                  lần tải gần nhất; bạn có thể thử lại.
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

      {!safety && (
        <View style={styles.quickSection}>
          <View style={styles.sectionHeader}>
            <Text accessibilityRole="header" style={styles.sectionTitle}>
              Tiện ích chăm sóc
            </Text>
            <Text style={styles.sectionMeta}>
              {visibleActions.length} lối tắt
            </Text>
          </View>
          <View style={styles.quickGrid}>
            {visibleActions.map(({ href, label, mark, tint, hint }) => (
              <Pressable
                key={href}
                accessibilityRole="button"
                accessibilityLabel={label}
                onPress={() => router.push(href)}
                style={({ pressed }) => [
                  styles.quickCard,
                  (width < 350 || fontScale > 1.25) && styles.quickCardLarge,
                  pressed && styles.pressed,
                ]}
              >
                <Text
                  accessible={false}
                  importantForAccessibility="no"
                  style={[styles.quickMark, tint]}
                >
                  {mark}
                </Text>
                <Text style={styles.quickLabel}>{label}</Text>
                <Text style={[styles.quickHint, tint]}>{hint}</Text>
              </Pressable>
            ))}
            {visibleActions.length === 0 && (
              <Text style={styles.body}>Không tìm thấy lối tắt phù hợp.</Text>
            )}
          </View>
        </View>
      )}
      {!safety && (
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
      {!safety && (
        <>
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
                    AI Companion
                  </Text>
                  <Text style={styles.companionBadge}>● 24/7</Text>
                </View>
                <Text style={styles.connectionSubtitle}>
                  Lắng nghe thấu cảm &amp; xoa dịu tức thì
                </Text>
              </View>
            </View>
            <View style={styles.connectionInset}>
              <Text style={[styles.connectionSubtitle, styles.companionQuote]}>
                “Bạn đang cảm thấy hơi quá tải hôm nay? Mình có thể nghe bạn kể
                một chút không?”
              </Text>
            </View>
            <View style={styles.companionActions}>
              <Pressable
                accessibilityRole="link"
                onPress={openCompanion}
                style={({ pressed }) => [
                  styles.companionCta,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.ctaLabel, styles.companionCtaText]}>
                  ▢ Trò chuyện giải tỏa ngay
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="link"
                accessibilityLabel="Mở AI Companion trên web để gọi AI"
                onPress={openCompanion}
                style={({ pressed }) => [
                  styles.companionVoice,
                  pressed && styles.pressed,
                ]}
              >
                <Text accessible={false} style={styles.voiceMark}>
                  ☎
                </Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.serviceLinks}>
            <View style={styles.utilityCard}>
              <SecondaryAction
                styles={styles}
                label="Nhắc nhở"
                href="/(user)/reminders"
              />
            </View>
            <View style={styles.utilityCard}>
              <SecondaryAction
                styles={styles}
                label="Hồ sơ cá nhân"
                href="/(user)/profile"
              />
            </View>
          </View>
        </>
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
              label="Phiên trò chuyện"
              href="/(user)/messages"
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

      <Pressable
        accessibilityRole="button"
        onPress={() => void signOut()}
        style={({ pressed }) => [
          styles.signOutButton,
          pressed && styles.pressed,
        ]}
      >
        <Text style={styles.signOutLabel}>Đăng xuất</Text>
      </Pressable>
    </Screen>
  )
}

const dashboardStyles = {
  navBar: {
    backgroundColor: colors.surface,
    borderTopColor: colors.line,
    borderTopWidth: 1,
  },
  nav: {
    flexDirection: 'row',
    alignSelf: 'center',
    maxWidth: 760,
    width: '100%',
    minHeight: 66,
    paddingVertical: spacing.xs,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  navMark: {
    color: colors.tealDeep,
    fontSize: 20,
    width: 32,
    lineHeight: 30,
    borderRadius: 15,
    overflow: 'hidden',
    textAlign: 'center',
  },
  navActive: { backgroundColor: colors.tealPale },
  navLabel: { color: colors.inkSoft, fontSize: 11, textAlign: 'center' },
  navLabelActive: { color: colors.tealDeep, fontWeight: '700' },
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
    marginTop: spacing.md,
    backgroundColor: '#003629',
    borderWidth: 1,
    borderColor: '#174E3E',
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
  companionQuote: { fontStyle: 'italic' },
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
    backgroundColor: '#B7EED8',
  },
  companionCtaText: { color: '#003629', fontWeight: '700' },
  companionVoice: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#245749',
    alignItems: 'center',
    justifyContent: 'center',
  },
  voiceMark: { color: colors.white, fontSize: 19 },
  connectionTitle: { color: colors.white, fontSize: 16, fontWeight: '700' },
  connectionSubtitle: { color: '#D9F3E4', fontSize: 13, lineHeight: 19 },
  connectionInset: {
    borderRadius: radii.control,
    backgroundColor: '#174E3E',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  ctaLabel: { fontSize: 14, textAlign: 'center' },
  sectionMeta: { color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
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
    padding: spacing.md,
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  weekTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
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
    minHeight: 56,
    backgroundColor: colors.surfaceSoft,
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
  quickMark: {
    color: colors.tealDeep,
    backgroundColor: colors.surfaceSoft,
    fontSize: 20,
    lineHeight: 42,
    width: 42,
    borderRadius: radii.pill,
    textAlign: 'center',
    overflow: 'hidden',
    marginBottom: spacing.xs,
  },
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
  signOutButton: {
    alignSelf: 'flex-start',
    justifyContent: 'center',
    marginTop: spacing.xl,
    minHeight: 44,
    paddingHorizontal: spacing.sm,
  },
  signOutLabel: {
    color: colors.tealDeep,
    fontSize: typography.body,
    fontWeight: '700',
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
  appointmentLabel: { ...dashboardStyles.appointmentLabel, ...sans },
  appointmentMeta: { ...dashboardStyles.appointmentMeta, ...sans },
  appointmentTime: { ...dashboardStyles.appointmentTime, ...sans },
  appointmentLinkLabel: { ...dashboardStyles.appointmentLinkLabel, ...sans },
  roomLabel: { ...dashboardStyles.roomLabel, ...sans },
  navMark: { ...dashboardStyles.navMark, ...sans },
  navLabel: { ...dashboardStyles.navLabel, ...sans },
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
  quickMark: { ...dashboardStyles.quickMark, ...sans },
  quickHint: { ...dashboardStyles.quickHint, ...sans },
  quickLabel: { ...dashboardStyles.quickLabel, ...sans },
  moreTitle: { ...dashboardStyles.moreTitle, ...sans },
  supporting: { ...dashboardStyles.supporting, ...sans },
  toggleLabel: { ...dashboardStyles.toggleLabel, ...sans },
  signOutLabel: { ...dashboardStyles.signOutLabel, ...sans },
})
