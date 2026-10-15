'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useRef, useState } from 'react'

import { Disclosure } from '@/components/ui/Disclosure'
import { useFeedback } from '@/components/ui/FeedbackProvider'
import { ApiError } from '@/lib/api/api-error'
import type {
  VideoAccess,
  VideoSession,
} from '@/lib/consultation/video-validation'
import { videoBrowserClient } from '../api/video-browser-client'
import styles from './VideoConsultation.module.css'

const VideoMedia = dynamic(() => import('./VideoMedia'), { ssr: false })
const phaseCopy: Record<VideoSession['phase'], string> = {
  TOO_EARLY: 'Bạn có thể kiểm tra camera và micro từ 5 phút trước giờ hẹn.',
  WAITING: 'Bạn có thể kiểm tra thiết bị. Đến giờ hẹn, nút tham gia sẽ mở.',
  ACTIVE: 'Phiên tư vấn đã mở. Khi sẵn sàng, hãy nhấn tham gia.',
  ENDED: 'Phiên video đã kết thúc. Bạn không thể kết nối lại phiên này.',
  COMPLETED: 'Buổi tư vấn đã được xác nhận hoàn tất.',
  NOT_AVAILABLE: 'Lịch hẹn này hiện không cho phép vào phiên video.',
  UNAVAILABLE: 'Chưa thể mở phiên video. Bạn có thể thử lại sau.',
}

/** The keyed boundary prevents draft/token carry-over between appointments. */
export function VideoConsultationPanel(props: {
  appointmentId: string
  role: 'USER' | 'SPECIALIST'
  onVerified?: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Disclosure
      className={styles.disclosure}
      summary="Phiên tư vấn video"
      open={open}
      expanded={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      {open && (
        <VideoSessionPanel
          key={`${props.role}:${props.appointmentId}`}
          {...props}
        />
      )}
    </Disclosure>
  )
}

export function VideoSessionPanel({
  appointmentId,
  role,
  onVerified,
}: {
  appointmentId: string
  role: 'USER' | 'SPECIALIST'
  onVerified?: () => void
}) {
  const { confirm } = useFeedback()
  const [session, setSession] = useState<VideoSession | null>(null)
  const [access, setAccess] = useState<VideoAccess | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [foreground, setForeground] = useState(true)
  const alive = useRef(false)
  const working = useRef(false)
  const latest = useRef<{ session: VideoSession; received: number } | null>(
    null,
  )
  const command = useRef<{ key: string; version: number } | null>(null)
  const verified = useRef(false)
  const callback = useRef(onVerified)
  useEffect(() => {
    callback.current = onVerified
  }, [onVerified])

  const refresh = useCallback(async () => {
    let next: VideoSession
    try {
      next = await videoBrowserClient.session(appointmentId)
    } catch (caught) {
      if (alive.current) {
        latest.current = null
        setSession(null)
        setAccess(null)
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
    if (!next.joinAllowed) setAccess(null)
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
  }, [appointmentId])

  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        await refresh()
      } catch (caught) {
        if (alive.current) {
          latest.current = null
          setSession(null)
          setAccess(null)
          setLoadError(
            caught instanceof ApiError &&
              [401, 403, 404].includes(caught.status ?? 0)
              ? 'Bạn không có quyền vào phiên này. Hãy kiểm tra tài khoản và lịch hẹn.'
              : 'Chưa kiểm tra được quyền vào phiên. Camera và micro đã dừng; hãy thử tải lại.',
          )
        }
      }
      if (alive.current) timer = setTimeout(poll, 5000)
    }
    void poll()
    const onVisibility = () => {
      const visible = document.visibilityState === 'visible'
      setForeground(visible)
      if (!visible) setAccess(null)
    }
    const onPageHide = () => {
      setForeground(false)
      setAccess(null)
    }
    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)
    // Local monotonic time only stops media; it never grants access or proves attendance.
    const deadline = setInterval(() => {
      const anchor = latest.current
      if (
        anchor &&
        Date.parse(anchor.session.serverTime) +
          performance.now() -
          anchor.received >=
          Date.parse(anchor.session.endsAt)
      ) {
        setAccess(null)
        setSession((current) => (current?.joinAllowed ? null : current))
      }
    }, 1000)
    return () => {
      alive.current = false
      clearTimeout(timer)
      clearInterval(deadline)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
    }
  }, [refresh])

  async function join() {
    if (working.current || command.current) return
    working.current = true
    setBusy(true)
    setError('')
    try {
      const current = await refresh()
      if (!current?.joinAllowed) return
      const issued = await videoBrowserClient.access(appointmentId)
      const anchor = latest.current
      if (
        !alive.current ||
        document.visibilityState !== 'visible' ||
        !anchor?.session.joinAllowed ||
        issued.endsAt !== anchor.session.endsAt ||
        Date.parse(issued.expiresAt) <=
          Date.parse(anchor.session.serverTime) +
            performance.now() -
            anchor.received
      )
        return
      setAccess(issued)
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
    <section className={styles.panel} aria-label="Cuộc gọi tư vấn">
      <header className={styles.header}>
        <h3>Trao đổi trực tiếp</h3>
        <span>Không ghi âm hoặc ghi hình</span>
      </header>
      <div className={styles.body}>
        <p role="status">
          {session
            ? phaseCopy[session.phase]
            : loadError
              ? 'Chưa xác nhận được quyền vào phiên.'
              : 'Đang kiểm tra quyền vào phiên…'}
        </p>
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
        {foreground && !uncertain && (access || session?.previewAllowed) && (
          <VideoMedia
            access={access}
            previewAllowed={Boolean(session?.previewAllowed)}
            onLeave={() => setAccess(null)}
            onError={() => {
              setAccess(null)
              setError(
                'Cuộc gọi đã ngắt. Bạn có thể kiểm tra thiết bị và thử tham gia lại nếu phiên còn mở.',
              )
            }}
          />
        )}
        <div className={styles.actions}>
          {!access && (
            <button
              type="button"
              className={styles.primary}
              disabled={
                busy || !foreground || !session?.joinAllowed || uncertain
              }
              onClick={() => void join()}
            >
              {busy ? 'Đang xử lý…' : 'Tham gia phiên tư vấn'}
            </button>
          )}
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
            Tải lại phiên
          </button>
          {role === 'SPECIALIST' &&
            !session?.completion &&
            (uncertain ||
              (session && ['ACTIVE', 'ENDED'].includes(session.phase))) && (
              <button
                type="button"
                className={styles.danger}
                disabled={busy}
                onClick={() => void finish()}
              >
                {uncertain
                  ? 'Kiểm tra lại xác nhận'
                  : 'Xác nhận kết thúc buổi tư vấn'}
              </button>
            )}
        </div>
        <p className={styles.note}>
          Kiểm tra thiết bị chỉ diễn ra trên máy của bạn. Rời cuộc gọi không
          đồng nghĩa buổi tư vấn đã hoàn tất.
        </p>
      </div>
    </section>
  )
}
