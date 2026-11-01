'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react'
import { Mic, MicOff, PhoneOff, ShieldAlert, Sparkles, X } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import {
  parseAiProcessingDisclosure,
  parseConsentCollection,
} from '@/lib/care/care-validation'
import type { AiProcessingDisclosure } from '@/features/assessment/api/care-contract'
import { VoiceController } from './controller'
import { voiceClient } from './client'
import { VoiceError, type Disclosure } from './contract'
import { clockLabel, durationLabel, voiceErrorText } from './copy'
import styles from './Voice.module.css'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  createController?: () => VoiceController
}
export default function VoiceDialog({
  open,
  onOpenChange,
  createController,
}: Props) {
  const [controller] = useState(
    () => createController?.() ?? new VoiceController(),
  )
  const view = useSyncExternalStore(
    controller.subscribe,
    controller.snapshot,
    controller.snapshot,
  )
  const [disclosure, setDisclosure] = useState<
    Disclosure | AiProcessingDisclosure
  >()
  const [disclosureLoading, setDisclosureLoading] = useState(false)
  const [consentError, setConsentError] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(Date.now)
  const consentKey = useRef<string | undefined>(undefined)
  const pendingDisclosure = useRef<AbortController | undefined>(undefined)
  const titleId = useId()
  const noteId = useId()
  useEffect(() => {
    if (!open) return
    void controller.refresh()
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    const leave = () => controller.dispose()
    window.addEventListener('pagehide', leave)
    return () => {
      clearInterval(timer)
      window.removeEventListener('pagehide', leave)
      pendingDisclosure.current?.abort()
    }
  }, [controller, open])
  function close() {
    pendingDisclosure.current?.abort()
    controller.dispose()
    onOpenChange(false)
  }
  async function loadDisclosure(ai: boolean) {
    pendingDisclosure.current?.abort()
    const abort = new AbortController()
    pendingDisclosure.current = abort
    setDisclosureLoading(true)
    setConsentError('')
    setAccepted(false)
    try {
      let value: Disclosure | AiProcessingDisclosure
      if (ai) {
        const response = await fetch('/api/care/ai-processing-disclosure', {
          cache: 'no-store',
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(12_000)]),
        })
        const parsed = response.ok
          ? parseAiProcessingDisclosure(await response.json())
          : null
        if (!parsed) throw new VoiceError('CONSENT_UNAVAILABLE')
        value = parsed
      } else value = await voiceClient.disclosure(abort.signal)
      if (!abort.signal.aborted) {
        setDisclosure(value)
        consentKey.current = undefined
      }
    } catch {
      if (!abort.signal.aborted)
        setConsentError(
          'Chưa tải được thông tin quyền riêng tư. Chưa có thay đổi nào được xác nhận.',
        )
    } finally {
      if (!abort.signal.aborted) setDisclosureLoading(false)
    }
  }
  async function consent() {
    if (!accepted || !disclosure || saving) return
    const key = consentKey.current ?? crypto.randomUUID()
    consentKey.current = key
    setSaving(true)
    setConsentError('')
    try {
      if (disclosure.consentType === 'AI_VOICE_PROCESSING') {
        const result = await voiceClient.consent(
          { consentVersion: disclosure.consentVersion, granted: true },
          key,
        )
        if (!result.current || !result.granted)
          throw new VoiceError('CONSENT_REQUIRED')
      } else {
        const response = await fetch('/api/care/consent-decisions', {
          method: 'POST',
          signal: AbortSignal.timeout(12_000),
          headers: {
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
          },
          body: JSON.stringify({
            consentType: 'AI_PROCESSING',
            policyVersion: disclosure.version,
            granted: true,
          }),
        })
        const parsed = response.ok
          ? parseConsentCollection({ decisions: [await response.json()] })
          : null
        if (
          !parsed?.decisions.some(
            (value) =>
              value.consentType === 'AI_PROCESSING' &&
              value.granted &&
              value.policyVersion === disclosure.version,
          )
        )
          throw new VoiceError('CONSENT_REQUIRED')
      }
      consentKey.current = undefined
      setDisclosure(undefined)
      setAccepted(false)
      await controller.refresh()
    } catch {
      setConsentError(
        'Chưa xác nhận được lựa chọn. Bạn có thể thử lại cùng yêu cầu hoặc tiếp tục nhắn tin.',
      )
    } finally {
      setSaving(false)
    }
  }
  const eligibility = view.eligibility
  const consentRequired =
    eligibility?.state === 'CONSENT_REQUIRED' ||
    eligibility?.state === 'VOICE_CONSENT_REQUIRED'
  const locked = eligibility?.state === 'FREE_LOCKED'
  const calling = ['starting', 'connected', 'reconnecting', 'ending'].includes(
    view.phase,
  )
  const status =
    view.phase === 'starting'
      ? 'Đang chuẩn bị cuộc gọi'
      : view.phase === 'reconnecting'
        ? 'Đang kết nối lại'
        : view.phase === 'ending'
          ? 'Đang xác nhận kết thúc'
          : view.muted
            ? 'Micro đang tắt'
            : view.hint === 'thinking'
              ? 'AI đang nghĩ'
              : view.hint === 'speaking'
                ? 'AI đang nói'
                : view.hint === 'listening'
                  ? 'AI đang lắng nghe'
                  : 'Đang chờ AI'
  const terminalReason = view.session?.terminalReason
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) close()
      }}
      labelledBy={titleId}
      describedBy={noteId}
      className={styles.dialog}
    >
      <header className={styles.header}>
        <div>
          <h2 id={titleId}>Gọi AI</h2>
          <p id={noteId}>AI đồng hành · Không thay thế chuyên gia</p>
        </div>
        <button
          type="button"
          className={styles.close}
          onClick={close}
          aria-label={calling ? 'Đóng và kết thúc cuộc gọi' : 'Đóng gọi AI'}
        >
          <X size={20} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.body}>
        {disclosure ? (
          <>
            <span className={styles.eyebrow}>Quyền riêng tư</span>
            <h3>
              {disclosure.consentType === 'AI_PROCESSING'
                ? 'Đồng ý xử lý AI'
                : 'Trước cuộc gọi đầu tiên'}
            </h3>
            <div className={styles.disclosure}>
              {disclosure.consentType === 'AI_PROCESSING'
                ? disclosure.content
                : disclosure.disclosureText}
            </div>
            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={accepted}
                disabled={saving}
                onChange={(event) => setAccepted(event.target.checked)}
              />
              <span>
                Tôi đã đọc và đồng ý với thông tin xử lý{' '}
                {disclosure.consentType === 'AI_PROCESSING'
                  ? 'AI'
                  : 'giọng nói'}{' '}
                trên.
              </span>
            </label>
            <button
              type="button"
              className={styles.primary}
              disabled={!accepted || saving}
              onClick={() => void consent()}
            >
              {saving ? 'Đang xác nhận…' : 'Đồng ý và tiếp tục'}
            </button>
            <button
              type="button"
              className={styles.secondary}
              disabled={saving}
              onClick={() => {
                setDisclosure(undefined)
                setAccepted(false)
              }}
            >
              Để sau
            </button>
          </>
        ) : view.phase === 'loading' ? (
          <div className={styles.center} aria-busy="true">
            <span className={styles.mark}>
              <Sparkles aria-hidden="true" />
            </span>
            <p role="status">Đang kiểm tra quyền gọi AI…</p>
          </div>
        ) : calling ? (
          <div className={styles.center}>
            <span className={styles.eyebrow}>Cuộc gọi AI</span>
            <span className={styles.mark} data-state={view.hint}>
              {view.muted ? (
                <MicOff aria-hidden="true" />
              ) : (
                <Sparkles aria-hidden="true" />
              )}
            </span>
            <h3 className={styles.status} role="status" aria-live="polite">
              {status}
            </h3>
            <p className={styles.copy}>
              {view.phase === 'reconnecting'
                ? 'Âm thanh đã tạm dừng. Đang xác minh lại phiên của bạn.'
                : view.phase === 'ending'
                  ? 'Micro đã ngắt. Hệ thống đang xác nhận trạng thái phiên.'
                  : view.muted
                    ? 'Bật micro khi bạn muốn nói tiếp.'
                    : view.hint === 'unavailable'
                      ? 'Chưa nhận được trạng thái mới từ AI. Bạn có thể kết thúc hoặc chờ trong giây lát.'
                      : 'Chia sẻ khi bạn sẵn sàng.'}
            </p>
            {view.session?.hardStopAt ? (
              <>
                <div
                  className={styles.timer}
                  role="timer"
                  aria-label="Thời gian còn lại tham khảo"
                >
                  {clockLabel(Date.parse(view.session.hardStopAt) - now)}
                </div>
                <span className={styles.small}>
                  Thời gian còn lại tham khảo
                </span>
              </>
            ) : null}
            {view.audioBlocked ? (
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void controller.audio()}
              >
                Bật âm thanh
              </button>
            ) : null}
            <div className={styles.controls}>
              {view.phase === 'connected' ? (
                <button
                  type="button"
                  className={styles.secondary}
                  aria-pressed={view.muted}
                  onClick={() => void controller.mute()}
                >
                  {view.muted ? (
                    <Mic size={17} aria-hidden="true" />
                  ) : (
                    <MicOff size={17} aria-hidden="true" />
                  )}
                  {view.muted ? 'Bật micro' : 'Tắt micro'}
                </button>
              ) : null}
              <button
                type="button"
                className={`${styles.primary} ${styles.end}`}
                onClick={() => void controller.end()}
              >
                <PhoneOff size={17} aria-hidden="true" />
                {view.phase === 'ending' ? 'Xác nhận kết thúc' : 'Kết thúc'}
              </button>
            </div>
            <p className={styles.note}>Không ghi âm · Không lưu bản chép lời</p>
          </div>
        ) : view.phase === 'ended' ? (
          <>
            <span className={styles.eyebrow}>Đã kết thúc</span>
            <h3>Cảm ơn bạn đã chia sẻ.</h3>
            <p className={styles.copy}>
              {terminalReason && terminalReason !== 'USER_ENDED'
                ? voiceErrorText(terminalReason)
                : 'Micro đã ngắt. Bạn có thể tiếp tục trò chuyện bằng tin nhắn.'}
            </p>
            <button type="button" className={styles.primary} onClick={close}>
              Tiếp tục nhắn tin
            </button>
          </>
        ) : locked ? (
          <>
            <span className={styles.eyebrow}>Giọng nói · Chưa mở</span>
            <h3>
              Thêm một cách
              <br />
              để chia sẻ.
            </h3>
            <p className={styles.copy}>
              {voiceErrorText('FREE_LOCKED')} Bạn vẫn có thể trò chuyện bằng tin
              nhắn.
            </p>
            <Link
              className={styles.primary}
              href="/subscription"
              onClick={close}
            >
              Xem gói Plus / Premium
            </Link>
            <button type="button" className={styles.secondary} onClick={close}>
              Tiếp tục nhắn tin
            </button>
            <p className={styles.note}>Bản xem trước · Chưa kết nối micro</p>
          </>
        ) : eligibility?.eligible && view.phase !== 'error' ? (
          <>
            <span className={styles.eyebrow}>
              {eligibility.packageCode} · Giọng nói
            </span>
            <h3>
              Chia sẻ bằng giọng nói,
              <br />
              khi bạn muốn.
            </h3>
            <p className={styles.copy}>
              Bạn đang trò chuyện với AI. Cuộc gọi chỉ bắt đầu khi bạn nhấn nút
              và cho phép dùng micro.
            </p>
            <div className={styles.balance}>
              <div>
                Thời lượng khả dụng
                <strong>
                  Tối đa {durationLabel(eligibility.availableSessionSeconds)}
                </strong>
              </div>
              <div>
                Hôm nay còn
                <strong>
                  {eligibility.quota.remainingSessions} phiên ·{' '}
                  {durationLabel(eligibility.quota.remainingSeconds)}
                </strong>
              </div>
            </div>
            <p className={styles.small}>
              Trần mỗi phiên của gói:{' '}
              {durationLabel(eligibility.maxSessionSeconds)}. Thời lượng thực tế
              được xác nhận khi bắt đầu.
            </p>
            <button
              type="button"
              className={styles.primary}
              onClick={() => void controller.start()}
            >
              Bắt đầu cuộc gọi
            </button>
            <p className={styles.note}>
              Không ghi âm, không lưu bản chép lời.
              <br />
              Chỉ dùng hội thoại trong cuộc gọi hiện tại.
            </p>
          </>
        ) : (
          <>
            <span className={styles.eyebrow}>Chưa thể gọi</span>
            <h3>
              {consentRequired
                ? 'Bạn chọn quyền riêng tư.'
                : eligibility?.state === 'GLOBAL_CAPACITY_FULL'
                  ? 'Hiện đã đủ cuộc gọi.'
                  : 'Gọi AI chưa sẵn sàng.'}
            </h3>
            <p className={styles.copy}>
              {voiceErrorText(view.error ?? eligibility?.state)}
            </p>
            {consentRequired ? (
              <button
                type="button"
                className={styles.primary}
                disabled={disclosureLoading}
                onClick={() =>
                  void loadDisclosure(eligibility?.state === 'CONSENT_REQUIRED')
                }
              >
                {disclosureLoading
                  ? 'Đang tải thông tin…'
                  : 'Xem thông tin và đồng ý'}
              </button>
            ) : (
              <button
                type="button"
                className={styles.primary}
                onClick={() =>
                  void (view.uncertain
                    ? controller.start()
                    : controller.refresh())
                }
              >
                {view.uncertain ? 'Xác nhận yêu cầu cũ' : 'Kiểm tra lại'}
              </button>
            )}
            <button type="button" className={styles.secondary} onClick={close}>
              Tiếp tục nhắn tin
            </button>
          </>
        )}
        {consentError ||
        (view.error &&
          (calling || (eligibility?.eligible && view.phase !== 'error'))) ? (
          <p className={styles.error} role="alert">
            {consentError || voiceErrorText(view.error)}
          </p>
        ) : null}
      </div>
      <Link href="/safety-directory" className={styles.help} onClick={close}>
        <ShieldAlert size={17} aria-hidden="true" /> Cần trợ giúp ngay
      </Link>
    </Dialog>
  )
}
