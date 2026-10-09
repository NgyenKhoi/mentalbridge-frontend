import { useLocalSearchParams } from 'expo-router'
import { useMemo } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { createSpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import { createSpecialistSummaryApi } from '@/specialist-summary/specialist-summary-api'

import { createSpecialistAppointmentApi } from './specialist-appointment-api'
import { SpecialistAppointmentDetailScreen } from './SpecialistAppointmentDetailScreen'
import { pendingSharedChatHandoff } from './specialist-chat-handoff'

export function SpecialistAppointmentDetailRoute() {
  const runtimeConfig = useRuntimeConfig()
  const { session } = useSession()
  const { appointmentId } = useLocalSearchParams<{ appointmentId: string }>()
  const specialistAccountId =
    session?.role === 'SPECIALIST' ? session.subject : ''
  const apis = useMemo(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      appointment: createSpecialistAppointmentApi(client),
      continuity: createSpecialistContinuityApi(client),
      summary: createSpecialistSummaryApi(client, specialistAccountId),
    }
  }, [runtimeConfig, specialistAccountId])

  return (
    <SpecialistAppointmentDetailScreen
      appointmentApi={apis.appointment}
      appointmentId={appointmentId}
      chatHandoff={pendingSharedChatHandoff}
      continuityApi={apis.continuity}
      summaryApi={apis.summary}
    />
  )
}
