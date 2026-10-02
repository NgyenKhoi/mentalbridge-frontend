'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import type {
  DiscoveryExplanation,
  DiscoverySlot,
  SpecialistDiscoveryItem,
  SpecialistDiscoveryPage,
} from '@/lib/consultation/consultation-validation'
import { appointmentBrowserClient } from '@/features/appointments/api/browser-client'
import {
  specialistDiscoveryBrowserClient,
  type DiscoveryFilters,
} from '../api/browser-client'
import styles from './SpecialistDiscovery.module.css'

const supportAreaLabels = {
  DEPRESSIVE_SYMPTOMS: 'Khí sắc và trầm buồn',
  ANXIETY_SYMPTOMS: 'Lo âu',
} as const
const languageLabels = { vi: 'Tiếng Việt', en: 'English' } as const
const VIETNAM_TIME_ZONE = 'Asia/Ho_Chi_Minh'

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase('vi-VN'))
    .join('')
}

function formatTime(value: string, timezone: string) {
  const date = new Date(value)
  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone,
  }).format(date)
  const day = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: timezone,
  }).format(date)
  return `${time} · ${day}`
}

function slotPresentation(slot: DiscoverySlot) {
  const start = new Date(slot.startAt)
  const end = new Date(slot.endAt)
  const weekday = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(start)
  const day = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(start)
  const month = new Intl.DateTimeFormat('vi-VN', {
    month: '2-digit',
    timeZone: VIETNAM_TIME_ZONE,
  }).format(start)
  const time = (value: Date) =>
    new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: VIETNAM_TIME_ZONE,
    }).format(value)

  return {
    weekday,
    day,
    month: `Tháng ${month}`,
    range: `${time(start)} – ${time(end)}`,
    summary: `${weekday}, ${Number(day)} tháng ${Number(month)} lúc ${time(start)}`,
  }
}

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

function discoveryError(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể tải danh sách chuyên gia. Vui lòng thử lại.'
  if (error.status === 401)
    return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
  if (error.status === 403)
    return 'Tài khoản hiện không thể xem danh sách chuyên gia.'
  if (error.code === 'DISCOVERY_CURSOR_STALE')
    return 'Danh sách đã thay đổi. Hãy tải lại từ đầu.'
  return 'Danh sách chuyên gia đang tạm thời không khả dụng. Vui lòng thử lại.'
}

function bookingError(error: unknown) {
  if (!(error instanceof ApiError))
    return 'Không thể gửi yêu cầu đặt lịch. Vui lòng thử lại.'
  const messages: Record<string, string> = {
    PAID_PLAN_REQUIRED: 'Bạn cần gói Plus hoặc Premium để đặt lịch.',
    APPOINTMENT_CREDIT_UNAVAILABLE: 'Bạn hiện không còn lượt tư vấn phù hợp.',
    APPOINTMENT_RESERVATION_LIMIT_REACHED:
      'Bạn đã đạt giới hạn lịch đang hoạt động của gói hiện tại.',
    APPOINTMENT_SLOT_UNAVAILABLE:
      'Khung giờ này vừa được chọn. Hãy tải lại và chọn giờ khác.',
    APPOINTMENT_SLOT_STALE:
      'Khung giờ này đã thay đổi. Hãy tải lại và chọn giờ khác.',
    APPOINTMENT_VIDEO_DISABLED:
      'Tư vấn video hiện chưa khả dụng. Hãy chọn chat trong ứng dụng.',
  }
  return messages[error.code] ?? 'Không thể gửi yêu cầu đặt lịch lúc này.'
}

type DetailDialogProps = Readonly<{
  item: SpecialistDiscoveryItem | null
  loading: boolean
  error: string
  open: boolean
  packageCode: SpecialistDiscoveryPage['packageCode'] | null
  onClose: () => void
  onRetry: () => void
  onBooked: () => void
}>

