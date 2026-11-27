import { useQuery } from '@tanstack/react-query'
import { useFocusEffect, useLocalSearchParams } from 'expo-router'
import { useCallback, useMemo } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { createSpecialistContinuityApi } from '@/specialist-continuity/specialist-continuity-api'
import {
  createSpecialistSummaryApi,
  getSpecialistSummaryPlanChange,
} from '@/specialist-summary/specialist-summary-api'

import { SpecialistClientsScreen } from './SpecialistClientsScreen'
import { createSpecialistApi } from './specialist-api'

export default function SpecialistClientsRoute() {
  const { session } = useSession()
  const config = useRuntimeConfig()
  const { appointmentId } = useLocalSearchParams<{ appointmentId?: string }>()
  const subject = session?.role === 'SPECIALIST' ? session.subject : ''
  const apis = useMemo(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      specialist: createSpecialistApi(client),
      continuity: createSpecialistContinuityApi(client),
      summary: {
        ...createSpecialistSummaryApi(client, subject),
        getPlanChange: (proposalId: string) =>
          getSpecialistSummaryPlanChange(client, proposalId),
      },
    }
  }, [config, subject])

  const continuity = useQuery({
    queryKey: ['specialist-clients', subject],
    queryFn: () => apis.continuity.list(),
    enabled: Boolean(subject),
    gcTime: 0,
    retry: false,
  })
  const profile = useQuery({
    queryKey: ['specialist-clients-masthead', subject],
    queryFn: () => apis.specialist.getProfile(),
    enabled: Boolean(subject),
    staleTime: 60_000,
    retry: false,
  })
  const { refetch } = continuity
  useFocusEffect(
    useCallback(() => {
      if (subject) void refetch({ cancelRefetch: false })
    }, [refetch, subject]),
  )

  return (
    <SpecialistClientsScreen
      key={[subject, appointmentId].join(':')}
      subject={subject}
      initialAppointmentId={appointmentId}
      data={continuity.isSuccess ? continuity.data : undefined}
      loading={continuity.isFetching}
      failed={continuity.isError}
      specialistName={profile.data?.displayName}
      continuityApi={apis.continuity}
      summaryApi={apis.summary}
      refresh={() => void refetch({ cancelRefetch: false })}
    />
  )
}
