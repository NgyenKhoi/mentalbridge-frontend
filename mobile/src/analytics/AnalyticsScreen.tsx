import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { Screen } from '@/components/Screen'
import { colors, radii, spacing } from '@/theme/tokens'

import {
  activityRanges,
  type ActivityDashboard,
  type ActivityRange,
} from './activity-api'
import {
  ActivityMix,
  DailyActivity,
  EmotionTrend,
  activityKinds,
} from './ActivityCharts'

function Summary({ data }: Readonly<{ data: ActivityDashboard }>) {
  const { summary, sources, bounded } = data
  const date =
    summary.latestAssessmentSubmittedAt &&
    new Intl.DateTimeFormat('vi-VN', {
      timeZone: data.timezone,
      day: '2-digit',
      month: '2-digit',
    }).format(new Date(summary.latestAssessmentSubmittedAt))
  const metrics = [
    {
      key: 'emotions',
      label: 'Chuỗi cảm xúc',
      icon: '☺',
      tint: '#EEE9F5',
      value: summary.currentEmotionStreak,
      unit: 'ngày',
      detail: `${summary.emotionActiveDays}/${bounded.windowDays} ngày có ghi nhận`,
    },
    {
      key: 'assessments',
      label: 'Bài sàng lọc đã lưu',
      icon: '▤',
      tint: '#F8EEDC',
      value: summary.assessmentSubmissions,
      unit: 'bài',
      detail:
        date && summary.latestAssessmentInstrument
          ? `Gần nhất: ${summary.latestAssessmentInstrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'} · ${date}`
          : 'Trong khoảng đã chọn',
    },
    {
      key: 'supportPlans',
      label: 'Hoạt động hỗ trợ',
      icon: 'ϟ',
      tint: '#F7EBE6',
      value: summary.supportCompleted + summary.supportSkipped,
      unit: 'lượt',
      detail: `${summary.supportCompleted} hoàn thành · ${summary.supportSkipped} bỏ qua`,
    },
    {
      key: 'appointments',
      label: 'Lịch tư vấn đã tạo',
      icon: '▣',
      tint: '#E6F0EF',
      value: summary.appointmentEvents,
      unit: 'lịch',
      detail: 'Trong khoảng đã chọn',
    },
  ] as const
  return (
    <View style={styles.kpis}>
      {metrics.map(({ key, label, icon, tint, value, unit, detail }) => (
        <View key={key} style={styles.kpi}>
          <View style={styles.kpiHead}>
            <Text aria-hidden style={[styles.icon, { backgroundColor: tint }]}>
              {icon}
            </Text>
            <Text style={styles.kpiLabel}>{label}</Text>
          </View>
          <Text style={styles.kpiValue}>
            {sources[key] === 'unavailable' ? (
              '—'
            ) : (
              <>
                {value} <Text style={styles.kpiUnit}>{unit}</Text>
              </>
            )}
          </Text>
          <Text style={styles.muted}>
            {sources[key] === 'unavailable' ? 'Chưa tải được dữ liệu' : detail}
          </Text>
        </View>
      ))}
    </View>
  )
}

