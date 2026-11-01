import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Text, View } from 'react-native'
import { useCommunityAction } from '@/community/community-ui'
import type { CommunityChatApi } from './community-chat-api'
import type { ChatPrivacy, Versioned } from './community-chat-contract'
import {
  ChatButton,
  ChatHeading,
  ChatNotice,
  ChatUnavailable,
  chatStyles as s,
} from './community-chat-ui'

function PrivacyEditor({
  api,
  initial,
  onSaved,
}: Readonly<{
  api: CommunityChatApi
  initial: Versioned<{ version: string; preferences: ChatPrivacy }>
  onSaved: () => Promise<unknown>
}>) {
  const [draft, setDraft] = useState(initial.value.preferences)
  const action = useCommunityAction()
  return (
    <View style={s.column}>
      <Text style={s.heading}>Ai có thể bắt đầu trò chuyện?</Text>
      {(
        [
          { value: 'APPROVAL_REQUIRED', label: 'Cần tôi chấp nhận' },
          { value: 'ANYONE', label: 'Cho phép nhắn trực tiếp' },
        ] as const
      ).map((option) => (
        <ChatButton
          key={option.value}
          label={option.label}
          selected={draft.directMessagePolicy === option.value}
          disabled={action.busy}
          onPress={() =>
            setDraft({ ...draft, directMessagePolicy: option.value })
          }
        />
      ))}
      <Text style={s.heading}>Trạng thái hoạt động</Text>
      <ChatButton
        label={
          draft.presenceVisible
            ? 'Hiển thị hoạt động: Bật'
            : 'Hiển thị hoạt động: Tắt'
        }
        selected={draft.presenceVisible}
        disabled={action.busy}
        onPress={() =>
          setDraft({ ...draft, presenceVisible: !draft.presenceVisible })
        }
      />
      <ChatButton
        label={draft.invisible ? 'Chế độ ẩn: Bật' : 'Chế độ ẩn: Tắt'}
        selected={draft.invisible}
        disabled={action.busy}
        onPress={() => setDraft({ ...draft, invisible: !draft.invisible })}
      />
      <Text style={s.muted}>
        Trạng thái mặc định không được chia sẻ. Chế độ ẩn luôn ưu tiên. Yêu cầu
        đang chờ vẫn cần bạn quyết định.
      </Text>
      <ChatButton
        label="Lưu quyền riêng tư"
        disabled={action.busy}
        onPress={() =>
          void action.run(async () => {
            await api.savePrivacy(draft, initial.etag)
            await onSaved()
          })
        }
      />
      {action.error && <ChatNotice>{action.error}</ChatNotice>}
    </View>
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
  return (
    <View style={s.column}>
      <ChatButton label="Về trò chuyện" onPress={onBack} />
      <ChatHeading>Quyền riêng tư trò chuyện</ChatHeading>
      {saved && <ChatNotice>Đã lưu quyền riêng tư trò chuyện.</ChatNotice>}
      <ChatButton
        label="Tải lại cài đặt, bỏ bản nháp"
        disabled={query.isFetching}
        onPress={() => {
          setSaved(false)
          void query.refetch()
        }}
      />
      {query.isFetching ? (
        <ChatNotice>Đang kiểm tra cài đặt…</ChatNotice>
      ) : query.isError || !query.data ? (
        <ChatUnavailable onRetry={() => void query.refetch()} />
      ) : (
        <PrivacyEditor
          key={query.data.value.version}
          api={api}
          initial={query.data}
          onSaved={async () => {
            await query.refetch({ throwOnError: true })
            setSaved(true)
          }}
        />
      )}
    </View>
  )
}
