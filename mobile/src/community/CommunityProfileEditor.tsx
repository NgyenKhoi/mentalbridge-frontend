import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Text, TextInput, View } from 'react-native'

import { PrimaryButton } from '@/components/PrimaryButton'

import type { CommunityApi } from './community-api'
import {
  avatarSchema,
  profileWriteSchema,
  type ProfileWrite,
  type VersionedProfile,
} from './community-contract'
import {
  CommunityButton,
  CommunityMessage,
  communityMessage,
  communityStyles as styles,
  useCommunityAction,
} from './community-ui'

const avatarLabels = {
  LEAF: 'Lá',
  SUNRISE: 'Bình minh',
  WAVE: 'Sóng',
  LOTUS: 'Sen',
  CLOUD: 'Mây',
  SPROUT: 'Mầm',
}
function ProfileForm({
  api,
  initial,
  onSaved,
  onReload,
}: Readonly<{
  api: CommunityApi
  initial: VersionedProfile | null
  onSaved: () => Promise<void>
  onReload: () => void
}>) {
  const [name, setName] = useState(initial?.profile.displayName ?? '')
  const [baseline] = useState(initial)
  const [avatar, setAvatar] = useState<ProfileWrite['avatarPreset']>(
    initial?.profile.avatarPreset ?? null,
  )
  const [saved, setSaved] = useState(false)
  const action = useCommunityAction()
  const body = { displayName: name.trim(), avatarPreset: avatar }
  return (
    <View style={styles.column}>
      <Text style={styles.body}>Tên hiển thị cộng đồng</Text>
      <TextInput
        accessibilityLabel="Tên hiển thị cộng đồng"
        maxLength={80}
        value={name}
        editable={!action.busy}
        style={styles.input}
        onChangeText={(value) => {
          setName(value)
          setSaved(false)
        }}
      />
      <Text accessibilityRole="header" style={styles.heading}>
        Biểu tượng
      </Text>
      <View style={styles.row}>
        <CommunityButton
          label="Không dùng biểu tượng"
          selected={avatar === null}
          disabled={action.busy}
          onPress={() => setAvatar(null)}
        />
        {avatarSchema.options.map((value) => (
          <CommunityButton
            key={value}
            label={avatarLabels[value]}
            selected={avatar === value}
            disabled={action.busy}
            onPress={() => {
              setAvatar(value)
              setSaved(false)
            }}
          />
        ))}
      </View>
      {action.error && (
        <>
          <CommunityMessage>{action.error}</CommunityMessage>
          <CommunityButton
            label="Tải lại danh tính"
            disabled={action.busy}
            onPress={onReload}
          />
        </>
      )}
      {saved && (
        <CommunityMessage>Danh tính hiển thị đã được lưu.</CommunityMessage>
      )}
      <PrimaryButton
        disabled={
          action.busy || saved || !profileWriteSchema.safeParse(body).success
        }
        label={action.busy ? 'Đang lưu…' : 'Lưu danh tính cộng đồng'}
        onPress={() =>
          void action.run(async () => {
            await api.saveProfile(body, baseline?.etag ?? null)
            setSaved(true)
            await onSaved()
          })
        }
      />
    </View>
  )
}

export function CommunityProfileEditor({
  api,
  subject,
  onBack,
}: Readonly<{ api: CommunityApi; subject: string; onBack: () => void }>) {
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ['community', subject, 'profile'],
    queryFn: () => api.profile(),
    staleTime: 0,
  })
  const [generation, setGeneration] = useState(0)
  const [savedMessage, setSavedMessage] = useState(false)
  const verified = query.isFetchedAfterMount
  return (
    <View style={styles.column}>
      <CommunityButton label="Quay lại cộng đồng" onPress={onBack} />
      <Text accessibilityRole="header" style={styles.title}>
        Danh tính cộng đồng
      </Text>
      <Text style={styles.muted}>
        Tên và biểu tượng chỉ dành cho cộng đồng, không thay đổi hồ sơ sức khỏe
        hay tài khoản đăng nhập.
      </Text>
      {savedMessage && (
        <CommunityMessage>Danh tính hiển thị đã được lưu.</CommunityMessage>
      )}
      {query.isFetching && verified && (
        <CommunityMessage>Đang tải lại danh tính…</CommunityMessage>
      )}
      {query.isPending || (!verified && !query.isError) ? (
        <CommunityMessage>Đang tải danh tính…</CommunityMessage>
      ) : query.isError ? (
        <>
          <CommunityMessage>{communityMessage(query.error)}</CommunityMessage>
          <CommunityButton
            label="Thử tải lại danh tính"
            onPress={() => void query.refetch()}
          />
        </>
      ) : query.data?.profile.status === 'DELETED' ? (
        <CommunityMessage>
          Danh tính này không còn hoạt động. Không thể chỉnh sửa.
        </CommunityMessage>
      ) : (
        <View style={query.isFetching ? { display: 'none' } : undefined}>
          <ProfileForm
            key={generation}
            api={api}
            initial={query.data ?? null}
            onReload={() => {
              void query
                .refetch()
                .then(() => setGeneration((value) => value + 1))
            }}
            onSaved={async () => {
              await client.invalidateQueries({
                queryKey: ['community', subject],
              })
              setSavedMessage(true)
              setGeneration((value) => value + 1)
            }}
          />
        </View>
      )}
    </View>
  )
}
