'use client'

import React, { type ReactNode } from 'react'
import styles from './MasterDetailShell.module.css'

export type MasterDetailShellProps = Readonly<{
  listHeader: ReactNode
  listBody: ReactNode
  listFooter?: ReactNode
  detailHeader?: ReactNode
  detailBody: ReactNode
  detailFooter?: ReactNode
  emptyState?: ReactNode
  hasSelected: boolean
  onBackToList?: () => void
  backButtonLabel?: string
  listPaneRef?: React.RefObject<HTMLDivElement | null>
  listBodyRef?: React.RefObject<HTMLDivElement | null>
  detailBodyRef?: React.RefObject<HTMLDivElement | null>
  onListKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>) => void
  className?: string
}>

export default function MasterDetailShell({
  listHeader,
  listBody,
  listFooter,
  detailHeader,
  detailBody,
  detailFooter,
  emptyState,
  hasSelected,
  onBackToList,
  backButtonLabel = '← Danh sách',
  listPaneRef,
  listBodyRef,
  detailBodyRef,
  onListKeyDown,
  className,
}: MasterDetailShellProps) {
  return (
    <div
      className={`${styles.shell} ${hasSelected ? styles.hasSelection : ''} ${
        className || ''
      }`}
    >
      {/* MASTER / LEFT PANE */}
      <aside
        ref={listPaneRef}
        className={styles.listPane}
        aria-label="Danh sách hội thoại / hồ sơ"
        onKeyDown={onListKeyDown}
        tabIndex={0}
      >
        <div className={styles.listHeader}>{listHeader}</div>
        <div ref={listBodyRef} className={styles.listBody} role="listbox">
          {listBody}
        </div>
        {listFooter && <div className={styles.listFooter}>{listFooter}</div>}
      </aside>

      {/* DETAIL / RIGHT PANE */}
      <section
        className={styles.detailPane}
        aria-label="Chi tiết hồ sơ"
        tabIndex={-1}
      >
        {hasSelected ? (
          <>
            {detailHeader && (
              <header className={styles.detailHeader}>
                {onBackToList && (
                  <button
                    type="button"
                    className={styles.mobileBackBtn}
                    onClick={onBackToList}
                    aria-label="Quay lại danh sách"
                  >
                    {backButtonLabel}
                  </button>
                )}
                {detailHeader}
              </header>
            )}
            <div ref={detailBodyRef} className={styles.detailBody}>
              {detailBody}
            </div>
            {detailFooter && (
              <footer className={styles.detailFooter}>{detailFooter}</footer>
            )}
          </>
        ) : (
          <div className={styles.emptyStateWrapper}>
            {emptyState || (
              <div style={{ textAlign: 'center', color: 'var(--ink-soft)' }}>
                Chọn một hồ sơ để xem chi tiết
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  )
}
