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

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase('vi-VN'))
    .join('')
}

function formatTime(value: string, timezone: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(value))
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
  if (explanation.timezoneMatch === 'EXACT')
    messages.push('Cùng múi giờ bạn đang dùng.')
  else if (explanation.timezoneMatch === 'OFFSET_DISTANCE')
    messages.push('Thứ tự có xét chênh lệch múi giờ.')
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
  displayTimezone: string
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
  displayTimezone,
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

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && onClose()}
      labelledBy="specialist-detail-title"
      describedBy="specialist-detail-description"
      className={styles.dialog}
    >
      <div className={styles.dialogHeader}>
        <div>
          <span>Hồ sơ chuyên gia</span>
          <h2 id="specialist-detail-title">
            {item?.displayName ?? 'Đang tải hồ sơ'}
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng hồ sơ">
          ×
        </button>
      </div>
      {loading ? (
        <div className={styles.dialogLoading} aria-label="Đang tải hồ sơ">
          <Skeleton height="28px" />
          <Skeleton height="96px" />
          <Skeleton height="140px" />
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
        <div className={styles.dialogContent}>
          <p id="specialist-detail-description" className={styles.bio}>
            {item.bio}
          </p>
          <dl className={styles.facts}>
            <div>
              <dt>Kinh nghiệm</dt>
              <dd>{item.yearsOfExperience} năm</dd>
            </div>
            <div>
              <dt>Ngôn ngữ</dt>
              <dd>
                {item.languages
                  .map((value) => languageLabels[value])
                  .join(', ')}
              </dd>
            </div>
            <div>
              <dt>Múi giờ</dt>
              <dd>{item.timezone}</dd>
            </div>
          </dl>
          <section className={styles.explanation} aria-labelledby="why-title">
            <h3 id="why-title">Vì sao hồ sơ này xuất hiện?</h3>
            <ul>
              {explanationText(item.explanation).map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </section>
          <fieldset className={styles.slots}>
            <legend>Chọn khung giờ 60 phút</legend>
            {item.selectableSlots.length === 0 ? (
              <p>Chuyên gia hiện chưa có khung giờ có thể chọn.</p>
            ) : (
              item.selectableSlots.map((slot) => (
                <label key={slot.id}>
                  <input
                    type="radio"
                    name="specialist-slot"
                    value={slot.id}
                    checked={selectedSlotId === slot.id}
                    onChange={() => setSelectedSlotId(slot.id)}
                  />
                  <span>
                    <strong>{formatTime(slot.startAt, displayTimezone)}</strong>
                    <small>
                      {slot.modality === 'IN_APP_CHAT'
                        ? 'Chat trong ứng dụng'
                        : 'Video trong ứng dụng'}
                    </small>
                  </span>
                </label>
              ))
            )}
          </fieldset>
          {bookingMessage && (
            <p className={styles.inlineError} role="alert">
              {bookingMessage}
            </p>
          )}
          <div className={styles.dialogFooter}>
            {packageCode === 'FREE' ? (
              <>
                <p>
                  Bạn có thể xem và chọn giờ; đặt lịch cần gói Plus hoặc
                  Premium.
                </p>
                <Link href="/subscription">Xem quyền lợi các gói</Link>
              </>
            ) : (
              <button
                type="button"
                disabled={!selectedSlot || submitting}
                onClick={() => selectedSlot && void book(selectedSlot)}
              >
                {submitting ? 'Đang gửi yêu cầu…' : 'Gửi yêu cầu đặt lịch'}
              </button>
            )}
          </div>
        </div>
      ) : null}
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
  const [timezone] = useState(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )
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
        <span>KẾT NỐI TRỰC TUYẾN</span>
        <h1>Chuyên gia tư vấn</h1>
        <p>
          Xem hồ sơ đã được phê duyệt và chọn khung giờ chat hoặc video 60 phút
          đang khả dụng.
        </p>
      </header>

      <section className={styles.controls} aria-label="Bộ lọc chuyên gia">
        <label>
          <span>Lĩnh vực hỗ trợ</span>
          <select
            value={supportArea}
            disabled={loading}
            onChange={(event) =>
              setSupportArea(event.target.value as typeof supportArea)
            }
          >
            <option value="">Tất cả</option>
            <option value="DEPRESSIVE_SYMPTOMS">Khí sắc và trầm buồn</option>
            <option value="ANXIETY_SYMPTOMS">Lo âu</option>
          </select>
        </label>
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
        <label>
          <span>Hình thức</span>
          <select
            value={modality}
            disabled={loading}
            onChange={(event) =>
              setModality(event.target.value as typeof modality)
            }
          >
            <option value="">Chat hoặc video</option>
            <option value="IN_APP_CHAT">Chat trong ứng dụng</option>
            <option
              value="IN_APP_VIDEO"
              disabled={page?.videoEnabled === false}
            >
              Video trong ứng dụng
              {page?.videoEnabled === false ? ' (chưa khả dụng)' : ''}
            </option>
          </select>
        </label>
        <button type="button" onClick={() => void load()} disabled={loading}>
          {loading ? 'Đang tải…' : 'Tải lại'}
        </button>
      </section>

      <p className={styles.timezone}>
        Thời gian hiển thị theo múi giờ {timezone}.
      </p>

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
              <dl className={styles.cardFacts}>
                <div>
                  <dt>Ngôn ngữ</dt>
                  <dd>
                    {item.languages
                      .map((value) => languageLabels[value])
                      .join(', ')}
                  </dd>
                </div>
                <div>
                  <dt>Lịch gần nhất</dt>
                  <dd>
                    {item.explanation.earliestSelectableStartAt
                      ? formatTime(
                          item.explanation.earliestSelectableStartAt,
                          timezone,
                        )
                      : 'Chưa có lịch trống'}
                  </dd>
                </div>
              </dl>
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
        displayTimezone={timezone}
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
