'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CompanionContextSources } from '@/lib/companion/companion-contract'
import type { PublicResourceSummary } from '@/features/resources/api/browser-resources'
import styles from './AiCompanionChat.module.css'

type Props = Readonly<{
  sources: CompanionContextSources
  resources: readonly PublicResourceSummary[]
  saving: boolean
  onClose: () => void
  onSave: (sources: CompanionContextSources) => void
}>

const focusable =
  'button:not([disabled]), input:not([disabled]), a[href], textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function SourceToggle({
  checked,
  label,
  note,
  icon,
  onChange,
}: Readonly<{
  checked: boolean
  label: string
  note: string
  icon: string
  onChange: (value: boolean) => void
}>) {
  return (
    <div className={styles.sourceGroup}>
      <div className={styles.sourceGroupTitle}>
        <span aria-hidden="true">{icon}</span>
        <div>
          <strong>{label}</strong>
          <small>{note}</small>
        </div>
        <label className={styles.sourceSwitch}>
          <span className="sr-only">Bật {label}</span>
          <input
            type="checkbox"
            checked={checked}
            onChange={(event) => onChange(event.target.checked)}
          />
          <i aria-hidden="true" />
        </label>
      </div>
      <div className={styles.sourceGroupMeta}>
        <button type="button" onClick={() => onChange(!checked)}>
          {checked ? 'Bỏ chọn' : 'Chọn tất cả'}
        </button>
        <span>{checked ? 1 : 0}/1 đã chọn</span>
      </div>
    </div>
  )
}

export default function CompanionContextDialog({
  sources,
  resources,
  saving,
  onClose,
  onSave,
}: Props) {
  const [draft, setDraft] = useState(sources)
  const [query, setQuery] = useState('')
  const panelRef = useRef<HTMLDivElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    returnFocusRef.current = document.activeElement as HTMLElement | null
    const panel = panelRef.current
    window.setTimeout(
      () => panel?.querySelector<HTMLElement>(focusable)?.focus(),
      0,
    )
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab' || !panel) return
      const items = [...panel.querySelectorAll<HTMLElement>(focusable)]
      if (items.length === 0) return
      const first = items[0]
      const last = items.at(-1)
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }
    document.addEventListener('keydown', keydown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', keydown)
      document.body.style.overflow = ''
      returnFocusRef.current?.focus()
    }
  }, [onClose])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('vi')
    return normalized
      ? resources.filter((resource) =>
          `${resource.title} ${resource.summary}`
            .toLocaleLowerCase('vi')
            .includes(normalized),
        )
      : resources
  }, [query, resources])

  const selectedResources = new Set(draft.resourceIds)
  const toggleResource = (resourceId: string) =>
    setDraft((current) => ({
      ...current,
      resourceIds: current.resourceIds.includes(resourceId)
        ? current.resourceIds.filter((id) => id !== resourceId)
        : [...current.resourceIds, resourceId],
    }))

  return (
    <div
      className={styles.contextDialogBackdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={panelRef}
        className={styles.contextDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="context-dialog-title"
        aria-describedby="context-dialog-description"
      >
        <header className={styles.contextDialogHeader}>
          <div>
            <span>Ngữ cảnh riêng tư</span>
            <h2 id="context-dialog-title">
              Nguồn thông tin cho cuộc trò chuyện này
            </h2>
            <p id="context-dialog-description">
              Không bắt buộc. Chỉ áp dụng cho cuộc trò chuyện này. Bạn có thể
              thay đổi bất cứ lúc nào.
            </p>
          </div>
          <button type="button" aria-label="Đóng hộp thoại" onClick={onClose}>
            ×
          </button>
        </header>

        <div className={styles.contextDialogBody}>
          <SourceToggle
            checked={draft.plan}
            label="Kế hoạch hỗ trợ"
            note="Mục tiêu và các bước bạn đang theo đuổi"
            icon="✦"
            onChange={(plan) => setDraft((current) => ({ ...current, plan }))}
          />
          <SourceToggle
            checked={draft.diary}
            label="Nhật ký"
            note="Nội dung riêng tư · dùng tối đa 3 nhật ký gần đây"
            icon="☁"
            onChange={(diary) => setDraft((current) => ({ ...current, diary }))}
          />
          <SourceToggle
            checked={draft.screening}
            label="Bài sàng lọc"
            note="Các kết quả gần đây, không phải chẩn đoán"
            icon="✓"
            onChange={(screening) =>
              setDraft((current) => ({ ...current, screening }))
            }
          />

          <section className={styles.resourceSourceGroup}>
            <header>
              <div>
                <span aria-hidden="true">◌</span>
                <div>
                  <strong>Tài nguyên</strong>
                  <small>Những nội dung bạn đã xem trong 31 ngày gần đây</small>
                </div>
              </div>
              <b>{draft.resourceIds.length} đã chọn</b>
            </header>
            <div className={styles.sourceGroupMeta}>
              <button
                type="button"
                disabled={resources.length === 0}
                onClick={() =>
                  setDraft((current) => ({
                    ...current,
                    resourceIds:
                      current.resourceIds.length === resources.length
                        ? []
                        : resources.map((resource) => resource.id),
                  }))
                }
              >
                {draft.resourceIds.length === resources.length &&
                resources.length > 0
                  ? 'Bỏ chọn'
                  : 'Chọn tất cả'}
              </button>
              <span>
                {draft.resourceIds.length}/{resources.length}
              </span>
            </div>
            <label className={styles.resourceSearch}>
              <span className="sr-only">Tìm tài nguyên đã xem</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tài nguyên đã xem…"
              />
            </label>
            <div className={styles.resourceSourceList}>
              {filtered.length === 0 ? (
                <p>Chưa có tài nguyên đã xem để chọn.</p>
              ) : (
                filtered.map((resource) => (
                  <label key={resource.id}>
                    <input
                      type="checkbox"
                      checked={selectedResources.has(resource.id)}
                      onChange={() => toggleResource(resource.id)}
                    />
                    <span>
                      <strong>{resource.title}</strong>
                      <small>{resource.summary}</small>
                    </span>
                  </label>
                ))
              )}
            </div>
          </section>
        </div>

        <footer className={styles.contextDialogFooter}>
          <p>AI chỉ đọc những mục bạn bật.</p>
          <div>
            <button type="button" onClick={onClose} disabled={saving}>
              Hủy
            </button>
            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={saving}
            >
              {saving ? 'Đang lưu…' : 'Lưu'}
            </button>
          </div>
        </footer>
      </div>
    </div>
  )
}
