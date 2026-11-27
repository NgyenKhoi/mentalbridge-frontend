import { randomUUID } from 'expo-crypto'
import { useFocusEffect } from 'expo-router'
import { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, Pressable, Text, View } from 'react-native'
import { ApiError } from '@/api/api-error'
import { useSession } from '@/auth/session-context'
import type { VideoApi } from './video-api'
import type { VideoAccess, VideoSession } from './video-contract'
import { videoStyles as styles } from './video-styles'
import { lobbyStyles as lobby } from './video-lobby-styles'

import VideoMedia from './VideoMedia'

export function VideoButton({
  label,
  onPress,
  disabled = false,
  danger = false,
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        lobby.button,
        danger && lobby.danger,
        disabled && lobby.disabled,
        pressed && lobby.pressed,
      ]}
    >
      <Text style={[lobby.label, danger && lobby.dangerLabel]}>{label}</Text>
    </Pressable>
  )
}

export function VideoConsultationPanel({
  api,
  appointmentId,
  initiallyOpen = false,
}: {
  api: VideoApi
  appointmentId: string
  initiallyOpen?: boolean
}) {
  const { session } = useSession()
  const [open, setOpen] = useState(initiallyOpen)
  return (
    <View style={lobby.panel}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={
          open ? 'Đóng phiên tư vấn video' : 'Mở phiên tư vấn video'
        }
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((value) => !value)}
        style={lobby.disclosure}
      >
        <View style={lobby.disclosureIcon}>
          <View style={lobby.cameraMark} />
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={lobby.disclosureTitle}>Cuộc gọi video</Text>
          <Text style={lobby.caption}>
            {open
              ? 'Kiểm tra thiết bị & tham gia phiên'
              : 'Mở khu vực chuẩn bị cuộc gọi'}
          </Text>
        </View>
        <Text accessible={false} style={lobby.disclosureChevron}>
          {open ? '⌃' : '⌄'}
        </Text>
      </Pressable>
      {open && session && (
        <VideoSessionPanel
          key={`${session.subject}:${session.role}:${appointmentId}`}
          api={api}
          appointmentId={appointmentId}
          role={session.role}
        />
      )}
    </View>
  )
}

const phaseCopy: Record<VideoSession['phase'], string> = {
  TOO_EARLY: 'Bạn có thể kiểm tra thiết bị từ 5 phút trước giờ hẹn.',
  WAITING: 'Bạn có thể kiểm tra thiết bị. Đến giờ hẹn, nút tham gia sẽ mở.',
  ACTIVE: 'Phiên tư vấn đã mở. Hãy tham gia khi sẵn sàng.',
  ENDED: 'Phiên video đã kết thúc. Bạn không thể kết nối lại.',
  COMPLETED: 'Buổi tư vấn đã được xác nhận hoàn tất.',
  NOT_AVAILABLE: 'Lịch hẹn này hiện không cho phép vào phiên video.',
  UNAVAILABLE: 'Chưa thể mở phiên video. Vui lòng thử lại sau.',
}

