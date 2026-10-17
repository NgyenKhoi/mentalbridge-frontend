'use client'

import { type FormEvent, useState } from 'react'
import { FilePlus2, X } from 'lucide-react'

import { Dialog } from '@/components/ui/Dialog'
import {
  BrowserConsultationError,
  browserConsultation,
} from '../api/browser-client'
import type { CredentialDocument } from '../api/credential-validation'
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
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const file = form.get('file')
    if (
      !(file instanceof File) ||
      file.size === 0 ||
      file.size > 10 * 1024 * 1024 ||
      !['application/pdf', 'image/jpeg', 'image/png'].includes(file.type)
    ) {
      setError('Chọn tệp PDF, JPG hoặc PNG tối đa 10 MB.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await browserConsultation.uploadCredential(form)
      onUploaded(result.data)
      formElement.reset()
      onClose()
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
      onOpenChange={(next) => !next && !busy && onClose()}
      labelledBy="credential-upload-title"
      describedBy="credential-upload-description"
      className={styles.dialog}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div>
            <span>Nơi nhận giấy tờ</span>
            <h2 id="credential-upload-title">Thêm giấy tờ</h2>
            <p id="credential-upload-description">
              Giấy tờ sẽ chờ xác minh trước khi bạn có thể hiện huy hiệu trên hồ sơ.
            </p>
          </div>
          <button
            type="button"
            data-profile-ui
            className={styles.closeButton}
            onClick={onClose}
            disabled={busy}
            aria-label="Đóng"
          >
            <X aria-hidden="true" />
          </button>
        </header>
        <form onSubmit={(event) => void submit(event)} className={styles.form}>
          <label className={styles.field}>
            Loại giấy tờ
            <select name="credentialType" defaultValue="DEGREE" required className={styles.input}>
              <option value="DEGREE">Bằng cấp</option>
              <option value="LICENSE">Giấy phép hành nghề</option>
              <option value="CERTIFICATE">Chứng chỉ</option>
            </select>
          </label>
          <label className={styles.field}>
            Tên giấy tờ
            <input
              name="title"
              maxLength={160}
              required
              placeholder="Ví dụ: Bằng Thạc sĩ Tâm lý học lâm sàng"
              className={styles.input}
            />
          </label>
          <div className={styles.gridRow}>
            <label className={styles.field}>
              Nơi cấp
              <input
                name="issuer"
                maxLength={160}
                required
                placeholder="Tên trường hoặc đơn vị cấp"
                className={styles.input}
              />
            </label>
            <label className={`${styles.field} ${styles.yearField}`}>
              Năm cấp
              <input
                name="issueYear"
                type="number"
                min={1900}
                max={new Date().getFullYear()}
                required
                placeholder="YYYY"
                className={styles.input}
              />
            </label>
          </div>
          <label className={styles.field}>
            Tệp gốc
            <input
              name="file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              required
              className={styles.fileInput}
            />
            <small>PDF, JPG hoặc PNG · tối đa 10 MB</small>
          </label>
          <p className={styles.privacy}>
            Tệp gốc chỉ bạn và đội ngũ xác minh xem được. Người dùng chỉ thấy
            huy hiệu khi giấy tờ đã xác minh và bạn bật hiển thị.
          </p>
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          <footer>
            <button
              type="button"
              data-profile-ui
              className={styles.cancelButton}
              onClick={onClose}
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
