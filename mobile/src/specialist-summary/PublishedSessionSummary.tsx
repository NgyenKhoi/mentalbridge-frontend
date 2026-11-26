import { StyleSheet, Text, View } from 'react-native'

import { colors, spacing } from '@/theme/tokens'

import type { SessionSummary } from './specialist-summary-contract'

const stepLabels = {
  CHECKLIST: 'Việc cần làm',
  JOURNAL: 'Nhật ký',
  EMOTION_CHECK_IN: 'Ghi nhận cảm xúc',
  REASSESSMENT: 'Sàng lọc lại',
  FOLLOW_UP_APPOINTMENT: 'Lịch hẹn tiếp theo',
  PLATFORM_RESOURCE: 'Tài nguyên hỗ trợ',
} as const

export function PublishedSessionSummary({
  summary,
  timezone,
}: {
  summary: SessionSummary
  timezone: string
}) {
  return (
    <View style={styles.card}>
      <View style={styles.meta}>
        <Text style={styles.copy}>Phiên bản {summary.version}</Text>
        <Text style={styles.copy}>
          {new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'medium',
            timeStyle: 'short',
            timeZone: timezone,
          }).format(new Date(summary.publishedAt))}
        </Text>
      </View>
      <Text style={styles.label}>Nội dung đã trao đổi</Text>
      <View style={styles.topics}>
        {summary.topicsDiscussed.map((topic, index) => (
          <Text key={index} style={styles.topic}>
            {topic}
          </Text>
        ))}
      </View>
      {summary.progressSummary && (
        <View style={styles.section}>
          <Text style={styles.label}>Điều đã ghi nhận trong phiên</Text>
          <Text style={styles.copy}>{summary.progressSummary}</Text>
        </View>
      )}
      {summary.specialistNoteForUser && (
        <View style={styles.section}>
          <Text style={styles.label}>Lời nhắn từ chuyên gia</Text>
          <Text style={styles.copy}>{summary.specialistNoteForUser}</Text>
        </View>
      )}
      {summary.agreedNextSteps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.label}>Các bước đã thống nhất</Text>
          {summary.agreedNextSteps.map((step) => (
            <View key={step.id} style={styles.step}>
              <Text style={styles.copy}>{stepLabels[step.type]}</Text>
              <Text style={styles.label}>{step.title}</Text>
              {step.details && <Text style={styles.copy}>{step.details}</Text>}
            </View>
          ))}
        </View>
      )}
      {summary.followUpSuggested && (
        <Text style={styles.copy}>
          Chuyên gia đề xuất một buổi trao đổi tiếp theo.
        </Text>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    padding: spacing.lg,
    gap: spacing.md,
  },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  topic: {
    backgroundColor: colors.tealPale,
    color: colors.tealDeep,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 13,
  },
  section: { gap: spacing.sm },
  step: {
    borderColor: colors.line,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    gap: spacing.xs,
  },
  label: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  copy: { color: colors.inkSoft, fontSize: 14, lineHeight: 22 },
})
