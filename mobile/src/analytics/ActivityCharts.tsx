import { useRef, useState } from 'react'
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing } from '@/theme/tokens'

import type { ActivityDashboard, ActivityDay } from './activity-api'

const shortDate = (value: string) =>
  `${value.slice(8, 10)}/${value.slice(5, 7)}`
const dateLabel = (value: string) => `${shortDate(value)}/${value.slice(0, 4)}`
const moods = ['Rất không tốt', 'Không tốt', 'Bình thường', 'Tốt', 'Rất tốt']
const plotHeight = 136
const ringSize = 154
const ringRadius = ringSize / 2

export const activityKinds = [
  { key: 'assessments', label: 'Bài sàng lọc', color: '#D89A3D' },
  { key: 'journals', label: 'Nhật ký', color: '#2F7167' },
  { key: 'emotions', label: 'Cảm xúc', color: '#7766A0' },
  { key: 'supportPlans', label: 'Hoạt động hỗ trợ', color: '#C87554' },
  { key: 'appointments', label: 'Lịch tư vấn', color: '#66A39B' },
] as const

const dailyLabels = {
  assessments: 'Sàng lọc',
  journals: 'Nhật ký',
  emotions: 'Cảm xúc',
  supportPlans: 'Hỗ trợ',
  appointments: 'Tư vấn',
}

const dayCounts = (day: ActivityDay) => ({
  assessments: day.assessments,
  journals: day.journals,
  emotions: day.emotions,
  supportPlans: day.supportCompleted + day.supportSkipped,
  appointments: day.appointments,
})

function ChartHeading({
  label,
  title,
  badge,
}: Readonly<{ label: string; title: string; badge?: string | undefined }>) {
  return (
    <View style={styles.sectionHead}>
      <View style={styles.sectionTop}>
        <Text style={styles.eyebrow}>{label}</Text>
        {badge && <Text style={styles.badge}>{badge}</Text>}
      </View>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
    </View>
  )
}

export function EmotionTrend({
  data,
  onCheckIn,
}: Readonly<{
  data: ActivityDashboard
  onCheckIn: () => void
}>) {
  const [width, setWidth] = useState(0)
  const points = data.daily.flatMap((day, index) =>
    day.emotionLevel === null
      ? []
      : [
          {
            date: day.localDate,
            index,
            x: 7 + (index * Math.max(0, width - 14)) / (data.daily.length - 1),
            y: 8 + ((5 - day.emotionLevel) * (plotHeight - 16)) / 4,
          },
        ],
  )
  return (
    <View style={styles.card}>
      <ChartHeading
        label="CẢM XÚC TỰ GHI NHẬN"
        title="Xu hướng cảm xúc"
        badge={
          data.sources.emotions === 'unavailable'
            ? undefined
            : `${points.length} ngày có ghi nhận`
        }
      />
      {data.sources.emotions === 'unavailable' ? (
        <Text style={styles.muted}>Chưa tải được dữ liệu cảm xúc.</Text>
      ) : (
        <>
          {points.length < 3 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text aria-hidden style={styles.emptyIconGlyph}>
                  ◌
                </Text>
              </View>
              <Text style={[styles.heading, styles.centered]}>
                Cần thêm vài ngày để tạo đường xu hướng
              </Text>
              <Text style={[styles.muted, styles.centered]}>
                Ghi nhận ít nhất 3 ngày trong khoảng đã chọn để xem cảm xúc thay
                đổi theo thời gian.
              </Text>
              <Pressable
                accessibilityRole="button"
                onPress={onCheckIn}
                style={styles.action}
              >
                <Text aria-hidden style={styles.actionText}>
                  ＋
                </Text>
                <Text style={styles.actionText}>Ghi nhận cảm xúc</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View
                style={styles.plotRow}
                accessible
                accessibilityLabel={`Xu hướng cảm xúc, ${points.length} ngày có ghi nhận. Chọn ngày trong lịch để xem cảm xúc của ngày đó.`}
              >
                <View aria-hidden style={styles.axis}>
                  {[...moods].reverse().map((mood) => (
                    <Text key={mood} style={styles.axisText}>
                      {mood}
                    </Text>
                  ))}
                </View>
                <View
                  aria-hidden
                  style={styles.plot}
                  onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
                >
                  {moods.map((mood, index) => (
                    <View
                      key={mood}
                      style={[
                        styles.gridLine,
                        { top: 8 + (index * (plotHeight - 16)) / 4 },
                      ]}
                    />
                  ))}
                  {width > 14 &&
                    points.map((point, index) => {
                      const previous = points[index - 1]
                      if (!previous || previous.index + 1 !== point.index)
                        return null
                      const dx = point.x - previous.x
                      const dy = point.y - previous.y
                      const length = Math.hypot(dx, dy)
                      return (
                        <View
                          key={point.date}
                          style={[
                            styles.segment,
                            {
                              width: length,
                              left: (point.x + previous.x - length) / 2,
                              top: (point.y + previous.y) / 2 - 1,
                              transform: [
                                { rotate: `${Math.atan2(dy, dx)}rad` },
                              ],
                            },
                          ]}
                        />
                      )
                    })}
                  {width > 14 &&
                    points.map((point) => (
                      <View
                        key={point.date}
                        style={[
                          styles.point,
                          { left: point.x - 3, top: point.y - 3 },
                        ]}
                      />
                    ))}
                </View>
              </View>
              <View style={styles.plotDates}>
                <Text style={styles.muted}>
                  {shortDate(data.startLocalDate)}
                </Text>
                <Text style={styles.muted}>
                  {shortDate(data.asOfLocalDate)}
                </Text>
              </View>
              <Text style={styles.muted}>
                Ngày không ghi nhận được để trống.
              </Text>
            </>
          )}
        </>
      )}
    </View>
  )
}

