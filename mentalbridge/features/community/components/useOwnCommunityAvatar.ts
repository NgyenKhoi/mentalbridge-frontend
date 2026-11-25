'use client'

import { useEffect, useState } from 'react'
import {
  COMMUNITY_PROFILE_CHANGED,
  getCommunityProfile,
} from '@/features/community/api/browser-community'
import type { AccountAvatarSource } from './AccountAvatar'

// Any failure, including 404 (no community profile yet), means "no avatar": callers fall back to initials.
export function useOwnCommunityAvatar() {
  const [avatar, setAvatar] = useState<AccountAvatarSource | null>(null)
  useEffect(() => {
    let active = true
    const load = () =>
      getCommunityProfile()
        .then(({ data }) => {
          if (active) setAvatar(data.status === 'ACTIVE' ? data : null)
        })
        .catch(() => {
          if (active) setAvatar(null)
        })
    void load()
    window.addEventListener(COMMUNITY_PROFILE_CHANGED, load)
    return () => {
      active = false
      window.removeEventListener(COMMUNITY_PROFILE_CHANGED, load)
    }
  }, [])
  return avatar
}
