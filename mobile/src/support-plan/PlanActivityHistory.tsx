import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { colors, radii, spacing } from '@/theme/tokens'

import { addPlanDays } from './emotion-plan-context'
import { planDayLabel, type readPlanCycle } from './SupportPlanHeader'
import type {
  ActionOccurrence,
  CanonicalSupportPlan,
} from './support-plan-action-contract'

const weekday = new Intl.DateTimeFormat('vi-VN', {
  weekday: 'short',
  timeZone: 'UTC',
})

export function PlanActivityHistory({
  plan,
  cycle,
  items,
  today,
  timezone,
  window,
}: Readonly<{
  plan: CanonicalSupportPlan
  cycle: ReturnType<typeof readPlanCycle>
  items: ActionOccurrence[]
  today: string
  timezone: string
  window: { from: string; through: string }
}>) {
  const [picked, setPicked] = useState<string>()
  const from = cycle?.startedOn ?? addPlanDays(today, -6)
  const through = cycle?.startedOn
    ? (cycle.reviewDueOn ?? addPlanDays(from, cycle.lengthDays - 1))
    : today
  const days: string[] = []
  for (let date = from; date <= through; date = addPlanDays(date, 1)) {
    days.push(date)
    if (days.length === 45) break
  }
  const selected =
    (picked && days.includes(picked) && picked) ||
    days.find((day) => day === today) ||
    days.at(-1)
  const available = Boolean(
    selected && selected >= window.from && selected <= window.through,
  )
  const activities = items.filter(
    (item) =>
      item.state !== 'CANCELLED' &&
      item.actionType !== 'REASSESSMENT_SCREENING',
  )
  const period = activities.filter(
    (item) =>
      item.localDate >= from &&
      item.localDate <= through &&
      item.localDate <= today,
  )
  const rows = activities
    .filter((item) => item.localDate === selected)
    .sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt))
  const actions = new Map(
    plan.focuses.flatMap((focus) =>
      focus.actions.map((action) => [action.actionId, action] as const),
    ),
  )
  const clock = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: timezone,
  })
  const labels: Partial<Record<ActionOccurrence['displayState'], string>> = {
    COMPLETED: 'Đã làm',
    SKIPPED: 'Để hôm khác',
    OVERDUE: 'Chưa làm',
    SCHEDULED: 'Đã lên lịch',
  }

  return (
    <View style={styles.panel}>
      <Text accessibilityRole="header" style={styles.heading}>
        {cycle?.startedOn ? `Chu kỳ ${cycle.cycleNumber}` : '7 ngày gần đây'}
      </Text>
      <Text style={styles.muted}>
        {planDayLabel(from)} – {planDayLabel(through)}
      </Text>
      {Array.from({ length: Math.ceil(days.length / 7) }, (_, index) => (
        <View key={days[index * 7]} style={styles.week}>
          {days.slice(index * 7, index * 7 + 7).map((day) => {
            const active = day === selected
            const completed = period.some(
              (item) => item.localDate === day && item.state === 'COMPLETED',
            )
            return (
              <Pressable
                key={day}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${planDayLabel(day)}${completed ? ', có hoạt động đã làm' : ''}`}
                onPress={() => setPicked(day)}
                style={[styles.day, active && styles.active]}
              >
                <Text style={[styles.muted, active && styles.activeText]}>
                  {weekday.format(new Date(`${day}T00:00:00Z`))}
                </Text>
                <Text style={[styles.dayNumber, active && styles.activeText]}>
                  {Number(day.slice(8))}
                  {completed ? ' ✓' : ''}
                </Text>
              </Pressable>
            )
          })}
        </View>
      ))}
      {selected && (
        <View style={styles.details}>
          <Text accessibilityRole="header" style={styles.heading}>
            {selected === today ? 'Hôm nay · ' : ''}
            {planDayLabel(selected)}
          </Text>
          {!available || rows.length === 0 ? (
            <Text style={styles.muted}>
              {!available
                ? 'Chưa có dữ liệu cho ngày này.'
                : 'Không có hoạt động nào trong ngày này.'}
            </Text>
          ) : (
            rows.map((item) => (
              <View key={item.occurrenceId} style={styles.activity}>
                <Text style={styles.muted}>
                  {clock.format(new Date(item.scheduledAt))}
                </Text>
                <View style={styles.copy}>
                  <Text style={styles.dayNumber}>
                    {actions.get(item.actionId)?.presentation.title}
                  </Text>
                  <Text style={styles.muted}>{labels[item.displayState]}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      )}
      <View style={styles.details}>
        <Text accessibilityRole="header" style={styles.heading}>
          Những gì bạn đã làm
        </Text>
        {window.from > from && (
          <Text style={styles.muted}>
            Tính từ {planDayLabel(window.from)} trong khoảng đã tải.
          </Text>
        )}
        <Text style={styles.muted}>
          {period.filter((item) => item.state === 'COMPLETED').length} đã làm ·{' '}
          {period.filter((item) => item.state === 'SKIPPED').length} để hôm khác
          · {period.filter((item) => item.displayState === 'OVERDUE').length}{' '}
          chưa làm
        </Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.surface,
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: radii.panel,
  },
  heading: { color: colors.ink, fontWeight: '700', fontSize: 16 },
  muted: { color: colors.inkSoft, fontSize: 13 },
  week: { flexDirection: 'row', gap: spacing.xs },
  day: {
    flex: 1,
    maxWidth: '14%',
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
    backgroundColor: colors.surfaceSoft,
  },
  active: { backgroundColor: colors.tealDeep },
  dayNumber: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  activeText: { color: colors.white },
  details: { gap: spacing.sm },
  activity: {
    flexDirection: 'row',
    gap: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.sm,
  },
  copy: { flex: 1, gap: spacing.xs },
})
