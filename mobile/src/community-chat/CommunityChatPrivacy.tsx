import { useQuery } from '@tanstack/react-query'
import { useState, type ReactNode } from 'react'
import { StyleSheet, Switch, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import {
  ChoiceRow,
  CommunityButton,
  CommunityHeader,
  CommunityMessage,
  IconButton,
  Reveal,
  SkeletonGroup,
  SkeletonRow,
  communityStyles,
  communityText,
  useCommunityAction,
} from '@/community/community-ui'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'
import { communityColors } from '@/community/community-theme'
import type { CommunityChatApi } from './community-chat-api'
import type { ChatPrivacy, Versioned } from './community-chat-contract'
import {
  ChatBanner,
  ChatFrame,
  ChatUnavailable,
  chatInput,
} from './community-chat-ui'

function SwitchRow({
  label,
  accessibilityLabel,
  value,
  disabled,
  change,
}: Readonly<{
  label: string
  accessibilityLabel: string
  value: boolean
  disabled: boolean
  change: (value: boolean) => void
}>) {
  // The whole row is the switch for assistive tech; the native Switch stays tappable but is hidden from them.
  return (
    <PressableScale
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      scaleTo={0.98}
      onPress={() => change(!value)}
      style={[styles.switchRow, disabled && communityStyles.disabled]}
    >
      <Txt style={[communityText.body, styles.switchLabel]}>{label}</Txt>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Switch
          accessible={false}
          trackColor={{
            false: communityColors.line,
            true: communityColors.primaryDeep,
          }}
          thumbColor={communityColors.white}
          disabled={disabled}
          value={value}
          onValueChange={change}
        />
      </View>
    </PressableScale>
  )
}

function PrivacyEditor({
  api,
  initial,
  header,
  saved,
  onSaved,
}: Readonly<{
  api: CommunityChatApi
  initial: Versioned<{ version: string; preferences: ChatPrivacy }>
  header: ReactNode
  saved: boolean
  onSaved: () => Promise<unknown>
}>) {
  const [draft, setDraft] = useState(initial.value.preferences)
  const action = useCommunityAction()
  return (
    <ChatFrame
      header={header}
      footer={
        <View style={styles.footer}>
          {action.error && <CommunityMessage>{action.error}</CommunityMessage>}
          <CommunityButton
            variant="primary"
            label="Lưu quyền riêng tư"
            disabled={action.busy}
            onPress={() =>
              void action.run(async () => {
                await api.savePrivacy(draft, initial.etag)
                await onSaved()
              })
            }
          />
        </View>
      }
    >
      {saved && (
        <ChatBanner icon="check-circle-outline">
          Đã lưu quyền riêng tư trò chuyện.
        </ChatBanner>
      )}
      <Reveal step={1} style={chatInput.card}>
        <Txt accessibilityRole="header" style={communityText.section}>
          Ai có thể bắt đầu trò chuyện?
        </Txt>
        {(
          [
            { value: 'APPROVAL_REQUIRED', label: 'Cần tôi chấp nhận' },
            { value: 'ANYONE', label: 'Cho phép nhắn trực tiếp' },
          ] as const
        ).map((option) => (
          <ChoiceRow
            key={option.value}
            label={option.label}
            selected={draft.directMessagePolicy === option.value}
            disabled={action.busy}
            onPress={() =>
              setDraft({ ...draft, directMessagePolicy: option.value })
            }
          />
        ))}
      </Reveal>
      <Reveal step={2} style={chatInput.card}>
        <Txt accessibilityRole="header" style={communityText.section}>
          Trạng thái hoạt động
        </Txt>
        <SwitchRow
          label="Hiển thị trạng thái hoạt động"
          accessibilityLabel={
            draft.presenceVisible
              ? 'Hiển thị hoạt động: Bật'
              : 'Hiển thị hoạt động: Tắt'
          }
          value={draft.presenceVisible}
          disabled={action.busy}
          change={(presenceVisible) => setDraft({ ...draft, presenceVisible })}
        />
        <SwitchRow
          label="Ẩn trạng thái của tôi"
          accessibilityLabel={
            draft.invisible ? 'Chế độ ẩn: Bật' : 'Chế độ ẩn: Tắt'
          }
          value={draft.invisible}
          disabled={action.busy}
          change={(invisible) => setDraft({ ...draft, invisible })}
        />
        <Txt style={communityText.meta}>
          Trạng thái mặc định không được chia sẻ. Chế độ ẩn luôn ưu tiên. Yêu
          cầu đang chờ vẫn cần bạn quyết định.
        </Txt>
      </Reveal>
    </ChatFrame>
  )
}
export function CommunityChatPrivacy({
  api,
  subject,
  onBack,
}: Readonly<{ api: CommunityChatApi; subject: string; onBack: () => void }>) {
  const [saved, setSaved] = useState(false)
  const query = useQuery({
    queryKey: ['community-chat', subject, 'privacy'],
    queryFn: () => api.privacy(),
    retry: false,
    staleTime: 0,
    gcTime: 0,
  })
  const header = (
    <CommunityHeader
      padded
      title="Quyền riêng tư trò chuyện"
      backLabel="Về tin nhắn"
      onBack={onBack}
      right={
        <IconButton
          icon="refresh"
          label="Tải lại cài đặt, bỏ bản nháp"
          disabled={query.isFetching}
          onPress={() => {
            setSaved(false)
            void query.refetch()
          }}
        />
      }
    />
  )
  if (query.isFetching || query.isError || !query.data)
    return (
      <ChatFrame header={header}>
        {query.isFetching ? (
          <SkeletonGroup label="Đang kiểm tra cài đặt…">
            <SkeletonRow size={44} />
            <SkeletonRow size={44} />
            <SkeletonRow size={44} />
          </SkeletonGroup>
        ) : (
          <ChatUnavailable onRetry={() => void query.refetch()} />
        )}
      </ChatFrame>
    )
  return (
    <PrivacyEditor
      key={query.data.value.version}
      api={api}
      initial={query.data}
      header={header}
      saved={saved}
      onSaved={async () => {
        await query.refetch({ throwOnError: true })
        setSaved(true)
      }}
    />
  )
}

const styles = StyleSheet.create({
  switchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: 48,
  },
  switchLabel: { flex: 1 },
  footer: {
    backgroundColor: communityColors.background,
    borderTopColor: communityColors.line,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
})
