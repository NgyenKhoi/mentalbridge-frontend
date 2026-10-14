import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useEffect, useState } from 'react'
import { Alert } from 'react-native'

import { createApiClient } from '@/api/api-client'
import { useSession } from '@/auth/session-context'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import type { RuntimeConfig } from '@/config/runtime-config'
import { secureCredentialStore } from '@/security/credential-store'
import { createSupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import {
  parseJournalPlanOrigin,
  type JournalOriginInput,
  type JournalPlanOrigin,
} from '@/support-plan/journal-plan-context'

import { createJournalApi } from './journal-api'
import { JournalScreen } from './JournalScreen'
import type { JournalNavigationState } from './JournalEditor'

function AccountJournalRoute({
  config,
  subject,
  origin,
}: Readonly<{
  config: RuntimeConfig
  subject: string
  origin: JournalOriginInput
}>) {
  const navigation = useNavigation()
  const [guard, setGuard] = useState<JournalNavigationState>({
    dirty: false,
    busy: false,
    uncertain: false,
  })
  const [returnOrigin, setReturnOrigin] = useState<JournalPlanOrigin | null>(
    null,
  )
  usePreventRemove(
    !returnOrigin && (guard.dirty || guard.busy || guard.uncertain),
    ({ data }) => {
      if (guard.busy) {
        Alert.alert(
          'Đang lưu hoặc kiểm tra',
          'Vui lòng đợi thao tác hiện tại kết thúc trước khi rời nhật ký.',
        )
        return
      }
      Alert.alert(
        'Rời bài viết?',
        guard.uncertain
          ? 'Lần lưu chưa được xác nhận. Thử lưu lại cùng yêu cầu để kiểm tra; rời màn hình không có nghĩa là bài đã lưu.'
          : 'Phần chưa lưu sẽ mất khi rời màn hình.',
        [
          { text: 'Tiếp tục viết', style: 'cancel' },
          {
            text: 'Rời bài viết',
            style: 'destructive',
            onPress: () => navigation.dispatch(data.action),
          },
        ],
      )
    },
  )
  const [binding] = useState(() => {
    const client = createApiClient({
      config,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      client,
      api: createJournalApi(client, subject),
      planApi: createSupportPlanActionApi(client),
    }
  })
  useEffect(() => {
    if (returnOrigin)
      router.dismissTo({
        pathname: '/(user)/support-plan',
        params: returnOrigin,
      })
  }, [returnOrigin])
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
  }, [binding])
  return (
    <>
      <Stack.Screen options={{ gestureEnabled: false }} />
      <JournalScreen
        api={binding.api}
        planApi={binding.planApi}
        planOrigin={origin}
        onNavigationStateChange={setGuard}
        onReturnToPlan={setReturnOrigin}
        onBack={() => router.back()}
      />
    </>
  )
}

export function JournalRoute() {
  const config = useRuntimeConfig()
  const { session } = useSession()
  const params = useLocalSearchParams()
  const subject = session?.subject ?? ''
  return (
    <AccountJournalRoute
      key={subject}
      config={config}
      subject={subject}
      origin={parseJournalPlanOrigin(params)}
    />
  )
}
