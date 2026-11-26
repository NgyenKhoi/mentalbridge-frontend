import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors } from '@/theme/tokens'
import { useDashboardFonts } from '@/theme/useDashboardFonts'

import type { AvailabilitySlot } from './specialist-contract'
import { defaultTimezone } from './specialist-model'

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
const dateDisplay = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'long',
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
})

export function availabilityDay(instant: string | Date, timezone: string) {
  const date = new Date(instant)
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map(({ type, value }) => [type, value]),
  )
  return `${parts.year}-${parts.month}-${parts.day}`
}

function shiftDay(day: string, offset: number) {
  const date = new Date(day + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + offset)
  return date.toISOString().slice(0, 10)
}

export function availabilityWindow(day: string) {
  return {
    from: shiftDay(day, -7) + 'T00:00:00.000Z',
    to: shiftDay(day, 90) + 'T00:00:00.000Z',
  }
}

export const displayAvailabilityDay = (day: string) =>
  dateDisplay.format(new Date(day + 'T00:00:00Z'))

export function AvailabilityMonth({
  day,
  slots,
  timezone,
  onSelect,
  onBrowse,
}: {
  day: string
  slots: readonly AvailabilitySlot[]
  timezone: string
  onSelect: (day: string) => void
  onBrowse: (day: string) => void
}) {
  const serif = useDashboardFonts() && s.serif
  const first = new Date(day.slice(0, 7) + '-01T00:00:00Z')
  const offset = (first.getUTCDay() + 6) % 7
  const month = first.getUTCMonth()
  const start = shiftDay(first.toISOString().slice(0, 10), -offset)
  const rows = Math.ceil(
    (offset +
      new Date(Date.UTC(first.getUTCFullYear(), month + 1, 0)).getUTCDate()) /
      7,
  )
  const byDay = new Map<
    string,
    { count: number; open: boolean; onlyWithdrawn: boolean }
  >()
  const today = availabilityDay(new Date(), timezone)
  for (const slot of slots) {
    const date = availabilityDay(slot.startAt, timezone)
    const existing = byDay.get(date)
    byDay.set(date, {
      count: (existing?.count ?? 0) + 1,
      open: (existing?.open ?? false) || slot.readiness === 'AVAILABLE',
      onlyWithdrawn:
        (existing?.onlyWithdrawn ?? true) && slot.readiness === 'WITHDRAWN',
    })
  }

  const browse = (direction: number) => {
    const target = new Date(first)
    target.setUTCMonth(month + direction)
    onBrowse(target.toISOString().slice(0, 10))
  }

  return (
    <View style={s.calendar}>
      <View style={s.header}>
        <Text accessibilityRole="header" style={[s.title, serif]}>
          Tháng {month + 1} Năm {first.getUTCFullYear()}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            onBrowse(availabilityDay(new Date(), timezone || defaultTimezone()))
          }
          style={[s.control, s.todayControl]}
        >
          <Text style={s.controlText}>Hôm nay</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng trước"
          onPress={() => browse(-1)}
          style={s.control}
        >
          <Text style={s.controlText}>‹</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tháng sau"
          onPress={() => browse(1)}
          style={s.control}
        >
          <Text style={s.controlText}>›</Text>
        </Pressable>
      </View>
      <Text style={s.meta}>Giờ hiển thị · {timezone}</Text>
      <View style={s.week}>
        {weekdays.map((label) => (
          <Text key={label} style={s.weekday}>
            {label}
          </Text>
        ))}
      </View>
      {Array.from({ length: rows }, (_, row) => (
        <View key={row} style={s.week}>
          {weekdays.map((_, col) => {
            const date = shiftDay(start, row * 7 + col)
            const entry = byDay.get(date)
            const selected = date === day
            return (
              <Pressable
                key={date}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={
                  displayAvailabilityDay(date) +
                  (entry ? `, ${entry.count} khung giờ` : '')
                }
                onPress={() => onSelect(date)}
                style={[
                  s.day,
                  date.slice(0, 7) !== day.slice(0, 7) && s.outside,
                  entry?.open && s.openDay,
                  date === today && s.today,
                  selected && s.selected,
                ]}
              >
                <Text
                  style={[
                    s.dayText,
                    date.slice(0, 7) !== day.slice(0, 7) && s.outsideText,
                    selected && s.selectedText,
                  ]}
                >
                  {Number(date.slice(8))}
                </Text>
                {entry &&
                  (entry.count === 1 || selected ? (
                    <View
                      style={[
                        s.dot,
                        entry.open && s.dotOpen,
                        entry.onlyWithdrawn && s.dotWithdrawn,
                        selected && s.dotSelected,
                      ]}
                    />
                  ) : (
                    <Text
                      style={[
                        s.marker,
                        entry.open && s.markerOpen,
                        selected && s.selectedText,
                      ]}
                    >
                      +{entry.count}
                    </Text>
                  ))}
              </Pressable>
            )
          })}
        </View>
      ))}
      <View style={s.legend}>
        <Text style={s.meta}>● Có thể đặt</Text>
        <Text style={s.meta}>● Đã bắt đầu / Video tắt</Text>
        <Text style={[s.meta, s.withdrawnText]}>● Đã rút</Text>
      </View>
    </View>
  )
}

const s = StyleSheet.create({
  calendar: {
    backgroundColor: '#FDFEF9',
    padding: 11,
    gap: 6,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    color: colors.tealDeep,
    fontSize: 19,
    fontWeight: '700',
    flexGrow: 1,
    flexShrink: 1,
  },
  control: {
    minWidth: 36,
    minHeight: 44,
    paddingHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlText: { color: colors.tealDeep, fontSize: 13, fontWeight: '700' },
  meta: { color: colors.inkSoft, fontSize: 11 },
  week: { flexDirection: 'row', gap: 4 },
  weekday: {
    flex: 1,
    textAlign: 'center',
    paddingVertical: 5,
    color: colors.inkSoft,
    fontSize: 11,
  },
  day: {
    flex: 1,
    minHeight: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    backgroundColor: '#F0F2ED',
  },
  serif: { fontFamily: 'DashboardSerif' },
  todayControl: {
    backgroundColor: '#F0F2ED',
    borderRadius: 16,
    paddingHorizontal: 8,
  },
  openDay: { backgroundColor: '#E8F3EE' },
  outside: { backgroundColor: '#F7F8F4' },
  outsideText: { color: '#728077' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 5 },
  withdrawnText: { color: '#98383B' },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#67766D' },
  dotOpen: { backgroundColor: '#2E705B' },
  dotWithdrawn: { backgroundColor: '#98383B' },
  dotSelected: { backgroundColor: '#C1E5D7' },
  today: { borderWidth: 1, borderColor: colors.tealDeep },
  selected: { backgroundColor: colors.tealDeep },
  dayText: { fontSize: 13, color: colors.ink, fontWeight: '600' },
  marker: { fontSize: 10, color: colors.inkSoft },
  markerOpen: { color: colors.tealDeep, fontWeight: '800' },
  selectedText: { color: '#fff' },
})
