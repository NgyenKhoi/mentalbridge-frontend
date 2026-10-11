import { useQuery } from '@tanstack/react-query'
import { randomUUID } from 'expo-crypto'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useState } from 'react'
import { Text, View } from 'react-native'
import { z } from 'zod'
import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { PrimaryButton } from '@/components/PrimaryButton'
import { Screen } from '@/components/Screen'
import type { RuntimeConfig } from '@/config/runtime-config'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { spacing, colors, typography } from '@/theme/tokens'
import { createChatApi, createChatAppointmentsApi } from './chat-api'
import type { ChatRole } from './chat-contract'
import { ChatSession } from './chat-session'
import { createChatSocketFactory } from './chat-socket'
import { ChatScreen } from './ChatScreen'

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
    enabled: !appointmentId,
    retry: false,
    staleTime: 0,
  })
  if (binding.chat)
    return (
      <ChatScreen
        session={binding.chat}
        subject={subject}
        onBack={() => router.back()}
      />
    )
  const items = !appointments.isError
    ? appointments.data?.items.filter((item) => item.modality === 'IN_APP_CHAT')
    : undefined
  return (
    <Screen>
      <View style={{ gap: spacing.lg }}>
        <PrimaryButton label="Về trang trước" onPress={() => router.back()} />
        <Text
          accessibilityRole="header"
          style={{ fontSize: typography.heading, color: colors.ink }}
        >
          Phiên trò chuyện
        </Text>
        <Text style={{ fontSize: typography.body, color: colors.ink }}>
          Mỗi cuộc trò chuyện gắn với một lịch tư vấn. Quyền tham gia sẽ được
          kiểm tra khi mở phiên.
        </Text>
        {appointments.isPending ? (
          <Text>Đang tải lịch hẹn…</Text>
        ) : appointments.isError ? (
          <>
            <Text>Chưa thể xác minh lịch hẹn của bạn.</Text>
            <PrimaryButton
              label="Tải lại lịch hẹn"
              onPress={() => void appointments.refetch()}
            />
          </>
        ) : items?.length === 0 ? (
          <Text>Chưa có lịch tư vấn qua trò chuyện.</Text>
        ) : (
          items?.map((item) => (
            <View key={item.id} style={{ gap: spacing.sm }}>
              <Text style={{ fontSize: typography.body, color: colors.ink }}>
                {item.specialistDisplayName} ·{' '}
                {new Intl.DateTimeFormat('vi-VN', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                  timeZone: item.timezone,
                }).format(new Date(item.scheduledStartAt))}
              </Text>
              <PrimaryButton
                label="Mở phiên trò chuyện"
                onPress={() =>
                  router.push({
                    pathname: './messages',
                    params: { appointmentId: item.id },
                  })
                }
              />
            </View>
          ))
        )}
      </View>
    </Screen>
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
