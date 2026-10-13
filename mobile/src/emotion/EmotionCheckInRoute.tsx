import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { router, useLocalSearchParams } from 'expo-router'
import { Text, ActivityIndicator } from 'react-native'

import { createApiClient } from '@/api/api-client'
import { useRuntimeConfig } from '@/config/runtime-config-context'
import { secureCredentialStore } from '@/security/credential-store'
import { useSession } from '@/auth/session-context'
import { Screen } from '@/components/Screen'
import { PrimaryButton } from '@/components/PrimaryButton'
import { colors, typography } from '@/theme/tokens'
import { createSupportPlanActionApi } from '@/support-plan/support-plan-action-api'
import {
  parseEmotionPlanOrigin,
  resolveEmotionPlanOrigin,
} from '@/support-plan/emotion-plan-context'

import { createEmotionApi } from './emotion-api'
import { EmotionCheckInScreen } from './EmotionCheckInScreen'

export function EmotionCheckInRoute() {
  const runtimeConfig = useRuntimeConfig()
  const { session } = useSession()
  const params = useLocalSearchParams<{
    occurrenceId?: string
    actionId?: string
  }>()
  const origin = parseEmotionPlanOrigin(params.occurrenceId, params.actionId)
  const [services] = useState(() => {
    const client = createApiClient({
      config: runtimeConfig,
      getBearerToken: () => secureCredentialStore.getAccessToken(),
    })
    return {
      emotion: createEmotionApi(client),
      plan: createSupportPlanActionApi(client),
    }
  })
  const context = useQuery({
    queryKey: [
      'support-plan-v3',
      session?.subject,
      'emotion-origin',
      params.occurrenceId,
      params.actionId,
    ],
    enabled: Boolean(session?.subject && origin.state === 'valid'),
    retry: false,
    refetchOnMount: 'always',
    queryFn: () =>
      origin.state === 'valid'
        ? resolveEmotionPlanOrigin(services.plan, origin.value, new Date())
        : Promise.resolve(null),
  })
  const returnToPlan = () =>
    router.push({
      pathname: '/(user)/support-plan',
      params: origin.state === 'valid' ? origin.value : {},
    })
  if (origin.state !== 'none') {
    if (origin.state === 'valid' && context.isPending && session)
      return (
        <Screen>
          <Text
            accessibilityRole="header"
            style={{ fontSize: typography.heading, color: colors.ink }}
          >
            Ghi nhận cảm xúc
          </Text>
          <ActivityIndicator
            accessibilityLabel="Đang kiểm tra hoạt động vừa mở"
            color={colors.tealDeep}
          />
        </Screen>
      )
    if (
      origin.state === 'invalid' ||
      context.isError ||
      !context.data ||
      !context.data.isToday
    )
      return (
        <Screen>
          <Text
            accessibilityRole="header"
            style={{ fontSize: typography.heading, color: colors.ink }}
          >
            Ghi nhận cảm xúc
          </Text>
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontSize: typography.body,
              lineHeight: typography.bodyLineHeight,
              color: colors.inkSoft,
            }}
          >
            {context.isError
              ? 'Chưa thể xác nhận hoạt động vừa mở. Dữ liệu cảm xúc và kế hoạch chưa bị thay đổi.'
              : context.data && !context.data.isToday
                ? 'Hoạt động này không thuộc hôm nay. Không thể tạo ghi nhận cho ngày khác từ màn hình hôm nay; quay lại để kiểm tra ghi nhận đã có.'
                : 'Không xác định được hoạt động vừa mở. Quay lại kế hoạch hiện tại để tiếp tục.'}
          </Text>
          {context.isError ? (
            <PrimaryButton
              label="Thử tải lại hoạt động"
              onPress={() => void context.refetch()}
            />
          ) : null}
          <PrimaryButton label="Quay lại kế hoạch" onPress={returnToPlan} />
        </Screen>
      )
    return (
      <EmotionCheckInScreen
        key={`${session?.subject}:${context.data.origin.occurrenceId}:${context.data.origin.actionId}:${context.data.occurrence.localDate}:${context.data.timezone}`}
        api={services.emotion}
        timezone={context.data.timezone}
        planOrigin={context.data}
        onReturnToPlan={returnToPlan}
      />
    )
  }

  return (
    <EmotionCheckInScreen
      key={`${session?.subject}:standalone`}
      api={services.emotion}
    />
  )
}