export function VideoSessionPanel({
  api,
  appointmentId,
  role,
}: {
  api: VideoApi
  appointmentId: string
  role: 'USER' | 'SPECIALIST'
}) {
  const [snapshot, setSnapshot] = useState<VideoSession | null>(null)
  const [access, setAccess] = useState<VideoAccess | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [review, setReview] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [foreground, setForeground] = useState(
    AppState.currentState === 'active',
  )
  const [focused, setFocused] = useState(true)
  const alive = useRef(false)
  const inFlight = useRef(false)
  const anchor = useRef<{ session: VideoSession; received: number } | null>(
    null,
  )
  const command = useRef<{ key: string; version: number } | null>(null)
  const canConnect = useRef(true)
  useEffect(() => {
    canConnect.current = foreground && focused
  }, [foreground, focused])
  useFocusEffect(
    useCallback(() => {
      setFocused(true)
      return () => {
        canConnect.current = false
        setAccess(null)
        setFocused(false)
        setReview(false)
      }
    }, []),
  )

  const refresh = useCallback(async () => {
    let next: VideoSession
    try {
      next = await api.session(appointmentId)
    } catch (caught) {
      if (alive.current) {
        anchor.current = null
        setSnapshot(null)
        setAccess(null)
      }
      throw caught
    }
    if (!alive.current) return null
    if (
      anchor.current &&
      (next.version < anchor.current.session.version ||
        (next.version === anchor.current.session.version &&
          Date.parse(next.serverTime) <
            Date.parse(anchor.current.session.serverTime)))
    )
      return anchor.current.session
    anchor.current = { session: next, received: performance.now() }
    setSnapshot(next)
    if (!next.joinAllowed) setAccess(null)
    if (next.completion) {
      command.current = null
      setUncertain(false)
      setReview(false)
    }
    return next
  }, [api, appointmentId])

  useEffect(() => {
    alive.current = true
    let timer: ReturnType<typeof setTimeout>
    async function poll() {
      try {
        await refresh()
      } catch (caught) {
        if (alive.current) {
          anchor.current = null
          setSnapshot(null)
          setAccess(null)
          setError(
            caught instanceof ApiError &&
              [401, 403, 404].includes(caught.status ?? 0)
              ? 'Bạn không có quyền vào phiên này. Hãy kiểm tra tài khoản và lịch hẹn.'
              : 'Chưa kiểm tra được quyền vào phiên. Thiết bị đã dừng; hãy thử tải lại.',
          )
        }
      }
      if (alive.current) timer = setTimeout(poll, 5000)
    }
    void poll()
    const listener = AppState.addEventListener('change', (state) => {
      if (state !== 'active') canConnect.current = false
      setForeground(state === 'active')
      if (state !== 'active') {
        setAccess(null)
        setReview(false)
      }
    })
    const deadline = setInterval(() => {
      const value = anchor.current
      if (
        value &&
        Date.parse(value.session.serverTime) +
          performance.now() -
          value.received >=
          Date.parse(value.session.endsAt)
      ) {
        setAccess(null)
        setSnapshot((current) => (current?.joinAllowed ? null : current))
      }
    }, 1000)
    return () => {
      alive.current = false
      clearTimeout(timer)
      clearInterval(deadline)
      listener.remove()
    }
  }, [refresh])

  async function join() {
    if (inFlight.current || command.current || !canConnect.current) return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      if (!(await refresh())?.joinAllowed) return
      const issued = await api.access(appointmentId)
      const latest = anchor.current
      if (
        !alive.current ||
        !canConnect.current ||
        !latest?.session.joinAllowed ||
        issued.endsAt !== latest.session.endsAt ||
        Date.parse(issued.expiresAt) <=
          Date.parse(latest.session.serverTime) +
            performance.now() -
            latest.received
      )
        return
      setAccess(issued)
    } catch {
      if (alive.current)
        setError('Chưa thể kết nối. Kiểm tra mạng và thử lại khi phiên còn mở.')
    } finally {
      inFlight.current = false
      if (alive.current) setBusy(false)
    }
  }

  async function finish() {
    if (inFlight.current || role !== 'SPECIALIST') return
    inFlight.current = true
    setBusy(true)
    setError('')
    try {
      if (!command.current) {
        const current = await refresh()
        if (!current || current.completion) return
        command.current = { key: randomUUID(), version: current.version }
      }
      setAccess(null)
      const pending = command.current
      const result = await api.complete(
        appointmentId,
        pending.version,
        pending.key,
      )
      if (!alive.current) return
      command.current = null
      setUncertain(false)
      setReview(false)
      const prior = anchor.current
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
        anchor.current = { ...prior, session: updated }
        setSnapshot(updated)
      }
      await refresh()
    } catch (caught) {
      if (!alive.current) return
      if (caught instanceof ApiError && caught.status === 412) {
        command.current = null
        setUncertain(false)
        setReview(false)
        setError('Lịch hẹn vừa thay đổi. Hãy tải lại trước khi xác nhận.')
      } else {
        setUncertain(command.current !== null)
        setError(
          'Chưa nhận được kết quả xác nhận. Kiểm tra lại cùng yêu cầu trước khi thực hiện thao tác khác.',
        )
      }
    } finally {
      inFlight.current = false
      if (alive.current) setBusy(false)
    }
  }

  return (
    <View style={lobby.body}>
      <View style={lobby.headingRow}>
        <View>
          <Text style={lobby.eyebrow}>PHÒNG TƯ VẤN TRỰC TUYẾN</Text>
          <Text accessibilityRole="header" style={lobby.title}>
            {access
              ? 'Cuộc gọi đang diễn ra'
              : snapshot?.phase === 'COMPLETED'
                ? 'Buổi tư vấn hoàn tất'
                : snapshot?.phase === 'ENDED'
                  ? 'Phiên đã kết thúc'
                  : 'Chuẩn bị cuộc gọi'}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={lobby.badge}>
            <View
              style={[
                lobby.badgeDot,
                snapshot?.phase !== 'ACTIVE' && { backgroundColor: '#7A8B80' },
              ]}
            />
            <Text style={lobby.badgeText}>
              {access
                ? 'Đang tham gia'
                : snapshot?.phase === 'ACTIVE'
                  ? 'Đã mở phiên'
                  : snapshot?.phase === 'WAITING'
                    ? 'Sắp đến giờ'
                    : snapshot?.phase === 'COMPLETED'
                      ? 'Đã hoàn tất'
                      : snapshot?.phase === 'ENDED'
                        ? 'Đã kết thúc'
                        : 'Kiểm tra phiên'}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Tải lại phiên"
            accessibilityHint="Cập nhật trạng thái và quyền tham gia cuộc gọi"
            accessibilityState={{ disabled: busy }}
            disabled={busy}
            onPress={() => {
              setError('')
              void refresh().catch(() =>
                setError('Chưa thể tải lại. Vui lòng thử lại.'),
              )
            }}
            style={({ pressed }) => [
              lobby.reload,
              busy && lobby.disabled,
              pressed && lobby.pressed,
            ]}
          >
            <Text accessible={false} style={lobby.reloadIcon}>
              ↻
            </Text>
          </Pressable>
        </View>
      </View>
      <View style={lobby.statusBox}>
        {snapshot && (
          <>
            <Text style={lobby.schedule}>
              {new Date(snapshot.startsAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh',
              })}{' '}
              –{' '}
              {new Date(snapshot.endsAt).toLocaleTimeString('vi-VN', {
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'Asia/Ho_Chi_Minh',
              })}
            </Text>
            <Text style={lobby.scheduleMeta}>
              {new Date(snapshot.startsAt).toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                timeZone: 'Asia/Ho_Chi_Minh',
              })}{' '}
              · Giờ Việt Nam
            </Text>
          </>
        )}
        <Text accessibilityLiveRegion="polite" style={lobby.statusText}>
          {snapshot
            ? phaseCopy[snapshot.phase]
            : 'Đang kiểm tra quyền vào phiên…'}
        </Text>
      </View>
      {error !== '' && (
        <Text accessibilityRole="alert" style={styles.error}>
          {error}
        </Text>
      )}
      {snapshot?.completion &&
        snapshot.completion.verificationState !== 'VERIFIED' && (
          <Text accessibilityLiveRegion="polite" style={styles.copy}>
            {snapshot.completion.verificationState === 'EVIDENCE_REVIEW'
              ? 'Phiên cần được kiểm tra thêm.'
              : 'Đã nhận xác nhận, đang kiểm tra thông tin tham gia.'}{' '}
            Lượt tư vấn vẫn được giữ; chưa có kết luận hoàn tất.
          </Text>
        )}
      {foreground &&
        focused &&
        !uncertain &&
        (access || snapshot?.previewAllowed) && (
          <VideoMedia
            access={access}
            role={role}
            startsAt={snapshot?.startsAt}
            previewAllowed={Boolean(snapshot?.previewAllowed)}
            onLeave={() => setAccess(null)}
            onError={() => {
              setAccess(null)
              setError(
                'Cuộc gọi đã ngắt. Kiểm tra thiết bị và tham gia lại nếu phiên còn mở.',
              )
            }}
          />
        )}
      {!access && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={busy ? 'Đang xử lý…' : 'Tham gia phiên tư vấn'}
          accessibilityState={{
            disabled:
              busy ||
              !foreground ||
              !focused ||
              !snapshot?.joinAllowed ||
              uncertain,
          }}
          disabled={
            busy ||
            !foreground ||
            !focused ||
            !snapshot?.joinAllowed ||
            uncertain
          }
          onPress={() => void join()}
          style={({ pressed }) => [
            lobby.join,
            (busy ||
              !foreground ||
              !focused ||
              !snapshot?.joinAllowed ||
              uncertain) &&
              lobby.disabled,
            pressed && lobby.pressed,
          ]}
        >
          <Text style={lobby.joinText}>
            {busy ? 'Đang xử lý…' : 'Tham gia phiên tư vấn'}
          </Text>
          <Text accessible={false} style={lobby.joinArrow}>
            →
          </Text>
        </Pressable>
      )}
      {role === 'SPECIALIST' &&
        !snapshot?.completion &&
        (uncertain ||
          (snapshot && ['ACTIVE', 'ENDED'].includes(snapshot.phase))) &&
        (uncertain ? (
          <VideoButton
            label="Kiểm tra lại xác nhận"
            disabled={busy}
            onPress={() => void finish()}
          />
        ) : (
          <VideoButton
            label="Xác nhận kết thúc buổi tư vấn"
            danger
            disabled={busy}
            onPress={() => setReview(true)}
          />
        ))}
      {review && !uncertain && (
        <View style={lobby.review}>
          <Text accessibilityRole="header" style={styles.title}>
            Buổi tư vấn đã kết thúc?
          </Text>
          <Text style={styles.copy}>
            Thao tác này đóng cuộc gọi cho cả hai người và gửi xác nhận của bạn.
            Nếu chưa xác minh được thông tin tham gia, lượt tư vấn vẫn được giữ.
          </Text>
          <VideoButton
            label="Tiếp tục tư vấn"
            disabled={busy}
            onPress={() => setReview(false)}
          />
          <VideoButton
            label="Kết thúc và gửi xác nhận"
            danger
            disabled={busy}
            onPress={() => void finish()}
          />
        </View>
      )}
      <View style={lobby.footer}>
        <View style={lobby.footerIcon}>
          <Text style={lobby.caption}>✓</Text>
        </View>
        <View style={{ flex: 1, gap: 3 }}>
          <Text style={lobby.footerCopy}>Không ghi âm hoặc ghi hình</Text>
          <Text style={lobby.footerCopy}>
            Kiểm tra thiết bị chỉ diễn ra trên máy. Rời cuộc gọi không tự hoàn
            tất buổi tư vấn.
          </Text>
        </View>
      </View>
    </View>
  )
}
