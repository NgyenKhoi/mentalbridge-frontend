'use client'

import { useEffect, useId, useState } from 'react'
import { Check, Eye, FileBadge2, RefreshCw, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { browserConsultation } from '../api/browser-client'
import type { CredentialDocument } from '../api/credential-validation'
import CredentialEvidencePanel from './CredentialEvidencePanel'
import styles from './AdminCredentialReviewSection.module.css'

const statusLabels = {
  PENDING: 'Đang chờ xác minh',
  VERIFIED: 'Đã xác minh',
  REJECTED: 'Đã từ chối',
} satisfies Record<CredentialDocument['verificationStatus'], string>

export default function AdminCredentialReviewSection({
  specialistId,
  refreshRevision = 0,
  onReviewed,
}: {
  specialistId?: string
  refreshRevision?: number
  onReviewed?: () => void
}) {
  const id = useId()
  const { confirm, showActionToast } = useFeedback()
  const [documents, setDocuments] = useState<CredentialDocument[]>([])
  const [selected, setSelected] = useState<CredentialDocument | null>(null)
  const [file, setFile] = useState<{ documentId: string; url: string } | null>(
    null,
  )
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    let active = true
    const request = specialistId
      ? browserConsultation.adminSpecialistCredentialDocuments(specialistId)
      : browserConsultation.pendingCredentialDocuments()
    request
      .then((result) => {
        if (!active) return
        setDocuments(result.data)
      })
      .catch((cause) => {
        if (!active) return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Không thể tải danh sách giấy tờ.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [refreshRevision, retry, specialistId])

  const selectedId = selected?.id

  useEffect(() => {
    if (!selectedId) return
    let active = true
    browserConsultation
      .adminCredentialFile(selectedId)
      .then((result) => {
        if (active) setFile({ documentId: selectedId, url: result.data.url })
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
    setFile(null)
    setError('')
  }

  async function decide(decision: 'verify' | 'reject') {
    if (!selected || selected.verificationStatus !== 'PENDING') return
    const approved = await confirm({
      title:
        decision === 'verify'
          ? 'Xác minh giấy tờ này?'
          : 'Từ chối giấy tờ này?',
      description:
        decision === 'verify'
          ? 'Chỉ xác minh sau khi bạn đã kiểm tra bản gốc và đối chiếu với đơn vị cấp. Sau đó, chuyên gia có thể bật huy hiệu công khai.'
          : 'Chuyên gia sẽ thấy giấy tờ chưa được xác minh và có thể tải lại giấy tờ khác.',
      confirmLabel: decision === 'verify' ? 'Xác minh' : 'Từ chối',
      ...(decision === 'reject' ? { tone: 'danger' as const } : {}),
    })
    if (!approved) return
    setBusy(true)
    setError('')
    try {
      const result = await browserConsultation.reviewCredential(
        selected.id,
        decision,
        selected.version,
      )
      setDocuments((current) =>
        specialistId
          ? current.map((item) =>
              item.id === selected.id ? result.data : item,
            )
          : current.filter((item) => item.id !== selected.id),
      )
      setSelected(null)
      setFile(null)
      onReviewed?.()
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
    <section className={styles.section} aria-labelledby={`${id}-title`}>
      <div className={styles.heading}>
        <div>
          <span className={styles.overline}>XÁC MINH RIÊNG TƯ</span>
          <h2 id={`${id}-title`}>
            {specialistId ? 'Giấy tờ của chuyên gia' : 'Giấy tờ chuyên gia'}{' '}
            <b>{documents.length}</b>
          </h2>
          <p>Mở bản gốc để kiểm tra và đối chiếu thủ công với đơn vị cấp.</p>
        </div>
        <button
          type="button"
          className={styles.refresh}
          onClick={() => {
            setError('')
            setLoading(true)
            setRetry((current) => current + 1)
          }}
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
        !error && (
          <p className={styles.empty}>
            {specialistId
              ? 'Chuyên gia chưa tải lên giấy tờ.'
              : 'Không có giấy tờ đang chờ xác minh.'}
          </p>
        )
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
                <small>{statusLabels[document.verificationStatus]}</small>
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
            setFile(null)
          }
        }}
        labelledBy={`${id}-document-title`}
        className={styles.dialog}
      >
        {selected && (
          <div className={styles.viewer}>
            <header>
              <div>
                <span>{statusLabels[selected.verificationStatus]}</span>
                <h2 id={`${id}-document-title`}>{selected.title}</h2>
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
                  setFile(null)
                }}
              >
                <X aria-hidden="true" />
              </button>
            </header>
            {file?.documentId === selected.id ? (
              <div className={styles.viewerBody}>
                <iframe
                  title={`Tệp gốc ${selected.title}`}
                  src={file.url}
                  referrerPolicy="no-referrer"
                />
                <CredentialEvidencePanel
                  key={selected.id}
                  credential={selected}
                  url={file.url}
                />
              </div>
            ) : (
              <p className={styles.empty}>{error || 'Đang mở tệp gốc…'}</p>
            )}
            {selected.verificationStatus === 'PENDING' && (
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
                  disabled={busy || file?.documentId !== selected.id}
                  onClick={() => void decide('verify')}
                >
                  <Check aria-hidden="true" /> Xác minh
                </button>
              </footer>
            )}
          </div>
        )}
      </Dialog>
    </section>
  )
}
