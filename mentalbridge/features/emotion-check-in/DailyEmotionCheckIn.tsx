'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInValue,
} from '@/lib/emotion-check-in/contract'
import {
  parseEmotionCheckIn,
  parseEmotionList,
} from '@/lib/emotion-check-in/validation'

const choices: ReadonlyArray<{
  value: Emotion
  emoji: string
  label: string
}> = [
  { value: 'VERY_LOW', emoji: '😞', label: 'Rất khó khăn' },
  { value: 'LOW', emoji: '😟', label: 'Không tốt' },
  { value: 'OKAY', emoji: '😌', label: 'Bình thường' },
  { value: 'GOOD', emoji: '😊', label: 'Tốt' },
  { value: 'GREAT', emoji: '😄', label: 'Rất tốt' },
]

type Phase = 'loading' | 'empty' | 'ready' | 'saving' | 'saved' | 'error'

class UiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message)
  }
}

const localDate = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? ''
  return `${value('year')}-${value('month')}-${value('day')}`
}

const read = async (response: Response): Promise<unknown> => {
  try {
    return (await response.json()) as unknown
  } catch {
    throw new UiError(502, 'MALFORMED_RESPONSE', 'Phản hồi không hợp lệ.')
  }
}

const problem = (value: unknown) => {
  if (typeof value !== 'object' || value === null) return undefined
  const body = value as Record<string, unknown>
  return {
    code: typeof body.code === 'string' ? body.code : 'REQUEST_FAILED',
    title:
      typeof body.title === 'string'
        ? body.title
        : 'Không thể xử lý yêu cầu lúc này.',
  }
}

const labelFor = (emotion: Emotion) =>
  choices.find((choice) => choice.value === emotion) ?? choices[2]!

