'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronRight, Clock3, FileText, LockKeyhole, MessageCircle, Search, ShieldCheck, Video, X } from 'lucide-react'

import type { SpecialistClientContinuityItem } from '@/features/appointments/api/consultation-brief-contract'
import { consultationBriefBrowserClient } from '@/features/appointments/api/consultation-brief-browser-client'
import { SessionSummaryPanel } from '@/features/appointments/components/SessionSummaryPanel'
import { SpecialistConsultationBrief } from '@/features/appointments/components/SpecialistConsultationBrief'
import { ApiError } from '@/lib/api/api-error'
import { Skeleton } from './ui/Skeleton'
import styles from './SpecialistClientsManager.module.css'

type Props = { rows?: unknown[]; initialAppointmentId?: string }
type Client = {
  id: string
  name: string
  appointments: SpecialistClientContinuityItem[]
}

const VN_ZONE = 'Asia/Ho_Chi_Minh'
const TABS = [
  ['prepare', 'Chuẩn bị phiên'],
  ['summary', 'Tổng kết phiên'],
  ['history', 'Phạm vi truy cập'],
] as const

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(-2)
    .map((part) => part[0]?.toLocaleUpperCase('vi') ?? '')
    .join('')
}

function formatAppointment(item: SpecialistClientContinuityItem) {
  const start = new Date(item.scheduledStartAt)
  const end = new Date(item.scheduledEndAt)
  const date = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_ZONE,
    weekday: 'long',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(start)
  const time = new Intl.DateTimeFormat('vi-VN', {
    timeZone: VN_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
  return { date, time: `${time.format(start)}–${time.format(end)}` }
}

function statusLabel(status: SpecialistClientContinuityItem['status']) {
  return {
    CONFIRMED: 'Đã xác nhận',
    IN_PROGRESS: 'Đang diễn ra',
    SESSION_ENDED: 'Đang hoàn tất',
    COMPLETED: 'Đã hoàn thành',
  }[status]
}

function accessLabel(
  state: SpecialistClientContinuityItem['briefAccessState'],
) {
  return {
    AVAILABLE: 'Có thể xem lúc này',
    TOO_EARLY: 'Chưa đến cửa sổ xem',
    EXPIRED: 'Cửa sổ xem đã kết thúc',
    REVOKED: 'Quyền đã được thu hồi',
    STALE: 'Lịch hẹn đã thay đổi',
    NOT_SHARED: 'Chưa được chia sẻ',
    UNAVAILABLE: 'Không khả dụng ở trạng thái này',
  }[state]
}

function accessDescription(
  state: SpecialistClientContinuityItem['briefAccessState'],
) {
  return {
    AVAILABLE: '',
    TOO_EARLY:
      'Bản chuẩn bị sẽ mở khi bắt đầu cửa sổ truy cập của lịch hẹn này.',
    EXPIRED:
      'Cửa sổ chuẩn bị đã kết thúc. Nội dung đã chia sẻ không còn được phép xem.',
    REVOKED:
      'Người dùng đã thu hồi quyền chia sẻ hoặc xóa bản chuẩn bị cho lịch hẹn này.',
    STALE:
      'Lịch hẹn đã thay đổi. Người dùng cần xem lại và chia sẻ một bản phù hợp với lịch mới.',
    NOT_SHARED: 'Người dùng chưa chia sẻ bản chuẩn bị cho lịch hẹn này.',
    UNAVAILABLE:
      'Trạng thái hiện tại của lịch hẹn không cho phép mở bản chuẩn bị.',
  }[state]
}

function appointmentOrder(
  left: SpecialistClientContinuityItem,
  right: SpecialistClientContinuityItem,
) {
  const rank = {
    IN_PROGRESS: 0,
    CONFIRMED: 1,
    SESSION_ENDED: 2,
    COMPLETED: 3,
  } satisfies Record<SpecialistClientContinuityItem['status'], number>
  const statusDifference = rank[left.status] - rank[right.status]
  if (statusDifference !== 0) return statusDifference
  const timeDifference =
    Date.parse(left.scheduledStartAt) - Date.parse(right.scheduledStartAt)
  return left.status === 'CONFIRMED' ? timeDifference : -timeDifference
}

function loadError(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401)
      return 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
    if (error.status === 403)
      return 'Quyền xem danh sách tiếp nối tư vấn hiện không khả dụng.'
  }
  return 'Chưa thể tải khách hàng và lịch hẹn được phép xem. Vui lòng thử lại.'
}

