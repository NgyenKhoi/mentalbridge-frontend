'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { terminateSession, type LogoutMode } from '../api/browser-auth'
import styles from './SessionActions.module.css'

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export default function SessionActions({ compact = false }) {
  const router = useRouter()
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const actionPending = useRef(false)
  const [open, setOpen] = useState(false)
  const [pendingMode, setPendingMode] = useState<LogoutMode | null>(null)

  useEffect(() => {
    if (!open) return

    const closeFromOutside = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !rootRef.current?.contains(event.target)
      )
        setOpen(false)
    }
    const closeFromKeyboard = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('pointerdown', closeFromOutside)
    document.addEventListener('keydown', closeFromKeyboard)
    return () => {
      document.removeEventListener('pointerdown', closeFromOutside)
      document.removeEventListener('keydown', closeFromKeyboard)
    }
  }, [open])

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
    <div
      ref={rootRef}
      className={styles.root}
      data-compact={compact || undefined}
    >
      {open ? (
        <div
          id={menuId}
          className={styles.menu}
          role="menu"
          aria-label="Tài khoản người dùng"
        >
          <div className={styles.menuHeader}>
            <span className={styles.headerAvatar}>N</span>
            <span>
              <strong>Người dùng</strong>
              <small>Tài khoản cá nhân</small>
            </span>
          </div>
          <Link
            href="/profile"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
            title={compact ? 'Hồ sơ cá nhân' : undefined}
          >
            <span className={styles.itemIcon}>
              <Icon>
                <circle cx="12" cy="8" r="3.4" />
                <path d="M4.5 20c1.2-4 4-6 7.5-6s6.3 2 7.5 6" />
              </Icon>
            </span>
            <span className={styles.itemLabel}>Hồ sơ cá nhân</span>
          </Link>
          <Link
            href="/subscription"
            className={styles.menuItem}
            role="menuitem"
            onClick={() => setOpen(false)}
            title={compact ? 'Gói dịch vụ' : undefined}
          >
            <span className={styles.itemIcon}>
              <Icon>
                <rect x="3" y="6" width="18" height="12" rx="2.5" />
                <path d="M3 10h18" />
              </Icon>
            </span>
            <span className={styles.itemLabel}>Gói dịch vụ</span>
          </Link>
          <div className={styles.separator} role="separator" />
          <button
            type="button"
            className={`${styles.menuItem} ${styles.logoutItem}`}
            role="menuitem"
            onClick={() => void endSession('current')}
            disabled={pendingMode !== null}
            title={compact ? 'Đăng xuất' : undefined}
          >
            <span className={styles.itemIcon}>
              <Icon>
                <path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" />
              </Icon>
            </span>
            <span className={styles.itemLabel}>
              {pendingMode === 'current' ? 'Đang đăng xuất...' : 'Đăng xuất'}
            </span>
          </button>
          <button
            type="button"
            className={`${styles.menuItem} ${styles.logoutItem}`}
            role="menuitem"
            onClick={() => void endSession('all')}
            disabled={pendingMode !== null}
            title={compact ? 'Đăng xuất mọi thiết bị' : undefined}
          >
            <span className={styles.itemIcon}>
              <Icon>
                <path d="M8 5H4v14h4M14 8l4 4-4 4M8 12h10" />
                <path d="M11 4h9v16h-9" />
              </Icon>
            </span>
            <span className={styles.itemLabel}>
              {pendingMode === 'all'
                ? 'Đang xử lý...'
                : 'Đăng xuất mọi thiết bị'}
            </span>
          </button>
        </div>
      ) : null}
      <button
        ref={triggerRef}
        type="button"
        className={styles.trigger}
        aria-label={open ? 'Đóng menu tài khoản' : 'Mở menu tài khoản'}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className={styles.avatar}>N</span>
        <span className={styles.triggerCopy}>
          <strong>Người dùng</strong>
          <small>Tài khoản cá nhân</small>
        </span>
        <svg
          className={styles.chevron}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 8 4 4 4-4" />
        </svg>
      </button>
    </div>
  )
}
