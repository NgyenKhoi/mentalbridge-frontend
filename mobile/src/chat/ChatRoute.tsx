import { useQuery } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text } from 'react-native'
import { z } from 'zod'
import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { createDiscoveryApi } from '@/discovery/discovery-api'
import { supportAreaLabels } from '@/discovery/discovery-model'
import { createChatApi, createChatAppointmentsApi } from './chat-api'
import type { ChatRole } from './chat-contract'
import { ChatSession } from './chat-session'
import { createChatSocketFactory } from './chat-socket'
import { ChatScreen } from './ChatScreen'
import { ChatInbox } from './ChatInbox'

function AccountChat({
  config,
  subject,
  role,
  appointmentId,
}: Readonly<{
  config: RuntimeConfig
  subject: string
  role: ChatRole
  appointmentId: string | null
}>) {
  const [binding] = useState(() => {
    const controller = new AbortController()
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    const interceptor = client.interceptors.request.use((request) => {
      request.signal = controller.signal
      return request
    })
    return {
      client,
      controller,
      interceptor,
      appointments: createChatAppointmentsApi(client, subject, role),
      discovery: createDiscoveryApi(client),
      chat: appointmentId
        ? new ChatSession({
            api: createChatApi(client, subject, role, appointmentId),
            factory: createChatSocketFactory(config.apiBaseUrl),
            subject,
            role,
            appointmentId,
            uuid: randomUUID,
          })
        : null,
    }
  })
  useEffect(
    () => () => {
      binding.chat?.stop()
      binding.controller.abort()
      binding.client.interceptors.request.eject(binding.interceptor)
    },
    [binding],
  )
  const appointments = useQuery({
    queryKey: ['chat-appointments', subject, role],
    queryFn: () => binding.appointments.list(),
    retry: false,
    staleTime: 0,
  })
  const selected = !appointments.isError
    ? appointments.data?.items.find((item) => item.id === appointmentId)
    : undefined
  const specialist = useQuery({
    queryKey: ['chat-specialist', subject, selected?.specialistAccountId],
    enabled: role === 'USER' && Boolean(selected),
    retry: false,
    queryFn: () => binding.discovery.detail(selected!.specialistAccountId, {}),
  })
  if (binding.chat)
    return (
      <ChatScreen
        session={binding.chat}
        subject={subject}
        onBack={() => router.back()}
        counterpartName={
          role === 'USER'
            ? (selected?.specialistDisplayName ?? 'Chuyên gia')
            : 'Người tham gia'
        }
        {...(selected ? { appointment: selected } : {})}
        {...(specialist.data
          ? {
              specialty: specialist.data.supportAreas
                .map((area) => supportAreaLabels[area])
                .join(' · '),
            }
          : {})}
        onViewAppointment={() =>
          router.push({
            pathname: './appointments',
            params: { appointmentId: appointmentId! },
          })
        }
        {...(role === 'USER'
          ? {
              onViewSummary: () =>
                router.push({
                  pathname: '/(user)/appointments',
                  params: { appointmentId: appointmentId! },
                }),
              onBook: () => router.push('/(user)/specialists'),
            }
          : {})}
      />
    )
  return (
    <ChatInbox
      items={appointments.isError ? [] : (appointments.data?.items ?? [])}
      loading={appointments.isPending}
      failed={appointments.isError}
      role={role}
      onBack={() => router.back()}
      onRetry={() => {
        void appointments.refetch()
      }}
      onOpen={(id) =>
        router.push({ pathname: './messages', params: { appointmentId: id } })
      }
    />
  )
}
export function ChatRoute() {
  const config = useRuntimeConfig()
  const { session, status } = useSession()
  const params = useLocalSearchParams<{ appointmentId?: string }>()
  const role = session?.role
  const parsed =
    params.appointmentId === undefined
      ? null
      : z.uuid().safeParse(params.appointmentId)
  if (status !== 'authenticated' || !session || !role)
    return (
      <Screen>
        <Text>
          Vui lòng đăng nhập bằng tài khoản được phân công trong lịch hẹn.
        </Text>
      </Screen>
    )
  if (parsed && !parsed.success)
    return (
      <Screen>
        <Text>Liên kết lịch hẹn không hợp lệ.</Text>
        <PrimaryButton label="Về trang trước" onPress={() => router.back()} />
      </Screen>
    )
  const appointmentId = parsed?.success ? parsed.data : null
  return (
    <AccountChat
      key={`${session.subject}:${role}:${appointmentId ?? 'list'}`}
      config={config}
      subject={session.subject}
      role={role}
      appointmentId={appointmentId}
    />
  )
}
