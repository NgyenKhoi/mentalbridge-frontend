import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { AppIcon } from '@/components/AppIcon'
import type { Appointment, CreditAccount } from './appointment-contract'
import {
  appointmentLabel,
  creditLabels,
  sessionLabels,
} from './appointment-model'

const green = '#1D443A'
const muted = '#64716B'

export function AppointmentCreditsCard({
  account,
  children,
}: Readonly<{
  account?: CreditAccount | undefined
  children: ReactNode
}>) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View style={s.creditCard}>
      <View style={s.creditHeading}>
        <View style={s.headingLabel}>
          <View style={s.liveDot} />
          <Text style={s.eyebrow}>LƯỢT TƯ VẤN KHẢ DỤNG</Text>
        </View>
        {account && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Chi tiết gói"
            accessibilityState={{ expanded }}
            onPress={() => setExpanded(!expanded)}
            style={s.detailAction}
          >
            <Text style={s.detailText}>Chi tiết gói</Text>
            <AppIcon name="chevron" size={13} />
          </Pressable>
        )}
      </View>
      {account && (
        <>
          <View style={s.stats}>
            {[
              [
                'ĐANG GIỮ',
                account.reservationCapacity.active,
                ` / ${account.reservationCapacity.maximum}`,
              ],
              ['ĐÃ DÙNG', account.balance.consumed, ' lượt'],
              ['CÒN LẠI', account.balance.available, ' lượt'],
            ].map(([label, value, unit], index) => (
              <View key={label} style={[s.stat, index > 0 && s.statDivider]}>
                <Text style={s.statLabel}>{label}</Text>
                <Text style={s.statValue}>
                  {value}
                  <Text style={s.statUnit}>{unit}</Text>
                </Text>
              </View>
            ))}
          </View>
          {expanded && (
            <View style={s.packageDetails}>
              <Text style={s.body}>Gói {account.packageCode}</Text>
              <Text style={s.body}>
                Còn {account.balance.available} lượt · đang giữ{' '}
                {account.balance.held} lượt
              </Text>
              <Text style={s.body}>
                Đã sử dụng {account.balance.consumed} lượt · không hoàn lại{' '}
                {account.balance.forfeited} lượt
              </Text>
              <Text style={s.body}>
                Lịch đang giữ: {account.reservationCapacity.active} /{' '}
                {account.reservationCapacity.maximum} · còn có thể giữ{' '}
                {account.reservationCapacity.remaining} lịch
              </Text>
            </View>
          )}
        </>
      )}
      {children}
    </View>
  )
}

function timeLabel(item: Appointment) {
  const clock = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: item.timezone,
  })
  const date = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: item.timezone,
  })
  return `${clock.format(new Date(item.scheduledStartAt))} – ${clock.format(new Date(item.scheduledEndAt))} · ${date.format(new Date(item.scheduledStartAt))}`
}

