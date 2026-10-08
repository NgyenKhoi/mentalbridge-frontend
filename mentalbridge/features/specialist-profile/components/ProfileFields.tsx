'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import {
  BookOpen,
  Brain,
  Check,
  CloudRain,
  Languages,
  List,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Text,
  Users,
} from 'lucide-react'
import type { SpecialistProfileInput } from '@/lib/consultation/consultation-validation'
import styles from './ProfileFields.module.css'

export const profileAreaLabels = {
  DEPRESSIVE_SYMPTOMS: 'Cảm xúc trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
} as const
export const profileLanguageLabels: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'Tiếng Anh',
}
export const amendmentReasonLabels = {
  PROFILE_INFORMATION_INCOMPLETE: 'Thông tin hồ sơ chưa đầy đủ',
  PROFILE_CONTENT_NOT_APPROVED: 'Nội dung hồ sơ chưa phù hợp để công khai',
  OUTSIDE_SUPPORTED_SCOPE: 'Ngoài phạm vi hỗ trợ của nền tảng',
} as const

type Props = {
  value: SpecialistProfileInput
  onChange: (value: SpecialistProfileInput) => void
  disabled?: boolean
  errors?: Partial<Record<keyof SpecialistProfileInput, string>>
}

export default function ProfileFields({
  value,
  onChange,
  disabled = false,
  errors = {},
}: Props) {
  const bio = useRef<HTMLTextAreaElement>(null)
  const caret = useRef<number | null>(null)
  const [expanded, setExpanded] = useState(false)
  useLayoutEffect(() => {
    if (caret.current === null || !bio.current) return
    bio.current.focus()
    bio.current.setSelectionRange(caret.current, caret.current)
    caret.current = null
  }, [value.bio])
  function insert(text: string) {
    if (disabled || !bio.current) return
    const start = bio.current.selectionStart
    const end = bio.current.selectionEnd
    const next = value.bio.slice(0, start) + text + value.bio.slice(end)
    if (next.length > 2000) return
    caret.current = start + text.length
    onChange({ ...value, bio: next })
  }
  const errorProps = (field: keyof SpecialistProfileInput, help?: string) => ({
    'aria-invalid': !!errors[field],
    'aria-describedby':
      [help, errors[field] ? `profile-${field}-error` : undefined]
        .filter(Boolean)
        .join(' ') || undefined,
  })
  const error = (field: keyof SpecialistProfileInput) =>
    errors[field] && (
      <small
        className={styles.error}
        id={`profile-${field}-error`}
        role="alert"
      >
        {errors[field]}
      </small>
    )
  return (
    <div className={styles.fields}>
      <section className={styles.section}>
        <header className={styles.sectionHeading}>
          <span>
            <BookOpen size={19} aria-hidden="true" />
          </span>
          <div>
            <h3>Thông tin cơ bản</h3>
            <p>Giúp người dùng hiểu bạn và cách bạn đồng hành.</p>
          </div>
        </header>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="profile-displayName">
              <span id="profile-displayName-label">Tên hiển thị</span>{' '}
              <span aria-hidden="true">*</span>
            </label>
            <small>Trên hồ sơ và lịch hẹn</small>
          </div>
          <input
            id="profile-displayName"
            aria-labelledby="profile-displayName-label"
            autoComplete="name"
            required
            maxLength={120}
            disabled={disabled}
            value={value.displayName}
            placeholder="Nhập tên bạn muốn hiển thị"
            {...errorProps('displayName', 'profile-displayName-help')}
            onChange={(event) =>
              onChange({ ...value, displayName: event.target.value })
            }
          />
          <small id="profile-displayName-help">
            Sử dụng tên để người dùng dễ nhận ra bạn.
          </small>
          {error('displayName')}
        </div>
        <div className={styles.field}>
          <div className={styles.labelRow}>
            <label htmlFor="profile-bio">
              <span id="profile-bio-label">Giới thiệu</span>{' '}
              <span aria-hidden="true">*</span>
            </label>
            <span className={styles.counter}>
              {value.bio.length}/2000 ký tự
            </span>
          </div>
          <div className={styles.notebook}>
            <div
              className={styles.toolbar}
              role="group"
              aria-label="Công cụ viết giới thiệu"
            >
              <button
                type="button"
                className="btn-ghost"
                disabled={disabled || value.bio.length > 1998}
                onClick={() => insert('\n\n')}
                aria-label="Thêm đoạn mới"
              >
                <Text size={15} aria-hidden="true" />
                <span>Đoạn</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={disabled || value.bio.length > 1997}
                onClick={() =>
                  insert((bio.current?.selectionStart ? '\n' : '') + '• ')
                }
                aria-label="Thêm gạch đầu dòng"
              >
                <List size={15} aria-hidden="true" />
                <span>Danh sách</span>
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={disabled}
                onClick={() => setExpanded(!expanded)}
                aria-pressed={expanded}
                aria-label={
                  expanded ? 'Thu gọn ô giới thiệu' : 'Mở rộng ô giới thiệu'
                }
              >
                {expanded ? (
                  <Minimize2 size={15} aria-hidden="true" />
                ) : (
                  <Maximize2 size={15} aria-hidden="true" />
                )}
              </button>
            </div>
            <textarea
              ref={bio}
              id="profile-bio"
              aria-labelledby="profile-bio-label"
              rows={expanded ? 12 : 6}
              maxLength={2000}
              required
              disabled={disabled}
              value={value.bio}
              placeholder="Chia sẻ cách bạn hỗ trợ và những người bạn có thể đồng hành…"
              style={{ resize: 'none' }}
              {...errorProps('bio', 'profile-bio-help')}
              onChange={(event) =>
                onChange({ ...value, bio: event.target.value })
              }
            />
          </div>
          <small id="profile-bio-help">
            Gợi ý: giới thiệu cách làm việc, kinh nghiệm và đối tượng bạn hỗ
            trợ.
          </small>
          {error('bio')}
        </div>
      </section>
      <section className={styles.section}>
        <header className={styles.sectionHeading}>
          <span>
            <Users size={19} aria-hidden="true" />
          </span>
          <div>
            <h3>Lĩnh vực hỗ trợ</h3>
            <p>Chọn những lĩnh vực bạn có thể đồng hành.</p>
          </div>
        </header>
        <fieldset
          id="profile-supportAreas"
          className={styles.optionGrid}
          disabled={disabled}
          {...errorProps('supportAreas')}
        >
          <legend className={styles.srOnly}>Chọn lĩnh vực hỗ trợ</legend>
          {Object.entries(profileAreaLabels).map(([key, label]) => {
            const area = key as keyof typeof profileAreaLabels
            const selected = value.supportAreas.includes(area)
            const Icon = area === 'DEPRESSIVE_SYMPTOMS' ? CloudRain : Brain
            return (
              <label className={styles.choice} key={area}>
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={selected}
                  onChange={() =>
                    onChange({
                      ...value,
                      supportAreas: selected
                        ? value.supportAreas.filter((item) => item !== area)
                        : [...value.supportAreas, area],
                    })
                  }
                />
                <span className={styles.choiceBody}>
                  <span className={styles.choiceIcon}>
                    <Icon size={19} aria-hidden="true" />
                  </span>
                  <span className={styles.choiceText}>
                    <strong>{label}</strong>
                    <small>
                      {area === 'DEPRESSIVE_SYMPTOMS'
                        ? 'Lắng nghe và hỗ trợ cảm xúc'
                        : 'Đồng hành với căng thẳng, lo âu'}
                    </small>
                  </span>
                  <span className={styles.selectedIcon} aria-hidden="true">
                    {selected && <Check size={13} />}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
        {error('supportAreas')}
      </section>
      <section className={styles.section}>
        <header className={styles.sectionHeading}>
          <span>
            <Languages size={19} aria-hidden="true" />
          </span>
          <div>
            <h3>Ngôn ngữ và kinh nghiệm</h3>
            <p>Thông tin giúp người dùng lựa chọn phù hợp.</p>
          </div>
        </header>
        <fieldset
          id="profile-languages"
          className={styles.optionGrid}
          disabled={disabled}
          {...errorProps('languages')}
        >
          <legend className={styles.legend}>Ngôn ngữ tư vấn</legend>
          {Object.entries(profileLanguageLabels).map(([language, label]) => {
            const selected = value.languages.includes(language)
            return (
              <label className={styles.choice} key={language}>
                <input
                  type="checkbox"
                  aria-label={label}
                  checked={selected}
                  onChange={() =>
                    onChange({
                      ...value,
                      languages: selected
                        ? value.languages.filter((item) => item !== language)
                        : [...value.languages, language],
                    })
                  }
                />
                <span className={styles.choiceBody}>
                  <span className={styles.flag} aria-hidden="true">
                    {language === 'vi' ? '🇻🇳' : '🇬🇧'}
                  </span>
                  <span className={styles.choiceText}>
                    <strong>{label}</strong>
                    <small>{selected ? 'Đã chọn' : 'Chọn ngôn ngữ này'}</small>
                  </span>
                  <span className={styles.selectedIcon} aria-hidden="true">
                    {selected && <Check size={13} />}
                  </span>
                </span>
              </label>
            )
          })}
        </fieldset>
        {error('languages')}
        <div className={styles.field}>
          <label htmlFor="profile-yearsOfExperience">
            <span id="profile-yearsOfExperience-label">Số năm kinh nghiệm</span>{' '}
            <span aria-hidden="true">*</span>
          </label>
          <div className={styles.experience}>
            <div className={styles.stepper}>
              <button
                type="button"
                className="btn-outline"
                disabled={disabled || !(value.yearsOfExperience > 0)}
                aria-label="Giảm năm kinh nghiệm"
                onClick={() =>
                  onChange({
                    ...value,
                    yearsOfExperience: Math.max(
                      0,
                      Math.min(80, Math.ceil(value.yearsOfExperience) - 1),
                    ),
                  })
                }
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <div>
                <input
                  id="profile-yearsOfExperience"
                  aria-labelledby="profile-yearsOfExperience-label"
                  type="number"
                  min={0}
                  max={80}
                  step={1}
                  required
                  disabled={disabled}
                  value={
                    Number.isNaN(value.yearsOfExperience)
                      ? ''
                      : value.yearsOfExperience
                  }
                  {...errorProps(
                    'yearsOfExperience',
                    'profile-experience-help',
                  )}
                  onChange={(event) =>
                    onChange({
                      ...value,
                      yearsOfExperience:
                        event.target.value === ''
                          ? Number.NaN
                          : Number(event.target.value),
                    })
                  }
                />
                <small>năm kinh nghiệm</small>
              </div>
              <button
                type="button"
                className="btn-outline"
                disabled={disabled || value.yearsOfExperience >= 80}
                aria-label="Tăng năm kinh nghiệm"
                onClick={() =>
                  onChange({
                    ...value,
                    yearsOfExperience: Number.isNaN(value.yearsOfExperience)
                      ? 1
                      : Math.min(
                          80,
                          Math.max(0, Math.floor(value.yearsOfExperience) + 1),
                        ),
                  })
                }
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <small id="profile-experience-help">
              Số năm kinh nghiệm hỗ trợ sức khỏe tinh thần. Có thể nhập trực
              tiếp từ 0 đến 80.
            </small>
          </div>
          {error('yearsOfExperience')}
        </div>
        <div className={styles.field}>
          <label htmlFor="profile-timezone">
            <span id="profile-timezone-label">Múi giờ</span>{' '}
            <span aria-hidden="true">*</span>
          </label>
          <input
            id="profile-timezone"
            aria-labelledby="profile-timezone-label"
            required
            disabled={disabled}
            maxLength={64}
            value={value.timezone}
            {...errorProps('timezone', 'profile-timezone-help')}
            onChange={(event) =>
              onChange({ ...value, timezone: event.target.value })
            }
          />
          <small id="profile-timezone-help">
            Ví dụ Asia/Ho_Chi_Minh. Thay đổi không làm đổi giờ của lịch hẹn đã
            tạo.
          </small>
          {error('timezone')}
        </div>
      </section>
    </div>
  )
}
