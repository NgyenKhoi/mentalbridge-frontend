import { router, type Href } from 'expo-router'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native'

import { Screen } from '@/components/Screen'
import { SpecialistOverviewTabBar } from '@/navigation/SpecialistOverviewTabBar'
import type { SpecialistDashboard } from '@/specialist/specialist-dashboard-contract'
import { colors } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

const background = '#F8F8F2'
const dark = '#173932'
const muted = '#52665C'
const profileStatus = {
  READY: [
    'Đủ điều kiện',
    'Sẵn sàng nhận ca tư vấn',
    'Mở khung giờ để thân chủ có thể đặt lịch.',
  ],
  PROFILE_REQUIRED: [
    'Cần bổ sung',
    'Hoàn thiện hồ sơ chuyên môn',
    'Bổ sung thông tin để gửi hồ sơ xét duyệt.',
  ],
  PENDING_APPROVAL: [
    'Chờ xét duyệt',
    'Hồ sơ đang được xét duyệt',
    'Bạn có thể xem tình trạng hồ sơ trong Tài khoản.',
  ],
  PROFILE_REJECTED: [
    'Cần cập nhật',
    'Hồ sơ cần cập nhật',
    'Mở hồ sơ để xem yêu cầu và gửi lại.',
  ],
  SUSPENDED: [
    'Tạm dừng',
    'Hồ sơ đang tạm dừng hoạt động',
    'Xem thông tin trong hồ sơ chuyên môn.',
  ],
} as const
const work = {
  COMPLETE_PROFILE: ['Hoàn thiện hồ sơ', './profile', '◎'],
  AWAIT_PROFILE_APPROVAL: ['Theo dõi xét duyệt hồ sơ', './profile', '◎'],
  UPDATE_REJECTED_PROFILE: ['Cập nhật hồ sơ chuyên môn', './profile', '◎'],
  CONTACT_SUPPORT: ['Xem trạng thái hồ sơ', './profile', '◎'],
  REVIEW_APPOINTMENT_REQUESTS: ['Xử lý yêu cầu tư vấn', './appointments', '✓'],
  PUBLISH_AVAILABILITY: ['Thêm lịch khả dụng', './availability', '▦'],
} as const

type SectionCount = { state: string; count: number }
function visibleCount(section: SectionCount | undefined) {
  return section && ['AVAILABLE', 'EMPTY'].includes(section.state)
    ? String(section.count)
    : '—'
}

function formatDate(
  value: string,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
) {
  try {
    return new Intl.DateTimeFormat('vi-VN', {
      ...options,
      timeZone: timezone ?? 'Asia/Ho_Chi_Minh',
    }).format(new Date(value))
  } catch {
    return new Intl.DateTimeFormat('vi-VN', {
      ...options,
      timeZone: 'Asia/Ho_Chi_Minh',
    }).format(new Date(value))
  }
}

function QuickAction({
  label,
  glyph,
  href,
  accessibilityLabel,
}: {
  label: string
  glyph: string
  href: Href
  accessibilityLabel?: string
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={() => router.push(href)}
      style={({ pressed }) => [s.quickAction, pressed && s.pressed]}
    >
      <Text style={s.quickGlyph} aria-hidden>
        {glyph}
      </Text>
      <Text style={s.quickLabel}>{label}</Text>
    </Pressable>
  )
}

