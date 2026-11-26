import { useState, type ReactNode } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import { AppIcon, type AppIconName } from '@/components/AppIcon'
import { colors, radii, spacing } from '@/theme/tokens'
import type { ReassessmentSummary } from './reassessment-contract'

const stateLabels = {
  AVAILABLE: 'Có dữ liệu',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
  UNAVAILABLE: 'Chưa khả dụng',
} as const
const directionLabels = {
  INCREASED: 'Tăng',
  DECREASED: 'Giảm',
  UNCHANGED: 'Không đổi',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
} as const
const journalDirections: Record<string, string> = {
  MORE_FREQUENT: 'Xuất hiện nhiều hơn',
  LESS_FREQUENT: 'Xuất hiện ít hơn',
  SIMILAR: 'Tương tự trước',
  INSUFFICIENT_DATA: 'Chưa đủ dữ liệu',
}
const signalLabels: Record<string, string> = {
  stress: 'Căng thẳng',
  sleep: 'Giấc ngủ',
  anxiety: 'Lo âu',
  mood: 'Tâm trạng',
  energy: 'Năng lượng',
  work: 'Công việc',
  social_connection: 'Kết nối với mọi người',
}

function journalReason(reason: string | null) {
  if (reason === 'ENTITLEMENT_UNAVAILABLE')
    return 'Chưa kiểm tra được quyền lợi gói để đọc bối cảnh nhật ký.'
  if (reason === 'ENTITLEMENT_CHANGED')
    return 'Quyền lợi gói đã thay đổi nên bối cảnh nhật ký chưa khả dụng.'
  if (reason === 'CONSENT_REQUIRED' || reason === 'CONSENT_REVOKED')
    return 'Chưa có quyền phân tích nhật ký cho bước này.'
  if (
    reason === 'CONSENT_UNAVAILABLE' ||
    reason === 'AUTHORIZATION_CONTEXT_LOST'
  )
    return 'Chưa xác nhận được quyền truy cập nhật ký.'
  if (reason === 'SOURCE_DELETED' || reason === 'SOURCE_NOT_FOUND')
    return 'Chưa có nguồn nhật ký để đối chiếu.'
  if (reason === 'SOURCE_REVISION_CHANGED')
    return 'Nội dung nhật ký đã thay đổi. Hãy cập nhật bản tổng hợp khi sẵn sàng.'
  return 'Chưa tải được bối cảnh nhật ký. Các góc nhìn khác vẫn được giữ riêng.'
}

function Details({
  title,
  children,
}: Readonly<{ title: string; children: ReactNode }>) {
  const [expanded, setExpanded] = useState(false)
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={title}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded(!expanded)}
        style={styles.detailsTrigger}
      >
        <Text style={styles.link}>{title}</Text>
        <View
          style={{ transform: [{ rotate: expanded ? '-90deg' : '90deg' }] }}
        >
          <AppIcon name="chevron" size={15} />
        </View>
      </Pressable>
      {expanded && <View style={styles.details}>{children}</View>}
    </View>
  )
}

function Dimension({
  title,
  icon,
  state,
  children,
}: Readonly<{
  title: string
  icon: AppIconName
  state: keyof typeof stateLabels
  children: ReactNode
}>) {
  return (
    <View style={styles.dimension}>
      <View style={styles.heading}>
        <View style={styles.icon}>
          <AppIcon name={icon} size={19} />
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.state}>{stateLabels[state]}</Text>
      </View>
      <View style={styles.content}>{children}</View>
    </View>
  )
}

