'use client'

import { useEffect, useState } from 'react'
import type { SpecialistProfile } from '@/lib/consultation/consultation-validation'
import { browserConsultation } from '../api/browser-client'
import styles from './AdminSpecialistReviewSection.module.css'

const supportLabels = {
  DEPRESSIVE_SYMPTOMS: 'Cảm xúc trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
} as const

export default function AdminSpecialistReviewSection() {
  const [items, setItems] = useState<SpecialistProfile[]>([])
  const [selected, setSelected] = useState<SpecialistProfile | null>(null)
  const [etag, setEtag] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    let active = true
    browserConsultation
      .pending()
      .then((result) => {
        if (active) setItems(result.data.items)
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(
            cause instanceof Error ? cause.message : 'Không thể tải hàng đợi.',
          )
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  async function inspect(id: string) {
    setError('')
    setNotice('')
    try {
      const result = await browserConsultation.detail(id)
      setSelected(result.data)
      setEtag(result.etag)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.')
    }
  }

  async function approve() {
    if (!selected || !etag) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await browserConsultation.approve(selected.accountId, etag)
      setItems((current) =>
        current.filter((item) => item.accountId !== selected.accountId),
      )
      setSelected(null)
      setEtag(null)
      setNotice('Đã phê duyệt hồ sơ chuyên gia.')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể phê duyệt hồ sơ.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={styles.workspace}>
      <header>
        <span>XÉT DUYỆT CHUYÊN GIA</span>
        <h1>Hồ sơ đang chờ</h1>
        <p>
          Chỉ xét sáu trường hồ sơ công khai. Luồng này không xác minh bằng cấp,
          giấy phép hay tài liệu.
        </p>
      </header>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className={styles.notice} role="status">
          {notice}
        </p>
      )}
      <div className={styles.layout}>
        <div className={styles.queue}>
          <h2>
            Hàng đợi <b>{items.length}</b>
          </h2>
          {loading ? (
            <p>Đang tải…</p>
          ) : items.length === 0 ? (
            <p>Không có hồ sơ đang chờ.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.accountId}
                onClick={() => void inspect(item.accountId)}
                aria-pressed={selected?.accountId === item.accountId}
              >
                <strong>{item.displayName}</strong>
                <span>
                  {item.supportAreas
                    .map((area) => supportLabels[area])
                    .join(' · ')}
                </span>
                <small>
                  Gửi{' '}
                  {item.submittedAt
                    ? new Date(item.submittedAt).toLocaleString('vi-VN')
                    : ''}
                </small>
              </button>
            ))
          )}
        </div>
        <article className={styles.detail}>
          {selected ? (
            <>
              <div className={styles.detailHead}>
                <div>
                  <small>HỒ SƠ #{selected.accountId.slice(0, 8)}</small>
                  <h2>{selected.displayName}</h2>
                </div>
                <span>ĐANG CHỜ</span>
              </div>
              <p>{selected.bio}</p>
              <dl>
                <div>
                  <dt>Lĩnh vực hỗ trợ</dt>
                  <dd>
                    {selected.supportAreas
                      .map((area) => supportLabels[area])
                      .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Ngôn ngữ</dt>
                  <dd>{selected.languages.join(', ')}</dd>
                </div>
                <div>
                  <dt>Kinh nghiệm</dt>
                  <dd>{selected.yearsOfExperience} năm</dd>
                </div>
                <div>
                  <dt>Múi giờ</dt>
                  <dd>{selected.timezone}</dd>
                </div>
              </dl>
              <aside>
                Việc phê duyệt chỉ xác nhận hồ sơ vận hành được phép hiển thị;
                không tạo tuyên bố “đã xác minh giấy phép”.
              </aside>
              <button
                className={styles.approve}
                disabled={busy}
                onClick={() => void approve()}
              >
                {busy ? 'Đang phê duyệt…' : 'Phê duyệt hồ sơ'}
              </button>
            </>
          ) : (
            <div className={styles.empty}>
              <strong>Chọn một hồ sơ</strong>
              <p>Thông tin đầy đủ sẽ hiện tại đây trước khi bạn quyết định.</p>
            </div>
          )}
        </article>
      </div>
    </section>
  )
}
