import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import type {
  SpecialistAppointment,
  SpecialistAppointmentList,
} from './specialist-appointment-contract'
import { formatAppointmentRange } from './specialist-appointment-ui'

const dark = '#143831'
const muted = '#52665D'
const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] as const
const labels = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
  timeZone: 'UTC',
})

function openAvailability() {
  router.push('/(specialist)/availability')
}

function weekFor(data: SpecialistAppointmentList | undefined) {
  let timezone = data?.items[0]?.timezone ?? 'Asia/Ho_Chi_Minh'
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone })
  } catch {
    timezone = 'Asia/Ho_Chi_Minh'
  }
  const calendar = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  })
  function localDay(timestamp: string) {
    const parts = calendar.formatToParts(new Date(timestamp))
    const part = (type: string) =>
      Number(parts.find((entry) => entry.type === type)?.value)
    return Date.UTC(part('year'), part('month') - 1, part('day'))
  }
  const today = localDay(data?.generatedAt ?? new Date().toISOString())
  const start = today - ((new Date(today).getUTCDay() + 6) % 7) * 86400000
  const marks = new Map<number, 'booked' | 'pending'>()
  for (const appointment of data?.items ?? []) {
    const day = localDay(appointment.scheduledStartAt)
    if (
      appointment.status === 'CONFIRMED' ||
      appointment.status === 'IN_PROGRESS'
    ) {
      marks.set(day, 'booked')
    } else if (appointment.status === 'REQUESTED' && !marks.has(day)) {
      marks.set(day, 'pending')
    }
  }
  return days.map((label, index) => {
    const date = start + index * 86400000
    return { label, date, current: date === today, mark: marks.get(date) }
  })
}

