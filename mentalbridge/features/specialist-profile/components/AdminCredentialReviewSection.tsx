'use client'

import { useEffect, useState } from 'react'
import { Check, Eye, FileBadge2, RefreshCw, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { browserConsultation } from '../api/browser-client'
import type { CredentialDocument } from '../api/credential-validation'
import styles from './AdminCredentialReviewSection.module.css'

export default function AdminCredentialReviewSection() {
  const { confirm, showActionToast } = useFeedback()
  const [documents, setDocuments] = useState<CredentialDocument[]>([])
  const [selected, setSelected] = useState<CredentialDocument | null>(null)
  const [fileUrl, setFileUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const result = await browserConsultation.pendingCredentialDocuments()
      setDocuments(result.data)
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Không thể tải giấy tờ đang chờ.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    let active = true
    browserConsultation
      .pendingCredentialDocuments()
      .then((result) => {
        if (active) {
          setDocuments(result.data)
          setLoading(false)
        }
      })
      .catch((cause) => {
        if (active) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Không thể tải giấy tờ đang chờ.',
          )
          setLoading(false)
        }
      })
    return () => {
      active = false
    }
  }, [])

  const selectedId = selected?.id

  useEffect(() => {
    if (!selectedId) return
    let active = true
    browserConsultation
      .adminCredentialFile(selectedId)
      .then((result) => {
        if (active) setFileUrl(result.data.url)
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : 'Không thể mở tệp gốc.',
          )
      })
    return () => {
      active = false
    }
  }, [selectedId])

  function inspect(document: CredentialDocument) {
    setSelected(document)
    setFileUrl(null)
    setError('')
  }

  async function decide(decision: 'verify' | 'reject') {
    if (!selected) return
    const approved = await confirm({
      title:
        decision === 'verify'
          ? 'Xác minh giấy tờ này?'
          : 'Từ chối giấy tờ này?',
      description:
        decision === 'verify'
          ? 'Chuyên gia có thể tự bật huy hiệu công khai sau khi giấy tờ được xác minh.'
          : 'Chuyên gia sẽ thấy giấy tờ chưa được xác minh và có thể tải lại giấy tờ khác.',
      confirmLabel: decision === 'verify' ? 'Xác minh' : 'Từ chối',
      ...(decision === 'reject' ? { tone: 'danger' as const } : {}),
    })
    if (!approved) return
    setBusy(true)
    setError('')
    try {
      await browserConsultation.reviewCredential(
        selected.id,
        decision,
        selected.version,
      )
      setDocuments((current) =>
        current.filter((item) => item.id !== selected.id),
      )
      setSelected(null)
      setFileUrl(null)
      showActionToast({
        title:
          decision === 'verify' ? 'Đã xác minh giấy tờ' : 'Đã từ chối giấy tờ',
        tone: 'success',
      })
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể cập nhật giấy tờ.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      className={styles.section}
      aria-labelledby="credential-review-title"
    >
      <div className={styles.heading}>
        <div>
          <span className={styles.overline}>XÁC MINH RIÊNG TƯ</span>
          <h2 id="credential-review-title">
            Giấy tờ chuyên gia <b>{documents.length}</b>
          </h2>
          <p>
            Chỉ quản trị viên xem được tệp gốc. Huy hiệu công khai do chuyên gia
            bật sau khi được xác minh.
          </p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => void load()}
          disabled={loading}
        >
          <RefreshCw aria-hidden="true" /> Làm mới
        </button>
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {loading ? (
        <p className={styles.empty}>Đang tải giấy tờ…</p>
      ) : documents.length === 0 ? (
        <p className={styles.empty}>Không có giấy tờ đang chờ xác minh.</p>
      ) : (
        <div className={styles.list}>
          {documents.map((document) => (
            <article key={document.id} className={styles.row}>
              <span className={styles.icon}>
                <FileBadge2 aria-hidden="true" />
              </span>
              <div>
                <strong>{document.title}</strong>
                <small>
                  {document.issuer} · {document.issueYear} · {document.fileName}
                </small>
                <small>
                  Chuyên gia #{document.specialistAccountId.slice(0, 8)} · Đã
                  gửi {new Date(document.createdAt).toLocaleDateString('vi-VN')}
                </small>
              </div>
              <button type="button" onClick={() => void inspect(document)}>
                <Eye aria-hidden="true" /> Xem tệp
              </button>
            </article>
          ))}
        </div>
      )}
      <Dialog
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open && !busy) {
            setSelected(null)
            setFileUrl(null)
          }
        }}
        labelledBy="credential-review-document-title"
        className={styles.dialog}
      >
        {selected && (
          <div className={styles.viewer}>
            <header>
              <div>
                <span>GIẤY TỜ CHỜ XÁC MINH</span>
                <h2 id="credential-review-document-title">{selected.title}</h2>
                <p>
                  {selected.issuer} · {selected.issueYear} · {selected.fileName}
                </p>
              </div>
              <button
                type="button"
                aria-label="Đóng"
                disabled={busy}
                onClick={() => {
                  setSelected(null)
                  setFileUrl(null)
                }}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            {fileUrl ? (
              <iframe title={`Tệp gốc ${selected.title}`} src={fileUrl} />
            ) : (
              <p className={styles.empty}>{error || 'Đang mở tệp gốc…'}</p>
            )}
            <footer>
              <button
                type="button"
                disabled={busy}
                onClick={() => void decide('reject')}
              >
                <X aria-hidden="true" /> Từ chối
              </button>
              <button
                type="button"
                disabled={busy || !fileUrl}
                onClick={() => void decide('verify')}
              >
                <Check aria-hidden="true" /> Xác minh
              </button>
            </footer>
          </div>
        )}
      </Dialog>
    </section>
  )
}