export function SpecialistHomeScreen({
  dashboard,
  loading = false,
  failed = false,
  onRetry,
}: {
  dashboard?: SpecialistDashboard | undefined
  loading?: boolean
  failed?: boolean
  onRetry?: () => void
} = {}) {
  const { fontScale } = useWindowDimensions()
  const fontsLoaded = useDashboardFonts()
  const serif = fontsLoaded && s.serif
  const profile = dashboard?.profile
  const status = dashboard ? profileStatus[dashboard.operationalStatus] : null
  const pending = visibleCount(dashboard?.pendingAppointmentRequests)
  const appointment =
    dashboard?.nextAppointment.state === 'AVAILABLE'
      ? dashboard.nextAppointment.item
      : null
  const nextEmpty = dashboard?.nextAppointment.state === 'EMPTY'
  const rating = dashboard?.ratingAggregate
  const average = rating?.state === 'AVAILABLE' ? rating.averageRating : null
  const appointmentHref = appointment
    ? {
        pathname: '/(specialist)/appointments/[appointmentId]' as const,
        params: { appointmentId: appointment.appointmentId },
      }
    : './appointments'
  const primaryLabel = appointment
    ? 'Xem chi tiết phiên hẹn'
    : nextEmpty
      ? 'Mở lịch khả dụng hôm nay'
      : 'Mở lịch hẹn tư vấn'

  return (
    <Screen
      layout="dashboard"
      backgroundColor={background}
      bottomActions={<SpecialistOverviewTabBar onOverview />}
    >
      <View style={s.page}>
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quản lý hồ sơ nghề nghiệp"
            onPress={() => router.push('./profile')}
            style={s.profileButton}
          >
            <Text style={s.avatar} aria-hidden>
              {profile?.displayName?.trim().charAt(0).toUpperCase() || '◎'}
            </Text>
            <View style={s.fill}>
              <Text style={s.name}>{profile?.displayName ?? 'Chuyên gia'}</Text>
              <Text style={s.body}>Tổng quan</Text>
            </View>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Thông báo chuyên môn"
            onPress={() => router.push('./notifications')}
            style={s.iconButton}
          >
            <Text style={s.icon} aria-hidden>
              ♧
            </Text>
          </Pressable>
        </View>

        <View style={s.readiness}>
          <View style={s.wrap}>
            <Text style={s.kicker}>● KHÔNG GIAN CHUYÊN MÔN</Text>
            {dashboard && (
              <Text style={s.small}>
                {formatDate(dashboard.generatedAt, profile?.timezone, {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>
            )}
          </View>
          <View style={s.wrap}>
            <Text accessibilityRole="header" style={[s.heading, s.fill, serif]}>
              {status?.[1] ?? 'Trạng thái nhận ca tư vấn'}
            </Text>
            {status && <Text style={s.pill}>{status[0]}</Text>}
          </View>
          <Text style={s.body}>
            {status?.[2] ??
              (loading
                ? 'Đang tải dữ liệu chuyên môn…'
                : 'Dữ liệu vận hành chưa khả dụng.')}
          </Text>
          {loading && <ActivityIndicator color={dark} />}
          {failed && (
            <Pressable
              accessibilityRole="button"
              onPress={onRetry}
              style={s.inlineButton}
            >
              <Text style={s.link}>Thử tải lại →</Text>
            </Pressable>
          )}
          <View style={s.queue}>
            <View style={s.wrap}>
              <Text style={s.fill}>
                <Text style={s.name}>Hàng đợi</Text>
                <Text style={s.body}>
                  {pending === '—'
                    ? ' · Chưa có dữ liệu'
                    : ` · ${pending} yêu cầu chờ duyệt`}
                </Text>
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Quản lý lịch khả dụng"
                onPress={() => router.push('./availability')}
                style={s.slotButton}
              >
                <Text style={s.slotText}>+ Mở slot</Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={s.hero}>
          <View style={s.accent} pointerEvents="none" />
          <View style={s.wrap}>
            <Text style={s.heroTag}>● PHIÊN HẸN TIẾP THEO</Text>
            {appointment && (
              <Text style={s.heroDate}>
                {formatDate(
                  appointment.scheduledStartAt,
                  appointment.timezone,
                  { day: '2-digit', month: '2-digit', year: 'numeric' },
                )}
              </Text>
            )}
          </View>
          <View style={s.heroIcon}>
            <Text style={s.heroGlyph} aria-hidden>
              {appointment ? '▣' : '⌛'}
            </Text>
          </View>
          <Text accessibilityRole="header" style={[s.heroTitle, serif]}>
            {appointment
              ? appointment.status === 'IN_PROGRESS'
                ? 'Phiên tư vấn đang diễn ra'
                : 'Phiên tư vấn sắp tới'
              : nextEmpty
                ? 'Chưa có ca tham vấn cận kề'
                : 'Lịch tư vấn tiếp theo'}
          </Text>
          <Text style={s.heroBody}>
            {appointment
              ? formatDate(appointment.scheduledStartAt, appointment.timezone, {
                  weekday: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                }) +
                (appointment.modality === 'IN_APP_VIDEO'
                  ? ' · Video'
                  : ' · Trò chuyện')
              : nextEmpty
                ? 'Phiên đã xác nhận sẽ xuất hiện tại đây.'
                : 'Mở lịch hẹn để theo dõi các phiên tư vấn.'}
          </Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={primaryLabel}
            onPress={() =>
              router.push(nextEmpty ? './availability' : appointmentHref)
            }
            style={({ pressed }) => [s.heroButton, pressed && s.pressed]}
          >
            <Text style={s.heroButtonText}>{primaryLabel}</Text>
            <Text style={s.link} aria-hidden>
              →
            </Text>
          </Pressable>
          {nextEmpty && (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push('./appointments')}
              style={s.heroLink}
            >
              <Text style={s.heroDate}>Xem lịch hẹn →</Text>
            </Pressable>
          )}
        </View>

        <View style={s.section}>
          <Text accessibilityRole="header" style={s.kicker}>
            CHỈ SỐ VẬN HÀNH LÂM SÀNG
          </Text>
          <View style={[s.tiles, fontScale > 1.35 && s.stacked]}>
            {[
              [
                'Slot mở',
                visibleCount(dashboard?.availability),
                'Khung giờ khả dụng',
              ],
              [
                'Đánh giá',
                average == null
                  ? '—'
                  : `${average.toLocaleString('vi-VN', { maximumFractionDigits: 1 })}/5`,
                rating?.state === 'AVAILABLE' || rating?.state === 'EMPTY'
                  ? `${rating.ratingCount} lượt đánh giá`
                  : 'Điểm trung bình',
              ],
              [
                'Hôm nay',
                visibleCount(dashboard?.todayConfirmedSessions),
                'Ca đã xác nhận',
              ],
            ].map(([label, count, detail]) => (
              <View key={label} style={s.metric}>
                <Text style={s.small}>{label}</Text>
                <Text style={[s.metricValue, serif]}>{count}</Text>
                <Text style={s.small}>{detail}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={s.utilities}>
          <Text accessibilityRole="header" style={s.kicker}>
            THAO TÁC PHIÊN & TIỆN ÍCH
          </Text>
          <View style={[s.tiles, fontScale > 1.35 && s.stacked]}>
            <QuickAction
              label="Phòng tư vấn"
              glyph="▣"
              href={appointmentHref}
            />
            <QuickAction label="Phiên trò chuyện" glyph="▤" href="./messages" />
            <QuickAction
              label="Lịch khả dụng"
              glyph="⊞"
              href="./availability"
            />
            <QuickAction
              label="Phân tích vận hành"
              glyph="◴"
              href="/(specialist)/operational-analytics"
            />
          </View>
        </View>

        <View style={s.section}>
          <Text accessibilityRole="header" style={[s.heading, serif]}>
            Việc cần theo dõi
          </Text>
          {dashboard?.actionRequired.map(({ type, count }) => {
            const [label, href, glyph] = work[type]
            return (
              <Pressable
                key={type}
                accessibilityRole="link"
                onPress={() => router.push(href)}
                style={s.followup}
              >
                <Text style={s.quickGlyph} aria-hidden>
                  {glyph}
                </Text>
                <Text style={[s.name, s.fill]}>{label}</Text>
                <Text style={s.pill}>{count}</Text>
                <Text style={s.link} aria-hidden>
                  ›
                </Text>
              </Pressable>
            )
          })}
          {dashboard?.actionRequired.length === 0 && (
            <Text style={s.empty}>Chưa có việc cần xử lý từ hệ thống.</Text>
          )}
        </View>
      </View>
    </Screen>
  )
}

const s = StyleSheet.create({
  page: { gap: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  profileButton: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    minHeight: 44,
  },
  avatar: {
    backgroundColor: dark,
    color: '#fff',
    width: 40,
    height: 40,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: 40,
    borderRadius: 20,
    overflow: 'hidden',
    fontWeight: '700',
  },
  fill: { flexGrow: 1, flexShrink: 1, minWidth: 0 },
  name: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  iconButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: { color: dark, fontSize: 23 },
  readiness: {
    padding: 14,
    gap: 10,
    borderRadius: 22,
    backgroundColor: '#F0F3EC',
  },
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 7,
  },
  kicker: { color: dark, fontSize: 12, fontWeight: '700', letterSpacing: 0.5 },
  small: { color: muted, fontSize: 11, lineHeight: 16 },
  heading: { color: colors.ink, fontSize: 21, fontWeight: '700' },
  serif: { fontFamily: 'DashboardSerif' },
  body: { color: muted, fontSize: 13, lineHeight: 19 },
  pill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#DCECE2',
    color: dark,
    fontSize: 11,
    fontWeight: '700',
  },
  queue: { backgroundColor: '#E9EFE8', padding: 9, borderRadius: 12 },
  slotButton: {
    paddingHorizontal: 12,
    minHeight: 44,
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: dark,
  },
  slotText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  hero: {
    backgroundColor: dark,
    borderRadius: 28,
    overflow: 'hidden',
    padding: 19,
    gap: 13,
  },
  accent: {
    position: 'absolute',
    width: 160,
    height: 160,
    right: -54,
    bottom: -58,
    borderRadius: 80,
    backgroundColor: 'rgba(218,238,229,0.07)',
  },
  heroTag: {
    color: '#F2FCF7',
    fontWeight: '700',
    fontSize: 11,
    backgroundColor: '#31534A',
    borderRadius: 13,
    paddingVertical: 5,
    paddingHorizontal: 8,
    overflow: 'hidden',
  },
  heroDate: { color: '#C1D9CD', fontSize: 12 },
  heroIcon: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    backgroundColor: '#31534A',
  },
  heroGlyph: { color: '#fff', fontSize: 27 },
  heroTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroBody: {
    color: '#CDDFD7',
    fontSize: 14,
    lineHeight: 21,
    textAlign: 'center',
  },
  heroButton: {
    backgroundColor: '#fff',
    borderRadius: 25,
    padding: 13,
    minHeight: 48,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
  },
  heroButtonText: { color: dark, fontWeight: '700', flexShrink: 1 },
  heroLink: { alignSelf: 'center', minHeight: 44, justifyContent: 'center' },
  link: { color: dark, fontWeight: '700', fontSize: 14 },
  section: { gap: 9 },
  tiles: { flexDirection: 'row', gap: 6 },
  stacked: { flexDirection: 'column' },
  metric: {
    flex: 1,
    borderRadius: 11,
    backgroundColor: '#fff',
    padding: 10,
    gap: 6,
  },
  metricValue: { color: colors.ink, fontWeight: '700', fontSize: 22 },
  utilities: {
    backgroundColor: '#E9F0E9',
    padding: 13,
    borderRadius: 22,
    gap: 12,
  },
  quickAction: {
    flex: 1,
    borderRadius: 10,
    backgroundColor: '#fff',
    alignItems: 'center',
    padding: 8,
    gap: 7,
    minHeight: 82,
  },
  quickGlyph: {
    minWidth: 36,
    padding: 7,
    textAlign: 'center',
    backgroundColor: '#DDEDE3',
    color: dark,
    borderRadius: 19,
    overflow: 'hidden',
    fontSize: 15,
  },
  quickLabel: {
    color: colors.ink,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  followup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 11,
    backgroundColor: '#fff',
    minHeight: 56,
  },
  empty: {
    padding: 13,
    borderRadius: 12,
    color: muted,
    backgroundColor: '#F0F3EC',
  },
  inlineButton: {
    minHeight: 44,
    alignSelf: 'flex-start',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.7 },
})