export function SpecialistAgendaHeader({
  data,
  next,
  refreshing,
  onRefresh,
  onSearch,
}: {
  data: SpecialistAppointmentList | undefined
  next: SpecialistAppointment | undefined
  refreshing: boolean
  onRefresh: () => void
  onSearch: () => void
}) {
  const name = data?.items[0]?.specialistDisplayName
  const serif = useDashboardFonts() && s.serif
  const week = weekFor(data)
  return (
    <View style={s.page}>
      <View style={s.header}>
        <View style={s.avatar}>
          <Text style={s.avatarText} aria-hidden>
            {name?.charAt(0) || '◎'}
          </Text>
        </View>
        <View style={s.fill}>
          <View style={s.identityRow}>
            <Text style={s.role}>CHUYÊN GIA</Text>
            <Text numberOfLines={1} style={s.workspace}>
              · Không gian làm việc
            </Text>
          </View>
          <Text numberOfLines={1} style={[s.profileName, serif]}>
            {name ?? 'Lịch làm việc'}
          </Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tìm lịch hẹn"
          onPress={onSearch}
          style={s.headerButton}
        >
          <View style={s.searchIcon} aria-hidden>
            <View style={s.searchHandle} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Thông báo chuyên môn"
          onPress={() => router.push('/(specialist)/notifications')}
          style={s.headerButton}
        >
          <Text style={s.icon} aria-hidden>
            🔔︎
          </Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Hồ sơ chuyên gia"
          onPress={() => router.push('/(specialist)/profile')}
          style={s.accountButton}
        >
          <Text style={s.avatarText} aria-hidden>
            ◎
          </Text>
        </Pressable>
      </View>

      <Text style={[s.badge, s.clinic]}>ⓘ TRUNG TÂM LÂM SÀNG TRỰC TUYẾN</Text>
      <Text accessibilityRole="header" style={[s.title, serif]}>
        Phản hồi yêu cầu lịch hẹn
      </Text>
      <Text style={s.intro}>
        Phản hồi trước hạn ghi trên lịch hẹn. Yêu cầu chưa được xử lý sẽ hết hạn
        theo quy định của hệ thống.
      </Text>
      <View style={s.toolbar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Làm mới lịch hẹn"
          disabled={refreshing}
          onPress={onRefresh}
          style={s.round}
        >
          <Text style={s.icon} aria-hidden>
            ⟳
          </Text>
        </Pressable>
        <View
          accessible
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
          accessibilityLabel="Đồng bộ Google Calendar, chưa hỗ trợ"
          style={s.sync}
        >
          <Text style={s.text}>▦ Đồng bộ Google Calendar</Text>
        </View>
      </View>

      <View style={s.hero}>
        <View pointerEvents="none" style={s.heroWave} />
        <View style={s.spread}>
          <Text style={[s.badge, s.heroBadge]}>● PHIÊN TƯ VẤN TIẾP THEO</Text>
          <Text aria-hidden style={s.heroMark}>
            ❧
          </Text>
        </View>
        <Text accessibilityRole="header" style={[s.heroTitle, serif]}>
          {next
            ? formatAppointmentRange(next)
            : data
              ? 'Chưa có phiên tư vấn sắp tới'
              : 'Phiên tư vấn tiếp theo'}
        </Text>
        <Text style={s.heroBody}>
          {next
            ? next.modality === 'IN_APP_VIDEO'
              ? 'Tư vấn qua video'
              : 'Tư vấn qua trò chuyện'
            : data
              ? 'Một khoảng lặng giữa các phiên là cơ hội tái tạo năng lượng cho chuyên gia.'
              : 'Thông tin sẽ hiển thị khi tải được lịch hẹn.'}
        </Text>
        <View style={s.heroFooter}>
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              if (next)
                router.push({
                  pathname: '/(specialist)/appointments/[appointmentId]',
                  params: { appointmentId: next.id },
                })
              else openAvailability()
            }}
            style={s.heroAction}
          >
            <Text style={s.link}>
              {next ? 'Mở chi tiết phiên tư vấn' : '⊕  Mở thêm slot tư vấn'}
            </Text>
          </Pressable>
          {data && !next && (
            <Text style={s.heroState}>Trạng thái: Yên tĩnh</Text>
          )}
        </View>
      </View>

      <View style={s.weekCard}>
        <View style={s.spread}>
          <View style={s.weekTitle}>
            <Text style={s.weekIcon} aria-hidden>
              ▥
            </Text>
            <View style={s.fill}>
              <Text accessibilityRole="header" style={s.name}>
                Mật độ lịch tuần này
              </Text>
              <Text style={s.text}>
                {labels.format(week[0]!.date)} – {labels.format(week[6]!.date)}
              </Text>
            </View>
          </View>
          {data && (
            <Text style={s.badge}>
              {week.filter((day) => day.mark === 'booked').length} ngày có lịch
              hẹn
            </Text>
          )}
        </View>
        <View style={s.week}>
          {week.map(({ label, date, current, mark }) => (
            <View
              key={label}
              accessible
              accessibilityLabel={`${label}, ${labels.format(date)}${current ? ', hôm nay' : ''}${mark === 'booked' ? ', có lịch đã xác nhận' : mark === 'pending' ? ', có yêu cầu chờ phản hồi' : ''}`}
              style={[s.day, current && s.current]}
            >
              <Text style={[s.dayText, current && s.currentText]}>{label}</Text>
              <Text style={[s.date, current && s.currentText]}>
                {new Date(date).getUTCDate()}
              </Text>
              <View
                style={[
                  s.dot,
                  mark === 'booked' && s.booked,
                  mark === 'pending' && s.pending,
                ]}
              />
            </View>
          ))}
        </View>

        <View style={s.spread}>
          <Text style={s.text}>
            {data
              ? '● Đã xác nhận · Chờ phản hồi'
              : 'Chưa có dữ liệu lịch tuần'}
          </Text>
          <Pressable
            accessibilityRole="link"
            onPress={openAvailability}
            style={s.touch}
          >
            <Text style={s.link}>Chỉnh sửa lịch rảnh →</Text>
          </Pressable>
        </View>
      </View>
    </View>
  )
}

