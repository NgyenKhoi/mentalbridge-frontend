import { router } from 'expo-router'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { z } from 'zod'

import { colors, radii, spacing } from '@/theme/tokens'

const planCycleSchema = z.object({
  cycleNumber: z.number().int().positive(),
  lengthDays: z.number().int().min(1).max(45),
  currentDay: z.number().int().positive().nullable(),
  reviewDueOn: z.iso.date().nullable(),
  startedOn: z.iso.date().nullable().optional(),
  timezone: z.string().min(1),
  state: z.enum([
    'NOT_STARTED',
    'IN_PROGRESS',
    'PAUSED',
    'REVIEW_DUE',
    'CLOSED',
  ]),
})

export function readPlanCycle(value: unknown) {
  return planCycleSchema.safeParse(value).data
}

export const planTabs = [
  ['today', 'Hôm nay'],
  ['plan', 'Kế hoạch'],
  ['progress', 'Tiến triển'],
  ['adjust', 'Điều chỉnh'],
] as const

export type PlanTab = (typeof planTabs)[number][0]

export function planDayLabel(date: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    weekday: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00Z`))
}

export function SupportPlanHeader({
  cycle,
  status,
  tab,
  onTab,
  fontsLoaded,
}: Readonly<{
  cycle?: ReturnType<typeof readPlanCycle> | undefined
  status?: string | undefined
  tab?: PlanTab
  onTab?: (tab: PlanTab) => void
  fontsLoaded: boolean
}>) {
  const day = cycle?.currentDay && Math.min(cycle.currentDay, cycle.lengthDays)
  const cycleStatus = cycle
    ? {
        NOT_STARTED: 'Chưa bắt đầu',
        IN_PROGRESS: day ? `Ngày ${day}/${cycle.lengthDays}` : 'Đang thực hiện',
        PAUSED: 'Đang tạm dừng',
        REVIEW_DUE: 'Đến lúc xem lại',
        CLOSED: 'Đã kết thúc',
      }[cycle.state]
    : status

  return (
    <View style={styles.header}>
      <View style={styles.brandRow}>
        <View accessible={false} style={styles.brandMark}>
          <Text style={styles.brandMarkText}>✿</Text>
        </View>
        <View style={styles.brandCopy}>
          <Text style={[styles.brand, fontsLoaded && styles.serif]}>
            MentalBridge
          </Text>
          <Text style={[styles.small, fontsLoaded && styles.sans]}>
            An tâm trị liệu
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Mở hồ sơ cá nhân"
          accessibilityRole="button"
          onPress={() => router.push('/(user)/profile')}
          style={styles.profile}
        >
          <Text accessible={false} style={styles.brandMarkText}>
            ◎
          </Text>
        </Pressable>
      </View>
      <View style={styles.headingRow}>
        <View style={styles.brandCopy}>
          <Text style={[styles.eyebrow, fontsLoaded && styles.sans]}>
            KHÔNG GIAN CỦA BẠN
          </Text>
          <Text
            accessibilityRole="header"
            style={[styles.title, fontsLoaded && styles.serif]}
          >
            Kế hoạch của bạn
          </Text>
        </View>
        {cycle?.reviewDueOn ? (
          <View style={styles.reviewDate}>
            <Text style={styles.small}>Xem lại vào</Text>
            <Text style={styles.reviewDay}>
              {planDayLabel(cycle.reviewDueOn)}
            </Text>
          </View>
        ) : null}
      </View>
      {cycleStatus ? (
        <View style={styles.cycleRow}>
          <Text style={[styles.cycleLabel, fontsLoaded && styles.sans]}>
            {cycle ? `Chu kỳ ${cycle.cycleNumber}  ·  ` : null}
            <Text style={styles.cycleStatus}>{cycleStatus}</Text>
          </Text>
          {cycle && day ? (
            <View
              accessible
              accessibilityLabel={`Ngày ${day} trên ${cycle.lengthDays} ngày trong chu kỳ`}
              style={styles.dots}
            >
              {Array.from({ length: cycle.lengthDays }, (_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    index < day - 1 && styles.pastDot,
                    index === day - 1 && styles.currentDot,
                  ]}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
      {onTab ? (
        <View accessibilityRole="tablist" style={styles.tabs}>
          {planTabs.map(([value, label]) => (
            <Pressable
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === value }}
              key={value}
              onPress={() => onTab(value)}
              style={[styles.tab, tab === value && styles.selectedTab]}
            >
              <Text
                style={[
                  styles.tabLabel,
                  fontsLoaded && styles.sans,
                  tab === value && styles.selectedLabel,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  header: { gap: spacing.md, marginBottom: spacing.lg },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  brandCopy: { flex: 1, minWidth: 150 },
  brandMark: {
    width: 36,
    height: 36,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDeep,
  },
  profile: {
    width: 44,
    height: 44,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.tealDeep,
  },
  brandMarkText: { color: colors.white, fontSize: 19 },
  brand: { color: colors.tealDeep, fontSize: 18, fontWeight: '700' },
  eyebrow: {
    color: colors.tealDeep,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  title: { color: colors.ink, fontSize: 25, lineHeight: 34, fontWeight: '600' },
  small: { color: colors.inkSoft, fontSize: 11 },
  reviewDate: { alignItems: 'flex-end', marginLeft: 'auto' },
  reviewDay: { color: colors.tealDeep, fontSize: 13, fontWeight: '700' },
  cycleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: spacing.sm,
    backgroundColor: '#edf2ef',
    borderRadius: radii.control,
    padding: spacing.md,
  },
  cycleLabel: { color: colors.inkSoft, fontSize: 12 },
  cycleStatus: { color: colors.tealDeep, fontWeight: '700' },
  dots: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    maxWidth: '100%',
    gap: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radii.pill,
    backgroundColor: colors.tealPale,
  },
  pastDot: { backgroundColor: colors.teal },
  currentDot: { width: 9, height: 9, backgroundColor: colors.tealDeep },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.lg },
  tab: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  selectedTab: { borderBottomColor: colors.tealDeep },
  tabLabel: { color: colors.inkSoft, fontSize: 13 },
  selectedLabel: { color: colors.tealDeep, fontWeight: '700' },
  serif: { fontFamily: 'DashboardSerif' },
  sans: { fontFamily: 'DashboardSans' },
})
