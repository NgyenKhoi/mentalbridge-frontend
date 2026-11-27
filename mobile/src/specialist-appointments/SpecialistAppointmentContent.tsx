import { useState } from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'

import type { AppointmentDisputeApi } from '@/appointment-dispute/appointment-dispute-api'
import { AppointmentDisputePanel } from '@/appointment-dispute/AppointmentDisputePanel'
import type { SpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import { SpecialistContinuityPanel } from '@/specialist-continuity/SpecialistContinuityPanel'
import type { SpecialistSummaryApi } from '@/specialist-summary/specialist-summary-api'
import { SpecialistSummaryPanel } from '@/specialist-summary/SpecialistSummaryPanel'
import { colors, spacing } from '@/theme/tokens'

import type { SpecialistAppointment } from './specialist-appointment-contract'
import { canPublishSummary } from './specialist-appointment-model'

export type SpecialistAppointmentContentApis = {
  continuityApi?: SpecialistContinuityApi | undefined
  summaryApi?: SpecialistSummaryApi | undefined
  disputeApi?: AppointmentDisputeApi | undefined
}

export function SpecialistAppointmentContent({
  appointment,
  subject,
  serverNow,
  authorityConfirmed,
  refreshAuthority,
  continuityApi,
  summaryApi,
  disputeApi,
}: SpecialistAppointmentContentApis & {
  appointment: SpecialistAppointment
  subject: string
  serverNow: string
  authorityConfirmed: boolean
  refreshAuthority: () => Promise<boolean>
}) {
  const [briefOpen, setBriefOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  if (!authorityConfirmed) return null

  const ongoing = ['CONFIRMED', 'IN_PROGRESS'].includes(appointment.status)
  return (
    <View style={styles.content}>
      {ongoing && continuityApi && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: briefOpen }}
            onPress={() => setBriefOpen((open) => !open)}
            style={styles.toggle}
          >
            <Text style={styles.label}>
              {briefOpen ? 'Thu gọn tóm tắt chuẩn bị' : 'Xem tóm tắt chuẩn bị'}
            </Text>
          </Pressable>
          {briefOpen && (
            <SpecialistContinuityPanel
              api={continuityApi}
              appointmentId={appointment.id}
              appointmentVersion={appointment.version}
              compact
            />
          )}
        </>
      )}
      {canPublishSummary(appointment) && summaryApi && (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: summaryOpen }}
            onPress={() => setSummaryOpen((open) => !open)}
            style={styles.toggle}
          >
            <Text style={styles.label}>Tóm tắt sau phiên</Text>
            <Text style={styles.copy}>Xuất bản nội dung đã thống nhất</Text>
          </Pressable>
          {summaryOpen && (
            <SpecialistSummaryPanel
              api={summaryApi}
              appointmentId={appointment.id}
              appointmentAuthorityConfirmed={authorityConfirmed}
              refreshAppointmentAuthority={refreshAuthority}
              timezone={appointment.timezone}
            />
          )}
        </>
      )}
      {disputeApi &&
        appointment.sessionSettledAt &&
        ['SESSION_ENDED', 'COMPLETED'].includes(appointment.status) && (
          <AppointmentDisputePanel
            api={disputeApi}
            appointment={appointment}
            serverNow={serverNow}
            subject={subject}
          />
        )}
    </View>
  )
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  toggle: {
    minHeight: 48,
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: 14,
    backgroundColor: colors.surfaceSoft,
  },
  label: { color: colors.tealDeep, fontSize: 14, fontWeight: '700' },
  copy: { color: colors.inkSoft, fontSize: 13 },
})
