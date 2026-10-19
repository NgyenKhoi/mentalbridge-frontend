'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  ArrowLeft,
  Ban,
  Clock3,
  FileText,
  RefreshCw,
  VideoOff,
  X,
} from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'

import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  VideoAccess,
  VideoSession,
} from '@/lib/consultation/video-validation'
import { videoBrowserClient } from '../api/video-browser-client'
import { appointmentBrowserClient } from '../api/browser-client'
import styles from './VideoConsultation.module.css'

const VideoMedia = dynamic(() => import('./VideoMedia'), {
  ssr: false,
  loading: () => (
    <div className={styles.standby} aria-busy="true">
      <VideoOff size={40} aria-hidden="true" />
      <p>Đang tải khung cuộc gọi…</p>
    </div>
  ),
})
const phaseCopy: Record<VideoSession['phase'], string> = {
  TOO_EARLY: 'Bạn có thể kiểm tra camera và micro từ 5 phút trước giờ hẹn.',
  WAITING: 'Bạn có thể kiểm tra thiết bị. Đến giờ hẹn, nút tham gia sẽ mở.',
  ACTIVE: 'Phiên tư vấn đã mở. Khi sẵn sàng, hãy nhấn tham gia.',
  ENDED: 'Phiên video đã kết thúc. Bạn không thể kết nối lại phiên này.',
  COMPLETED: 'Buổi tư vấn đã được xác nhận hoàn tất.',
  NOT_AVAILABLE: 'Lịch hẹn này hiện không cho phép vào phiên video.',
  UNAVAILABLE: 'Chưa thể mở phiên video. Bạn có thể thử lại sau.',
}

