'use client'

import { Suspense, useEffect, useState } from 'react'
import {
  getCommunityProfile,
  type CommunityProfile,
} from '@/features/community/api/browser-community'
import CommunityMemberProfile from '@/features/community/components/CommunityMemberProfile'
import '../community.css'

function CommunityProfileContent() {
  const [profile, setProfile] = useState<CommunityProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    getCommunityProfile()
      .then((res) => {
        if (active) setProfile(res.data)
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div
        style={{
          padding: '3rem 1rem',
          textAlign: 'center',
          color: 'var(--ink-soft, #556b64)',
        }}
      >
        Đang tải thông tin trang cá nhân…
      </div>
    )
  }

  if (!profile?.communityProfileId) {
    return (
      <div
        style={{
          padding: '3rem 1rem',
          textAlign: 'center',
          color: 'var(--ink-soft, #556b64)',
        }}
      >
        Không tìm thấy thông tin trang cá nhân cộng đồng.
      </div>
    )
  }

  return (
    <div>
      <CommunityMemberProfile profileId={profile.communityProfileId} />
    </div>
  )
}

export default function CommunityProfilePage() {
  return (
    <Suspense
      fallback={
        <div style={{ padding: '3rem', textAlign: 'center', color: '#556b64' }}>
          Đang tải…
        </div>
      }
    >
      <CommunityProfileContent />
    </Suspense>
  )
}