export function AppointmentListCard({
  item,
  busy,
  onDetail,
  onChat,
  onReschedule,
  onCancel,
}: Readonly<{
  item: Appointment
  busy: boolean
  onDetail: () => void
  onChat: () => void
  onReschedule?: (() => void) | undefined
  onCancel?: (() => void) | undefined
}>) {
  const active = ['REQUESTED', 'CONFIRMED', 'IN_PROGRESS'].includes(item.status)
  const waiting = item.status === 'REQUESTED'
  const negative = ['CANCELLED', 'REJECTED', 'EXPIRED'].includes(item.status)
  const initials = item.specialistDisplayName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => Array.from(part)[0])
    .join('')
    .toLocaleUpperCase('vi-VN')
  const modality =
    item.modality === 'IN_APP_VIDEO'
      ? 'Video Call · 60 phút'
      : 'Chat văn bản (60p)'
  const deadline = new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: item.timezone,
  }).format(new Date(item.decisionDeadlineAt))
  const detailLabel = `Xem lịch ${item.specialistDisplayName} · ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: item.timezone }).format(new Date(item.scheduledStartAt))}`
  return (
    <View style={[s.appointmentCard, active && s.activeCard]}>
      <View style={s.cardTop}>
        <View
          style={[
            s.badge,
            waiting
              ? s.waitingBadge
              : active
                ? s.activeBadge
                : negative
                  ? s.negativeBadge
                  : s.endedBadge,
          ]}
        >
          <View
            style={[
              s.statusDot,
              waiting
                ? s.waitingDot
                : active
                  ? s.activeDot
                  : negative
                    ? s.negativeDot
                    : s.endedDot,
            ]}
          />
          <Text
            style={[
              s.badgeText,
              waiting && s.waitingText,
              negative && s.negativeText,
            ]}
          >
            {waiting ? 'Chờ chuyên gia xác nhận' : appointmentLabel(item)}
          </Text>
        </View>
        <View style={s.modality}>
          <AppIcon
            name={item.modality === 'IN_APP_VIDEO' ? 'video' : 'chat'}
            size={16}
          />
          <Text style={s.caption}>{modality}</Text>
        </View>
      </View>
      <View style={s.person}>
        <View style={[s.avatar, active && s.activeAvatar]}>
          <Text style={[s.initials, active && s.activeInitials]}>
            {initials}
          </Text>
        </View>
        <View style={s.grow}>
          <Text accessibilityRole="header" style={s.name}>
            {item.specialistDisplayName}
          </Text>
          <Text style={s.caption}>
            {active ? 'Chuyên gia tư vấn' : timeLabel(item)}
          </Text>
        </View>
      </View>
      {active ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={detailLabel}
            testID="appointment-open-detail"
            disabled={busy}
            onPress={onDetail}
            style={({ pressed }) => [s.datePanel, pressed && s.pressed]}
          >
            <View style={s.dateHeading}>
              <AppIcon name="calendar" size={19} />
              <Text style={s.dateText}>{timeLabel(item)}</Text>
            </View>
            {waiting && (
              <Text style={s.deadline}>
                Chờ chuyên gia phản hồi xác nhận trước {deadline}.{' '}
                {creditLabels[item.creditState]}.
              </Text>
            )}
            {!waiting && (
              <Text style={s.body}>{creditLabels[item.creditState]}</Text>
            )}
            <View style={s.dateLink}>
              <Text style={s.detailText}>Xem chi tiết</Text>
              <AppIcon name="chevron" size={13} />
            </View>
          </Pressable>
          <View style={s.actions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                item.modality === 'IN_APP_CHAT'
                  ? 'Mở phiên trò chuyện'
                  : 'Xem phiên tư vấn video'
              }
              disabled={busy}
              onPress={item.modality === 'IN_APP_CHAT' ? onChat : onDetail}
              style={({ pressed }) => [
                s.chatAction,
                pressed && s.pressed,
                busy && s.disabled,
              ]}
            >
              <AppIcon
                name={item.modality === 'IN_APP_CHAT' ? 'chat' : 'video'}
                size={18}
                color="#B9E7D6"
              />
              <Text style={s.chatText}>
                {item.modality === 'IN_APP_CHAT'
                  ? 'Mở phiên trò chuyện'
                  : 'Xem phiên tư vấn video'}
              </Text>
            </Pressable>
            {onReschedule && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Đổi lịch với ${item.specialistDisplayName}`}
                disabled={busy}
                onPress={onReschedule}
                style={({ pressed }) => [s.iconAction, pressed && s.pressed]}
              >
                <AppIcon name="swap" size={21} color={muted} />
              </Pressable>
            )}
            {onCancel && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Hủy lịch với ${item.specialistDisplayName}`}
                disabled={busy}
                onPress={onCancel}
                style={({ pressed }) => [
                  s.iconAction,
                  s.cancelAction,
                  pressed && s.pressed,
                ]}
              >
                <AppIcon name="close" size={20} color="#A33140" />
              </Pressable>
            )}
          </View>
        </>
      ) : (
        <>
          {item.sessionOutcome && (
            <Text style={s.caption}>{sessionLabels[item.sessionOutcome]}</Text>
          )}
          <View style={s.cardFooter}>
            <Text style={[s.caption, s.grow]}>
              {creditLabels[item.creditState]}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={detailLabel}
              testID="appointment-open-detail"
              disabled={busy}
              onPress={onDetail}
              style={s.detailAction}
            >
              <Text style={s.detailText}>Xem lại chi tiết</Text>
              <AppIcon name="chevron" size={13} />
            </Pressable>
          </View>
        </>
      )}
    </View>
  )
}

