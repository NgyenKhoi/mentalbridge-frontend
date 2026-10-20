'use client'

import Link from 'next/link'
import { useId, useMemo, useState } from 'react'
import { BadgeCheck, Check, Clock3, LockKeyhole, Star, X } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Skeleton } from '@/components/ui/Skeleton'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  DiscoveryExplanation,
  DiscoverySlot,
  SpecialistDiscoveryItem,
  SpecialistDiscoveryPage,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '@/features/appointments/api/browser-client'
import type { VerifiedCredentialBadge } from '@/features/specialist-profile/api/credential-validation'
import styles from './SpecialistDetailDialog.module.css'

const areaLabels: Record<string, string> = {
  ANXIETY_SYMPTOMS: 'Lo âu',
  DEPRESSIVE_SYMPTOMS: 'Khí sắc và trầm buồn',
}
const languageLabels: Record<string, string> = {
  vi: 'Tiếng Việt',
  en: 'English',
  zh: '中文',
  fr: 'Français',
}
const timezone = 'Asia/Ho_Chi_Minh'

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase('vi-VN'))
    .join('')
}

function dateKey(value: string) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone,
  }).format(new Date(value))
}

function timeLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(new Date(value))
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    timeZone: timezone,
  }).format(new Date(value))
}

// Short ranking explanation required by ADR 0027; neutral and unavailable Care
// context stay distinct (consultation-specialist-policy-v2 §44–49).
function explanationText(explanation: DiscoveryExplanation) {
  const messages: string[] = []
  if (explanation.compatibility === 'MATCHED')
    messages.push(
      'Có lĩnh vực hỗ trợ trùng với gợi ý sau bài sàng lọc bạn đã chọn dùng.',
    )
  if (explanation.compatibility === 'NOT_MATCHED')
    messages.push('Chưa có lĩnh vực hỗ trợ trùng với gợi ý sau bài sàng lọc.')
  if (explanation.compatibility === 'UNAVAILABLE')
    messages.push(
      'Hiện chưa thể dùng gợi ý sau bài sàng lọc; các tiêu chí còn lại vẫn được áp dụng.',
    )
  if (explanation.compatibility === 'NEUTRAL')
    messages.push('Thứ tự chung không sử dụng nội dung bài sàng lọc.')
  if (explanation.languageMatched === true)
    messages.push('Có ngôn ngữ bạn ưu tiên.')
  if (explanation.languageMatched === false)
    messages.push('Chưa có ngôn ngữ bạn ưu tiên.')
  messages.push(
    explanation.hasSelectableSlot
      ? 'Có khung giờ 60 phút đang chọn được.'
      : 'Hiện chưa có khung giờ chọn được.',
  )
  if (explanation.ratingTieBreakerApplied)
    messages.push(
      'Điểm đánh giá chỉ được dùng để phân định khi các yếu tố chính bằng nhau.',
    )
  return messages
}

function bookingError(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể gửi yêu cầu đặt lịch. Vui lòng thử lại.'
  const messages: Record<string, string> = {
    PAID_PLAN_REQUIRED: 'Bạn cần gói Plus hoặc Premium để đặt lịch.',
    APPOINTMENT_CREDIT_UNAVAILABLE: 'Bạn hiện không còn lượt tư vấn phù hợp.',
    APPOINTMENT_RESERVATION_LIMIT_REACHED:
      'Bạn đã đạt giới hạn lịch đang hoạt động của gói.',
    APPOINTMENT_SLOT_UNAVAILABLE:
      'Khung giờ này vừa được chọn. Hãy tải lại và chọn giờ khác.',
    APPOINTMENT_SLOT_STALE:
      'Khung giờ này đã thay đổi. Hãy tải lại và chọn giờ khác.',
    APPOINTMENT_VIDEO_DISABLED:
      'Tư vấn video hiện chưa khả dụng. Hãy chọn chat trong ứng dụng.',
  }
  return messages[error.code] ?? 'Không thể gửi yêu cầu đặt lịch lúc này.'
}

type Props = Readonly<{
  item: SpecialistDiscoveryItem | null
  badges: VerifiedCredentialBadge[]
  loading: boolean
  error: string
  open: boolean
  initialTab: 'profile' | 'slots'
  packageCode: SpecialistDiscoveryPage['packageCode'] | null
  availableCredits: number | null
  onClose: () => void
  onRetry: () => void
  onBooked: (slot: DiscoverySlot, name: string) => void
  originatingPlanActionId: string | null
}>