export default function SpecialistClientsManager({
  initialAppointmentId,
}: Props) {
  const [items, setItems] = useState<SpecialistClientContinuityItem[]>([])
  const [selectedClientId, setSelectedClientId] = useState('')
  const [selectedAppointmentId, setSelectedAppointmentId] = useState(
    initialAppointmentId ?? '',
  )
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')
  const [tab, setTab] = useState<'prepare' | 'summary' | 'history'>('prepare')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [loaded, setLoaded] = useState(false)
  const [detailOpen, setDetailOpen] = useState(Boolean(initialAppointmentId))
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const selectedClientButton = useRef<HTMLButtonElement>(null)
  const searchInput = useRef<HTMLInputElement>(null)
  const selectedId = useRef(initialAppointmentId ?? '')
  const tabId = useId()

  const clients = useMemo<Client[]>(() => {
    const groups = new Map<string, Client>()
    for (const item of items) {
      const current = groups.get(item.userAccountId)
      if (current) current.appointments.push(item)
      else
        groups.set(item.userAccountId, {
          id: item.userAccountId,
          name: item.userDisplayName,
          appointments: [item],
        })
    }
    return [...groups.values()].map((client) => ({
      ...client,
      appointments: client.appointments.sort(appointmentOrder),
    }))
  }, [items])

  const visibleClients = useMemo(
    () =>
      clients.filter((client) => {
        const matchesQuery = client.name.toLocaleLowerCase('vi').includes(query.trim().toLocaleLowerCase('vi'))
        const matchesFilter = filter === 'all' || client.appointments.some((appointment) =>
          filter === 'completed' ? appointment.status === 'COMPLETED' : appointment.status === 'CONFIRMED' || appointment.status === 'IN_PROGRESS',
        )
        return matchesQuery && matchesFilter
      }),
    [clients, filter, query],
  )

  const selectedClient =
    clients.find((client) => client.id === selectedClientId) ??
    clients[0] ??
    null
  const selectedAppointment =
    selectedClient?.appointments.find(
      (appointment) => appointment.appointmentId === selectedAppointmentId,
    ) ??
    selectedClient?.appointments[0] ??
    null
  const activeClients = clients.filter((client) => client.appointments.some((item) => item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS')).length
  const completedClients = clients.filter((client) => client.appointments.some((item) => item.status === 'COMPLETED')).length
  const upcoming = items.filter((item) => (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') && Date.parse(item.scheduledEndAt) >= Date.now()).sort((a, b) => Date.parse(a.scheduledStartAt) - Date.parse(b.scheduledStartAt))[0]

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const response =
        await consultationBriefBrowserClient.specialistContinuity()
      setItems(response.items)
      const first =
        response.items.find(
          (item) => item.appointmentId === selectedId.current,
        ) ?? response.items[0]
      setSelectedClientId(first?.userAccountId ?? '')
      setSelectedAppointmentId(first?.appointmentId ?? '')
      if (first?.appointmentId !== selectedId.current)
        setTab(first?.status === 'COMPLETED' ? 'summary' : 'prepare')
      selectedId.current = first?.appointmentId ?? ''
      setLoaded(true)
    } catch (caught) {
      if (caught instanceof ApiError && [401, 403].includes(caught.status ?? 0))
        setItems([])
      setError(loadError(caught))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    let active = true
    void consultationBriefBrowserClient
      .specialistContinuity()
      .then((response) => {
        if (!active) return
        setItems(response.items)
        const first =
          response.items.find(
            (item) => item.appointmentId === initialAppointmentId,
          ) ?? response.items[0]
        setSelectedClientId(first?.userAccountId ?? '')
        setSelectedAppointmentId(first?.appointmentId ?? '')
        selectedId.current = first?.appointmentId ?? ''
        setLoaded(true)
        setTab(first?.status === 'COMPLETED' ? 'summary' : 'prepare')
      })
      .catch((caught: unknown) => {
        if (!active) return
        setItems([])
        setError(loadError(caught))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [initialAppointmentId])

  const chooseClient = (client: Client) => {
    const next = client.appointments[0]
    setSelectedClientId(client.id)
    setSelectedAppointmentId(next?.appointmentId ?? '')
    selectedId.current = next?.appointmentId ?? ''
    setDetailOpen(true)
    setTab(next?.status === 'COMPLETED' ? 'summary' : 'prepare')
    requestAnimationFrame(() =>
      detailHeading.current?.focus({ preventScroll: true }),
    )
  }

  const chooseAppointment = (appointment: SpecialistClientContinuityItem) => {
    setSelectedAppointmentId(appointment.appointmentId)
    selectedId.current = appointment.appointmentId
    setTab(appointment.status === 'COMPLETED' ? 'summary' : 'prepare')
  }

  if (loading)
    return (
      <section className={`clients-page ${styles.page}`} aria-label="Khách hàng của tôi">
        <div className={styles.loadingState} role="status">
          <span />
          <span />
          <span />
          <p>Đang tải các quan hệ tư vấn được phép xem…</p>
        </div>
      </section>
    )

  return (
    <section className={`clients-page ${styles.page}`} aria-labelledby="specialist-clients-title">
      <header className={`clients-heading ${styles.heading}`}>
        <div>
          <span className={styles.eyebrow}>Không gian chuyên gia lâm sàng</span>
          <h1 id="specialist-clients-title">Khách hàng &amp; phiên tư vấn</h1>
          <p>
            Chuẩn bị, xem lại hồ sơ tóm tắt và đồng hành cùng khách hàng theo lịch hẹn trong phạm vi được cho phép.
          </p>
        </div>
        <div className="clients-heading-actions"><span className="clients-security"><ShieldCheck size={16} /> Dữ liệu được bảo vệ</span><Link className={styles.primaryLink} href="/specialist/appointments">＋ Quản lý lịch hẹn</Link></div>
      </header>

      <aside className={`clients-banner ${styles.boundaryNote}`}>
        <span aria-hidden="true"><Check size={17} /></span>
        <p>
          Danh sách giới hạn theo lịch hẹn đã xác nhận, đang diễn ra hoặc mới hoàn tất để bảo đảm quyền riêng tư.
        </p>
        <small>Quyền xem theo phiên</small>
      </aside>

      {error && (
        <div className={styles.pageError} role="alert">
          <p>{error}</p>
          <button type="button" onClick={() => void load()} disabled={loading}>
            Thử lại
          </button>
        </div>
      )}
      {loading && !loaded ? (
        <div
          className={styles.loadingState}
          role="status"
          aria-label="Đang tải khách hàng"
        >
          <Skeleton width="100%" height={280} />
          <Skeleton width="100%" height={480} />
        </div>
      ) : error && clients.length === 0 ? null : clients.length === 0 ? (
        <div className={styles.emptyState}>
          <span aria-hidden="true">◇</span>
          <h2>Chưa có khách hàng trong phạm vi tiếp nối</h2>
          <p>
            Khách hàng sẽ xuất hiện sau khi một lịch hẹn được xác nhận. Các yêu
            cầu chưa xác nhận và lịch cũ ngoài phạm vi gần đây không được liệt
            kê.
          </p>
          <Link href="/specialist/appointments">Xem lịch hẹn</Link>
        </div>
      ) : (
        <>
        <div className="clients-stats">
          <div className="clients-stat"><div><small>Khách hàng được phép xem</small><strong>{String(clients.length).padStart(2, '0')} khách hàng</strong></div><span><CalendarDays size={20} /></span></div>
          <div className="clients-stat"><div><small>Phiên tiếp theo{upcoming ? ` (${formatAppointment(upcoming).time.split('–')[0]})` : ''}</small><strong>{upcoming?.userDisplayName ?? 'Chưa có lịch'}</strong></div><span><Video size={20} /></span></div>
          <div className="clients-stat"><div><small>Trạng thái lịch hẹn</small><strong>{upcoming ? statusLabel(upcoming.status) : 'Chưa có phiên sắp tới'}</strong></div><span><FileText size={20} /></span></div>
        </div>
        <div className={`clients-layout ${styles.workspace}`}>
          <aside
            className={`clients-directory ${styles.directory}`}
            aria-label="Khách hàng được phép xem"
          >
            <header>
              <div>
                <h2>Khách hàng của tôi</h2>
                <span>Theo lịch hẹn</span>
              </div>
              <strong>{clients.length}</strong>
            </header>
            <label className="clients-search">
              <Search size={16} aria-hidden="true" />
              <input
                ref={searchInput}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm tên khách hàng…"
                aria-label="Tìm khách hàng"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => {
                    setQuery('')
                    searchInput.current?.focus()
                  }}
                >
                  <X size={18} aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="clients-filters" aria-label="Lọc khách hàng">
              {([['all', 'Tất cả', clients.length], ['active', 'Đã xác nhận', activeClients], ['completed', 'Đã xong', completedClients]] as const).map(([key, label, count]) => (
                <button data-clients-ui type="button" key={key} aria-pressed={filter === key} onClick={() => setFilter(key)}>{label} <span>({count})</span></button>
              ))}
            </div>
            <div className={`clients-list ${styles.appointmentList}`}>
              {visibleClients.length === 0 && <p className="clients-no-results">Không tìm thấy khách hàng phù hợp.</p>}
              {visibleClients.map((client) => {
                const latest = client.appointments[0]
                return (
                  <button
                    data-clients-ui
                    type="button"
                    key={client.id}
                    ref={
                      selectedClient?.id === client.id
                        ? selectedClientButton
                        : undefined
                    }
                    className={
                      selectedClient?.id === client.id
                        ? styles.selectedAppointment
                        : ''
                    }
                    aria-pressed={selectedClient?.id === client.id}
                    onClick={() => chooseClient(client)}
                  >
                    <span className={`clients-list-avatar ${styles.dateMark}`}>
                      {initials(client.name)}
                    </span>
                    <span className={`clients-list-copy ${styles.appointmentCopy}`}>
                      <strong>{client.name}</strong>
                      <small>
                        {client.appointments.length} phiên ·{' '}
                        {statusLabel(latest.status)}
                      </small>
                    </span>
                    <ChevronRight size={16} aria-hidden="true" />
                  </button>
                )
              })}
              {visibleClients.length === 0 && (
                <div className={styles.searchEmpty}>
                  <p>Không tìm thấy khách hàng phù hợp.</p>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery('')
                      searchInput.current?.focus()
                    }}
                  >
                    Xóa tìm kiếm
                  </button>
                </div>
              )}
            </div>
            <div className="clients-directory-note"><ShieldCheck size={18} /><p><strong>Chính sách bảo mật quyền riêng tư</strong>Dữ liệu chỉ hiển thị trong phạm vi khách hàng đã cấp quyền cho phiên.</p></div>
          </aside>

          {selectedClient && selectedAppointment && (
            <section className={`clients-detail ${styles.detail}`} aria-live="polite">
              <header className={`clients-detail-header ${styles.detailHeader}`}>
                <span className="clients-detail-avatar">{initials(selectedClient.name)}</span>
                <div className="clients-detail-copy">
                  <span className={styles.sectionLabel}>
                    Hồ sơ theo lịch hẹn <span className="clients-id">#{selectedClient.id.slice(0, 8).toUpperCase()}</span>
                  </span>
                  <h2 ref={detailHeading} tabIndex={-1}>
                    {selectedClient.name}
                  </h2>
                  <p>
                    <Video size={15} />{' '}
                    {selectedAppointment.modality === 'IN_APP_CHAT'
                      ? 'Chat bảo mật trong ứng dụng'
                      : 'Video bảo mật trong ứng dụng'}
                  </p>
                  <small>{Math.round((Date.parse(selectedAppointment.scheduledEndAt) - Date.parse(selectedAppointment.scheduledStartAt)) / 60000)} phút · {selectedClient.appointments.length} phiên với bạn</small>
                </div>
                <div className="clients-appointment-summary">
                  <small>Lịch hẹn đang chọn</small>
                  <strong><Clock3 size={16} /> {formatAppointment(selectedAppointment).time}</strong>
                  <span>{formatAppointment(selectedAppointment).date}</span>
                </div>
              </header>
              <div className="clients-detail-actions">
                <Link className="clients-main-action" href="/specialist/appointments"><CalendarDays size={17} /> Xem lịch hẹn</Link>
                {selectedAppointment.modality === 'IN_APP_CHAT' && <Link className="clients-chat-action" href={`/specialist/messages?appointmentId=${encodeURIComponent(selectedAppointment.appointmentId)}`}><MessageCircle size={17} /> Mở cửa sổ Chat</Link>}
                <span>{statusLabel(selectedAppointment.status)}</span>
              </div>

                {selectedClient.appointments.length > 1 && <div className={`clients-version-bar ${styles.versionBar}`}>
                <div>
                  <span className={styles.sectionLabel}>
                    Lịch hẹn đang chọn
                  </span>
                  <p>
                    {formatAppointment(selectedAppointment).date} ·{' '}
                    {formatAppointment(selectedAppointment).time} ·{' '}
                    {statusLabel(selectedAppointment.status)}
                  </p>
                  <small>Múi giờ hiển thị: {VN_ZONE}</small>
                </div>
                <div
                  className={`clients-version-choices ${styles.versionChoices}`}
                  aria-label="Chọn lịch hẹn"
                >
                  {selectedClient.appointments.map((appointment) => (
                    <button
                      data-clients-ui
                      type="button"
                      key={appointment.appointmentId}
                      aria-pressed={
                        appointment.appointmentId ===
                        selectedAppointment.appointmentId
                      }
                      onClick={() => chooseAppointment(appointment)}
                    >
                      <span>
                        {formatAppointment(appointment).date} ·{' '}
                        {formatAppointment(appointment).time}
                      </span>
                    </button>
                  ))}
                </div>
              </div>}

              <div
                className="clients-tabs"
                role="tablist"
                aria-label="Nội dung phiên tư vấn"
              >
                {TABS.map(([key, label]) => (
                  <button
                    data-clients-ui
                    type="button"
                    role="tab"
                    key={key}
                    aria-selected={tab === key}
                    id={`${tabId}-${key}`}
                    aria-controls={`${tabId}-panel`}
                    tabIndex={tab === key ? 0 : -1}
                    onClick={() => setTab(key)}
                    onKeyDown={(event) => {
                      const index = TABS.findIndex(([value]) => value === key)
                      const next =
                        event.key === 'Home'
                          ? 0
                          : event.key === 'End'
                            ? TABS.length - 1
                            : event.key === 'ArrowRight'
                              ? (index + 1) % TABS.length
                              : event.key === 'ArrowLeft'
                                ? (index + TABS.length - 1) % TABS.length
                                : null
                      if (next !== null) {
                        event.preventDefault()
                        setTab(TABS[next][0])
                        document
                          .getElementById(`${tabId}-${TABS[next][0]}`)
                          ?.focus()
                      }
                    }}
                  >
                    {label}
                  </button>
                ))}
                <small>ConsultationBrief · {selectedAppointment.briefSnapshotVersion ? `bản ${selectedAppointment.briefSnapshotVersion}` : 'theo quyền truy cập'}</small>
              </div>

              <div
                className={`clients-panel ${styles.snapshot}`}
                key={`${selectedAppointment.appointmentId}-${tab}`}
              >
                {tab === 'prepare' && (
                  <>
                    <h3 className="clients-panel-title"><span aria-hidden="true" /> Tóm tắt trước buổi tư vấn</h3>
                    <div className={styles.snapshotMeta}>
                      <span>
                        {accessLabel(selectedAppointment.briefAccessState)}
                      </span>
                    </div>
                    {selectedAppointment.briefAccessState === 'AVAILABLE' ? (
                      <SpecialistConsultationBrief
                        key={selectedAppointment.appointmentId}
                        appointmentId={selectedAppointment.appointmentId}
                        compact
                      />
                    ) : (
                      <div className={styles.detailState}>
                        <h3>
                          {accessLabel(selectedAppointment.briefAccessState)}
                        </h3>
                        <p>
                          {accessDescription(
                            selectedAppointment.briefAccessState,
                          )}
                        </p>
                        <button
                          type="button"
                          className={styles.reload}
                          onClick={() => void load()}
                          disabled={loading}
                        >
                          Kiểm tra lại quyền xem
                        </button>
                      </div>
                    )}
                    <div className="clients-panel-foot"><LockKeyhole size={16} /> Chỉ đọc bản chụp khách hàng đã phê duyệt cho phiên này.</div>
                  </>
                )}

                {tab === 'summary' &&
                  (selectedAppointment.status === 'COMPLETED' ? (
                    <SessionSummaryPanel
                      key={selectedAppointment.appointmentId}
                      appointmentId={selectedAppointment.appointmentId}
                      viewer="SPECIALIST"
                    />
                  ) : (
                    <div className={styles.detailState}>
                      <h3>Tổng kết mở sau khi phiên hoàn thành</h3>
                      <p>
                        Bản tóm tắt sau phiên chỉ được xuất bản từ một lịch hẹn
                        đã hoàn thành.
                      </p>
                    </div>
                  ))}

                {tab === 'history' && (
                  <section className={styles.summarySection}>
                    <h3>Nguồn và thời hạn của quyền xem</h3>
                    <p>
                      Nội dung được chia sẻ riêng cho lịch hẹn{' '}
                      {formatAppointment(selectedAppointment).date},{' '}
                      {formatAppointment(selectedAppointment).time}.
                    </p>
                    <p>
                      {selectedAppointment.briefAccessStartAt &&
                      selectedAppointment.briefAccessEndAt
                        ? `Thời gian được xem: ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: VN_ZONE }).format(new Date(selectedAppointment.briefAccessStartAt))} – ${new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short', timeZone: VN_ZONE }).format(new Date(selectedAppointment.briefAccessEndAt))} (${VN_ZONE}).`
                        : 'Người dùng chưa chia sẻ bản chuẩn bị cho lịch hẹn này.'}
                    </p>
                    <p>
                      Chỉ bản tóm tắt được người dùng phê duyệt cho lịch hẹn này
                      được chia sẻ. Nhật ký gốc, câu trả lời sàng lọc, kế hoạch
                      hỗ trợ đầy đủ và ghi chú của chuyên gia khác không được
                      chia sẻ tại đây.
                    </p>
                  </section>
                )}
              </div>
              {tab === 'prepare' && selectedAppointment.briefAccessState === 'AVAILABLE' && (
                <section className="clients-guides" aria-label="Tài liệu tham khảo cho phiên">
                  <div className="clients-guides-heading"><h3>Tài liệu tham khảo cho phiên</h3><span>Chọn theo đánh giá chuyên môn</span></div>
                  <div className="clients-guide-grid">
                    <article><span className="clients-guide-icon"><Clock3 size={20} /></span><div><h4>Kỹ thuật thở hộp (4–4–4–4)</h4><p>Bài tập hướng dẫn điều hòa nhịp thở trong vài phút.</p><small>5 phút hướng dẫn</small></div></article>
                    <article><span className="clients-guide-icon"><FileText size={20} /></span><div><h4>Giãn cơ tiến triển (PMR)</h4><p>Tài liệu hướng dẫn nhận biết và thả lỏng căng cơ.</p><small>8 phút hướng dẫn</small></div></article>
                  </div>
                </section>
              )}
              <div className="clients-privacy-foot"><ShieldCheck size={18} /> Không gian tư vấn bảo vệ dữ liệu theo phạm vi quyền truy cập của từng lịch hẹn.</div>
            </section>
          )}
        </div>
        </>
      )}
    </section>
  )
}