const s = StyleSheet.create({
  creditCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 18,
    gap: 16,
    borderWidth: 1,
    borderColor: '#F1F5F2',
  },
  creditHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 4,
  },
  headingLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  liveDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#25BC8A',
    borderWidth: 2,
    borderColor: '#BFF3E0',
  },
  eyebrow: {
    color: green,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    flexShrink: 1,
  },
  detailAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 3,
  },
  detailText: { color: green, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  stats: {
    flexDirection: 'row',
    backgroundColor: '#F5F8F3',
    borderRadius: 17,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingVertical: 15,
  },
  stat: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 3,
  },
  statDivider: { borderLeftWidth: 1, borderLeftColor: '#DDE5DF' },
  statLabel: { color: muted, fontSize: 12, lineHeight: 18 },
  statValue: { color: green, fontSize: 27, lineHeight: 32, fontWeight: '700' },
  statUnit: { fontSize: 13, fontWeight: '400', color: muted },
  packageDetails: { gap: 6, paddingTop: 4 },
  body: { color: green, fontSize: 14, lineHeight: 21 },
  appointmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 23,
    padding: 18,
    borderWidth: 1,
    borderColor: '#E9EEEA',
    gap: 16,
  },
  activeCard: { borderColor: '#CDDFD5', borderWidth: 1.5 },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 13,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F5F2',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 20,
    flexShrink: 1,
  },
  badgeText: { color: green, fontSize: 13, lineHeight: 18, flexShrink: 1 },
  statusDot: { width: 5, height: 5, borderRadius: 3 },
  waitingBadge: {
    backgroundColor: '#FFF9DD',
    borderWidth: 1,
    borderColor: '#F0E5AF',
  },
  waitingText: { color: '#886422' },
  waitingDot: { backgroundColor: '#D9A32C' },
  activeBadge: { backgroundColor: '#E6F4EC' },
  activeDot: { backgroundColor: '#328166' },
  endedBadge: { backgroundColor: '#F3F5F5' },
  endedDot: { backgroundColor: '#929999' },
  negativeBadge: { backgroundColor: '#FFF0EF' },
  negativeText: { color: '#963D39' },
  negativeDot: { backgroundColor: '#B35B55' },
  modality: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  caption: { color: muted, fontSize: 13, lineHeight: 20 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  grow: { flex: 1, minWidth: 0 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#EDF3EF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: green,
    borderWidth: 2,
    borderColor: '#DDEBE3',
  },
  initials: { color: green, fontSize: 18, fontWeight: '700' },
  activeInitials: { color: '#FFFFFF' },
  name: { color: '#15251E', fontSize: 18, lineHeight: 25, fontWeight: '600' },
  datePanel: {
    backgroundColor: '#F6F9F5',
    borderRadius: 17,
    padding: 14,
    gap: 7,
    borderWidth: 1,
    borderColor: '#EDF1EB',
  },
  dateHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dateText: {
    color: '#243D31',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    flex: 1,
  },
  deadline: { color: '#896A42', fontSize: 13, lineHeight: 21, paddingLeft: 27 },
  dateLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 2,
  },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatAction: {
    flex: 1,
    minHeight: 48,
    padding: 11,
    borderRadius: 15,
    backgroundColor: green,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  chatText: {
    color: '#FFFFFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'center',
  },
  iconAction: {
    minWidth: 44,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E7EBE7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelAction: { borderColor: '#F0D5D8' },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
  },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.5 },
})