function DetailDialog({
  item,
  loading,
  error,
  open,
  packageCode,
  onClose,
  onRetry,
  onBooked,
}: DetailDialogProps) {
  const { showActionToast } = useFeedback()
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [bookingMessage, setBookingMessage] = useState('')

  const selectedSlot = item?.selectableSlots.find(
    (slot) => slot.id === selectedSlotId,
  )

  async function book(slot: DiscoverySlot) {
    setSubmitting(true)
    setBookingMessage('')
    try {
      await appointmentBrowserClient.request(
        slot.id,
        slot.modality,
        `appointment-${crypto.randomUUID()}`,
      )
      showActionToast({
        title: 'Đã gửi yêu cầu đặt lịch',
        description: 'Chuyên gia sẽ xác nhận yêu cầu của bạn.',
      })
      onBooked()
    } catch (caught) {
      setBookingMessage(bookingError(caught))
    } finally {
      setSubmitting(false)
    }
  }

  const selectedPresentation = selectedSlot
    ? slotPresentation(selectedSlot)
    : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      labelledBy="specialist-detail-title"
      describedBy="specialist-detail-description"
      className={styles.dialog}
    >
      <div className={styles.profileLayout}>
        <aside className={styles.profileAside}>
          <svg
            className={styles.bridge}
            viewBox="0 0 300 300"
            aria-hidden="true"
          >
            <path d="M-20 300V150a170 170 0 0 1 340 0v150" />
            <path d="M20 300V150a130 130 0 0 1 260 0v150" />
            <path d="M60 300V150a90 90 0 0 1 180 0v150" />
          </svg>
          <div className={styles.profileAvatar} aria-hidden="true">
            {item ? initials(item.displayName) : 'MB'}
          </div>
          <h2 id="specialist-detail-title">
            {item?.displayName ?? 'Đang tải hồ sơ'}
          </h2>
          <p className={styles.profileRole}>
            Chuyên gia hỗ trợ sức khỏe tinh thần
          </p>
          {item && item.selectableSlots.length > 0 && (
            <span className={styles.availabilityBadge}>
              <i /> Có lịch trống
            </span>
          )}
          {item && (
            <dl className={styles.profileFacts}>
              <div>
                <span className={styles.factIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <rect x="3" y="7" width="18" height="13" rx="2" />
                    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18" />
                  </svg>
                </span>
                <div>
                  <dt>Kinh nghiệm</dt>
                  <dd>{item.yearsOfExperience} năm</dd>
                </div>
              </div>
              <div>
                <span className={styles.factIcon} aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="M4 5h9M8.5 3v2M6 5c.5 4 3 7 6 8M12 5c-.5 4-3 7-6 8M13 21l4.5-10L22 21M14.8 17h5.4" />
                  </svg>
                </span>
                <div>
                  <dt>Ngôn ngữ</dt>
                  <dd>
                    {item.languages
                      .map((value) => languageLabels[value])
                      .join(', ')}
                  </dd>
                </div>
              </div>
            </dl>
          )}
          <p className={styles.profileNote}>
            Hỗ trợ phi lâm sàng, không thay thế chẩn đoán hay điều trị y tế.
          </p>
        </aside>

        <section className={styles.profileMain}>
          <button
            className={styles.closeButton}
            type="button"
            onClick={onClose}
            aria-label="Đóng hồ sơ"
          >
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <path d="M4 4l12 12M16 4L4 16" />
            </svg>
          </button>
          {loading ? (
            <div className={styles.dialogLoading} aria-label="Đang tải hồ sơ">
              <Skeleton height="34px" />
              <Skeleton height="110px" />
              <Skeleton height="160px" />
            </div>
          ) : error ? (
            <div className={styles.dialogState} role="alert">
              <h3>Không thể mở hồ sơ này</h3>
              <p>{error}</p>
              <button type="button" onClick={onRetry}>
                Thử lại
              </button>
            </div>
          ) : item ? (
            <>
              <div className={styles.dialogContent}>
                <p id="specialist-detail-description" className={styles.bio}>
                  {item.bio}
                </p>
                <section
                  className={styles.explanation}
                  aria-labelledby="why-title"
                >
                  <h3 id="why-title">Vì sao hồ sơ này xuất hiện?</h3>
                  <ul>
                    {explanationText(item.explanation).map((message) => (
                      <li key={message}>
                        <svg viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M5 10.5l3.2 3.2L15 7" />
                        </svg>
                        <span>{message}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                <fieldset className={styles.slots}>
                  <legend>Chọn khung giờ 60 phút</legend>
                  {item.selectableSlots.length === 0 ? (
                    <div className={styles.emptySlots}>
                      <strong>Hiện chưa có khung giờ trống</strong>
                      <p>Hãy quay lại sau khi chuyên gia cập nhật lịch mới.</p>
                    </div>
                  ) : (
                    <div className={styles.slotList}>
                      {item.selectableSlots.map((slot) => {
                        const presentation = slotPresentation(slot)
                        return (
                          <label className={styles.slotCard} key={slot.id}>
                            <input
                              type="radio"
                              name="specialist-slot"
                              value={slot.id}
                              checked={selectedSlotId === slot.id}
                              onChange={() => setSelectedSlotId(slot.id)}
                            />
                            <span
                              className={styles.slotDate}
                              aria-hidden="true"
                            >
                              <small>{presentation.weekday}</small>
                              <strong>{presentation.day}</strong>
                              <small>{presentation.month}</small>
                            </span>
                            <span className={styles.slotTime}>
                              <strong>{presentation.range}</strong>
                              <small>
                                <svg viewBox="0 0 24 24" aria-hidden="true">
                                  <path d="M21 12a8 8 0 0 1-11.8 7L4 20l1.2-4.4A8 8 0 1 1 21 12z" />
                                </svg>
                                {slot.modality === 'IN_APP_CHAT'
                                  ? 'Chat trong ứng dụng'
                                  : 'Video trong ứng dụng'}
                              </small>
                            </span>
                            <span
                              className={styles.slotRadio}
                              aria-hidden="true"
                            >
                              <svg viewBox="0 0 20 20">
                                <path d="M5 10.5l3.2 3.2L15 7" />
                              </svg>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                </fieldset>
                {bookingMessage && (
                  <p className={styles.inlineError} role="alert">
                    {bookingMessage}
                  </p>
                )}
              </div>
              <div className={styles.dialogFooter}>
                {packageCode === 'FREE' ? (
                  <>
                    <p>Đặt lịch cần gói Plus hoặc Premium.</p>
                    <Link href="/subscription">Xem quyền lợi các gói</Link>
                  </>
                ) : (
                  <>
                    <p aria-live="polite">
                      {selectedPresentation ? (
                        <>
                          Bạn chọn:{' '}
                          <strong>{selectedPresentation.summary}</strong>
                        </>
                      ) : (
                        'Chọn một khung giờ để tiếp tục.'
                      )}
                    </p>
                    <button
                      type="button"
                      disabled={!selectedSlot || submitting}
                      onClick={() => selectedSlot && void book(selectedSlot)}
                    >
                      {submitting
                        ? 'Đang gửi yêu cầu…'
                        : 'Gửi yêu cầu đặt lịch'}
                    </button>
                  </>
                )}
              </div>
            </>
          ) : null}
        </section>
      </div>
    </Dialog>
  )
}

export default function SpecialistDiscovery() {
  const [supportArea, setSupportArea] = useState<
    DiscoveryFilters['supportArea'] | ''
  >('')
  const [language, setLanguage] = useState<DiscoveryFilters['language'] | ''>(
    '',
  )
  const [modality, setModality] = useState<DiscoveryFilters['modality'] | ''>(
    '',
  )
  const timezone = VIETNAM_TIME_ZONE
  const [page, setPage] = useState<SpecialistDiscoveryPage | null>(null)
  const [items, setItems] = useState<SpecialistDiscoveryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<SpecialistDiscoveryItem | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')

  const filters = useMemo<DiscoveryFilters>(
    () => ({
      ...(supportArea ? { supportArea } : {}),
      ...(language ? { language } : {}),
      ...(modality ? { modality } : {}),
      timezone,
    }),
    [language, modality, supportArea, timezone],
  )

  const load = useCallback(
    async (cursor?: string) => {
      if (cursor) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const result = await specialistDiscoveryBrowserClient.list({
          ...filters,
          ...(cursor ? { cursor } : {}),
        })
        setPage(result)
        setItems((current) =>
          cursor ? [...current, ...result.items] : result.items,
        )
      } catch (caught) {
        setError(discoveryError(caught))
        if (!cursor) {
          setPage(null)
          setItems([])
        }
      } finally {
        setLoading(false)
        setLoadingMore(false)
      }
    },
    [filters],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const loadDetail = useCallback(
    async (id: string) => {
      setDetailLoading(true)
      setDetailError('')
      setDetail(null)
      try {
        setDetail(
          await specialistDiscoveryBrowserClient.detail(id, {
            ...(language ? { language } : {}),
            ...(modality ? { modality } : {}),
            timezone,
          }),
        )
      } catch (caught) {
        if (caught instanceof ApiError && caught.status === 404)
          setDetailError(
            'Hồ sơ không còn trong danh sách hiện tại. Hãy đóng cửa sổ và tải lại.',
          )
        else setDetailError(discoveryError(caught))
      } finally {
        setDetailLoading(false)
      }
    },
    [language, modality, timezone],
  )

  function openDetail(id: string) {
    setDetailId(id)
    void loadDetail(id)
  }

  async function booked() {
    if (detailId) await loadDetail(detailId)
    await load()
  }

  return (
    <main className={styles.page}>
      <header className={styles.hero}>
        <span className={styles.heroPill}>
          <i aria-hidden="true" /> Kết nối trực tuyến
        </span>
        <h1>Chuyên gia tư vấn</h1>
        <p>
          Xem hồ sơ đã được phê duyệt và chọn khung giờ chat hoặc video 60 phút
          đang khả dụng.
        </p>
        <div className={styles.heroStats}>
          <span>
            <strong>{loading ? '—' : items.length}</strong> chuyên gia có lịch
          </span>
          <span>
            <strong>60</strong> phút mỗi buổi
          </span>
        </div>
      </header>

      <section className={styles.controls} aria-label="Bộ lọc chuyên gia">
        <div className={styles.controlGroup}>
          <span>Lĩnh vực hỗ trợ</span>
          <div className={styles.chips}>
            {(
              [
                ['', 'Tất cả'],
                ['ANXIETY_SYMPTOMS', 'Lo âu'],
                ['DEPRESSIVE_SYMPTOMS', 'Khí sắc và trầm buồn'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value || 'all'}
                type="button"
                data-active={supportArea === value}
                disabled={loading}
                onClick={() => setSupportArea(value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label>
          <span>Ưu tiên ngôn ngữ</span>
          <select
            value={language}
            disabled={loading}
            onChange={(event) =>
              setLanguage(event.target.value as typeof language)
            }
          >
            <option value="">Không ưu tiên</option>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </label>
        <div className={styles.controlGroup}>
          <span>Hình thức</span>
          <div className={styles.chips}>
            <button
              type="button"
              data-active={modality === ''}
              disabled={loading}
              onClick={() => setModality('')}
            >
              Tất cả
            </button>
            <button
              type="button"
              data-active={modality === 'IN_APP_CHAT'}
              disabled={loading}
              onClick={() => setModality('IN_APP_CHAT')}
            >
              Chat
            </button>
            <button
              type="button"
              disabled
              title="Video trong ứng dụng hiện chưa khả dụng"
            >
              Video · sắp có
            </button>
          </div>
        </div>
        <button
          className={styles.reload}
          type="button"
          onClick={() => void load()}
          disabled={loading}
        >
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </section>

      {page && (
        <aside className={styles.entitlement}>
          {page.packageCode === 'FREE' ? (
            <p>
              <strong>Bạn đang dùng gói Free.</strong> Bạn có thể xem hồ sơ và
              khung giờ; đặt lịch cần gói Plus hoặc Premium.
            </p>
          ) : (
            <p>
              <strong>
                Gói {page.packageCode === 'PLUS' ? 'Plus' : 'Premium'}.
              </strong>{' '}
              Khi gửi yêu cầu, quyền lợi và lượt tư vấn sẽ được kiểm tra lại.
            </p>
          )}
          {!page.videoEnabled && (
            <p>
              Video trong ứng dụng hiện chưa khả dụng; chỉ hiển thị lịch chat.
            </p>
          )}
        </aside>
      )}

      {!loading && !error && (
        <p className={styles.resultCount}>
          Hiển thị <strong>{items.length}</strong> chuyên gia
        </p>
      )}

      {error && (
        <section className={styles.state} role="alert">
          <h2>Chưa thể tải danh sách</h2>
          <p>{error}</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      )}

      {loading ? (
        <div className={styles.grid} aria-label="Đang tải chuyên gia">
          {[0, 1, 2].map((value) => (
            <div className={styles.skeletonCard} key={value}>
              <Skeleton height="68px" />
              <Skeleton height="24px" />
              <Skeleton height="80px" />
            </div>
          ))}
        </div>
      ) : !error && items.length === 0 ? (
        <section className={styles.state}>
          <h2>Chưa có chuyên gia phù hợp</h2>
          <p>Hãy đổi bộ lọc hoặc quay lại sau khi có lịch mới.</p>
          <button
            type="button"
            onClick={() => {
              setSupportArea('')
              setLanguage('')
              setModality('')
            }}
          >
            Xóa bộ lọc
          </button>
        </section>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <article className={styles.card} key={item.specialistAccountId}>
              <div className={styles.identity}>
                <span aria-hidden="true">{initials(item.displayName)}</span>
                <div>
                  <h2>{item.displayName}</h2>
                  <p>{item.yearsOfExperience} năm kinh nghiệm</p>
                </div>
              </div>
              <div className={styles.tags}>
                {item.supportAreas.map((area) => (
                  <span key={area}>{supportAreaLabels[area]}</span>
                ))}
              </div>
              <p className={styles.summary}>{item.bio}</p>
              <p className={styles.languages}>
                Ngôn ngữ{' '}
                <strong>
                  {item.languages
                    .map((value) => languageLabels[value])
                    .join(', ')}
                </strong>
              </p>
              <div className={styles.nextSlot}>
                <i aria-hidden="true">◷</i>
                <div>
                  <small>Lịch gần nhất</small>
                  <strong>
                    {item.explanation.earliestSelectableStartAt
                      ? formatTime(
                          item.explanation.earliestSelectableStartAt,
                          timezone,
                        )
                      : 'Chưa có lịch trống'}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                onClick={() => openDetail(item.specialistAccountId)}
              >
                Xem hồ sơ và khung giờ
              </button>
            </article>
          ))}
        </div>
      )}

      {page?.nextCursor && !error && (
        <button
          className={styles.more}
          type="button"
          disabled={loadingMore}
          onClick={() => void load(page.nextCursor ?? undefined)}
        >
          {loadingMore ? 'Đang tải thêm…' : 'Xem thêm chuyên gia'}
        </button>
      )}

      <DetailDialog
        key={detailId ?? 'closed'}
        open={detailId !== null}
        item={detail}
        loading={detailLoading}
        error={detailError}
        packageCode={page?.packageCode ?? null}
        onClose={() => {
          setDetailId(null)
          setDetail(null)
          setDetailError('')
        }}
        onRetry={() => detailId && void loadDetail(detailId)}
        onBooked={() => void booked()}
      />
    </main>
  )
}
