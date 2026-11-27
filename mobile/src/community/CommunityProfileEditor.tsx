import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { StyleSheet, TextInput, View } from 'react-native'

import { PressableScale } from '@/components/PressableScale'
import { Screen } from '@/components/Screen'
import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'
import { communityColors } from './community-theme'

import type { CommunityApi } from './community-api'
import {
  avatarSchema,
  profileWriteSchema,
  type ProfileWrite,
  type VersionedProfile,
} from './community-contract'
import {
  Avatar,
  CommunityButton,
  CommunityHeader,
  CommunityIcon,
  CommunityMessage,
  communityMessage,
  communityStyles as styles,
  communityText,
  Reveal,
  SelectOverlay,
  SkeletonBlock,
  SkeletonGroup,
  StateCard,
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

function PresetTile({
  label,
  name,
  preset,
  selected,
  disabled,
  onPress,
}: Readonly<{
  label: string
  name: string
  preset: ProfileWrite['avatarPreset']
  selected: boolean
  disabled: boolean
  onPress: () => void
}>) {
  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[local.tile, disabled && styles.disabled]}
    >
      <View style={local.ring}>
        <Avatar
          size={56}
          author={{ displayName: name, avatarPreset: preset, state: 'ACTIVE' }}
        />
        <SelectOverlay selected={selected} style={local.ringOn} />
      </View>
      <Txt
        numberOfLines={2}
        style={[communityText.meta, local.tileLabel, selected && local.strong]}
      >
        {label}
      </Txt>
    </PressableScale>
  )
}

function Saved() {
  return (
    <View accessibilityLiveRegion="polite" style={local.saved}>
      <CommunityIcon name="check-circle-outline" />
      <Txt style={[communityText.body, local.savedText]}>
        Danh tính hiển thị đã được lưu.
      </Txt>
    </View>
  )
}

function ProfileSkeleton({ label }: Readonly<{ label: string }>) {
  return (
    <SkeletonGroup label={label}>
      <View style={local.preview}>
        <SkeletonBlock width={96} height={96} radius={48} />
      </View>
      <SkeletonBlock width="45%" height={16} />
      <SkeletonBlock height={48} />
    </SkeletonGroup>
  )
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
      <View style={local.preview}>
        <Avatar
          size={96}
          author={{
            displayName: body.displayName,
            avatarPreset: avatar,
            state: 'ACTIVE',
          }}
        />
      </View>
      <View style={local.field}>
        <Txt style={local.title}>Tên hiển thị cộng đồng</Txt>
        <TextInput
          accessibilityLabel="Tên hiển thị cộng đồng"
          maxLength={80}
          value={name}
          editable={!action.busy}
          style={local.input}
          onChangeText={(value) => {
            setName(value)
            setSaved(false)
          }}
        />
      </View>
      <View style={local.field}>
        <Txt accessibilityRole="header" style={local.title}>
          Biểu tượng
        </Txt>
        <View accessibilityRole="radiogroup" style={local.grid}>
          <PresetTile
            label="Không dùng biểu tượng"
            name={body.displayName}
            preset={null}
            selected={avatar === null}
            disabled={action.busy}
            onPress={() => {
              setAvatar(null)
              setSaved(false)
            }}
          />
          {avatarSchema.options.map((value) => (
            <PresetTile
              key={value}
              label={avatarLabels[value]}
              name={body.displayName}
              preset={value}
              selected={avatar === value}
              disabled={action.busy}
              onPress={() => {
                setAvatar(value)
                setSaved(false)
              }}
            />
          ))}
        </View>
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
      {saved && <Saved />}
      <CommunityButton
        large
        variant="primary"
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
    <Screen
      layout="dashboard"
      backgroundColor={communityColors.background}
      header={
        <CommunityHeader
          padded
          title="Danh tính cộng đồng"
          backLabel="Quay lại cộng đồng"
          onBack={onBack}
        />
      }
    >
      <View style={styles.column}>
        <Reveal step={0}>
          <Txt style={communityText.body}>
            Tên và biểu tượng chỉ dành cho cộng đồng, không thay đổi hồ sơ sức
            khỏe hay tài khoản đăng nhập.
          </Txt>
        </Reveal>
        {savedMessage && <Saved />}
        {query.isFetching && verified && (
          <ProfileSkeleton label="Đang tải lại danh tính…" />
        )}
        {query.isPending || (!verified && !query.isError) ? (
          <ProfileSkeleton label="Đang tải danh tính…" />
        ) : query.isError ? (
          <>
            <CommunityMessage>{communityMessage(query.error)}</CommunityMessage>
            <CommunityButton
              label="Thử tải lại danh tính"
              onPress={() => void query.refetch()}
            />
          </>
        ) : query.data?.profile.status === 'DELETED' ? (
          <StateCard
            icon="account-off-outline"
            title="Danh tính này không còn hoạt động. Không thể chỉnh sửa."
          />
        ) : (
          <Reveal style={query.isFetching ? { display: 'none' } : undefined}>
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
          </Reveal>
        )}
      </View>
    </Screen>
  )
}

const local = StyleSheet.create({
  preview: { alignItems: 'center' },
  field: { gap: spacing.sm },
  title: {
    color: communityColors.ink,
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  input: {
    backgroundColor: communityColors.soft,
    borderRadius: 14,
    color: communityColors.ink,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  tile: { alignItems: 'center', gap: spacing.xs, width: '30%' },
  ring: {
    alignItems: 'center',
    borderRadius: 32,
    height: 64,
    justifyContent: 'center',
    width: 64,
  },
  ringOn: {
    borderColor: communityColors.primaryDeep,
    borderRadius: 32,
    borderWidth: 3,
  },
  tileLabel: { color: communityColors.ink, textAlign: 'center' },
  strong: { fontWeight: '600' },
  saved: {
    alignItems: 'center',
    backgroundColor: communityColors.mint,
    borderRadius: 14,
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.md,
  },
  savedText: { color: communityColors.primaryDeep, flex: 1 },
})
