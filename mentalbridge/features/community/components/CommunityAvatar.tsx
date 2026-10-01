import type { CommunityAvatarPreset } from '@/lib/community/community-validation'

const presetMarks: Record<CommunityAvatarPreset, string> = {
  LEAF: '🍃',
  SUNRISE: '☀',
  WAVE: '≈',
  LOTUS: '✿',
  CLOUD: '☁',
  SPROUT: '♧',
}

export default function CommunityAvatar({
  displayName,
  avatarPreset,
  deleted = false,
  anonymous = false,
}: Readonly<{
  displayName: string
  avatarPreset: CommunityAvatarPreset | null
  deleted?: boolean
  anonymous?: boolean
}>) {
  const mark = anonymous
    ? '◌'
    : deleted
      ? '—'
      : avatarPreset
        ? presetMarks[avatarPreset]
        : [...displayName][0]?.toUpperCase()

  return (
    <div
      className={`community-avatar${deleted ? ' is-deleted' : ''}${anonymous ? ' is-anonymous' : ''}${avatarPreset && !deleted && !anonymous ? ` is-${avatarPreset.toLowerCase()}` : ''}`}
      aria-hidden="true"
    >
      {mark}
    </div>
  )
}
