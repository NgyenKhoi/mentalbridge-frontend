'use client'

import { FormEvent, useEffect, useState } from 'react'
import {
  browserConsultation,
  BrowserConsultationError,
} from '../api/browser-client'
import type {
  SpecialistProfileInput,
  SupportArea,
} from '@/lib/consultation/consultation-validation'
import styles from './SpecialistProfileWorkspace.module.css'

const empty: SpecialistProfileInput = {
  displayName: '',
  bio: '',
  supportAreas: [],
  languages: ['vi'],
  yearsOfExperience: 0,
  timezone:
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Ho_Chi_Minh',
}

export default function SpecialistProfileWorkspace() {
  const [form, setForm] = useState<SpecialistProfileInput>(empty)
  const [etag, setEtag] = useState<string | null>(null)
  const [status, setStatus] = useState<
    'NEW' | 'PENDING_DRAFT' | 'PENDING_REVIEW' | 'APPROVED'
  >('NEW')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    browserConsultation
      .own()
      .then((result) => {
        if (!active) return
        setForm(result.data)
        setEtag(result.etag)
        setStatus(
          result.data.approvalStatus === 'APPROVED'
            ? 'APPROVED'
            : result.data.submittedAt
              ? 'PENDING_REVIEW'
              : 'PENDING_DRAFT',
        )
      })
      .catch((cause: unknown) => {
        if (
          active &&
          (!(cause instanceof BrowserConsultationError) || cause.status !== 404)
        ) {
          setError(
            cause instanceof Error ? cause.message : 'Không thể tải hồ sơ.',
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

  function toggleArea(area: SupportArea) {
    setForm((current) => ({
      ...current,
      supportAreas: current.supportAreas.includes(area)
        ? current.supportAreas.filter((item) => item !== area)
        : [...current.supportAreas, area],
    }))
  }
  function toggleLanguage(language: string) {
    setForm((current) => ({
      ...current,
      languages: current.languages.includes(language)
        ? current.languages.filter((item) => item !== language)
        : [...current.languages, language],
    }))
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await browserConsultation.save(form, etag)
      setForm(result.data)
      setEtag(result.etag)
      setStatus('PENDING_DRAFT')
      setNotice(
        status === 'PENDING_REVIEW'
          ? 'Đã lưu thay đổi. Hồ sơ được rút khỏi hàng đợi; hãy gửi lại khi sẵn sàng.'
          : 'Đã lưu hồ sơ.',
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể lưu hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!etag) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const result = await browserConsultation.submit(etag)
      setEtag(result.etag)
      setStatus('PENDING_REVIEW')
      setNotice('Hồ sơ đã được gửi để quản trị viên xét duyệt.')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể gửi hồ sơ.')
    } finally {
      setBusy(false)
    }
  }

  if (loading)
    return (
      <section className={styles.card} aria-busy="true">
        Đang tải hồ sơ…
      </section>
    )
  const locked = status === 'APPROVED'
  return (
    <section className={styles.workspace}>
      <header>
        <span>HỒ SƠ CÔNG KHAI</span>
        <h1>Hồ sơ chuyên gia</h1>
        <p>
          Điền thông tin hỗ trợ phi lâm sàng sẽ hiển thị cho người dùng sau khi
          được phê duyệt.
        </p>
      </header>
      <div className={styles.status} data-state={status}>
        <strong>
          {status === 'NEW'
            ? 'Chưa tạo hồ sơ'
            : status === 'PENDING_DRAFT'
              ? 'Bản nháp chờ gửi'
              : status === 'PENDING_REVIEW'
                ? 'Đang chờ xét duyệt'
                : 'Đã phê duyệt'}
        </strong>
        <span>
          {status === 'PENDING_REVIEW'
            ? 'Nếu sửa, hồ sơ sẽ rời hàng đợi cho đến khi bạn gửi lại.'
            : status === 'APPROVED'
              ? 'Hồ sơ đã khóa trong luồng này và đủ điều kiện cho tính năng khám phá ở story sau.'
              : 'Lưu bản nháp, kiểm tra lại rồi gửi duyệt.'}
        </span>
      </div>
      <form className={styles.card} onSubmit={save}>
        <label>
          {' '}
          Tên hiển thị
          <input
            required
            minLength={1}
            maxLength={120}
            disabled={locked}
            value={form.displayName}
            onChange={(e) => setForm({ ...form, displayName: e.target.value })}
          />
        </label>
        <label>
          {' '}
          Giới thiệu
          <textarea
            required
            minLength={1}
            maxLength={2000}
            rows={6}
            disabled={locked}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
          />
        </label>
        <fieldset disabled={locked}>
          <legend>Lĩnh vực hỗ trợ</legend>
          <label>
            <input
              type="checkbox"
              checked={form.supportAreas.includes('DEPRESSIVE_SYMPTOMS')}
              onChange={() => toggleArea('DEPRESSIVE_SYMPTOMS')}
            />{' '}
            Cảm xúc trầm buồn (PHQ-9)
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.supportAreas.includes('ANXIETY_SYMPTOMS')}
              onChange={() => toggleArea('ANXIETY_SYMPTOMS')}
            />{' '}
            Lo âu (GAD-7)
          </label>
        </fieldset>
        <fieldset disabled={locked}>
          <legend>Ngôn ngữ</legend>
          <label>
            <input
              type="checkbox"
              checked={form.languages.includes('vi')}
              onChange={() => toggleLanguage('vi')}
            />{' '}
            Tiếng Việt
          </label>
          <label>
            <input
              type="checkbox"
              checked={form.languages.includes('en')}
              onChange={() => toggleLanguage('en')}
            />{' '}
            English
          </label>
        </fieldset>
        <div className={styles.row}>
          <label>
            Số năm kinh nghiệm
            <input
              type="number"
              min={0}
              max={80}
              required
              disabled={locked}
              value={form.yearsOfExperience}
              onChange={(e) =>
                setForm({ ...form, yearsOfExperience: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Múi giờ
            <input
              required
              disabled={locked}
              value={form.timezone}
              onChange={(e) => setForm({ ...form, timezone: e.target.value })}
            />
          </label>
        </div>
        <p className={styles.scope}>
          Không thu thập bằng cấp, giấy phép, chứng chỉ hoặc tài liệu xác minh
          trong luồng này.
        </p>
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
        {!locked && (
          <div className={styles.actions}>
            <button
              type="submit"
              disabled={
                busy ||
                form.supportAreas.length === 0 ||
                form.languages.length === 0
              }
            >
              {busy ? 'Đang xử lý…' : 'Lưu bản nháp'}
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={busy || !etag || status === 'PENDING_REVIEW'}
              onClick={submit}
            >
              Gửi xét duyệt
            </button>
          </div>
        )}
      </form>
    </section>
  )
}