export function ReassessmentSummaryPanel({
  summary,
}: Readonly<{ summary: ReassessmentSummary }>) {
  const selfReport = summary.selfReportedExperience
  const experience = {
    BETTER: 'Dễ chịu hơn trước',
    ABOUT_THE_SAME: 'Gần như không thay đổi',
    MORE_DIFFICULT: 'Khó khăn hơn trước',
    UNSURE: 'Tôi chưa chắc',
  } as const
  return (
    <View accessibilityLabel="Bốn chiều đánh giá lại" style={styles.panel}>
      <Text accessibilityRole="header" style={styles.panelTitle}>
        Bốn góc nhìn riêng biệt
      </Text>
      <Text style={styles.caption}>
        Xem từng nguồn để chọn bước tiếp theo phù hợp.
      </Text>
      <View style={styles.card}>
        <Dimension
          title="Sàng lọc"
          icon="clipboard"
          state={summary.screening.state}
        >
          <View style={styles.scores}>
            {summary.screening.trends.map((trend) => (
              <View key={trend.instrument} style={styles.score}>
                <Text style={styles.caption}>
                  {trend.instrument === 'PHQ9' ? 'PHQ-9' : 'GAD-7'}
                </Text>
                <Text selectable style={styles.scoreValue}>
                  {trend.current.totalScore}{' '}
                  <Text style={styles.caption}>điểm</Text>
                </Text>
                <Text style={styles.caption}>
                  {trend.state !== 'AVAILABLE'
                    ? 'Chưa có kết quả tương thích để so sánh'
                    : `${directionLabels[trend.direction]}${trend.rawDelta !== null && trend.rawDelta !== 0 ? ` ${Math.abs(trend.rawDelta)} điểm` : ''}`}
                </Text>
              </View>
            ))}
          </View>
        </Dimension>
        <Dimension
          title="Nhật ký"
          icon="book"
          state={summary.journalContext.state}
        >
          {summary.journalContext.state !== 'AVAILABLE' ? (
            <Text style={styles.caption}>
              {summary.journalContext.state === 'INSUFFICIENT_DATA'
                ? 'Chưa đủ nhật ký ở hai giai đoạn để đối chiếu.'
                : journalReason(summary.journalContext.unavailableReason)}
            </Text>
          ) : (
            <Details title="Xem bối cảnh nhật ký">
              {summary.journalContext.changesComparedWithPreviousPeriod
                .length === 0 ? (
                <Text style={styles.caption}>
                  Không có thay đổi được ghi nhận trong nguồn này.
                </Text>
              ) : (
                summary.journalContext.changesComparedWithPreviousPeriod.map(
                  (change, index) => (
                    <Text key={index} selectable style={styles.copy}>
                      {signalLabels[change.signal.toLowerCase()] ??
                        (/[_A-Z]{2,}/.test(change.signal)
                          ? 'Ghi nhận từ nhật ký'
                          : change.signal)}
                      :{' '}
                      {journalDirections[change.direction] ??
                        'Chưa hiển thị được thay đổi này'}
                    </Text>
                  ),
                )
              )}
            </Details>
          )}
        </Dimension>
        <Dimension
          title="Thực hiện kế hoạch"
          icon="calendar"
          state={summary.supportPlanEngagement.state}
        >
          <View style={styles.tableRow}>
            <Text style={[styles.caption, styles.tableLabel]}>Giai đoạn</Text>
            <Text style={styles.tableHeader}>Hoàn thành</Text>
            <Text style={styles.tableHeader}>Bỏ qua</Text>
          </View>
          {(
            [
              ['Trước', summary.supportPlanEngagement.previousPeriod],
              ['Hiện tại', summary.supportPlanEngagement.currentPeriod],
            ] as const
          ).map(([label, period]) => (
            <View key={label} style={styles.tableRow}>
              <Text style={[styles.caption, styles.tableLabel]}>{label}</Text>
              <Text selectable style={styles.count}>
                {period.completedCount}
              </Text>
              <Text selectable style={styles.count}>
                {period.skippedCount}
              </Text>
            </View>
          ))}
        </Dimension>
        <Dimension
          title="Cảm nhận của bạn"
          icon="chat"
          state={selfReport?.state ?? 'INSUFFICIENT_DATA'}
        >
          {selfReport?.state === 'AVAILABLE' && selfReport.source ? (
            <>
              <Text selectable style={styles.copy}>
                {experience[selfReport.source.currentExperience]}
              </Text>
              <Details title="Xem chia sẻ & phản hồi">
                {selfReport.source.helpfulContext && (
                  <Text selectable style={styles.copy}>
                    Điều giúp ích: {selfReport.source.helpfulContext}
                  </Text>
                )}
                {selfReport.source.difficultContext && (
                  <Text selectable style={styles.copy}>
                    Điều khó khăn: {selfReport.source.difficultContext}
                  </Text>
                )}
                <Text style={styles.caption}>
                  Nguồn hỗ trợ ·{' '}
                  {summary.activityReflection?.sources.length ?? 0} phản hồi
                  hoạt động. Câu trả lời trực tiếp của bạn là nguồn chính.
                </Text>
              </Details>
            </>
          ) : (
            <Text style={styles.caption}>
              Chưa có câu trả lời trực tiếp trong bản tổng hợp này.
            </Text>
          )}
        </Dimension>
      </View>
      <Text style={styles.caption}>
        Bốn góc nhìn được giữ riêng, không gộp thành điểm số, chẩn đoán hay kết
        luận tổng thể.
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: { gap: spacing.sm },
  panelTitle: { color: colors.ink, fontSize: 18, fontWeight: '700' },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radii.shell,
    overflow: 'hidden',
  },
  dimension: {
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    gap: spacing.sm,
  },
  heading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  icon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: '700',
    flexGrow: 1,
    flexShrink: 1,
  },
  state: { color: colors.inkSoft, fontSize: 11 },
  content: { gap: spacing.sm },
  caption: { color: colors.inkSoft, fontSize: 13, lineHeight: 19 },
  copy: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  scores: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  score: {
    flex: 1,
    minWidth: 110,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
    padding: spacing.md,
    gap: spacing.xs,
  },
  scoreValue: {
    color: colors.tealDeep,
    fontSize: 24,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  detailsTrigger: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  link: { color: colors.tealDeep, fontSize: 13, fontWeight: '600', flex: 1 },
  details: { gap: spacing.sm },
  tableRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tableLabel: { flex: 1 },
  tableHeader: {
    flex: 1,
    textAlign: 'right',
    color: colors.inkSoft,
    fontSize: 12,
  },
  count: {
    flex: 1,
    textAlign: 'right',
    color: colors.ink,
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
})
