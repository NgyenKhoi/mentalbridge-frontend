'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { lockBodyScroll } from '@/lib/dom/body-scroll-lock'
import { CRISIS_SUPPORT_CONTENT } from './crisis-support-content'
import styles from './CrisisSupportWidget.module.css'

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function SupportIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 11.3 8.9 8.4a2.35 2.35 0 0 1 3.1-3.52 2.35 2.35 0 0 1 3.1 3.52L12 11.3Z" />
      <path d="M3.5 14.2h2.35l2.1 3.05h5.8c1.2 0 2.35-.48 3.2-1.33l3.55-3.56a1.48 1.48 0 0 0-2.06-.08l-2.53 2.06" />
      <path d="M9.1 14.15h4.1a1.5 1.5 0 0 1 0 3H9.6" />
      <path d="M3.5 12.85v6.3" />
    </svg>
  )
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.9.33 1.78.62 2.63a2 2 0 0 1-.45 2.11L8 9.73a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.85.29 1.73.5 2.63.62A2 2 0 0 1 22 16.92Z" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  )
}

export default function CrisisSupportWidget() {
  const [isOpen, setIsOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const releaseScrollLock = lockBodyScroll()
    const trigger = triggerRef.current
    closeRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setIsOpen(false)
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusableElements = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      )
      const firstElement = focusableElements[0]
      const lastElement = focusableElements.at(-1)

      if (!firstElement || !lastElement) return

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      releaseScrollLock()
      document.removeEventListener('keydown', handleKeyDown)
      trigger?.focus()
    }
  }, [isOpen])

  const closePanel = () => setIsOpen(false)

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={styles.fab}
        aria-label="Mở hỗ trợ khẩn cấp"
        aria-expanded={isOpen}
        aria-controls="crisis-support-panel"
        aria-haspopup="dialog"
        onClick={() => setIsOpen(true)}
      >
        <span className={styles.fabIcon}>
          <SupportIcon />
        </span>
        <span>Cần hỗ trợ ngay</span>
      </button>

      {isOpen && (
        <>
          <button
            type="button"
            className={styles.backdrop}
            aria-label="Đóng khi chạm bên ngoài bảng hỗ trợ"
            tabIndex={-1}
            onClick={closePanel}
          />
          <section
            ref={panelRef}
            id="crisis-support-panel"
            className={styles.panel}
            role="dialog"
            aria-modal="true"
            aria-label="Bảng hỗ trợ khẩn cấp"
            data-content-version={CRISIS_SUPPORT_CONTENT.version}
          >
            <header className={styles.header}>
              <div>
                <span>Hỗ trợ ngay</span>
                <h2>Bạn không đơn độc</h2>
                <p>
                  Các số hỗ trợ dưới đây luôn hiện sẵn để bạn có thể gọi ngay.
                </p>
              </div>
              <button
                ref={closeRef}
                type="button"
                className={styles.close}
                aria-label="Đóng bảng hỗ trợ khẩn cấp"
                onClick={closePanel}
              >
                <span aria-hidden="true">×</span>
              </button>
            </header>

            <div className={styles.body}>
              <div
                className={styles.contacts}
                aria-label="Số điện thoại hỗ trợ"
              >
                {CRISIS_SUPPORT_CONTENT.contacts.map((contact) => (
                  <article className={styles.contact} key={contact.id}>
                    <div>
                      <p>
                        {contact.name}
                        {contact.availability && (
                          <span>{contact.availability}</span>
                        )}
                      </p>
                      <strong>{contact.displayPhone}</strong>
                    </div>
                    <a
                      className={styles.call}
                      href={contact.href}
                      aria-label={`Gọi ${contact.name} số ${contact.displayPhone}`}
                    >
                      <PhoneIcon />
                      Gọi
                    </a>
                  </article>
                ))}
              </div>

              <nav
                className={styles.links}
                aria-label="Các lựa chọn hỗ trợ khác"
              >
                <Link href="/safety-directory" onClick={closePanel}>
                  <span>Tìm cơ sở gần bạn</span>
                  <ArrowIcon />
                </Link>
                <Link href="/resources" onClick={closePanel}>
                  <span>Bài tập ổn định cảm xúc</span>
                  <ArrowIcon />
                </Link>
              </nav>
            </div>

            <footer className={styles.footer}>
              Không cần đăng nhập hay điền form để gọi hotline. Thông tin này
              luôn sẵn sàng, mọi lúc.
            </footer>
          </section>
        </>
      )}
    </>
  )
}