export function SpecialistAgendaFooter() {
  return (
    <View style={s.page}>
      <View style={s.privacy}>
        <Text aria-hidden style={s.link}>
          ◇
        </Text>
        <Text style={[s.text, s.fill]}>
          Các phiên đã hoàn tất được lưu tại mục Lịch sử.
        </Text>
      </View>
      <View style={s.rules}>
        <Text accessibilityRole="header" style={s.name}>
          ▣ QUY TẮC CHUẨN MỰC PHẢN HỒI
        </Text>
        {[
          [
            'Phản hồi đúng hạn',
            'Xử lý yêu cầu trước thời hạn ghi trên lịch hẹn.',
          ],
          [
            'Bảo mật thông tin',
            'Chỉ xem thông tin thân chủ khi phiên cho phép truy cập.',
          ],
          [
            'Từ chối ca',
            'Theo dõi trạng thái lịch và khung giờ trong hệ thống.',
          ],
        ].map(([label, copy], index) => (
          <View key={label} style={s.ruleRow}>
            <Text style={s.ruleIndex}>{index + 1}</Text>
            <View style={s.fill}>
              <Text style={s.link}>{label}</Text>
              <Text style={s.text}>{copy}</Text>
            </View>
          </View>
        ))}
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={openAvailability}
        style={s.footerAction}
      >
        <Text style={s.footerText}>⊞ Mở lịch khả dụng mới</Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  page: { gap: 12 },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  role: {
    fontSize: 10,
    fontWeight: '800',
    color: dark,
    backgroundColor: '#DFEDE5',
    borderRadius: 9,
    overflow: 'hidden',
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  workspace: { color: muted, fontSize: 11, flexShrink: 1 },
  profileName: { color: dark, fontSize: 17, fontWeight: '700' },
  headerButton: {
    width: 40,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountButton: {
    backgroundColor: dark,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchIcon: {
    width: 13,
    height: 13,
    borderRadius: 7,
    borderColor: dark,
    borderWidth: 2,
  },
  searchHandle: {
    position: 'absolute',
    width: 7,
    height: 2,
    backgroundColor: dark,
    bottom: -2,
    right: -6,
    transform: [{ rotate: '45deg' }],
  },
  clinic: { minWidth: '72%', letterSpacing: 0.5 },
  heroWave: {
    position: 'absolute',
    width: '160%',
    height: '105%',
    top: '49%',
    left: '-31%',
    backgroundColor: '#2A5148',
    borderRadius: 160,
    transform: [{ rotate: '-9deg' }],
  },
  heroMark: { color: '#C0DACD', fontSize: 25 },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 9,
  },
  heroState: { color: '#C9DFD3', fontSize: 11 },
  weekTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    flexShrink: 1,
    gap: 8,
  },
  weekIcon: {
    textAlign: 'center',
    backgroundColor: '#DFEEE5',
    color: dark,
    padding: 7,
    borderRadius: 16,
    overflow: 'hidden',
  },
  privacy: {
    borderRadius: 19,
    padding: 13,
    backgroundColor: '#EAF1EA',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  ruleRow: { flexDirection: 'row', gap: 9 },
  ruleIndex: {
    fontSize: 12,
    backgroundColor: '#E5EAE3',
    borderRadius: 9,
    overflow: 'hidden',
    paddingHorizontal: 6,
    alignSelf: 'flex-start',
    color: muted,
  },
  title: { color: colors.ink, fontSize: 27, fontWeight: '700' },
  serif: { fontFamily: 'DashboardSerif' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  fill: { flex: 1, minWidth: 0 },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: dark,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 17, color: '#fff', fontWeight: '700' },
  name: { fontSize: 15, color: colors.ink, fontWeight: '700' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#DFEEE5',
    color: dark,
    fontSize: 11,
    fontWeight: '700',
    borderRadius: 14,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  intro: { color: muted, fontSize: 14, lineHeight: 22 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  round: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EFF2EC',
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { color: dark, fontSize: 22 },
  sync: {
    flexShrink: 1,
    minHeight: 44,
    padding: 10,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
  },
  text: { color: muted, fontSize: 12, lineHeight: 17 },
  hero: {
    backgroundColor: dark,
    borderRadius: 30,
    padding: 21,
    gap: 12,
    overflow: 'hidden',
  },
  heroBadge: { backgroundColor: '#31554B', color: '#EFF8F2' },
  heroTitle: { color: '#fff', fontSize: 21, fontWeight: '700' },
  heroBody: { color: '#C8DBD2', fontSize: 13, lineHeight: 20 },
  heroAction: {
    alignSelf: 'flex-start',
    minHeight: 44,
    borderRadius: 22,
    backgroundColor: '#DDEFE6',
    justifyContent: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  link: { color: dark, fontSize: 13, fontWeight: '700' },
  weekCard: { padding: 13, gap: 8, backgroundColor: '#fff', borderRadius: 20 },
  spread: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 5,
  },
  week: { flexDirection: 'row', gap: 3 },
  day: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 7,
    gap: 3,
    backgroundColor: '#F1F3EE',
    borderRadius: 20,
  },
  current: { backgroundColor: '#DCEDE3' },
  currentText: { color: dark, fontWeight: '800' },
  dayText: { fontSize: 10, color: muted },
  date: { fontSize: 13, color: dark, fontWeight: '700' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#CED7D0' },
  booked: { backgroundColor: '#22684B' },
  pending: { backgroundColor: '#B75F38' },
  touch: { minHeight: 44, justifyContent: 'center' },
  rules: { backgroundColor: '#EFF2EB', borderRadius: 20, padding: 16, gap: 12 },
  footerAction: {
    backgroundColor: dark,
    minHeight: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    padding: 10,
  },
  footerText: { color: '#fff', fontWeight: '700' },
})
