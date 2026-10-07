'use client'

import Link from 'next/link'
import { useId, type CSSProperties, type ReactNode } from 'react'
import {
  CalendarDays,
  Check,
  CheckCheck,
  Eye,
  ShieldCheck,
  UserRound,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import type { SpecialistProfileInput } from '@/lib/consultation/consultation-validation'
import { profileAreaLabels, profileLanguageLabels } from './ProfileFields'
import ProfileSnapshot from './ProfileSnapshot'
import styles from './ProfilePage.module.css'

export function profileInitials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words.length
    ? `${words[0][0]}${words.length > 1 ? words.at(-1)![0] : ''}`.toLocaleUpperCase(
        'vi-VN',
      )
    : 'M'
}

export function ProfilePageHeader({
  status,
  warning = false,
  children,
}: {
  status: string
  warning?: boolean
  children?: ReactNode
}) {
  return (
    <header className={styles.header}>
      <div className={styles.headerContext}>
        <nav aria-label="Đường dẫn hồ sơ" className={styles.breadcrumb}>
          <ol>
            <li>
              <Link href="/specialist/dashboard">Không gian chuyên gia</Link>
            </li>
            <li aria-current="page">Hồ sơ</li>
          </ol>
        </nav>
        <div className={styles.titleRow}>
          <h1>Hồ sơ chuyên gia</h1>
          <span className={styles.badge} data-warning={warning}>
            <span aria-hidden="true" />
            {status}
          </span>
        </div>
      </div>
      <div className={styles.headerActions}>{children}</div>
    </header>
  )
}

export function ProfileIdentityCard({
  value,
  approved,
}: {
  value: SpecialistProfileInput
  approved: boolean
}) {
  return (
    <section className={styles.identity} aria-label="Danh tính chuyên gia">
      <div className={styles.identityBanner} aria-hidden="true">
        <span className={styles.lanyard} />
        <span className={styles.identityMark}>MENTALBRIDGE · CHUYÊN GIA</span>
      </div>
      <div className={styles.identityBody}>
        <div className={styles.identityTop}>
          <div className={styles.identityAvatar} aria-hidden="true">
            {profileInitials(value.displayName)}
          </div>
          <div className={styles.identityTags}>
            <span>
              {approved ? (
                <ShieldCheck size={15} aria-hidden="true" />
              ) : (
                <UserRound size={15} aria-hidden="true" />
              )}
              {approved ? 'Hồ sơ đã được duyệt' : 'Hồ sơ chuyên gia'}
            </span>
            {Number.isInteger(value.yearsOfExperience) &&
              value.yearsOfExperience >= 0 && (
                <span>{value.yearsOfExperience} năm kinh nghiệm</span>
              )}
          </div>
        </div>
        <h2>{value.displayName.trim() || 'Tên hiển thị của bạn'}</h2>
        <p>Chuyên gia tâm lý · Hỗ trợ sức khỏe tinh thần</p>
        <small>Ảnh đại diện được hiển thị bằng tên viết tắt.</small>
      </div>
    </section>
  )
}

export function ProfilePreviewCard({
  value,
  title,
  draft = false,
  status,
}: {
  value: SpecialistProfileInput
  title: string
  draft?: boolean
  status?: string
}) {
  return (
    <section className={styles.preview} aria-label={title}>
      <div className={styles.previewHeading}>
        <Eye size={16} aria-hidden="true" />
        <h2>{title}</h2>
        <span>{status ?? (draft ? 'Chưa công khai' : 'Đã duyệt')}</span>
      </div>
      <div className={styles.previewBody}>
        <div className={styles.previewAvatar} aria-hidden="true">
          {profileInitials(value.displayName)}
        </div>
        <h3>{value.displayName.trim() || 'Tên hiển thị của bạn'}</h3>
        <p className={styles.previewRole}>Chuyên gia tâm lý</p>
        <p className={styles.previewBio}>
          {value.bio || 'Phần giới thiệu của bạn sẽ xuất hiện ở đây.'}
        </p>
        <div className={styles.previewTags}>
          {value.supportAreas.map((area) => (
            <span key={area}>{profileAreaLabels[area]}</span>
          ))}
          {value.languages.map((language) => (
            <span className={styles.languageTag} key={language}>
              {profileLanguageLabels[language] ?? language}
            </span>
          ))}
        </div>
        <p className={styles.previewExperience}>
          <CalendarDays size={15} aria-hidden="true" />
          {Number.isInteger(value.yearsOfExperience) &&
          value.yearsOfExperience >= 0
            ? `${value.yearsOfExperience} năm kinh nghiệm`
            : 'Chưa nhập số năm kinh nghiệm'}
        </p>
        <div className={styles.bookingSample}>
          <span>
            <CalendarDays size={16} aria-hidden="true" />
            Đặt lịch tư vấn · 60 phút
          </span>
          <small>Minh họa thẻ hồ sơ · Không đặt lịch từ trang này</small>
        </div>
      </div>
    </section>
  )
}

