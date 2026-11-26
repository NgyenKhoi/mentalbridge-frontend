import { useState, type ReactNode } from 'react'
import { Image, StyleSheet, View, type ViewStyle } from 'react-native'

import { Txt } from '@/theme/dashboard'
import { spacing } from '@/theme/tokens'

import {
  CommunityIcon,
  communityText,
  type IconName,
} from './community-primitives'
import { communityAvatarTints, communityColors } from './community-theme'

export type AvatarAuthor = Readonly<{
  displayName: string
  avatarPreset: string | null
  avatarImage?: Readonly<{ url: string }> | undefined
  state: 'ACTIVE' | 'DELETED' | 'ANONYMOUS'
}>

const presets: Record<
  string,
  {
    icon: IconName
    tint: (typeof communityAvatarTints)[keyof typeof communityAvatarTints]
  }
> = {
  LEAF: { icon: 'leaf', tint: communityAvatarTints.green },
  SPROUT: { icon: 'sprout', tint: communityAvatarTints.green },
  SUNRISE: { icon: 'weather-sunset-up', tint: communityAvatarTints.sun },
  WAVE: { icon: 'waves', tint: communityAvatarTints.blue },
  CLOUD: { icon: 'weather-cloudy', tint: communityAvatarTints.blue },
  LOTUS: { icon: 'spa-outline', tint: communityAvatarTints.rose },
}

/** Decorative circle; the name beside it is the label. `author` undefined shows a neutral person. */
export function Avatar({
  author,
  size = 40,
  group = false,
}: Readonly<{
  author?: AvatarAuthor | undefined
  size?: number
  /** Chat group: group glyph on a soft surface. */
  group?: boolean
}>) {
  const [failed, setFailed] = useState(false)
  const image = author?.state === 'ACTIVE' ? author.avatarImage : undefined
  const preset = author?.avatarPreset ? presets[author.avatarPreset] : undefined
  const glyph = Math.round(size * 0.55)
  const variant = group
    ? 'group'
    : author?.state === 'ANONYMOUS'
      ? 'anonymous'
      : author?.state === 'DELETED'
        ? 'deleted'
        : image && !failed
          ? 'image'
          : preset
            ? 'preset'
            : author
              ? 'initial'
              : 'neutral'
  const box: ViewStyle = { width: size, height: size, borderRadius: size / 2 }
  return (
    <View
      testID={`community-avatar-${variant}`}
      accessible={false}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
      style={[
        avatar.base,
        box,
        variant === 'anonymous' && avatar.anonymous,
        variant === 'group' && { backgroundColor: communityColors.soft },
        variant === 'deleted' && {
          backgroundColor: communityAvatarTints.deleted.background,
        },
        (variant === 'initial' || variant === 'neutral') && {
          backgroundColor: communityColors.mint,
        },
        variant === 'preset' &&
          preset && { backgroundColor: preset.tint.background },
      ]}
    >
      {variant === 'image' && image ? (
        <Image
          source={{ uri: image.url }}
          style={{ width: size, height: size }}
          onError={() => setFailed(true)}
        />
      ) : variant === 'preset' && preset ? (
        <CommunityIcon
          name={preset.icon}
          size={glyph}
          color={preset.tint.icon}
        />
      ) : variant === 'anonymous' ? (
        <CommunityIcon
          name="incognito"
          size={glyph}
          color={communityColors.lavender}
        />
      ) : variant === 'group' ? (
        <CommunityIcon name="account-group-outline" size={glyph} />
      ) : variant === 'deleted' ? (
        <Txt
          style={[avatar.letter, { color: communityAvatarTints.deleted.icon }]}
        >
          —
        </Txt>
      ) : variant === 'initial' ? (
        <Txt style={[avatar.letter, { fontSize: Math.round(size * 0.42) }]}>
          {Array.from(author?.displayName.trim() ?? '')[0]?.toUpperCase() ??
            '?'}
        </Txt>
      ) : (
        <CommunityIcon name="account-outline" size={glyph} />
      )}
    </View>
  )
}

const avatar = StyleSheet.create({
  base: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  anonymous: {
    backgroundColor: communityColors.lavenderPale,
    borderColor: communityColors.lavender,
    borderStyle: 'dashed',
    borderWidth: 1,
  },
  letter: {
    color: communityColors.primaryDeep,
    fontWeight: '700',
    fontSize: 16,
  },
})

/** Avatar + name, with a meta line (time, role) and a trailing slot. */
export function AuthorRow({
  author,
  name,
  meta,
  size = 38,
  trailing,
}: Readonly<{
  author?: AvatarAuthor | undefined
  name: string
  meta?: string | undefined
  size?: number
  trailing?: ReactNode
}>) {
  return (
    <View style={authorRow.row}>
      <Avatar author={author} size={size} />
      <View style={authorRow.text}>
        <Txt numberOfLines={1} style={communityText.author}>
          {name}
        </Txt>
        {meta ? (
          <Txt numberOfLines={1} style={authorRow.meta}>
            {meta}
          </Txt>
        ) : null}
      </View>
      {trailing}
    </View>
  )
}

const authorRow = StyleSheet.create({
  row: { alignItems: 'center', flexDirection: 'row', gap: spacing.md },
  text: { flex: 1 },
  meta: {
    color: communityColors.inkSoft,
    fontSize: 12.5,
    lineHeight: 17,
    marginTop: 1,
  },
})

const dateFormat = new Intl.DateTimeFormat('vi-VN', {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
})
export function relativeTime(iso: string, now = Date.now()) {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return ''
  const minutes = Math.floor(Math.max(0, now - at) / 60000)
  if (minutes < 1) return 'Vừa xong'
  if (minutes < 60) return `${minutes} phút trước`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} giờ trước`
  const days = Math.floor(hours / 24)
  return days < 7 ? `${days} ngày trước` : dateFormat.format(at)
}