function ActivityRing({
  counts,
  total,
  range,
}: Readonly<{
  counts: Record<(typeof activityKinds)[number]['key'], number>
  total: number
  range: number
}>) {
  const segments = activityKinds.flatMap(({ key, color }, index) => {
    const sweep = (counts[key] / total) * 360
    const precedingCount = activityKinds
      .slice(0, index)
      .reduce((sum, kind) => sum + counts[kind.key], 0)
    const offset = (precedingCount / total) * 360
    return [Math.min(180, sweep), Math.max(0, sweep - 180)].flatMap(
      (angle, half) =>
        angle > 0
          ? [
              {
                key: `${key}-${half}`,
                color,
                angle,
                offset: offset + half * 180,
              },
            ]
          : [],
    )
  })

  return (
    <View aria-hidden style={styles.ring}>
      {segments.map(({ key, color, angle, offset }) => (
        <View
          key={key}
          style={[styles.ringDisk, { transform: [{ rotate: `${offset}deg` }] }]}
        >
          {/* Rotate a half disk into a stationary half-width clip to reveal the arc. */}
          <View style={styles.ringClip}>
            <View
              style={[
                styles.ringSweep,
                { transform: [{ rotate: `${angle}deg` }] },
              ]}
            >
              <View style={[styles.ringHalf, { backgroundColor: color }]} />
            </View>
          </View>
        </View>
      ))}
      <View style={styles.ringCenter}>
        <Text style={styles.muted}>Cơ cấu</Text>
        <Text style={styles.heading}>{range} ngày</Text>
      </View>
    </View>
  )
}