export function VideoSessionPanel({
  appointmentId,
  role,
  onVerified,
  preparation,
}: {
  appointmentId: string
  role: 'USER' | 'SPECIALIST'
  onVerified?: () => void
  preparation?: ReactNode
}) {
  const { confirm } = useFeedback()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [access, setAccess] = useState<VideoAccess | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [participantName, setParticipantName] = useState('')
  const [callEnded, setCallEnded] = useState(false)
  const [preparationOpen, setPreparationOpen] = useState(false)
  const preparationId = useId()
  const alive = useRef(false)
  const working = useRef(false)
  const latest = useRef<{ session: VideoSession; received: number } | null>(
    null,
  )
  const command = useRef<{ key: string; version: number } | null>(null)
  const verified = useRef(false)
  const callback = useRef(onVerified)
  const joinAttempt = useRef(0)
  const stopMedia = useCallback(() => {
    joinAttempt.current += 1
    setAccess(null)
  }, [])
  const leaveCall = useCallback(() => {
    stopMedia()
    setCallEnded(true)
  }, [stopMedia])
  const mediaError = useCallback(() => {
    setAccess(null)
    setError(
      'Cuộc gọi đã ngắt. Bạn có thể kiểm tra thiết bị và thử tham gia lại nếu phiên còn mở.',
    )
  }, [])
  useEffect(() => {
    callback.current = onVerified
  }, [onVerified])
  useEffect(() => {
    if (role !== 'USER') return
    let current = true
    void appointmentBrowserClient
      .list()
      .then(({ items }) => {
        const name = items.find(
          (item) => item.id === appointmentId,
        )?.specialistDisplayName
        if (current && name) setParticipantName(name)
      })
      .catch(() => {
        if (current) setParticipantName('')
      })
    return () => {
      current = false
    }
  }, [appointmentId, role])

  const refresh = useCallback(async () => {
    let next: VideoSession
    try {
      next = await videoBrowserClient.session(appointmentId)
    } catch (caught) {
      const temporary =
        caught instanceof ApiError &&
        [
          'CONSULTATION_UNAVAILABLE',
          'CONSULTATION_TIMEOUT',
          'NETWORK_ERROR',
          'REQUEST_TIMEOUT',
        ].includes(caught.code)
      if (alive.current && !temporary) {
        latest.current = null
        setSession(null)
        stopMedia()
      }
      throw caught
    }
    if (!alive.current) return null
    if (
      latest.current &&
      (next.version < latest.current.session.version ||
        (next.version === latest.current.session.version &&
          Date.parse(next.serverTime) <
            Date.parse(latest.current.session.serverTime)))
    )
      return latest.current.session
    latest.current = { session: next, received: performance.now() }
    setSession(next)
    setLoadError('')
    if (!next.joinAllowed) stopMedia()
    if (next.completion) {
      command.current = null
      setUncertain(false)
    }
    if (
      next.completion?.verificationState === 'VERIFIED' &&
      !verified.current
    ) {
      verified.current = true
      callback.current?.()
    }
    return next
  }, [appointmentId, stopMedia])

  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        await refresh()
      } catch (caught) {
        if (alive.current) {
          setLoadError(
            caught instanceof ApiError &&
              [401, 403, 404].includes(caught.status ?? 0)
              ? 'Bạn không có quyền vào phiên này. Hãy kiểm tra tài khoản và lịch hẹn.'
              : latest.current
                ? 'Chưa cập nhật được phiên. Đang thử lại; cuộc gọi đã kết nối sẽ được giữ đến khi phiên kết thúc.'
                : 'Chưa kiểm tra được quyền vào phiên. Camera và micro đã dừng; hãy thử tải lại.',
          )
        }
      }
      if (alive.current) timer = setTimeout(poll, 5000)
    }
    void poll()
    const onPageHide = () => {
      stopMedia()
    }
    window.addEventListener('pagehide', onPageHide)
    const checkDeadline = () => {
      const anchor = latest.current
      if (
        anchor &&
        Date.parse(anchor.session.serverTime) +
          performance.now() -
          anchor.received >=
          Date.parse(anchor.session.endsAt)
      ) {
        stopMedia()
        setSession((current) => (current?.joinAllowed ? null : current))
      }
    }
    const onVisible = () => {
      if (document.visibilityState === 'visible') checkDeadline()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', checkDeadline)
    const deadline = setInterval(checkDeadline, 1000)
    return () => {
      alive.current = false
      joinAttempt.current += 1
      clearTimeout(timer)
      clearInterval(deadline)
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', checkDeadline)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [refresh, stopMedia])

  async function join() {
    if (working.current || command.current) return
    working.current = true
    setBusy(true)
    setError('')
    const attempt = ++joinAttempt.current
    try {
      const current = await refresh()
      if (!current?.joinAllowed) return
      const issued = await videoBrowserClient.access(appointmentId)
      const anchor = latest.current
      if (
        !alive.current ||
        attempt !== joinAttempt.current ||
        !anchor?.session.joinAllowed ||
        issued.endsAt !== anchor.session.endsAt ||
        Date.parse(issued.expiresAt) <=
          Date.parse(anchor.session.serverTime) +
            performance.now() -
            anchor.received
      )
        return
      setAccess(issued)
      setCallEnded(false)
    } catch {
      if (alive.current)
        setError(
          'Chưa thể kết nối cuộc gọi. Kiểm tra mạng, quyền truy cập và thử lại.',
        )
    } finally {
      working.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function finish() {
    if (working.current) return
    working.current = true
    setBusy(true)
    try {
      if (!command.current) {
        const accepted = await confirm({
          title: 'Xác nhận buổi tư vấn đã kết thúc?',
          description:
            'Thao tác này đóng cuộc gọi cho cả hai người và gửi xác nhận của bạn. Lượt tư vấn vẫn được giữ nếu thông tin tham gia chưa được xác minh.',
          confirmLabel: 'Kết thúc và gửi xác nhận',
          cancelLabel: 'Tiếp tục tư vấn',
          tone: 'danger',
        })
        if (!accepted || !alive.current) return
        const current = await refresh()
        if (!current || current.completion) return
        command.current = { key: crypto.randomUUID(), version: current.version }
      }
      setAccess(null)
      const pending = command.current
      const result = await videoBrowserClient.complete(
        appointmentId,
        pending.version,
        pending.key,
      )
      if (!alive.current) return
      command.current = null
      setUncertain(false)
      setError('')
      const prior = latest.current
      if (prior) {
        const updated: VideoSession = {
          ...prior.session,
          phase:
            result.verificationState === 'VERIFIED' ? 'COMPLETED' : 'ENDED',
          previewAllowed: false,
          joinAllowed: false,
          completion: result,
          version: result.version,
        }
        latest.current = { ...prior, session: updated }
        setSession(updated)
      }
      if (result.verificationState === 'VERIFIED' && !verified.current) {
        verified.current = true
        callback.current?.()
      }
      await refresh()
    } catch (caught) {
      if (!alive.current) return
      if (caught instanceof ApiError && caught.status === 412) {
        command.current = null
        setUncertain(false)
        setError('Lịch hẹn vừa thay đổi. Hãy tải lại trước khi xác nhận.')
      } else {
        setUncertain(command.current !== null)
        setError(
          'Chưa nhận được kết quả xác nhận. Thử gửi lại để kiểm tra cùng yêu cầu; không tạo buổi tư vấn mới.',
        )
      }
    } finally {
      working.current = false
      if (alive.current) setBusy(false)
    }
  }

  return (
    <section
      className={styles.panel}
      aria-label="Cuộc gọi tư vấn"
      data-specialist-journey={role === 'SPECIALIST' ? 'video' : undefined}
    >
      <header className={styles.header}>
        <div className={styles.headerIdentity}>
          <Link
            className={styles.backLink}
            aria-label="Trở về lịch hẹn"
            title="Trở về lịch hẹn"
            href={
              role === 'USER'
                ? `/appointments/${encodeURIComponent(appointmentId)}`
                : `/specialist/appointments?appointmentId=${encodeURIComponent(appointmentId)}`
            }
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div>
            <div className={styles.nameLine}>
              <h2>
                {participantName ||
                  (role === 'USER'
                    ? 'Chuyên gia của bạn'
                    : 'Người tham gia cùng bạn')}
              </h2>
              <span className={styles.sessionBadge}>Tư vấn trực tuyến</span>
            </div>
            {session && (
              <p className={styles.schedule}>
                <Clock3 size={13} aria-hidden="true" />
                <time dateTime={session.startsAt}>
                  {new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  }).format(new Date(session.startsAt))}
                </time>
                {' – '}
                <time dateTime={session.endsAt}>
                  {new Intl.DateTimeFormat('vi-VN', {
                    timeZone: 'Asia/Ho_Chi_Minh',
                    timeStyle: 'short',
                  }).format(new Date(session.endsAt))}
                </time>
                {' · Giờ Việt Nam'}
              </p>
            )}
          </div>
        </div>
        <span className={styles.privacy}>
          <Ban size={14} aria-hidden="true" />
          Không ghi âm hoặc ghi hình
        </span>
      </header>
      <div className={styles.body}>
        {session?.completion && (
          <p role="status">
            {session.completion.verificationState === 'VERIFIED'
              ? 'Bạn có thể xem tóm tắt sau buổi tư vấn.'
              : session.completion.verificationState === 'EVIDENCE_REVIEW'
                ? 'Phiên cần được kiểm tra thêm. Lượt tư vấn vẫn được giữ; chưa có kết luận hoàn tất.'
                : 'Đã nhận xác nhận. Đang kiểm tra thông tin tham gia; lượt tư vấn vẫn được giữ.'}
          </p>
        )}
        {error && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}
        {loadError && (
          <p className={styles.error} role="alert">
            {loadError}
          </p>
        )}
        {!uncertain && (
          <VideoMedia
            access={access}
            previewAllowed={Boolean(session?.previewAllowed)}
            onLeave={leaveCall}
            onError={mediaError}
            participantName={participantName || 'Người tham gia cùng bạn'}
            hint={
              callEnded && session?.joinAllowed
                ? 'Bạn đã rời cuộc gọi. Có thể tham gia lại nếu phiên còn mở.'
                : session
                  ? phaseCopy[session.phase]
                  : loadError
                    ? 'Chưa xác nhận được quyền vào phiên.'
                    : 'Đang kiểm tra quyền vào phiên…'
            }
            onJoin={() => void join()}
            joinDisabled={busy || !session?.joinAllowed || uncertain}
            joining={busy}
          />
        )}
        {uncertain && (
          <div className={styles.standby}>
            <VideoOff size={40} aria-hidden="true" />
            <p>Camera và micro đang tắt</p>
          </div>
        )}
        <footer className={styles.footer}>
          <div className={styles.footerNote}>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setError('')
                void refresh().catch(() =>
                  setError('Chưa thể tải lại phiên. Vui lòng thử lại.'),
                )
              }}
            >
              <RefreshCw size={14} aria-hidden="true" />
              Tải lại phiên
            </button>
            <p className={styles.note}>
              Kiểm tra thiết bị chỉ diễn ra trên máy của bạn. Rời cuộc gọi không
              đồng nghĩa buổi tư vấn đã hoàn tất.
            </p>
          </div>
          <div className={styles.actions}>
            {preparation ? (
              <button
                type="button"
                className={styles.preparationButton}
                onClick={() => setPreparationOpen(true)}
              >
                <FileText size={14} aria-hidden="true" />
                Tóm tắt trước buổi tư vấn
              </button>
            ) : (
              <Link
                className={styles.preparationButton}
                href={`/appointments/${encodeURIComponent(appointmentId)}`}
              >
                <FileText size={14} aria-hidden="true" />
                Xem nội dung chuẩn bị trong lịch hẹn
              </Link>
            )}
            {role === 'SPECIALIST' &&
              !session?.completion &&
              (uncertain ||
                (session && ['ACTIVE', 'ENDED'].includes(session.phase))) && (
                <button
                  type="button"
                  className={styles.primary}
                  disabled={busy}
                  onClick={() => void finish()}
                >
                  {uncertain
                    ? 'Kiểm tra lại xác nhận'
                    : 'Xác nhận kết thúc buổi tư vấn'}
                </button>
              )}
          </div>
        </footer>
        {session?.completion?.verificationState === 'VERIFIED' && (
          <Link
            className={styles.resultLink}
            href={
              role === 'USER'
                ? `/appointments/${encodeURIComponent(appointmentId)}`
                : `/specialist/follow-up?appointmentId=${encodeURIComponent(appointmentId)}`
            }
          >
            Xem nội dung sau buổi tư vấn
          </Link>
        )}
      </div>
      {preparation && (
        <Dialog
          open={preparationOpen}
          onOpenChange={setPreparationOpen}
          labelledBy={preparationId}
          className={styles.callDialog}
        >
          <div className={styles.dialogContent}>
            <div className={styles.dialogHeading}>
              <h2 id={preparationId}>Thông tin trước buổi tư vấn</h2>
              <button
                type="button"
                aria-label="Đóng thông tin chuẩn bị"
                onClick={() => setPreparationOpen(false)}
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>
            {preparation}
          </div>
        </Dialog>
      )}
    </section>
  )
}
