import { useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { createJournalApi } from '@/journal/journal-api'
import { secureCredentialStore } from '@/security/credential-store'

import { AiCompanionScreen } from './AiCompanionScreen'
import { createCompanionApi } from './companion-api'

function AccountAiCompanion({ subject }: Readonly<{ subject: string }>) {
  const config = useRuntimeConfig()
  const [services] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      chat: createCompanionApi(client),
      consent: createJournalApi(client, subject),
    }
  })
  return (
    <AiCompanionScreen
      subject={subject}
      api={services.chat}
      consentApi={services.consent}
    />
  )
}

export default function AiCompanionRoute() {
  const { session } = useSession()
  return session?.role === 'USER' ? (
    <AccountAiCompanion key={session.subject} subject={session.subject} />
  ) : null
}
