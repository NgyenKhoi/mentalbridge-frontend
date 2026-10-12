'use client'

import Link from 'next/link'
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  MessageSquare,
  RefreshCw,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'

import type { SpecialistClientContinuityItem } from '@/features/appointments/api/consultation-brief-contract'
import { consultationBriefBrowserClient } from '@/features/appointments/api/consultation-brief-browser-client'
import { SessionSummaryPanel } from '@/features/appointments/components/SessionSummaryPanel'
import { SpecialistConsultationBrief } from '@/features/appointments/components/SpecialistConsultationBrief'
import { ApiError } from '@/lib/api/api-error'
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
      clients.filter((client) =>
        client.name
          .toLocaleLowerCase('vi')
          .includes(query.trim().toLocaleLowerCase('vi')),
      ),
    [clients, query],
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

  return (
    <section
      className={styles.page}
      data-specialist-journey="clients"
      aria-labelledby="specialist-clients-title"
    >
      <header className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Không gian chuyên gia</span>
          <h1 id="specialist-clients-title">Khách hàng &amp; phiên tư vấn</h1>
          <p>
            Chuẩn bị và xem lại nội dung theo đúng lịch hẹn, quyền chia sẻ và
            cửa sổ truy cập hiện hành.
          </p>
        </div>
        <div className={styles.headingActions}>
          <button
            type="button"
            className={styles.reload}
            onClick={() => void load()}
            disabled={loading}
            aria-label="Tải lại khách hàng"
          >
            <RefreshCw size={18} aria-hidden="true" />
            <span>{loading ? 'Đang tải…' : 'Tải lại'}</span>
          </button>
          <Link className={styles.primaryLink} href="/specialist/appointments">
            <CalendarDays size={18} aria-hidden="true" /> Quản lý lịch hẹn
          </Link>
        </div>
      </header>

      <aside className={styles.boundaryNote}>
        <ShieldCheck size={20} aria-hidden="true" />
        <p>
          <strong>Danh sách được giới hạn theo lịch hẹn</strong>
          Chỉ khách hàng có phiên đã xác nhận, đang diễn ra hoặc mới hoàn thành
          với bạn mới xuất hiện tại đây.
        </p>
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
        <div
          className={styles.workspace}
          data-detail-open={detailOpen}
          aria-busy={loading}
        >
          <aside
            className={styles.directory}
            aria-label="Khách hàng được phép xem"
          >
            <header>
              <div>
                <span>Theo quan hệ lịch hẹn</span>
                <h2>Khách hàng của tôi</h2>
              </div>
              <strong>{clients.length}</strong>
            </header>
            <label className={styles.search}>
              <Search size={18} aria-hidden="true" />
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
            <div className={styles.appointmentList}>
              {visibleClients.map((client) => {
                const latest = client.appointments[0]
                return (
                  <button
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
                    <span className={styles.dateMark}>
                      {initials(client.name)}
                    </span>
                    <span className={styles.appointmentCopy}>
                      <strong>{client.name}</strong>
                      <small>
                        {client.appointments.length} phiên ·{' '}
                        {statusLabel(latest.status)}
                      </small>
                    </span>
                    <ChevronRight size={18} aria-hidden="true" />
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
          </aside>

          {selectedClient && selectedAppointment && (
            <section className={styles.detail} aria-label="Chi tiết khách hàng">
              <button
                type="button"
                className={styles.back}
                onClick={() => {
                  setDetailOpen(false)
                  requestAnimationFrame(() =>
                    selectedClientButton.current?.focus({
                      preventScroll: true,
                    }),
                  )
                }}
              >
                <ArrowLeft size={18} aria-hidden="true" /> Danh sách khách hàng
              </button>
              <header className={styles.detailHeader}>
                <div>
                  <span className={styles.sectionLabel}>
                    Không gian phiên tư vấn
                  </span>
                  <h2 ref={detailHeading} tabIndex={-1}>
                    {selectedClient.name}
                  </h2>
                  <p>
                    {selectedClient.appointments.length} lịch hẹn với bạn ·{' '}
                    {selectedAppointment.modality === 'IN_APP_CHAT'
                      ? 'Chat trong ứng dụng'
                      : 'Video trong ứng dụng'}
                  </p>
                </div>
                <div className={styles.detailActions}>
                  {selectedAppointment.modality === 'IN_APP_CHAT' && (
                    <Link
                      href={`/specialist/messages?appointmentId=${encodeURIComponent(selectedAppointment.appointmentId)}`}
                    >
                      <MessageSquare size={18} aria-hidden="true" /> Mở tin nhắn
                    </Link>
                  )}
                </div>
              </header>

              <div className={styles.versionBar}>
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
                  className={styles.versionChoices}
                  aria-label="Chọn lịch hẹn"
                >
                  {selectedClient.appointments.map((appointment) => (
                    <button
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
              </div>

              <div
                className={styles.tabs}
                role="tablist"
                aria-label="Nội dung phiên tư vấn"
              >
                {TABS.map(([key, label]) => (
                  <button
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
              </div>

              <div
                className={styles.snapshot}
                role="tabpanel"
                id={`${tabId}-panel`}
                aria-labelledby={`${tabId}-${tab}`}
                tabIndex={0}
                key={`${selectedAppointment.appointmentId}-${tab}`}
              >
                {tab === 'prepare' && (
                  <>
                    <div className={styles.snapshotMeta}>
                      <span>
                        {accessLabel(selectedAppointment.briefAccessState)}
                      </span>
                    </div>
                    {selectedAppointment.briefAccessState === 'AVAILABLE' ? (
                      <SpecialistConsultationBrief
                        key={selectedAppointment.appointmentId}
                        appointmentId={selectedAppointment.appointmentId}
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
            </section>
          )}
        </div>
      )}
    </section>
  )
}
