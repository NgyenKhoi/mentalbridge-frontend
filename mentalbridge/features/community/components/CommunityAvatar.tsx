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
}: Readonly<{
  displayName: string
  avatarPreset: CommunityAvatarPreset | null
  deleted?: boolean
}>) {
  const mark = deleted
    ? '—'
    : avatarPreset
      ? presetMarks[avatarPreset]
      : [...displayName][0]?.toUpperCase()

  return (
    <div
      className={`community-avatar${deleted ? ' is-deleted' : ''}${avatarPreset && !deleted ? ` is-${avatarPreset.toLowerCase()}` : ''}`}
      aria-hidden="true"
    >
      {mark}
    </div>
  )
}
