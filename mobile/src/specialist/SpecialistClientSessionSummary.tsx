import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import { ApiError } from '@/api/api-error'
import type { SpecialistSummaryApi } from '@/specialist-summary/specialist-summary-api'
import type { SessionSummary } from '@/specialist-summary/specialist-summary-contract'
import type { PlanChangeRequest } from '@/support-plan/support-plan-contract'
import { colors, radii, spacing } from '@/theme/tokens'

import { visitDateTime } from './specialist-clients-model'

export type ClientSummaryApi = Pick<SpecialistSummaryApi, 'list'> & {
  getPlanChange(proposalId: string): Promise<PlanChangeRequest>
}

const stepLabels = {
  CHECKLIST: 'Việc cần làm',
  JOURNAL: 'Viết nhật ký',
  EMOTION_CHECK_IN: 'Ghi nhận cảm xúc',
  REASSESSMENT: 'Làm lại bài đánh giá',
  FOLLOW_UP_APPOINTMENT: 'Đặt lịch tiếp theo',
  PLATFORM_RESOURCE: 'Tài nguyên trên MentalBridge',
} as const

const reasonLabels = {
  POST_CONSULTATION_CONTINUITY: 'Tiếp nối nội dung sau buổi tư vấn',
  TRY_ALTERNATIVE_RESOURCE: 'Thử một tài nguyên phù hợp khác',
  ADDRESS_REPORTED_BARRIER: 'Hỗ trợ trở ngại đã trao đổi',
} as const

const statusLabels = {
  READY_FOR_REVIEW: 'Đang chờ thân chủ quyết định',
  ACCEPTED: 'Đã chấp nhận và cập nhật kế hoạch',
  REJECTED: 'Đã từ chối',
} as const

function ResourceProposal({
  api,
  subject,
  summary,
  proposalId,
}: {
  api: ClientSummaryApi
  subject: string
  summary: SessionSummary
  proposalId: string
}) {
  const query = useQuery({
    queryKey: [
      'specialist-client-plan-change',
      subject,
      summary.id,
      proposalId,
    ],
    queryFn: () => api.getPlanChange(proposalId),
    gcTime: 0,
    retry: false,
  })
  const request = query.data
  if (query.isPending)
    return <Text style={s.copy}>Đang kiểm tra trạng thái đề xuất…</Text>
  if (query.error instanceof ApiError && query.error.status === 404) {
    return <Text style={s.copy}>Đang chờ thân chủ mở và xem đề xuất.</Text>
  }
  if (
    query.isError ||
    !request ||
    request.sourceProposalId !== proposalId ||
    request.sourceAppointmentId !== summary.appointmentId ||
    request.sourceSummaryId !== summary.id
  ) {
    return (
      <Pressable
        accessibilityRole="button"
        style={s.action}
        onPress={() => void query.refetch()}
      >
        <Text style={s.label}>Chưa thể tải trạng thái đề xuất · Thử lại</Text>
      </Pressable>
    )
  }
  return (
    <View style={s.copyBlock}>
      <Text style={s.label}>{statusLabels[request.status]}</Text>
      <Text style={s.copy}>{reasonLabels[request.proposalReasonCode]}</Text>
      <Text style={s.copy}>
        Hiện tại · {request.currentResource?.title ?? 'Chưa có tài nguyên'}
      </Text>
      <Text style={s.copy}>
        Được đề xuất · {request.proposedResource.title}
      </Text>
    </View>
  )
}

