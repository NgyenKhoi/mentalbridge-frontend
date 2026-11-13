'use client'

import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import { FilePlus2, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import {
  BrowserConsultationError,
  browserConsultation,
} from '../api/browser-client'
import type { CredentialDocument } from '../api/credential-validation'
import {
  readCredentialFile,
  supportedCredentialFile,
  type CredentialReading,
} from '../services/credential-file-evidence'
import styles from './SpecialistCredentialUploadDialog.module.css'

export default function SpecialistCredentialUploadDialog({
  open,
  onClose,
  onUploaded,
}: {
  open: boolean
  onClose: () => void
  onUploaded: (document: CredentialDocument) => void
}) {
  const formRef = useRef<HTMLFormElement | null>(null)
  const activeRead = useRef<AbortController | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [readingStatus, setReadingStatus] = useState('')
  const [reading, setReading] = useState<CredentialReading | null>(null)

  function stopReading() {
    activeRead.current?.abort()
    activeRead.current = null
  }

  function close() {
    stopReading()
    setBusy(false)
    setError('')
    setReadingStatus('')
    setReading(null)
    onClose()
  }

  async function readSelectedFile(event: ChangeEvent<HTMLInputElement>) {
    stopReading()
    setError('')
    const file = event.target.files?.[0]
    if (!file || !supportedCredentialFile(file)) return
    const request = new AbortController()
    activeRead.current = request
    const signal = AbortSignal.any([
      request.signal,
      AbortSignal.timeout(90_000),
    ])
    setReadingStatus('Đang đọc nội dung tệp bằng OCR…')
    try {
      const result = await readCredentialFile(file, signal)
      signal.throwIfAborted()
      setReading(result)
      setReadingStatus(
        result.text
          ? 'Đã đọc nội dung thành công. Hãy so sánh thông tin với giấy tờ gốc.'
          : 'Không đọc được chữ rõ nét. Bạn có thể tự nhập thông tin theo bản gốc.',
      )
    } catch {
      if (!request.signal.aborted)
        setReadingStatus(
          'Chưa đọc được tệp. Bạn có thể nhập thông tin theo bản gốc.',
        )
    }
  }

  function applyReading() {
    if (!reading || !formRef.current) return
    const { title, credentialType, issuer, issueYear } = reading.fields
    for (const [name, value] of Object.entries({
      title,
      credentialType,
      issuer,
      issueYear,
    })) {
      const field = formRef.current.elements.namedItem(name)
      if (
        value &&
        (field instanceof HTMLInputElement ||
          field instanceof HTMLSelectElement)
      ) {
        field.value = value
      }
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const file = form.get('file')
    if (!(file instanceof File) || !supportedCredentialFile(file)) {
      setError('Chọn tệp PDF, JPG hoặc PNG tối đa 10 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await browserConsultation.uploadCredential(form)
      onUploaded(result.data)
      formElement.reset()
      close()
    } catch (cause) {
      setError(
        cause instanceof BrowserConsultationError && cause.status === 503
          ? 'Chưa thể tải giấy tờ lên lúc này. Vui lòng thử lại sau.'
          : cause instanceof Error
            ? cause.message
            : 'Không thể tải giấy tờ. Hãy thử lại.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && !busy && close()}
      labelledBy="credential-upload-title"
      describedBy="credential-upload-description"
      className={styles.dialog}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <h2 id="credential-upload-title">Tải lên giấy tờ chuyên môn</h2>
            <p id="credential-upload-description">
              Tải lên chứng chỉ hành nghề hoặc văn bằng để quản trị viên đối
              chiếu. Thông tin sẽ được tự động điền nếu hệ thống đọc được tệp.
            </p>
          </div>
          <button
            type="button"
            data-profile-ui
            className={styles.closeButton}
            onClick={close}
            disabled={busy}
            aria-label="Đóng"
          >
            <X aria-hidden="true" />
          </button>
        </header>

        <form
          ref={formRef}
          className={styles.form}
          onSubmit={(event) => void submit(event)}
        >
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <label className={styles.field}>
            Tệp gốc văn bằng / CCHN
            <input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => void readSelectedFile(event)}
              disabled={busy}
              required
              className={styles.fileInput}
            />
            <small>
              PDF, JPG hoặc PNG · tối đa 10 MB. Giấy tờ sẽ ở trạng thái chờ xác
              minh sau khi tải lên.
            </small>
          </label>

          {readingStatus && (
            <div className={styles.scannerStatus} role="status">
              <span className={styles.laserLine} />
              <p>{readingStatus}</p>
              {reading?.text && (
                <button
                  type="button"
                  data-profile-ui
                  className={styles.autofillButton}
                  onClick={applyReading}
                >
                  Tự động điền theo tệp vừa đọc
                </button>
              )}
            </div>
          )}

          <label className={styles.field}>
            Tên giấy tờ
            <input
              name="title"
              type="text"
              required
              maxLength={160}
              placeholder="VD: Chứng chỉ hành nghề khám bệnh, chữa bệnh"
              disabled={busy}
            />
          </label>

          <label className={styles.field}>
            Loại giấy tờ
            <select
              name="credentialType"
              required
              defaultValue=""
              disabled={busy}
            >
              <option value="" disabled>
                Chọn loại giấy tờ
              </option>
              <option value="LICENSE">Giấy phép / Chứng chỉ hành nghề</option>
              <option value="DEGREE">Bằng cấp chuyên môn</option>
              <option value="CERTIFICATE">Chứng nhận chuyên khoa</option>
            </select>
          </label>

          <label className={styles.field}>
            Cơ quan / Đơn vị cấp
            <input
              name="issuer"
              type="text"
              required
              maxLength={160}
              placeholder="VD: Sở Y tế TP. Hồ Chí Minh"
              disabled={busy}
            />
          </label>

          <label className={styles.field}>
            Năm cấp
            <input
              name="issueYear"
              type="number"
              required
              min={1950}
              max={new Date().getFullYear()}
              placeholder={String(new Date().getFullYear())}
              disabled={busy}
            />
          </label>

          <footer className={styles.actions}>
            <button
              type="button"
              data-profile-ui
              className={styles.cancelButton}
              onClick={close}
              disabled={busy}
            >
              Hủy
            </button>
            <button
              type="submit"
              data-profile-ui
              className={`btn-primary ${styles.submitButton}`}
              disabled={busy}
            >
              <FilePlus2 aria-hidden="true" />{' '}
              {busy ? 'Đang tải lên…' : 'Tải lên để xác minh'}
            </button>
          </footer>
        </form>
      </div>
    </Dialog>
  )
}