export function AnalyticsScreen({
  range,
  data,
  loading,
  onRangeChange,
  retry,
  goBack,
  openCheckIn,
  header,
}: Readonly<{
  range: ActivityRange
  data: ActivityDashboard | undefined
  loading: boolean
  onRangeChange: (range: ActivityRange) => void
  retry: () => void
  goBack: () => void
  openCheckIn: () => void
  header?: Readonly<{
    initials: string
    unread: boolean
    messages: () => void
    notifications: () => void
    profile: () => void
  }>
}>) {
  const unavailable =
    data &&
    activityKinds
      .filter(({ key }) => data.sources[key] === 'unavailable')
      .map(({ label }) => label)
      .join(', ')
  const limited = data && Object.values(data.sources).includes('limited')

  return (
    <Screen layout="dashboard" backgroundColor="#F4F8F9">
      <View style={styles.page}>
        <View style={styles.masthead}>
          <View style={styles.brandMark}>
            <Text aria-hidden style={styles.brandGlyph}>
              ✦
            </Text>
          </View>
          <View style={styles.brandCopy}>
            <Text style={styles.brandName}>MentalBridge</Text>
            <Text style={styles.brandTag}>HEALTH TECH</Text>
          </View>
          {header && (
            <View style={styles.headActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Tin nhắn tư vấn"
                style={styles.headAction}
                onPress={header.messages}
              >
                <Text aria-hidden style={styles.headIcon}>
                  ✉
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={
                  header.unread ? 'Thông báo, có mục chưa đọc' : 'Thông báo'
                }
                style={styles.headAction}
                onPress={header.notifications}
              >
                <View aria-hidden style={styles.bell}>
                  <View style={styles.bellTop} />
                  <View style={styles.bellBase} />
                  {header.unread && <View style={styles.unread} />}
                </View>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Hồ sơ cá nhân"
                style={styles.headAction}
                onPress={header.profile}
              >
                <View style={styles.avatar}>
                  <Text aria-hidden style={styles.avatarText}>
                    {header.initials}
                  </Text>
                </View>
              </Pressable>
            </View>
          )}
        </View>
        <View style={styles.breadcrumb}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Quay lại"
            onPress={goBack}
            style={styles.back}
          >
            <Text style={styles.backText}>‹ Không gian</Text>
          </Pressable>
          <Text style={styles.crumbTitle}>› Phân tích</Text>
          <View style={styles.privateBadge}>
            <View aria-hidden style={styles.privateDot} />
            <Text style={styles.privateText}>Không gian cá nhân</Text>
          </View>
        </View>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>HÀNH TRÌNH CỦA BẠN</Text>
          <Text accessibilityRole="header" style={styles.title}>
            Thống kê &amp; Phân tích
          </Text>
          <Text style={styles.heroCopy}>
            Xem lại các hoạt động bạn đã ghi nhận trên MentalBridge theo thời
            gian.
          </Text>
        </View>
        <View style={styles.filters}>
          <Text style={styles.rangeLabel}>▣ Khoảng thời gian</Text>
          <View style={styles.range} accessibilityRole="tablist">
            {activityRanges.map((item) => (
              <Pressable
                key={item}
                accessibilityRole="tab"
                accessibilityState={{ selected: range === item }}
                onPress={() => onRangeChange(item)}
                style={[styles.rangeItem, range === item && styles.activeRange]}
              >
                <Text
                  style={[
                    styles.rangeText,
                    range === item && styles.activeText,
                  ]}
                >
                  {item} ngày
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        {!data && (
          <View style={styles.notice} accessibilityLiveRegion="polite">
            {loading ? (
              <>
                <ActivityIndicator
                  color={colors.tealDeep}
                  accessibilityLabel="Đang tải thống kê"
                />
                <Text style={styles.muted}>
                  Đang tải hoạt động trong {range} ngày…
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.filterTitle}>Chưa tải được thống kê</Text>
                <Pressable
                  accessibilityRole="button"
                  style={styles.back}
                  onPress={retry}
                >
                  <Text style={styles.backText}>Thử lại</Text>
                </Pressable>
              </>
            )}
          </View>
        )}
        {data && (
          <>
            {data.partial && (
              <View
                style={[styles.notice, styles.partial]}
                accessibilityLiveRegion="polite"
              >
                <Text style={styles.filterTitle}>Dữ liệu chưa đầy đủ</Text>
                <Text style={styles.muted}>
                  {unavailable
                    ? `Chưa tải được: ${unavailable}. Tổng chỉ tính các mục đã tải.`
                    : 'Tổng chỉ tính các mục đã tải.'}
                </Text>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: loading }}
                  disabled={loading}
                  style={styles.back}
                  onPress={retry}
                >
                  <Text style={styles.backText}>
                    {loading ? 'Đang tải lại…' : 'Tải lại dữ liệu'}
                  </Text>
                </Pressable>
              </View>
            )}
            {limited && (
              <Text style={styles.muted}>
                Một số mục có giới hạn số bản ghi. Khoảng ngắn hơn có thể đầy đủ
                hơn.
              </Text>
            )}
            <Summary data={data} />
            <EmotionTrend data={data} onCheckIn={openCheckIn} />
            <ActivityMix data={data} />
            <DailyActivity key={range} data={data} />
            <Text style={styles.muted}>
              Số liệu phản ánh những hoạt động bạn đã ghi nhận trên
              MentalBridge.
            </Text>
          </>
        )}
      </View>
    </Screen>
  )
}

const styles = StyleSheet.create({
  page: { gap: spacing.lg },
  masthead: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 13,
    backgroundColor: '#123E32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandGlyph: { color: colors.white, fontSize: 19, fontWeight: '700' },
  brandCopy: { flex: 1, minWidth: 0 },
  brandName: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  brandTag: { color: colors.tealDeep, fontSize: 9, letterSpacing: 1 },
  headActions: { flexDirection: 'row', alignItems: 'center' },
  headAction: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headIcon: { color: colors.inkSoft, fontSize: 19 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#123E32',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: colors.white, fontSize: 12, fontWeight: '800' },
  bell: { alignItems: 'center' },
  bellTop: {
    width: 12,
    height: 12,
    borderWidth: 1.5,
    borderColor: colors.inkSoft,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
  },
  bellBase: {
    width: 16,
    height: 2,
    borderRadius: 2,
    backgroundColor: colors.inkSoft,
    marginTop: -1,
  },
  unread: {
    position: 'absolute',
    width: 7,
    height: 7,
    borderRadius: 4,
    right: -3,
    top: -3,
    backgroundColor: '#C74355',
  },
  breadcrumb: {
    marginTop: -spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  crumbTitle: { color: colors.ink, fontSize: 12 },
  privateBadge: {
    marginLeft: 'auto',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#EAF4EF',
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderRadius: radii.pill,
  },
  privateDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#267058',
  },
  privateText: { color: colors.tealDeep, fontSize: 10, fontWeight: '600' },
  back: { minHeight: 44, alignSelf: 'flex-start', justifyContent: 'center' },
  backText: { color: colors.tealDeep, fontWeight: '700', fontSize: 14 },
  hero: { gap: spacing.xs, paddingVertical: spacing.xs },
  eyebrow: {
    color: colors.tealDeep,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  title: {
    color: colors.ink,
    fontSize: 23,
    lineHeight: 30,
    fontWeight: '700',
  },
  heroCopy: { color: colors.inkSoft, fontSize: 13, lineHeight: 20 },
  filters: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radii.control,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: spacing.sm,
  },
  rangeLabel: {
    color: colors.inkSoft,
    fontSize: 11,
    paddingVertical: spacing.xs,
  },
  filterTitle: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  range: {
    flex: 1,
    minWidth: 176,
    flexDirection: 'row',
    gap: spacing.xs,
    borderRadius: radii.control,
  },
  rangeItem: {
    flex: 1,
    minHeight: 38,
    marginVertical: 3,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.control,
  },
  activeRange: { backgroundColor: '#123E32' },
  rangeText: {
    color: colors.inkSoft,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  activeText: { color: colors.white },
  kpis: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.sm,
  },
  kpi: {
    width: '49%',
    padding: spacing.md,
    gap: spacing.sm,
    minHeight: 126,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.panel,
  },
  kpiHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    minHeight: 31,
  },
  icon: {
    alignSelf: 'flex-start',
    minWidth: 28,
    textAlign: 'center',
    paddingVertical: 5,
    borderRadius: radii.control,
    overflow: 'hidden',
    color: colors.tealDeep,
    fontSize: 17,
  },
  kpiLabel: { flex: 1, color: colors.inkSoft, fontSize: 12, fontWeight: '500' },
  kpiValue: { color: colors.ink, fontSize: 25, fontWeight: '800' },
  kpiUnit: { color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
  muted: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  notice: {
    gap: spacing.sm,
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderRadius: radii.panel,
    padding: spacing.lg,
  },
  partial: { backgroundColor: '#FFF3DF' },
})