export function ProfileChecklist({ value }: { value: SpecialistProfileInput }) {
  let validTimezone = false
  try {
    if (value.timezone.trim()) {
      new Intl.DateTimeFormat('vi-VN', { timeZone: value.timezone })
      validTimezone = true
    }
  } catch {
    validTimezone = false
  }
  const checks = [
    {
      label: 'Tên hiển thị',
      done:
        value.displayName.trim().length > 0 && value.displayName.length <= 120,
    },
    {
      label: 'Phần giới thiệu',
      done: value.bio.trim().length > 0 && value.bio.length <= 2000,
    },
    { label: 'Lĩnh vực hỗ trợ', done: value.supportAreas.length > 0 },
    { label: 'Ngôn ngữ tư vấn', done: value.languages.length > 0 },
    {
      label: 'Số năm kinh nghiệm',
      done:
        Number.isInteger(value.yearsOfExperience) &&
        value.yearsOfExperience >= 0 &&
        value.yearsOfExperience <= 80,
    },
    { label: 'Múi giờ', done: validTimezone },
  ]
  const done = checks.filter((check) => check.done).length
  const percentage = Math.round((done / checks.length) * 100)
  return (
    <section className={styles.checklist} aria-label="Mức độ hoàn thiện">
      <h2>
        <CheckCheck size={17} aria-hidden="true" />
        Mức độ hoàn thiện
      </h2>
      <div className={styles.completionSummary}>
        <div
          className={styles.completionRing}
          style={{ '--completion': `${percentage}%` } as CSSProperties}
          aria-hidden="true"
        >
          <strong>{percentage}%</strong>
        </div>
        <div>
          <strong>
            {done}/{checks.length} mục đã điền
          </strong>
          <p>Kiểm tra thông tin trước khi gửi xét duyệt.</p>
        </div>
      </div>
      <ul>
        {checks.map((check) => (
          <li key={check.label} data-done={check.done}>
            <span className={styles.checkIcon} aria-hidden="true">
              {check.done && <Check size={12} />}
            </span>
            <span>{check.label}</span>
            <small>{check.done ? 'Đã điền' : 'Cần bổ sung'}</small>
          </li>
        ))}
      </ul>
      <p className={styles.checklistNote}>
        Mức độ đầy đủ thông tin, không phải chứng nhận chuyên môn.
      </p>
    </section>
  )
}

export function ProfilePreviewDialog({
  value,
  open,
  published = true,
  onOpenChange,
}: {
  value: SpecialistProfileInput
  open: boolean
  published?: boolean
  onOpenChange: (open: boolean) => void
}) {
  const titleId = useId()
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      labelledBy={titleId}
      className={styles.previewDialog}
    >
      <header className={styles.dialogHeader}>
        <div>
          <small>
            {published ? 'HỒ SƠ ĐANG CÔNG KHAI' : 'HỒ SƠ ĐANG TẠM NGƯNG'}
          </small>
          <h2 id={titleId}>
            {published ? 'Người dùng đang thấy gì?' : 'Hồ sơ đã duyệt gần nhất'}
          </h2>
        </div>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => onOpenChange(false)}
          aria-label="Đóng xem trước"
        >
          <X size={20} />
        </button>
      </header>
      <div className={styles.dialogBody}>
        {!published && <p>Hồ sơ này hiện không được công khai.</p>}
        <ProfileSnapshot
          value={value}
          title={published ? 'Hồ sơ đang công khai' : 'Hồ sơ đã duyệt gần nhất'}
        />
      </div>
    </Dialog>
  )
}
