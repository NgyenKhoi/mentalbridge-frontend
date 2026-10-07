import type { CommunityAvatarPreset } from '@/lib/community/community-validation'

function PresetMark({ preset }: Readonly<{ preset: CommunityAvatarPreset }>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {preset === 'LEAF' && (
        <>
          <path d="M19 5C11 5.2 6.3 8.7 6.3 14.2c0 2.8 2 4.8 4.8 4.8C16.6 19 19 12.2 19 5Z" />
          <path d="M5 20c2-4.5 5.4-7.2 10.3-9" />
        </>
      )}
      {preset === 'SUNRISE' && (
        <>
          <path d="M4 17h16M6.5 14.5a5.5 5.5 0 0 1 11 0" />
          <path d="M12 4v3M5.7 7.2l2.1 2.1M18.3 7.2l-2.1 2.1" />
        </>
      )}
      {preset === 'WAVE' && (
        <>
          <path d="M3.5 9.5c2.8 0 2.8 2 5.6 2s2.8-2 5.6-2 2.8 2 5.8 2" />
          <path d="M3.5 14c2.8 0 2.8 2 5.6 2s2.8-2 5.6-2 2.8 2 5.8 2" />
        </>
      )}
      {preset === 'LOTUS' && (
        <>
          <path d="M12 18c-4-2-5.5-5.4-4.5-10 3.2 1.8 4.5 4 4.5 6.8C12 12 13.3 9.8 16.5 8c1 4.6-.5 8-4.5 10Z" />
          <path d="M5 17.5c2 .9 4.3 1.3 7 1.3s5-.4 7-1.3" />
        </>
      )}
      {preset === 'CLOUD' && (
        <path d="M7.5 18h9.2a4.1 4.1 0 0 0 .4-8.2A5.5 5.5 0 0 0 6.7 11 3.5 3.5 0 0 0 7.5 18Z" />
      )}
      {preset === 'SPROUT' && (
        <>
          <path d="M12 20v-8" />
          <path d="M12 13C7.5 13 5.2 10.7 5.2 6.2 9.7 6.2 12 8.5 12 13ZM12 16c4.4 0 6.8-2.3 6.8-6.8-4.5 0-6.8 2.3-6.8 6.8Z" />
        </>
      )}
    </svg>
  )
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
  const fallbackMark = anonymous
    ? 'Ẩn'
    : deleted
      ? '—'
      : [...displayName][0]?.toUpperCase()

  return (
    <div
      className={`community-avatar${deleted ? ' is-deleted' : ''}${anonymous ? ' is-anonymous' : ''}${avatarPreset && !deleted && !anonymous ? ` is-${avatarPreset.toLowerCase()}` : ''}`}
      aria-hidden="true"
    >
      {avatarPreset && !deleted && !anonymous ? (
        <PresetMark preset={avatarPreset} />
      ) : (
        fallbackMark
      )}
    </div>
  )
}