export function ActivityMix({ data }: Readonly<{ data: ActivityDashboard }>) {
  const { summary, sources } = data
  const counts = {
    assessments: summary.assessmentSubmissions,
    journals: summary.journalEntries,
    emotions: summary.emotionCheckIns,
    supportPlans: summary.supportCompleted + summary.supportSkipped,
    appointments: summary.appointmentEvents,
  }
  const total = summary.totalActivities
  return (
    <View style={styles.card}>
      <ChartHeading label="PHÂN BỔ" title="Cơ cấu hoạt động" />
      {total > 0 ? (
        <ActivityRing
          counts={counts}
          total={total}
          range={data.bounded.windowDays}
        />
      ) : (
        <Text style={styles.muted}>Chưa có hoạt động để thống kê.</Text>
      )}
      {activityKinds.map(({ key, color, label }) => (
        <View key={key} style={[styles.legendRow, styles.mixLegendRow]}>
          <View
            aria-hidden
            style={[styles.swatch, { backgroundColor: color }]}
          />
          <Text style={[styles.muted, styles.flex]}>{label}</Text>
          <Text style={styles.legendValue}>
            {sources[key] === 'unavailable'
              ? 'Chưa tải được'
              : `${total ? Math.round((counts[key] / total) * 100) : 0}%`}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function DailyActivity({ data }: Readonly<{ data: ActivityDashboard }>) {
  const [picked, setPicked] = useState<string>()
  const scroller = useRef<ScrollView>(null)
  const initialScrollDone = useRef(false)
  const selected =
    data.daily.find((day) => day.localDate === picked) ?? data.daily.at(-1)
  if (!selected) return null
  const max = Math.max(1, ...data.daily.map(({ total }) => total))
  const counts = dayCounts(selected)
  return (
    <View style={styles.card}>
      <ChartHeading
        label="NHỊP HOẠT ĐỘNG"
        title="Hoạt động theo ngày"
        badge={`${data.summary.activeDays}/${data.bounded.windowDays} ngày hoạt động`}
      />
      <View
        style={styles.dayLegend}
        accessible
        accessibilityLabel="Nhóm hoạt động trong chi tiết từng ngày: sàng lọc, nhật ký, cảm xúc, hỗ trợ và tư vấn"
      >
        {activityKinds.map(({ key, color }) => (
          <View key={key} style={styles.miniLegend}>
            <View
              aria-hidden
              style={[styles.swatch, { backgroundColor: color }]}
            />
            <Text style={styles.axisText}>{dailyLabels[key]}</Text>
          </View>
        ))}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        showsHorizontalScrollIndicator
        style={styles.timelineScroll}
        contentContainerStyle={styles.timeline}
        onContentSizeChange={() => {
          if (initialScrollDone.current) return
          initialScrollDone.current = true
          scroller.current?.scrollToEnd({ animated: false })
        }}
      >
        {data.daily.map((day) => {
          const active = day.localDate === selected.localDate
          const intensity = day.total / max
          const tint =
            day.total === 0
              ? styles.quiet
              : intensity > 0.66
                ? styles.high
                : intensity > 0.33
                  ? styles.medium
                  : styles.low
          return (
            <Pressable
              key={day.localDate}
              accessibilityRole="button"
              accessibilityLabel={`Ngày ${dateLabel(day.localDate)}, ${day.total} hoạt động`}
              accessibilityState={{ selected: active }}
              onPress={() => setPicked(day.localDate)}
              style={styles.day}
            >
              <View style={styles.barSlot}>
                <View
                  style={[
                    styles.dayBar,
                    tint,
                    { height: day.total > 0 ? 24 + intensity * 16 : 14 },
                    active && styles.selectedDay,
                  ]}
                >
                  {day.total > 0 && (
                    <Text
                      style={[
                        styles.dayNumber,
                        intensity > 0.66 && styles.dayNumberHigh,
                      ]}
                    >
                      {day.total}
                    </Text>
                  )}
                </View>
              </View>
              <Text style={styles.axisText}>{shortDate(day.localDate)}</Text>
            </Pressable>
          )
        })}
      </ScrollView>
      <View style={styles.dayDetail} accessibilityLiveRegion="polite">
        <Text accessibilityRole="header" style={styles.heading}>
          {selected.localDate === data.asOfLocalDate ? 'Hôm nay · ' : ''}
          {dateLabel(selected.localDate)}
        </Text>
        {selected.total === 0 && !data.partial ? (
          <Text style={styles.muted}>
            Chưa ghi nhận hoạt động trong ngày này.
          </Text>
        ) : (
          activityKinds.map(({ key, label, color }) => (
            <View key={key} style={styles.legendRow}>
              <View
                aria-hidden
                style={[styles.swatch, { backgroundColor: color }]}
              />
              <Text style={[styles.muted, styles.flex]}>{label}</Text>
              <Text style={styles.legendValue}>
                {data.sources[key] === 'unavailable'
                  ? 'Chưa tải được'
                  : key === 'emotions' && selected.emotionLevel !== null
                    ? moods[selected.emotionLevel - 1]
                    : key === 'supportPlans' && counts[key] > 0
                      ? `${selected.supportCompleted} xong · ${selected.supportSkipped} bỏ qua`
                      : counts[key]}
              </Text>
            </View>
          ))
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    borderColor: colors.line,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sectionHead: { gap: spacing.xs },
  sectionTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  badge: {
    fontSize: 11,
    color: colors.tealDeep,
    backgroundColor: '#EDF5F1',
    borderRadius: radii.pill,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  eyebrow: {
    color: colors.inkSoft,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  heading: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  muted: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  empty: {
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.md,
  },
  centered: { textAlign: 'center', maxWidth: 280 },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#EEF5F1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyIconGlyph: { color: colors.tealDeep, fontSize: 27, fontWeight: '800' },
  action: {
    backgroundColor: '#123E32',
    borderRadius: 15,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { color: colors.white, fontWeight: '700' },
  plotRow: { flexDirection: 'row', gap: spacing.sm },
  axis: { justifyContent: 'space-between', paddingVertical: 1 },
  axisText: { color: colors.inkSoft, fontSize: 10 },
  plot: { flex: 1, height: plotHeight },
  gridLine: {
    position: 'absolute',
    width: '100%',
    height: 1,
    backgroundColor: colors.line,
  },
  segment: { position: 'absolute', height: 2, backgroundColor: '#7766A0' },
  point: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#7766A0',
  },
  plotDates: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginLeft: 64,
  },
  ring: {
    alignSelf: 'center',
    width: ringSize,
    height: ringSize,
    marginVertical: spacing.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: ringRadius,
    backgroundColor: '#EAF1EF',
  },
  ringDisk: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: ringSize,
    height: ringSize,
    borderRadius: ringRadius,
    overflow: 'hidden',
  },
  ringClip: {
    position: 'absolute',
    left: ringRadius,
    width: ringRadius,
    height: ringSize,
    overflow: 'hidden',
  },
  ringSweep: {
    position: 'absolute',
    left: -ringRadius,
    width: ringSize,
    height: ringSize,
  },
  ringHalf: {
    width: ringRadius,
    height: ringSize,
    borderTopLeftRadius: ringRadius,
    borderBottomLeftRadius: ringRadius,
  },
  ringCenter: {
    width: 102,
    height: 102,
    borderRadius: 51,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  mixLegendRow: {
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  legendValue: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'right',
    flexShrink: 1,
  },
  swatch: { height: 8, width: 8, borderRadius: 3 },
  flex: { flex: 1 },
  dayLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  miniLegend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timelineScroll: { flexGrow: 0 },
  timeline: { gap: spacing.xs, paddingBottom: spacing.sm },
  day: { width: 44, alignItems: 'center', gap: 4 },
  barSlot: {
    height: 44,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  dayBar: {
    width: 30,
    borderWidth: 2,
    borderColor: 'transparent',
    borderRadius: radii.control,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedDay: { borderColor: colors.tealDeep },
  dayNumber: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  dayNumberHigh: { color: colors.white },
  quiet: { backgroundColor: '#F2F4F2' },
  low: { backgroundColor: '#E4F1E9' },
  medium: { backgroundColor: '#BCDACA' },
  high: { backgroundColor: '#1B6153' },
  dayDetail: {
    borderRadius: radii.control,
    padding: spacing.md,
    backgroundColor: '#F2F5F3',
    gap: spacing.sm,
  },
})
