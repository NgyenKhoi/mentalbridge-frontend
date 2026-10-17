'use client'

import { useEffect, useState } from 'react'
import { Download, Eye, FileText, Minus, Plus, RotateCw, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import { browserConsultation } from '../api/browser-client'
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
  const [userSelectedId, setUserSelectedId] = useState<string | null>(null)
  const [loadedDoc, setLoadedDoc] = useState<{
    id: string
    url: string | null
  } | null>(null)
  const [error, setError] = useState('')
  const [zoom, setZoom] = useState(100)
  const activeId = userSelectedId ?? selectedId ?? documents[0]?.id ?? null
  const selected =
    documents.find((item) => item.id === activeId) ?? documents[0] ?? null
  const url =
    loadedDoc && selected && loadedDoc.id === selected.id ? loadedDoc.url : null

  useEffect(() => {
    if (!open || !selected) return
    let active = true
    browserConsultation
      .credentialFile(selected.id)
      .then((result) => {
        if (active) {
          setLoadedDoc({ id: selected.id, url: result.data.url })
          setError('')
        }
      })
      .catch(() => {
        if (active) {
          setLoadedDoc({ id: selected.id, url: null })
          setError('Không thể mở tệp. Hãy thử lại.')
        }
      })
    return () => {
      active = false
    }
  }, [open, selected])

  async function download() {
    if (!selected) return
    try {
      const result = await browserConsultation.credentialFile(selected.id, true)
      window.location.assign(result.data.url)
    } catch {
      setError('Không thể tải tệp. Hãy thử lại.')
    }
  }

  const verifiedCount = documents.filter(
    (item) => item.verificationStatus === 'VERIFIED',
  ).length

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
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
            onClick={onClose}
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
                  setUserSelectedId(document.id)
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
                    <div className={styles.viewerState}>
                      {error || 'Đang mở tệp…'}
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
                      disabled={zoom <= 50}
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
                      disabled={zoom >= 150}
                      aria-label="Phóng to"
                    >
                      <Plus aria-hidden="true" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setLoadedDoc(null)
                      void browserConsultation
                        .credentialFile(selected.id)
                        .then((result) => {
                          setLoadedDoc({
                            id: selected.id,
                            url: result.data.url,
                          })
                          setError('')
                        })
                        .catch(() => setError('Không thể mở tệp. Hãy thử lại.'))
                    }}
                  >
                    <RotateCw aria-hidden="true" /> Tải lại
                  </button>
                  <button type="button" onClick={() => void download()}>
                    <Download aria-hidden="true" /> Tải xuống
                  </button>
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
