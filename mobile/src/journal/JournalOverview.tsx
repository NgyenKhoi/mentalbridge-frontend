import { useState } from 'react'
import { router } from 'expo-router'
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'
import { localDateInTimeZone, shiftLocalDate } from '@/resources/resource-model'
import { colors, radii, spacing } from '@/theme/tokens'

import type { JournalMood, JournalSummary } from './journal-contract'

const zone = 'Asia/Ho_Chi_Minh'
const moodLabels: Record<JournalMood, string> = {
  GREAT: 'Rất tốt',
  GOOD: 'Tốt',
  OKAY: 'Bình thường',
  LOW: 'Không tốt',
  VERY_LOW: 'Rất không tốt',
}
const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
export function JournalOverview({
  entries,
  now,
  complete,
  pending,
  error,
  onNew,
  onEntry,
  onRetry,
  onMore,
  hasMore,
  fetchingMore,
  onReflection,
  fonts,
}: {
  entries: JournalSummary[]
  now: Date
  complete: boolean
  pending: boolean
  error?: string | undefined
  onNew: () => void
  onEntry: (id: string) => void
  onRetry: () => void
  onMore: () => void
  hasMore: boolean
  fetchingMore: boolean
  onReflection: () => void
  fonts: boolean
}) {
  const today = localDateInTimeZone(now, zone)
  const [month, setMonth] = useState(today.slice(0, 7))
  const [calendarExpanded, setCalendarExpanded] = useState(true)
  const [day, setDay] = useState<string | null>(null)
  const [mood, setMood] = useState<JournalMood | null>(null)
  const [tag, setTag] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const sans = fonts ? s.sans : undefined
  const serif = fonts ? s.serif : s.serifFallback
  const labelDate = new Intl.DateTimeFormat('vi-VN', {
    timeZone: zone,
    weekday: 'short',
    day: 'numeric',
    month: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  const dated = entries.map((entry) => ({
    ...entry,
    day: localDateInTimeZone(new Date(entry.occurredAt), zone),
  }))
  const markedDays = new Set(dated.map((entry) => entry.day))
  const loadedMonth =
    complete || dated.some((entry) => entry.day < today.slice(0, 7) + '-01')
  const monthEntries = dated.filter((entry) =>
    entry.day.startsWith(today.slice(0, 7)),
  )
  const moodCounts = new Map<JournalMood, number>()
  for (const { mood } of monthEntries)
    if (mood) moodCounts.set(mood, (moodCounts.get(mood) ?? 0) + 1)
  const rankedMoods = [...moodCounts].sort((left, right) => right[1] - left[1])
  const mainMood =
    rankedMoods[0] && rankedMoods[0][1] !== rankedMoods[1]?.[1]
      ? moodLabels[rankedMoods[0][0]]
      : '—'
  let streak = 0
  const streakStart = markedDays.has(today) ? today : shiftLocalDate(today, -1)
  while (markedDays.has(shiftLocalDate(streakStart, -streak))) streak++
  const tags = [...new Set(entries.flatMap((entry) => entry.tags))]
  const phrase = search.trim().toLocaleLowerCase('vi')
  const matches = dated.filter(
    (entry) =>
      (!day || entry.day === day) &&
      (!mood || entry.mood === mood) &&
      (!tag || entry.tags.includes(tag)) &&
      (!phrase ||
        [entry.content.preview, ...entry.tags].some((value) =>
          value.toLocaleLowerCase('vi').includes(phrase),
        )),
  )
  const start = month + '-01'
  const monthDate = new Date(start + 'T00:00:00Z')
  const monthLabel =
    'Tháng ' + (monthDate.getUTCMonth() + 1) + ', ' + monthDate.getUTCFullYear()
  const offset = (monthDate.getUTCDay() + 6) % 7
  const last = new Date(
    Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0),
  ).getUTCDate()
  const cells = Array.from(
    { length: Math.ceil((last + offset) / 7) * 7 },
    (_, index) => shiftLocalDate(start, index - offset),
  )
  const shiftMonth = (amount: number) => {
    setMonth(
      new Date(
        Date.UTC(
          monthDate.getUTCFullYear(),
          monthDate.getUTCMonth() + amount,
          1,
        ),
      )
        .toISOString()
        .slice(0, 7),
    )
    setDay(null)
  }
  return (
    <View style={s.stack}>
      <View style={s.topBar}>
        <View style={s.flex}>
          <View style={s.brandRow}>
            <Text style={[s.brand, serif]}>MentalBridge</Text>
            <Text style={[s.brandBadge, sans]}>HEALTH TECH</Text>
          </View>
          <Text style={[s.small, sans]}>Kết nối an toàn &amp; bảo mật</Text>
        </View>
        <Pressable
          style={s.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Tìm trong nhật ký"
          onPress={() => setShowSearch((value) => !value)}
        >
          <Text style={s.icon}>⌕</Text>
        </Pressable>
        <Pressable
          style={s.iconButton}
          accessibilityRole="button"
          accessibilityLabel="Thông báo"
          onPress={() => router.push('/(user)/notifications')}
        >
          <Text style={s.icon}>♧</Text>
        </Pressable>
        <Pressable
          style={[s.iconButton, s.profile]}
          accessibilityRole="button"
          accessibilityLabel="Hồ sơ cá nhân"
          onPress={() => router.push('/(user)/profile')}
        >
          <Text style={s.white}>◎</Text>
        </Pressable>
      </View>
      <View style={s.hero}>
        <View style={s.between}>
          <Text style={[s.privateTag, sans]}>Không gian an trú cá nhân</Text>
          <Text style={[s.small, sans]}>
            {'Tháng ' + Number(today.slice(5, 7)) + ', ' + today.slice(0, 4)}
          </Text>
        </View>
        <Text accessibilityRole="header" style={[s.title, serif]}>
          Nhật ký của bạn
        </Text>
        <Text style={[s.body, sans]}>
          Ghi lại cảm xúc và những điều bạn muốn nhìn lại theo nhịp riêng.
        </Text>
        <View style={s.writeRow}>
          <View style={s.flex}>
            <PrimaryButton
              testID="journal-new"
              label="+ Viết nhật ký"
              leadingIcon="✎"
              tone="dashboard"
              labelStyle={sans}
              onPress={onNew}
            />
          </View>
          <Pressable
            style={s.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Nhìn lại nhật ký theo thời gian"
            onPress={onReflection}
          >
            <Text style={s.icon}>▤</Text>
          </Pressable>
        </View>
      </View>
      {!pending && !error && (
        <View style={s.metrics}>
          {[
            {
              icon: '▤',
              value: loadedMonth
                ? monthEntries.length
                : monthEntries.length + '+',
              label: 'bài tháng này',
            },
            {
              icon: '♧',
              value:
                complete ||
                dated.some(
                  (entry) => entry.day < shiftLocalDate(streakStart, -streak),
                )
                  ? streak
                  : streak + '+',
              label: 'ngày liên tiếp',
            },
            {
              icon: '☺',
              value: loadedMonth ? mainMood : '—',
              label: 'tâm trạng chính',
            },
          ].map(({ icon, value, label }) => (
            <View key={label} style={s.metric}>
              <Text accessible={false} style={s.metricIcon}>
                {icon}
              </Text>
              <Text
                style={[
                  s.metricValue,
                  typeof value === 'number' ? serif : sans,
                ]}
              >
                {value}
              </Text>
              <Text style={[s.small, sans]}>{label}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={s.filter}>
        <View style={s.search}>
          <Text accessible={false} style={s.icon}>
            ⌕
          </Text>
          <TextInput
            key={String(showSearch)}
            autoFocus={showSearch}
            value={search}
            onChangeText={setSearch}
            accessibilityLabel="Tìm trong nhật ký"
            placeholder="Tìm trong nhật ký..."
            placeholderTextColor={colors.inkSoft}
            style={[s.input, sans]}
          />
        </View>
        <View style={s.calendar}>
          <View style={s.calendarHeader}>
            <Text accessibilityRole="header" style={[s.calendarTitle, sans]}>
              {monthLabel}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={calendarExpanded ? 'Thu gọn lịch' : 'Mở lịch'}
              accessibilityState={{ expanded: calendarExpanded }}
              onPress={() => setCalendarExpanded((value) => !value)}
              style={({ pressed }) => [
                s.calendarToggle,
                pressed && s.calendarTogglePressed,
              ]}
            >
              <View
                style={[
                  s.calendarTogglePill,
                  !calendarExpanded && s.calendarToggleFilled,
                ]}
              >
                <Text
                  style={[
                    s.calendarToggleLabel,
                    sans,
                    !calendarExpanded && s.white,
                  ]}
                >
                  {calendarExpanded ? 'Thu gọn' : 'Mở lịch'}
                </Text>
                <View
                  accessible={false}
                  importantForAccessibility="no"
                  style={[
                    s.calendarChevron,
                    calendarExpanded ? s.chevronUp : s.chevronDown,
                  ]}
                />
              </View>
            </Pressable>
          </View>
          {calendarExpanded && (
            <>
              <View style={s.calendarTools}>
                <View style={s.legend}>
                  <View style={s.calendarDot} />
                  <Text style={[s.small, sans]}>Có bài viết</Text>
                </View>
                <View style={s.monthNav}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tháng trước"
                    style={s.monthButton}
                    onPress={() => shiftMonth(-1)}
                  >
                    <Text style={s.icon}>‹</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Tháng sau"
                    style={s.monthButton}
                    onPress={() => shiftMonth(1)}
                  >
                    <Text style={s.icon}>›</Text>
                  </Pressable>
                </View>
              </View>
              <View style={s.week}>
                {weekdays.map((name) => (
                  <Text key={name} style={[s.weekday, sans]}>
                    {name}
                  </Text>
                ))}
              </View>
              {Array.from({ length: cells.length / 7 }, (_, row) => (
                <View key={row} style={s.week}>
                  {cells.slice(row * 7, row * 7 + 7).map((date) => {
                    const inMonth = date.startsWith(month)
                    const hasEntry = inMonth && markedDays.has(date)
                    const active = date === day
                    return (
                      <Pressable
                        key={date}
                        style={s.dayCell}
                        disabled={!inMonth}
                        accessibilityRole="button"
                        accessibilityState={{
                          selected: active,
                          disabled: !inMonth,
                        }}
                        accessibilityLabel={
                          date +
                          (date === today ? ', hôm nay' : '') +
                          (hasEntry ? ', có bài viết' : '')
                        }
                        onPress={() => setDay(active ? null : date)}
                      >
                        <View
                          style={[
                            s.dateBadge,
                            date === today && s.today,
                            active && s.marked,
                          ]}
                        >
                          <Text
                            style={[
                              s.day,
                              sans,
                              !inMonth && s.outside,
                              active && s.white,
                            ]}
                          >
                            {Number(date.slice(-2))}
                          </Text>
                          {hasEntry && (
                            <View
                              style={[
                                s.calendarDot,
                                s.dateDot,
                                active && s.selectedDot,
                              ]}
                            />
                          )}
                        </View>
                      </Pressable>
                    )
                  })}
                </View>
              ))}
            </>
          )}
          {day && (
            <View style={s.filterDateRow}>
              <Text style={[s.small, sans]}>
                Đang lọc ngày {day.slice(8)}/{day.slice(5, 7)}/{day.slice(0, 4)}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Bỏ lọc theo ngày"
                onPress={() => setDay(null)}
                style={s.clearDate}
              >
                <Text style={[s.calendarAction, sans]}>Bỏ lọc</Text>
              </Pressable>
            </View>
          )}
        </View>
        <Text style={[s.caption, sans]}>LỌC THEO CẢM XÚC</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.chips}
          keyboardShouldPersistTaps="handled"
        >
          {([null, ...Object.keys(moodLabels)] as (JournalMood | null)[]).map(
            (value) => (
              <Pressable
                key={value ?? 'all'}
                accessibilityRole="button"
                accessibilityState={{ selected: value === mood }}
                onPress={() => setMood(value)}
                style={[s.chip, value === mood && s.marked]}
              >
                <Text style={[s.chipText, sans, value === mood && s.white]}>
                  {value ? moodLabels[value] : 'Tất cả'}
                </Text>
              </Pressable>
            ),
          )}
        </ScrollView>
        {tags.length > 0 && (
          <>
            <Text style={[s.caption, sans]}>CHỦ ĐỀ THƯỜNG NHẬT</Text>
            <View style={s.tagRow}>
              {tags.map((value) => (
                <Pressable
                  key={value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: tag === value }}
                  onPress={() => setTag(tag === value ? null : value)}
                  style={[s.chip, tag === value && s.marked]}
                >
                  <Text style={[s.chipText, sans, tag === value && s.white]}>
                    #{value}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
      <View style={s.between}>
        <Text accessibilityRole="header" style={[s.timelineTitle, serif]}>
          Dòng thời gian
        </Text>
        <Text style={[s.small, sans]}>
          {matches.length} ghi chép{!complete && hasMore ? ' đã tải' : ''}
        </Text>
      </View>
      {pending ? (
        <Text accessibilityRole="progressbar" style={[s.small, sans]}>
          Đang tải nhật ký…
        </Text>
      ) : error ? (
        <View style={s.filter}>
          <Text accessibilityLiveRegion="polite" style={[s.small, sans]}>
            {error}
          </Text>
          <PrimaryButton label="Tải lại danh sách" onPress={onRetry} />
        </View>
      ) : matches.length === 0 ? (
        <Text style={[s.body, sans]}>
          {entries.length
            ? 'Chưa tìm thấy bài viết phù hợp.'
            : 'Chưa có bài viết. Bắt đầu bằng một điều bạn muốn ghi lại hôm nay.'}
        </Text>
      ) : null}
      {matches.map((entry) => (
        <Pressable
          key={entry.id}
          testID={'journal-entry-' + entry.id}
          accessibilityRole="button"
          accessibilityLabel={
            'Mở nhật ký ' + labelDate.format(new Date(entry.occurredAt))
          }
          style={s.entry}
          onPress={() => onEntry(entry.id)}
        >
          <Text style={[s.small, sans]}>
            {labelDate.format(new Date(entry.occurredAt))}
          </Text>
          {(entry.mood || entry.tags.length > 0) && (
            <View style={s.tagRow}>
              {entry.mood && (
                <Text style={[s.entryTag, sans]}>{moodLabels[entry.mood]}</Text>
              )}
              {entry.tags.map((value, index) => (
                <Text key={value + index} style={[s.entryTag, sans]}>
                  #{value}
                </Text>
              ))}
            </View>
          )}
          <Text numberOfLines={4} style={[s.body, sans]}>
            {entry.content.preview}
          </Text>
          <View style={s.between}>
            <Text style={[s.link, sans]}>Đọc tiếp →</Text>
            <Text style={[s.entryTag, sans]}>Xem chi tiết</Text>
          </View>
        </Pressable>
      ))}
      {hasMore && (
        <PrimaryButton
          label={fetchingMore ? 'Đang tải…' : 'Xem bài viết trước đó'}
          disabled={fetchingMore}
          onPress={onMore}
        />
      )}
      <View style={s.footer}>
        <Text accessible={false} style={s.icon}>
          ♡
        </Text>
        <Text style={[s.quote, serif]}>Một khoảng riêng để lắng nghe mình</Text>
        <Text style={[s.footerBody, sans]}>
          Mọi cảm xúc đều có chỗ trong nhật ký của bạn.
        </Text>
      </View>
    </View>
  )
}

const paper = '#F7FAF8'
const mint = '#D9ECE3'
const primary = '#174A3F'
const s = StyleSheet.create({
  sans: { fontFamily: 'DashboardSans' },
  serif: { fontFamily: 'DashboardSerif' },
  serifFallback: { fontFamily: 'serif' },
  stack: { gap: spacing.lg },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  flex: { flex: 1, minWidth: 0 },
  brandRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  brandBadge: {
    fontSize: 9,
    color: primary,
    backgroundColor: mint,
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.xs,
  },
  brand: { fontSize: 20, color: primary, fontWeight: '700' },
  iconButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  profile: { backgroundColor: primary },
  icon: { color: primary, fontSize: 20 },
  hero: {
    backgroundColor: mint,
    borderRadius: radii.panel,
    padding: spacing.lg,
    gap: spacing.md,
  },
  between: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  privateTag: {
    color: primary,
    backgroundColor: paper,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    overflow: 'hidden',
    fontSize: 12,
  },
  title: { color: primary, fontSize: 29 },
  timelineTitle: { color: primary, fontSize: 23 },
  body: { color: colors.ink, fontSize: 14, lineHeight: 22 },
  small: { color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
  writeRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  metrics: { flexDirection: 'row', gap: spacing.sm },
  metric: {
    flex: 1,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
    padding: spacing.md,
    gap: spacing.xs,
    borderColor: colors.line,
    borderWidth: 1,
  },
  metricIcon: {
    color: primary,
    backgroundColor: mint,
    width: 31,
    lineHeight: 31,
    textAlign: 'center',
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  metricValue: { fontSize: 16, color: primary },
  filter: {
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: spacing.md,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    backgroundColor: '#EFF3F1',
  },
  input: { minHeight: 44, flex: 1, fontSize: 14, color: colors.ink },
  calendar: {
    backgroundColor: '#EFF3F1',
    padding: spacing.sm,
    borderRadius: radii.control,
    gap: spacing.xs,
  },
  calendarTitle: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  calendarToggle: { minHeight: 44, justifyContent: 'center' },
  calendarTogglePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 32,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
  },
  calendarToggleFilled: { backgroundColor: primary, borderColor: primary },
  calendarTogglePressed: { opacity: 0.72 },
  calendarToggleLabel: { color: primary, fontWeight: '700', fontSize: 12 },
  calendarChevron: {
    width: 7,
    height: 7,
    borderBottomWidth: 1.5,
    borderRightWidth: 1.5,
  },
  chevronUp: { borderColor: primary, transform: [{ rotate: '225deg' }] },
  chevronDown: { borderColor: colors.white, transform: [{ rotate: '45deg' }] },
  calendarTools: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  calendarAction: { color: primary, fontWeight: '700', fontSize: 11 },
  monthNav: { flexDirection: 'row' },
  monthButton: {
    width: 44,
    minHeight: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  week: { flexDirection: 'row' },
  weekday: {
    flex: 1,
    textAlign: 'center',
    color: colors.inkSoft,
    fontSize: 11,
  },
  dayCell: {
    flex: 1,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateBadge: {
    minWidth: 28,
    minHeight: 28,
    paddingHorizontal: 3,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  day: {
    textAlign: 'center',
    color: colors.ink,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  outside: { opacity: 0.4 },
  today: { backgroundColor: mint, borderColor: colors.teal },
  marked: { backgroundColor: primary, color: colors.white },
  calendarDot: {
    width: 5,
    height: 5,
    borderRadius: radii.pill,
    backgroundColor: primary,
  },
  dateDot: { position: 'absolute', bottom: 2 },
  selectedDot: { backgroundColor: colors.white },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  filterDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
  },
  clearDate: {
    minHeight: 44,
    paddingHorizontal: spacing.sm,
    justifyContent: 'center',
  },
  caption: { fontSize: 11, color: colors.inkSoft },
  chips: { gap: spacing.xs },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    minHeight: 36,
    justifyContent: 'center',
    borderRadius: radii.pill,
    backgroundColor: '#EFF3F1',
  },
  chipText: { color: colors.ink, fontSize: 12 },
  white: { color: colors.white },
  entry: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radii.control,
    borderLeftWidth: 3,
    borderLeftColor: primary,
  },
  entryTag: {
    color: primary,
    backgroundColor: '#EFF3F1',
    borderRadius: radii.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 11,
  },
  link: { fontSize: 13, fontWeight: '700', color: primary },
  footer: {
    backgroundColor: '#EFF3F1',
    alignItems: 'center',
    borderRadius: radii.control,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  quote: {
    color: primary,
    fontStyle: 'italic',
    fontSize: 17,
    textAlign: 'center',
  },
  footerBody: { color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
})
