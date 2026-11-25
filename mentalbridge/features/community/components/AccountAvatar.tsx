'use client'

import type {
  CommunityAvatarImage,
  CommunityAvatarPreset,
} from '@/lib/community/community-validation'
import CommunityAvatar from './CommunityAvatar'
import styles from './AccountAvatar.module.css'

export type AccountAvatarSource = Readonly<{
  displayName: string
  avatarPreset: CommunityAvatarPreset | null
  avatarImage?: CommunityAvatarImage | null
}>

// The account avatar is the community avatar: photo or preset when chosen, the caller's initials otherwise.
export default function AccountAvatar({
  avatar,
  fallback,
}: Readonly<{ avatar: AccountAvatarSource | null; fallback: string }>) {
  if (!avatar || (!avatar.avatarPreset && !avatar.avatarImage)) return fallback
  return (
    <span className={styles.root}>
      <CommunityAvatar
        displayName={avatar.displayName}
        avatarPreset={avatar.avatarPreset}
        avatarImage={avatar.avatarImage}
      />
    </span>
  )
}
