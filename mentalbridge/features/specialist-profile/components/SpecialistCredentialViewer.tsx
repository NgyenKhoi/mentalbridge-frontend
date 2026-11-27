'use client'

import { useEffect, useState } from 'react'
import { Download, Eye, FileText, Minus, Plus, RotateCw, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import {
  BrowserConsultationError,
  browserConsultation,
} from '../api/browser-client'
import type { CredentialDocument } from '../api/credential-validation'
import styles from './SpecialistDocumentsPreview.module.css'

export default function SpecialistCredentialViewer({
  open,
  onClose,
  documents,
  selectedId,
}: {
  open: boolean
  onClose: () => void
  documents: CredentialDocument[]
  selectedId: string | null
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const [prevSelectedId, setPrevSelectedId] = useState<string | null>(
    selectedId,
  )
  const [attempt, setAttempt] = useState(0)
  if (selectedId !== prevSelectedId) {
    setPrevSelectedId(selectedId)
    setActiveId(null)
    setAttempt(attempt + 1)
  }
  const [preview, setPreview] = useState<{
    id: string
    attempt: number
    url?: string
    error?: string
  } | null>(null)
  const [zoom, setZoom] = useState(100)
  const effectiveId = activeId ?? selectedId ?? documents[0]?.id ?? null
  const selected =
    documents.find((item) => item.id === effectiveId) ?? documents[0] ?? null
  const documentId = selected?.id
  const current =
    preview?.id === documentId && preview?.attempt === attempt ? preview : null
  const url = current?.url
  const loading = Boolean(documentId && !current)

  useEffect(() => {
    if (!open || !documentId) return
    const request = new AbortController()
    let objectUrl: string | undefined
    browserConsultation
      .credentialFile(documentId, request.signal)
      .then((file) => {
        if (request.signal.aborted) return
        objectUrl = URL.createObjectURL(file)
        setPreview({ id: documentId, attempt, url: objectUrl })
      })
      .catch((error: unknown) => {
        if (request.signal.aborted) return
        setPreview({
          id: documentId,
          attempt,
          error:
            error instanceof BrowserConsultationError && error.status === 429
              ? 'Tệp đang được tải quá nhiều lần. Hãy đợi một lúc rồi thử lại.'
              : 'Không thể mở tệp. Hãy thử lại.',
        })
      })
    return () => {
      request.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [open, documentId, attempt])

  function reload() {
    setAttempt((value) => value + 1)
  }

  function close() {
    reload()
    onClose()
  }

  const verifiedCount = documents.filter(
    (item) => item.verificationStatus === 'VERIFIED',
  ).length

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && close()}
      labelledBy="specialist-documents-title"
      describedBy="specialist-documents-description"
      className={styles.dialog}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span className={styles.eyebrow}>Giấy tờ của bạn</span>
            <h2 id="specialist-documents-title">Giấy tờ đã tải lên</h2>
            <p id="specialist-documents-description">
              {documents.length} giấy tờ · {verifiedCount} đã xác minh. Tệp gốc
              chỉ bạn và đội ngũ xác minh xem được.
            </p>
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={close}
            aria-label="Đóng giấy tờ"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <div className={styles.content}>
          <nav className={styles.list} aria-label="Danh sách giấy tờ">
            {documents.map((document) => (
              <button
                key={document.id}
                type="button"
                className={styles.document}
                aria-current={selected?.id === document.id ? 'true' : undefined}
                onClick={() => {
                  if (document.id === documentId) return
                  reload()
                  setActiveId(document.id)
                  setZoom(100)
                }}
              >
                <span className={styles.documentIcon}>
                  <FileText aria-hidden="true" />
                </span>
                <span>
                  <strong>{document.title}</strong>
                  <small>
                    {document.verificationStatus === 'VERIFIED'
                      ? 'Đã xác minh'
                      : document.verificationStatus === 'REJECTED'
                        ? 'Chưa được xác minh'
                        : 'Đang chờ xác minh'}
                  </small>
                </span>
              </button>
            ))}
            {documents.length === 0 && (
              <p className={styles.empty}>Bạn chưa tải giấy tờ lên.</p>
            )}
          </nav>
          <section
            className={styles.viewer}
            aria-label={selected ? `Xem ${selected.title}` : 'Xem giấy tờ'}
          >
            {selected ? (
              <>
                <div className={styles.metadata}>
                  <div>
                    <span>Loại</span>
                    <strong>
                      {selected.credentialType === 'DEGREE'
                        ? 'Bằng cấp'
                        : selected.credentialType === 'LICENSE'
                          ? 'Giấy phép'
                          : 'Chứng chỉ'}
                    </strong>
                  </div>
                  <div>
                    <span>Nơi cấp</span>
                    <strong>{selected.issuer}</strong>
                  </div>
                  <div>
                    <span>Năm cấp</span>
                    <strong>{selected.issueYear}</strong>
                  </div>
                  <div>
                    <span>Tệp</span>
                    <strong>
                      {selected.fileName} ·{' '}
                      {(selected.fileBytes / 1024 / 1024).toFixed(1)} MB
                    </strong>
                  </div>
                </div>
                <div className={styles.stage}>
                  {url ? (
                    <iframe
                      title={`Bản gốc ${selected.title}`}
                      src={url}
                      className={styles.original}
                      style={{ zoom: `${zoom}%` }}
                    />
                  ) : (
                    <div className={styles.viewerState} role="status">
                      {current?.error || 'Đang mở tệp…'}
                    </div>
                  )}
                </div>
                <footer className={styles.tools}>
                  <div
                    className={styles.zoom}
                    role="group"
                    aria-label="Thu phóng tệp"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setZoom((value) => Math.max(50, value - 10))
                      }
                      disabled={!url || zoom <= 50}
                      aria-label="Thu nhỏ"
                    >
                      <Minus aria-hidden="true" />
                    </button>
                    <span>{zoom}%</span>
                    <button
                      type="button"
                      onClick={() =>
                        setZoom((value) => Math.min(150, value + 10))
                      }
                      disabled={!url || zoom >= 150}
                      aria-label="Phóng to"
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                  <button type="button" onClick={reload} disabled={loading}>
                    <RotateCw aria-hidden="true" /> Tải lại
                  </button>
                  {url ? (
                    <a href={url} download={selected.fileName}>
                      <Download aria-hidden="true" /> Tải xuống
                    </a>
                  ) : (
                    <button type="button" disabled>
                      <Download aria-hidden="true" /> Tải xuống
                    </button>
                  )}
                </footer>
              </>
            ) : (
              <div className={styles.viewerState}>
                <Eye aria-hidden="true" /> Chọn giấy tờ để xem bản gốc.
              </div>
            )}
          </section>
        </div>
      </div>
    </Dialog>
  )
}
