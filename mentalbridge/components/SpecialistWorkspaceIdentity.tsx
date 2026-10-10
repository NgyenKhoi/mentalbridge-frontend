'use client'

import { useEffect, useState } from 'react'
import SessionActions from '@/features/auth/components/SessionActions'

import {
  browserConsultation,
  BrowserConsultationError,
} from '@/features/specialist-profile/api/browser-client'
import type {
  SpecialistApprovalStatus,
  SpecialistProfile,
} from '@/lib/consultation/consultation-validation'

const STATUS_LABELS: Record<SpecialistApprovalStatus, string> = {
  PENDING: 'Đang chờ xét duyệt',
  APPROVED: 'Chuyên gia đã được duyệt',
  REJECTED: 'Hồ sơ cần cập nhật',
  SUSPENDED: 'Quyền vận hành tạm ngưng',
}

function initials(displayName: string) {
  return displayName
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase('vi') ?? '')
    .join('')
}

export default function SpecialistWorkspaceIdentity({
  compact = false,
}: {
  compact?: boolean
}) {
  const [profile, setProfile] = useState<SpecialistProfile | null>(null)
  const [state, setState] = useState<'loading' | 'missing' | 'unavailable'>(
    'loading',
  )

  useEffect(() => {
    let active = true
    void browserConsultation
      .own()
      .then(({ data }) => {
        if (!active) return
        setProfile(data)
      })
      .catch((error: unknown) => {
        if (!active) return
        setState(
          error instanceof BrowserConsultationError && error.status === 404
            ? 'missing'
            : 'unavailable',
        )
      })
    return () => {
      active = false
    }
  }, [])

  const displayName = profile?.displayName.trim() || 'Chuyên gia'
  const status = profile
    ? STATUS_LABELS[profile.approvalStatus]
    : state === 'loading'
      ? 'Đang tải hồ sơ…'
      : state === 'missing'
        ? 'Hồ sơ chưa hoàn tất'
        : 'Chưa tải được hồ sơ'

  return (
    <SessionActions
      compact={compact}
      accountKind="specialist"
      displayName={displayName}
      avatar={profile ? initials(displayName) : 'CG'}
      description={status}
    />
  )
}
