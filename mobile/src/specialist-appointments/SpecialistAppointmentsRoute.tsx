import { useMemo } from 'react'

import { createApiClient } from '@/api/api-client'
import { createAppointmentDisputeApi } from '@/appointment-dispute/appointment-dispute-api'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { createSpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import { createSpecialistSummaryApi } from '@/specialist-summary/specialist-summary-api'

import { createSpecialistAppointmentApi } from './specialist-appointment-api'
import { SpecialistAppointmentsScreen } from './SpecialistAppointmentsScreen'

export function SpecialistAppointmentsRoute() {
  const runtimeConfig = useRuntimeConfig()
  const { session } = useSession()
  const apis = useMemo(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      appointment: createSpecialistAppointmentApi(client),
      continuity: createSpecialistContinuityApi(client),
      summary: createSpecialistSummaryApi(client, session?.subject ?? ''),
      dispute: createAppointmentDisputeApi(client, 'SPECIALIST'),
    }
  }, [runtimeConfig, session?.subject])

  return (
    <SpecialistAppointmentsScreen
      api={apis.appointment}
      continuityApi={apis.continuity}
      summaryApi={apis.summary}
      disputeApi={apis.dispute}
    />
  )
}