export function DailyEmotionCheckIn() {
  const today = useMemo(() => localDate(), [])
  const timezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  )
  const [current, setCurrent] = useState<EmotionCheckIn | null>(null)
  const [history, setHistory] = useState<EmotionCheckIn[]>([])
  const [emotion, setEmotion] = useState<Emotion | null>(null)
  const [intensity, setIntensity] = useState(3)
  const [note, setNote] = useState('')
  const [phase, setPhase] = useState<Phase>('loading')
  const [message, setMessage] = useState('Đang tải ghi nhận hôm nay…')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const keys = useRef(new Map<string, string>())

  const applyCurrent = useCallback((value: EmotionCheckIn | null) => {
    setCurrent(value)
    setEmotion(value?.emotion ?? null)
    setIntensity(value?.intensity ?? 3)
    setNote(value?.note ?? '')
  }, [])

  const reload = useCallback(async () => {
    const [todayResponse, historyResponse] = await Promise.all([
      fetch(`/api/emotion-check-ins/${today}`, { cache: 'no-store' }),
      fetch('/api/emotion-check-ins?limit=7', { cache: 'no-store' }),
    ])
    let todayValue: EmotionCheckIn | null = null
    if (todayResponse.ok) {
      todayValue = parseEmotionCheckIn(await read(todayResponse))
      if (!todayValue)
        throw new UiError(502, 'MALFORMED_RESPONSE', 'Phản hồi không hợp lệ.')
    } else if (todayResponse.status !== 404) {
      const details = problem(await read(todayResponse))
      throw new UiError(
        todayResponse.status,
        details?.code ?? 'REQUEST_FAILED',
        details?.title ?? 'Không thể tải ghi nhận hôm nay.',
      )
    }
    if (!historyResponse.ok) {
      const details = problem(await read(historyResponse))
      throw new UiError(
        historyResponse.status,
        details?.code ?? 'REQUEST_FAILED',
        details?.title ?? 'Không thể tải lịch sử cảm xúc.',
      )
    }
    const page = parseEmotionList(await read(historyResponse))
    if (!page)
      throw new UiError(502, 'MALFORMED_RESPONSE', 'Phản hồi không hợp lệ.')
    applyCurrent(todayValue)
    setHistory(page.items)
    setPhase(todayValue ? 'ready' : 'empty')
    setMessage(
      todayValue
        ? 'Đã tải ghi nhận tự báo cáo hôm nay.'
        : 'Hôm nay bạn chưa ghi nhận cảm xúc.',
    )
  }, [applyCurrent, today])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void reload().catch((error: unknown) => {
        setPhase('error')
        setMessage(
          error instanceof UiError
            ? error.message
            : 'Không thể tải ghi nhận cảm xúc lúc này.',
        )
      })
    }, 0)
    return () => window.clearTimeout(timer)
  }, [reload])

  const keyFor = (scope: string) => {
    const existing = keys.current.get(scope)
    if (existing) return existing
    const key = `emotion-${crypto.randomUUID()}`
    keys.current.set(scope, key)
    return key
  }

  async function save() {
    if (!emotion || note.length > 500) return
    const value: EmotionCheckInValue = {
      emotion,
      intensity,
      note: note.trim().length > 0 ? note : null,
    }
    const scope = `${current ? `update:${current.revision}` : 'create'}:${JSON.stringify(value)}`
    setPhase('saving')
    setMessage(current ? 'Đang cập nhật…' : 'Đang lưu…')
    const response = await fetch(
      current ? `/api/emotion-check-ins/${today}` : '/api/emotion-check-ins',
      {
        method: current ? 'PATCH' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': keyFor(scope),
          ...(current ? { 'If-Match-Revision': String(current.revision) } : {}),
        },
        body: JSON.stringify(
          current ? value : { ...value, localDate: today, timezone },
        ),
      },
    )
    const body = await read(response)
    if (!response.ok) {
      const details = problem(body)
      if (response.status === 409 || response.status === 412) {
        await reload()
        setPhase('error')
        setMessage('Ghi nhận đã thay đổi ở nơi khác. Mình đã tải bản mới nhất.')
        return
      }
      throw new UiError(
        response.status,
        details?.code ?? 'REQUEST_FAILED',
        details?.title ?? 'Không thể lưu ghi nhận cảm xúc.',
      )
    }
    const saved = parseEmotionCheckIn(body)
    if (!saved)
      throw new UiError(502, 'MALFORMED_RESPONSE', 'Phản hồi không hợp lệ.')
    applyCurrent(saved)
    setHistory((entries) =>
      [
        saved,
        ...entries.filter((entry) => entry.localDate !== saved.localDate),
      ].slice(0, 7),
    )
    setPhase('saved')
    setMessage(
      current ? 'Đã cập nhật ghi nhận hôm nay.' : 'Đã lưu ghi nhận hôm nay.',
    )
  }

  async function remove() {
    if (!current) return
    setPhase('saving')
    setMessage('Đang xóa ghi nhận…')
    const response = await fetch(`/api/emotion-check-ins/${today}`, {
      method: 'DELETE',
      headers: {
        'Idempotency-Key': keyFor(`delete:${today}`),
      },
    })
    if (!response.ok) {
      const details = problem(await read(response))
      throw new UiError(
        response.status,
        details?.code ?? 'REQUEST_FAILED',
        details?.title ?? 'Không thể xóa ghi nhận.',
      )
    }
    applyCurrent(null)
    setHistory((entries) =>
      entries.filter((entry) => entry.localDate !== today),
    )
    setConfirmDelete(false)
    setPhase('empty')
    setMessage('Đã xóa ghi nhận và nội dung riêng tư của hôm nay.')
  }

  const guard = (operation: () => Promise<void>) => {
    void operation().catch((error: unknown) => {
      setPhase('error')
      setMessage(
        error instanceof UiError
          ? error.message
          : 'Dịch vụ ghi nhận cảm xúc tạm thời không khả dụng.',
      )
    })
  }

  return (
    <>
      <article className="ref-card ref-mood emotion-check-in">
        <header>
          <div>
            <h2>Cảm xúc hôm nay</h2>
            <p>Tự ghi nhận để nhìn lại, không phải chẩn đoán</p>
          </div>
          <i aria-hidden="true">🙂</i>
        </header>

        {phase === 'loading' ? (
          <p className="emotion-state" role="status">
            Đang tải ghi nhận hôm nay…
          </p>
        ) : (
          <>
            <fieldset className="emotion-choices" disabled={phase === 'saving'}>
              <legend>Chọn cảm xúc phù hợp nhất</legend>
              <div>
                {choices.map((choice) => (
                  <label key={choice.value}>
                    <input
                      type="radio"
                      name="daily-emotion"
                      value={choice.value}
                      checked={emotion === choice.value}
                      onChange={() => setEmotion(choice.value)}
                    />
                    <span aria-hidden="true">{choice.emoji}</span>
                    <small>{choice.label}</small>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset
              className="emotion-intensity"
              disabled={phase === 'saving'}
            >
              <legend>Cường độ của cảm xúc này</legend>
              <div>
                {[1, 2, 3, 4, 5].map((value) => (
                  <label key={value}>
                    <input
                      type="radio"
                      name="daily-emotion-intensity"
                      checked={intensity === value}
                      onChange={() => setIntensity(value)}
                    />
                    <span>{value}</span>
                  </label>
                ))}
              </div>
              <small>1 là nhẹ, 5 là mạnh — không phải điểm sức khỏe.</small>
            </fieldset>
            <label className="emotion-note">
              <span>Ghi chú riêng tư (không bắt buộc)</span>
              <textarea
                value={note}
                maxLength={500}
                rows={2}
                disabled={phase === 'saving'}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Một điều bạn muốn ghi nhớ về hôm nay…"
              />
              <small>{note.length}/500</small>
            </label>
            <div className="emotion-actions">
              <button
                type="button"
                className="emotion-save"
                disabled={!emotion || phase === 'saving'}
                onClick={() => guard(save)}
              >
                {phase === 'saving'
                  ? 'Đang xử lý…'
                  : current
                    ? 'Cập nhật'
                    : 'Lưu ghi nhận'}
              </button>
              {current && (
                <button
                  type="button"
                  className="emotion-delete"
                  onClick={() => setConfirmDelete(true)}
                >
                  Xóa
                </button>
              )}
            </div>
            {confirmDelete && (
              <div className="emotion-delete-confirm" role="alert">
                <p>Xóa sẽ loại bỏ nội dung cảm xúc đã mã hóa của ngày này.</p>
                <button type="button" onClick={() => guard(remove)}>
                  Xác nhận xóa
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)}>
                  Giữ lại
                </button>
              </div>
            )}
          </>
        )}

        <footer
          className={
            phase === 'error' ? 'emotion-status error' : 'emotion-status'
          }
          role={phase === 'error' ? 'alert' : 'status'}
        >
          {message}
          {phase === 'error' && (
            <button type="button" onClick={() => guard(reload)}>
              Thử lại
            </button>
          )}
        </footer>
      </article>

      <article className="ref-card ref-trend emotion-history">
        <header>
          <div>
            <h2>Ghi nhận tự báo cáo gần đây</h2>
            <p>
              Phản ánh điều bạn đã chọn, không phải tiến triển hay hồi phục.
            </p>
          </div>
          <i aria-hidden="true">◷</i>
        </header>
        {phase === 'loading' ? (
          <p className="emotion-history-empty">Đang tải lịch sử…</p>
        ) : history.length === 0 ? (
          <p className="emotion-history-empty">
            Chưa có lịch sử. Bạn có thể bắt đầu bằng ghi nhận hôm nay.
          </p>
        ) : (
          <ol>
            {history.map((entry) => {
              const choice = labelFor(entry.emotion)
              return (
                <li key={entry.localDate}>
                  <time dateTime={entry.localDate}>{entry.localDate}</time>
                  <span aria-hidden="true">{choice.emoji}</span>
                  <p>
                    <strong>{choice.label}</strong>
                    <small>Cường độ tự báo cáo {entry.intensity}/5</small>
                  </p>
                </li>
              )
            })}
          </ol>
        )}
      </article>
    </>
  )
}
