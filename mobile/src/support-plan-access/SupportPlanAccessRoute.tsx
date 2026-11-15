import NetInfo from '@react-native-community/netinfo'
import { useEffect, useState } from 'react'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'

import {
  SupportPlanAccessGate,
  type SupportPlanAccessGateProps,
} from './SupportPlanAccessGate'
import { createSupportPlanAccessApi } from './support-plan-access-api'

type RouteBoundaryProps = Omit<
  SupportPlanAccessGateProps,
  'api' | 'offline' | 'subject'
>

function AccountSupportPlanAccessBoundary({
  config,
  subject,
  ...gateProps
}: Readonly<RouteBoundaryProps & { config: RuntimeConfig; subject: string }>) {
  const [offline, setOffline] = useState(false)
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createSupportPlanAccessApi(client, subject),
    }
  })

  useEffect(() => {
    const controller = new AbortController()
    const interceptor = binding.client.interceptors.request.use((request) => {
      request.signal = controller.signal
      return request
    })
    return () => {
      controller.abort()
      binding.client.interceptors.request.eject(interceptor)
    }
  }, [binding.client])

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setOffline(state.isConnected === false)
    })
    return () => unsubscribe()
  }, [])

  return (
    <SupportPlanAccessGate
      {...gateProps}
      api={binding.api}
      offline={offline}
      subject={subject}
    />
  )
}

/**
 * Runtime-bound wrapper ready for post-MB-701/MB-702 route mounting inside `app/(user)/`.
 * Fails closed whenever `session` is missing or not a `USER` session.
 */
export function SupportPlanAccessRoute(props: RouteBoundaryProps) {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const userSubject = session?.role === 'USER' ? session.subject : null

  if (!userSubject) {
    return (
      <SupportPlanAccessGate
        {...props}
        api={null}
        offline={false}
        subject={null}
      />
    )
  }

  return (
    <AccountSupportPlanAccessBoundary
      key={userSubject}
      config={config}
      subject={userSubject}
      {...props}
    />
  )
}