export default function SpecialistDetailDialog({
  item,
  badges,
  loading,
  error,
  open,
  initialTab,
  packageCode,
  availableCredits,
  onClose,
  onRetry,
  onBooked,
  originatingPlanActionId,
}: Props) {
  const { showActionToast } = useFeedback()
  const whyTitleId = useId()
  const [tab, setTab] = useState<'profile' | 'slots'>(initialTab)
  const [step, setStep] = useState<'browse' | 'confirm' | 'success'>('browse')
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')
  const [todayIso] = useState(() => new Date().toISOString())

  const slots = useMemo(
    () =>
      [...(item?.selectableSlots ?? [])].sort((a, b) =>
        a.startAt.localeCompare(b.startAt),
      ),
    [item],
  )
  const days = useMemo(() => {
    const groups = new Map<string, DiscoverySlot[]>()
    for (const slot of slots) {
      const key = dateKey(slot.startAt)
      groups.set(key, [...(groups.get(key) ?? []), slot])
    }
    const today = todayIso ? dateKey(todayIso) : null
    const tomorrow = todayIso
      ? dateKey(
          new Date(new Date(todayIso).getTime() + 86_400_000).toISOString(),
        )
      : null
    return [...groups].map(([key, entries]) => ({
      key,
      label:
        key === today
          ? 'Hôm nay'
          : key === tomorrow
            ? 'Ngày mai'
            : dateLabel(entries[0].startAt),
      slots: entries,
    }))
  }, [slots, todayIso])
  const activeDay =
    selectedDay && days.some((day) => day.key === selectedDay)
      ? selectedDay
      : days[0]?.key
  const selectedSlot = slots.find((slot) => slot.id === selectedSlotId)

  function beginConfirmation(slot: DiscoverySlot) {
    setSelectedSlotId(slot.id)
    setBookingMessage('')
    setStep('confirm')
  }

  async function submitBooking() {
    if (!item || !selectedSlot || submitting || availableCredits === 0) return
    setSubmitting(true)
    setBookingMessage('')
    try {
      const commandKey = `appointment-${crypto.randomUUID()}`
      if (originatingPlanActionId) {
        await appointmentBrowserClient.request(
          selectedSlot.id,
          selectedSlot.modality,
          commandKey,
          undefined,
          undefined,
          originatingPlanActionId,
        )
      } else {
        await appointmentBrowserClient.request(
          selectedSlot.id,
          selectedSlot.modality,
          commandKey,
        )
      }
      showActionToast({
        title: `Đã gửi yêu cầu tới ${item.displayName}`,
        description:
          dateLabel(selectedSlot.startAt) +
          ' · ' +
          timeLabel(selectedSlot.startAt),
      })
      window.dispatchEvent(new Event('mentalbridge:appointment-requested'))
      onBooked(selectedSlot, item.displayName)
      setStep('success')
    } catch (caught) {
      setBookingMessage(bookingError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      labelledBy="specialist-detail-title"
      className={styles.dialog}
    >
      <div className={styles.shell}>
        <header className={styles.header}>
          <div className={styles.avatar} aria-hidden="true">
            {item ? initials(item.displayName) : 'MB'}
          </div>
          <div className={styles.heading}>
            <h2 id="specialist-detail-title">
              {item?.displayName ?? 'Đang tải hồ sơ'}
            </h2>
            {item && (
              <p>
                {item.yearsOfExperience} năm kinh nghiệm
                {item.ratingAggregate && (
                  <>
                    {' '}
                    · <Star size={13} aria-hidden="true" />{' '}
                    {item.ratingAggregate.averageRating.toFixed(1)} ·{' '}
                    {item.ratingAggregate.ratingCount} đánh giá
                  </>
                )}
              </p>
            )}
            {badges.length > 0 && (
              <span className={styles.badge}>
                <BadgeCheck size={14} aria-hidden="true" /> Giấy tờ đã xác minh
              </span>
            )}
          </div>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Đóng hồ sơ"
          >
            <X size={19} aria-hidden="true" />
          </button>
        </header>

        {loading ? (
          <div className={styles.body}>
            <Skeleton height="40px" />
            <Skeleton height="150px" />
            <Skeleton height="80px" />
          </div>
        ) : error ? (
          <div className={styles.body} role="alert">
            <h3>Không thể mở hồ sơ này</h3>
            <p>{error}</p>
            <button type="button" className={styles.primary} onClick={onRetry}>
              Thử lại
            </button>
          </div>
        ) : item && step === 'success' ? (
          <div className={styles.success} role="status">
            <span>
              <Check size={30} aria-hidden="true" />
            </span>
            <h3>Đã gửi yêu cầu đặt lịch</h3>
            <p>
              Chuyên gia sẽ xác nhận lịch của bạn. Bạn có thể theo dõi trạng
              thái tại mục Lịch hẹn.
            </p>
            <button type="button" className={styles.primary} onClick={onClose}>
              Hoàn tất
            </button>
          </div>
        ) : item && step === 'confirm' ? (
          <>
            <div className={styles.body}>
              <h3 className={styles.sectionTitle}>Xác nhận yêu cầu</h3>
              <dl className={styles.confirmFacts}>
                <div>
                  <dt>Chuyên gia</dt>
                  <dd>{item.displayName}</dd>
                </div>
                <div>
                  <dt>Thời gian</dt>
                  <dd>
                    {selectedSlot
                      ? `${dateLabel(selectedSlot.startAt)}, ${timeLabel(selectedSlot.startAt)}`
                      : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Hình thức</dt>
                  <dd>
                    {selectedSlot?.modality === 'IN_APP_VIDEO'
                      ? 'Video trong ứng dụng'
                      : 'Chat trong ứng dụng'}{' '}
                    · 60 phút
                  </dd>
                </div>
                <div>
                  <dt>Chi phí</dt>
                  <dd>1 lượt tư vấn theo gói hiện tại</dd>
                </div>
                <div>
                  <dt>Quyền lợi</dt>
                  <dd>
                    {availableCredits === null
                      ? 'Kiểm tra lượt theo gói khi gửi yêu cầu'
                      : `${availableCredits} lượt tư vấn khả dụng theo gói`}
                  </dd>
                </div>
              </dl>
              <p className={styles.note}>
                {availableCredits === 0
                  ? 'Bạn đã hết lượt tư vấn khả dụng theo gói.'
                  : 'Lịch chỉ được xác nhận sau khi chuyên gia chấp thuận.'}
              </p>
              {bookingMessage && (
                <p className={styles.error} role="alert">
                  {bookingMessage}
                </p>
              )}
            </div>
            <footer className={styles.footer}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setStep('browse')}
              >
                Quay lại
              </button>
              <button
                type="button"
                className={styles.primary}
                disabled={!selectedSlot || submitting || availableCredits === 0}
                onClick={() => void submitBooking()}
              >
                {submitting ? 'Đang gửi…' : 'Xác nhận đặt lịch'}
              </button>
            </footer>
          </>
        ) : item ? (
          <>
            <div
              className={styles.tabs}
              role="tablist"
              aria-label="Chi tiết chuyên gia"
              onKeyDown={(event) => {
                if (
                  !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(
                    event.key,
                  )
                )
                  return
                event.preventDefault()
                const next =
                  event.key === 'Home'
                    ? 'profile'
                    : event.key === 'End'
                      ? 'slots'
                      : tab === 'profile'
                        ? 'slots'
                        : 'profile'
                setTab(next)
                event.currentTarget
                  .querySelectorAll('button')
                  [next === 'profile' ? 0 : 1]?.focus()
              }}
            >
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'profile'}
                onClick={() => setTab('profile')}
              >
                Hồ sơ
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'slots'}
                onClick={() => setTab('slots')}
              >
                Lịch trống
              </button>
            </div>
            {tab === 'profile' ? (
              <div className={styles.body} role="tabpanel">
                <p className={styles.bio}>{item.bio}</p>
                <section className={styles.why} aria-labelledby={whyTitleId}>
                  <h3 id={whyTitleId}>Vì sao hồ sơ này xuất hiện?</h3>
                  <ul>
                    {explanationText(item.explanation).map((message) => (
                      <li key={message}>{message}</li>
                    ))}
                  </ul>
                </section>
                <dl className={styles.facts}>
                  <div>
                    <dt>Kinh nghiệm</dt>
                    <dd>{item.yearsOfExperience} năm</dd>
                  </div>
                  <div>
                    <dt>Phương pháp</dt>
                    <dd>Chưa được cung cấp riêng</dd>
                  </div>
                  <div>
                    <dt>Ngôn ngữ trao đổi</dt>
                    <dd>
                      {item.languages
                        .map((value) => languageLabels[value] ?? value)
                        .join(', ')}
                    </dd>
                  </div>
                  <div>
                    <dt>Hình thức</dt>
                    <dd>
                      {slots.some((slot) => slot.modality === 'IN_APP_CHAT')
                        ? 'Chat trong ứng dụng · 60 phút'
                        : 'Xem lịch trống'}
                    </dd>
                  </div>
                </dl>
                <h3 className={styles.eyebrow}>Lĩnh vực hỗ trợ</h3>
                <div className={styles.tags}>
                  {item.supportAreas.map((area) => (
                    <span key={area}>{areaLabels[area] ?? area}</span>
                  ))}
                </div>
                {badges.length > 0 && (
                  <div className={styles.credentials}>
                    {badges.map((badge, index) => (
                      <span key={`${badge.title}-${index}`}>
                        <BadgeCheck size={15} aria-hidden="true" />
                        {badge.title}
                      </span>
                    ))}
                  </div>
                )}
                <p className={styles.security}>
                  <LockKeyhole size={17} aria-hidden="true" /> Phiên chat được
                  bảo vệ theo chính sách của nền tảng.
                </p>
              </div>
            ) : (
              <div className={styles.body} role="tabpanel">
                {days.length === 0 ? (
                  <div className={styles.empty}>
                    <Clock3 aria-hidden="true" />
                    <strong>Hiện chưa có lịch trống</strong>
                    <p>Hãy quay lại sau khi chuyên gia cập nhật lịch.</p>
                  </div>
                ) : (
                  <>
                    <div className={styles.days}>
                      {days.map((day) => (
                        <button
                          type="button"
                          key={day.key}
                          aria-pressed={activeDay === day.key}
                          onClick={() => setSelectedDay(day.key)}
                        >
                          <strong>{day.label}</strong>
                          <small>{day.slots.length} khung giờ</small>
                        </button>
                      ))}
                    </div>
                    <div
                      className={styles.times}
                      role="radiogroup"
                      aria-label="Khung giờ trống"
                    >
                      {days
                        .find((day) => day.key === activeDay)
                        ?.slots.map((slot) => (
                          <label key={slot.id} className={styles.time}>
                            <input
                              type="radio"
                              name="specialist-slot"
                              checked={selectedSlotId === slot.id}
                              onChange={() => setSelectedSlotId(slot.id)}
                            />
                            <span>
                              {timeLabel(slot.startAt)} –{' '}
                              {timeLabel(slot.endAt)}
                            </span>
                          </label>
                        ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <footer className={styles.footer}>
              {packageCode === 'FREE' ? (
                <>
                  <p>Đặt lịch cần gói Plus hoặc Premium.</p>
                  <Link className={styles.primary} href="/subscription">
                    Xem quyền lợi các gói
                  </Link>
                </>
              ) : tab === 'profile' ? (
                <>
                  <div className={styles.footerActions}>
                    <button
                      type="button"
                      className={styles.primary}
                      disabled={slots.length === 0 || availableCredits === 0}
                      onClick={() => slots[0] && beginConfirmation(slots[0])}
                    >
                      Đặt lịch gần nhất
                    </button>
                    <button
                      type="button"
                      className={styles.secondary}
                      onClick={() => setTab('slots')}
                    >
                      Chọn giờ khác
                    </button>
                  </div>
                  <p>
                    {slots[0]
                      ? `Gần nhất: ${dateLabel(slots[0].startAt)}, ${timeLabel(slots[0].startAt)}`
                      : 'Chưa có lịch trống'}{' '}
                    ·{' '}
                    {availableCredits === null
                      ? 'Kiểm tra lượt theo gói khi đặt'
                      : `${availableCredits} lượt khả dụng`}
                    {availableCredits === 0 ? ' · Hết lượt tư vấn' : ''}
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Đã chọn:{' '}
                    {selectedSlot
                      ? `${dateLabel(selectedSlot.startAt)}, ${timeLabel(selectedSlot.startAt)}`
                      : 'Chưa chọn giờ'}
                  </p>
                  <button
                    type="button"
                    className={styles.primary}
                    disabled={!selectedSlot || availableCredits === 0}
                    onClick={() =>
                      selectedSlot && beginConfirmation(selectedSlot)
                    }
                  >
                    Tiếp tục
                  </button>
                </>
              )}
            </footer>
          </>
        ) : null}
      </div>
    </Dialog>
  )
}
