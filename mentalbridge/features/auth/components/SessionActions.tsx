'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'

import { terminateSession, type LogoutMode } from '../api/browser-auth'
import styles from './SessionActions.module.css'

export default function SessionActions({ compact = false }) {
  const router = useRouter()
  const actionPending = useRef(false)
  const [pendingMode, setPendingMode] = useState<LogoutMode | null>(null)

  const endSession = async (mode: LogoutMode) => {
    if (actionPending.current) return

    actionPending.current = true
    setPendingMode(mode)

    try {
      await terminateSession(mode)
    } catch {
      // The BFF clears its cookies even when Identity is unavailable.
    } finally {
      router.replace('/login')
      router.refresh()
    }
  }

  return (
    <div className={styles.actions} data-compact={compact || undefined}>
      <button
        type="button"
        onClick={() => endSession('current')}
        disabled={pendingMode !== null}
      >
        {pendingMode === 'current' ? 'Đang đăng xuất...' : 'Đăng xuất'}
      </button>
      <button
        type="button"
        onClick={() => endSession('all')}
        disabled={pendingMode !== null}
      >
        {pendingMode === 'all' ? 'Đang xử lý...' : 'Đăng xuất mọi thiết bị'}
      </button>
    </div>
  )
}
