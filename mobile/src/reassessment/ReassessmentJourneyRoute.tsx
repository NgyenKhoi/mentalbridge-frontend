import { router, useFocusEffect } from 'expo-router'
import { useCallback, useRef, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { createJournalApi } from '@/journal/journal-api'
import { secureCredentialStore } from '@/security/credential-store'

import { createReassessmentApi } from './reassessment-api'
import { ReassessmentJourneyScreen } from './ReassessmentJourneyScreen'

function AccountReassessmentRoute({
  config,
  subject,
}: Readonly<{ config: RuntimeConfig; subject: string }>) {
  const [refreshToken, setRefreshToken] = useState(0)
  const focusedOnce = useRef(false)
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      api: createReassessmentApi(client),
      journalApi: createJournalApi(client, subject),
    }
  })

  useFocusEffect(
    useCallback(() => {
      // Initial loading belongs to the screen. Every later focus can follow a
      // completed assessment, so Care must revalidate the retained route.
      if (focusedOnce.current) setRefreshToken((value) => value + 1)
      else focusedOnce.current = true
    }, []),
  )

  return (
    <ReassessmentJourneyScreen
      {...binding}
      refreshToken={refreshToken}
      onScreening={() =>
        router.push({
          pathname: '/(user)/assessment',
          params: { purpose: 'REASSESSMENT', returnTo: 'reassessment' },
        })
      }
      onReturnToPlan={() => router.dismissTo('/(user)/support-plan')}
    />
  )
}

export function ReassessmentJourneyRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const subject = session?.subject ?? ''
  return (
    <AccountReassessmentRoute key={subject} config={config} subject={subject} />
  )
}