function PublishedSummary({
  summary,
  api,
  subject,
  showSteps = false,
}: {
  summary: SessionSummary
  api: ClientSummaryApi
  subject: string
  showSteps?: boolean
}) {
  return (
    <View style={s.inset}>
      <Text style={s.label}>
        Phiên bản {summary.version} · {visitDateTime(summary.publishedAt)}
      </Text>
      <View style={s.copyBlock}>
        <Text style={s.label}>Nội dung đã trao đổi</Text>
        {summary.topicsDiscussed.map((topic, index) => (
          <Text key={index} style={s.copy}>
            • {topic}
          </Text>
        ))}
      </View>
      {summary.progressSummary ? (
        <View style={s.copyBlock}>
          <Text style={s.label}>Điều đã ghi nhận trong phiên</Text>
          <Text style={s.copy}>{summary.progressSummary}</Text>
        </View>
      ) : null}
      {summary.specialistNoteForUser ? (
        <View style={s.copyBlock}>
          <Text style={s.label}>Lời nhắn từ chuyên gia</Text>
          <Text style={s.copy}>{summary.specialistNoteForUser}</Text>
        </View>
      ) : null}
      {summary.followUpSuggested ? (
        <Text style={s.copy}>Đề xuất một buổi trao đổi tiếp theo.</Text>
      ) : null}
      {showSteps && summary.agreedNextSteps.length > 0 ? (
        <View style={s.group}>
          <Text style={s.label}>Các bước đã thống nhất</Text>
          {summary.agreedNextSteps.map((step) => (
            <View key={step.id} style={s.step}>
              <Text style={s.copy}>{stepLabels[step.type]}</Text>
              <Text style={s.label}>{step.title}</Text>
              {step.details ? <Text style={s.copy}>{step.details}</Text> : null}
              {step.hidden ? (
                <Text style={s.copy}>Đã ẩn khỏi danh sách của thân chủ</Text>
              ) : null}
              {step.type === 'PLATFORM_RESOURCE' ? (
                <ResourceProposal
                  api={api}
                  summary={summary}
                  subject={subject}
                  proposalId={step.id}
                />
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

export function SpecialistClientSessionSummary({
  appointmentId,
  appointmentVersion,
  api,
  subject,
  onOpenAppointment,
}: {
  appointmentId: string
  appointmentVersion: number
  api: ClientSummaryApi
  subject: string
  onOpenAppointment: () => void
}) {
  const [historyOpen, setHistoryOpen] = useState(false)
  const summaries = useQuery({
    queryKey: [
      'specialist-client-summary',
      subject,
      appointmentId,
      appointmentVersion,
    ],
    queryFn: () => api.list(appointmentId),
    gcTime: 0,
    retry: false,
  })

  if (summaries.isFetching)
    return (
      <ActivityIndicator
        accessibilityLabel="Đang tải tổng kết"
        color={colors.tealDeep}
      />
    )
  if (summaries.isError) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() => void summaries.refetch()}
        style={s.action}
      >
        <Text style={s.label}>Chưa thể tải tổng kết · Thử lại</Text>
      </Pressable>
    )
  }

  const [latest, ...previous] = summaries.data?.items ?? []
  return (
    <View style={s.group}>
      {latest ? (
        <>
          <Text style={s.label}>Bản tổng hợp đã xuất bản</Text>
          <PublishedSummary
            summary={latest}
            api={api}
            subject={subject}
            showSteps
          />
        </>
      ) : (
        <Text style={s.copy}>Chưa có bản tổng hợp sau tư vấn.</Text>
      )}
      {previous.length > 0 ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: historyOpen }}
            style={s.action}
            onPress={() => setHistoryOpen((open) => !open)}
          >
            <Text style={s.label}>
              {historyOpen
                ? 'Ẩn phiên bản trước'
                : ['Xem', previous.length, 'phiên bản trước'].join(' ')}
            </Text>
          </Pressable>
          {historyOpen
            ? previous.map((summary) => (
                <PublishedSummary
                  key={summary.id}
                  summary={summary}
                  api={api}
                  subject={subject}
                />
              ))
            : null}
        </>
      ) : null}
      <Pressable
        accessibilityRole="button"
        style={s.action}
        onPress={onOpenAppointment}
      >
        <Text style={s.label}>
          Mở lịch hẹn để {latest ? 'đính chính tổng kết' : 'tạo tổng kết'} →
        </Text>
      </Pressable>
    </View>
  )
}

const s = StyleSheet.create({
  group: { gap: spacing.md },
  copyBlock: { gap: spacing.xs },
  label: { color: colors.tealDeep, fontSize: 14, fontWeight: '700' },
  copy: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  inset: {
    gap: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
  },
  step: {
    gap: spacing.xs,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.control,
  },
  action: {
    minHeight: 48,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surfaceSoft,
    borderRadius: radii.control,
  },
})
