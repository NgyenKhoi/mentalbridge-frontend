'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { AiProcessingDisclosure } from '@/features/assessment/api/care-contract'
import type {
  AnalysisJob,
  AnalysisTerminalReason,
  JournalEntry,
} from '@/lib/journal/journal-contract'
import {
  parseAiProcessingDisclosure,
  parseConsentCollection,
} from '@/lib/care/care-validation'
import { parseAnalysisJob } from '@/lib/journal/journal-validation'
import {
  actionRoutes,
  analysisStorageKey,
  canRetryAnalysis,
  isConsentFailure,
  isStaleFailure,
  matchesDisplayedRevision,
  parseStoredAnalysisRequest,
  type StoredAnalysisRequest,
} from './reflection'
import styles from './JournalReflection.module.css'

function SystemLabel({ children = 'Thông tin từ hệ thống' }) {
  return (
    <span className={styles.systemLabel}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 10.7v5.1M12 7.7h.01" />
      </svg>
      {children}
    </span>
  )
}

type AnalysisLoadingPhase = 'requesting' | 'queued' | 'running'

function AnalysisLoadingState({ phase }: { phase: AnalysisLoadingPhase }) {
  const copy = {
    requesting: {
      title: 'Đang gửi nhật ký đến AI',
      description:
        'MentalBridge đang chuẩn bị nội dung bạn đã chọn để bắt đầu phân tích.',
    },
    queued: {
      title: 'Yêu cầu đang chờ xử lý',
      description:
        'Yêu cầu đã được tiếp nhận và sẽ tự động bắt đầu khi đến lượt.',
    },
    running: {
      title: 'AI đang phân tích nhật ký này',
      description:
        'Bạn có thể tiếp tục sử dụng MentalBridge và quay lại xem kết quả sau.',
    },
  }[phase]

  return (
    <div
      className={`${styles.state} ${styles.analyzingState}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div
        className={styles.analysisLoader}
        data-testid="journal-analysis-loader"
        aria-hidden="true"
      >
        <span className={styles.analysisOrbit} />
        <span className={styles.analysisCore}>
          <svg viewBox="0 0 24 24">
            <path d="M12 3.5c.6 3.7 2.8 5.9 6.5 6.5-3.7.6-5.9 2.8-6.5 6.5-.6-3.7-2.8-5.9-6.5-6.5 3.7-.6 5.9-2.8 6.5-6.5Z" />
            <path d="M18.3 15.2c.2 1.5 1.1 2.4 2.6 2.6-1.5.2-2.4 1.1-2.6 2.6-.2-1.5-1.1-2.4-2.6-2.6 1.5-.2 2.4-1.1 2.6-2.6Z" />
          </svg>
        </span>
        <span className={styles.analysisWave}>
          <span />
          <span />
          <span />
        </span>
      </div>
      <div className={styles.analysisCopy}>
        <SystemLabel>Trạng thái phân tích</SystemLabel>
        <strong className={styles.analyzingTitle}>
          {copy.title}
          <span className={styles.analyzingDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </strong>
        <p>{copy.description}</p>
        <span className={styles.analysisTrack} aria-hidden="true">
          <span />
        </span>
      </div>
    </div>
  )
}

function TypingText({ text }: { text: string }) {
  const [visibleLength, setVisibleLength] = useState(0)

  useEffect(() => {
    const reduceMotion =
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    if (reduceMotion) {
      const frame = window.requestAnimationFrame(() => {
        setVisibleLength(text.length)
      })
      return () => window.cancelAnimationFrame(frame)
    }

    let position = 0
    const timer = window.setInterval(() => {
      position = Math.min(text.length, position + 3)
      setVisibleLength(position)
      if (position === text.length) window.clearInterval(timer)
    }, 18)

    return () => window.clearInterval(timer)
  }, [text])

  const isTyping = visibleLength < text.length

  return (
    <span
      className={styles.typingText}
      data-testid="journal-ai-typing-text"
      data-state={isTyping ? 'typing' : 'complete'}
    >
      <span className={styles.srOnly}>{text}</span>
      <span className={styles.typingMeasure} aria-hidden="true">
        {text}
      </span>
      <span className={styles.typingVisible} aria-hidden="true">
        {text.slice(0, visibleLength)}
        {isTyping && <span className={styles.typingCaret} />}
      </span>
    </span>
  )
}

type Problem = Readonly<{ code?: string; title?: string }>
type ConsentState = 'loading' | 'granted' | 'missing' | 'error'

class ReflectionError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message)
    this.name = 'ReflectionError'
  }
}

const read = async (response: Response) => {
  try {
    return (await response.json()) as unknown
  } catch {
    return null
  }
}

const problemOf = (value: unknown): Problem | null =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Problem)
    : null

const analysisErrorMessage = (problem: Problem | null) =>
  ({
    AUTHENTICATION_REQUIRED:
      'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
    RESOURCE_NOT_FOUND: 'Không tìm thấy yêu cầu phân tích thuộc tài khoản này.',
    CONFLICT:
      'Chưa thể bắt đầu phân tích vì nội dung hoặc lựa chọn đồng ý đã thay đổi. Hãy kiểm tra lại rồi thử lần nữa.',
    DEPENDENCY_UNAVAILABLE:
      'Chưa thể xác minh đồng ý AI. Nội dung nhật ký chưa được gửi để phân tích.',
    JOURNAL_MUTATION_OUTCOME_UNKNOWN:
      'Chưa xác nhận được yêu cầu đã được tiếp nhận. Bạn có thể thử lại an toàn.',
    JOURNAL_MALFORMED_RESPONSE:
      'Chưa thể xác nhận kết quả phân tích nên MentalBridge không hiển thị kết quả này.',
    JOURNAL_UNAVAILABLE:
      'Dịch vụ phân tích hiện không khả dụng. Nhật ký vẫn có thể sử dụng bình thường.',
  })[problem?.code ?? ''] ??
  problem?.title ??
  'Không thể tải kết quả phân tích AI lúc này.'

const terminalMessages: Readonly<Record<AnalysisTerminalReason, string>> = {
  CONSENT_REQUIRED: 'Bạn cần đồng ý trước khi AI phân tích nhật ký này.',
  CONSENT_REVOKED:
    'Đồng ý xử lý AI đã được rút lại trước khi phân tích hoàn tất.',
  CONSENT_UNAVAILABLE:
    'Không thể xác minh lựa chọn đồng ý nên nội dung nhật ký chưa được gửi để phân tích.',
  ENTITLEMENT_UNAVAILABLE:
    'Không thể xác minh quyền sử dụng AI cho tài khoản lúc này.',
  ENTITLEMENT_CHANGED:
    'Quyền sử dụng AI đã thay đổi trước khi phân tích hoàn tất.',
  AUTHORIZATION_CONTEXT_LOST:
    'Phiên xử lý không còn thông tin xác thực cần thiết. Bạn có thể yêu cầu lại.',
  REVISION_STALE:
    'Nhật ký đã được chỉnh sửa. Kết quả cũ không được dùng cho nội dung đang hiển thị.',
  JOURNAL_DELETED: 'Nhật ký nguồn đã bị xóa nên phân tích đã dừng.',
  PROVIDER_TIMEOUT:
    'Dịch vụ AI không phản hồi trong giới hạn thời gian. Bạn có thể thử lại thủ công.',
  PROVIDER_UNAVAILABLE:
    'Dịch vụ AI tạm thời không khả dụng. Bạn có thể thử lại thủ công.',
  INVALID_PROVIDER_RESULT:
    'Kết quả AI chưa đáp ứng yêu cầu hiển thị nên đã được loại bỏ.',
  INTERNAL_ERROR:
    'Không thể hoàn tất phân tích AI. Nhật ký của bạn không bị ảnh hưởng.',
}

const terminalMessage = (reason: AnalysisTerminalReason | null) =>
  reason ? terminalMessages[reason] : 'Không thể hoàn tất phân tích AI.'

const signalGroups = (job: AnalysisJob) => {
  if (job.status !== 'SUCCEEDED' || !job.result) return []
  return [
    ['Bối cảnh được nhận diện', job.result.contextSignals],
    ['Dấu hiệu cảm xúc', job.result.emotionIndicators],
    ['Chủ đề', job.result.themes],
    ['Điều bạn có thể ưu tiên', job.result.preferenceSignals],
    ['Rào cản được nhắc tới', job.result.barrierSignals],
  ].filter((group): group is [string, string[]] => group[1].length > 0)
}

export function JournalReflection({ entry }: { entry: JournalEntry }) {
  const [job, setJob] = useState<AnalysisJob | null>(null)
  const [restoring, setRestoring] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [analysisError, setAnalysisError] = useState('')
  const [consentState, setConsentState] = useState<ConsentState>('loading')
  const [consentError, setConsentError] = useState('')
  const [disclosure, setDisclosure] = useState<AiProcessingDisclosure | null>(
    null,
  )
  const [accepted, setAccepted] = useState(false)
  const [consentWorking, setConsentWorking] = useState(false)
  const consentKey = useRef<string | undefined>(undefined)
  const storageKey = analysisStorageKey(entry.id, entry.currentRevision)

  const loadConsent = useCallback(async () => {
    setConsentState('loading')
    setConsentError('')
    try {
      const [consentsResponse, disclosureResponse] = await Promise.all([
        fetch('/api/care/consents', { cache: 'no-store' }),
        fetch('/api/care/ai-processing-disclosure', { cache: 'no-store' }),
      ])
      const [consentsValue, disclosureValue] = await Promise.all([
        read(consentsResponse),
        read(disclosureResponse),
      ])
      const consents = consentsResponse.ok
        ? parseConsentCollection(consentsValue)
        : null
      const currentDisclosure = disclosureResponse.ok
        ? parseAiProcessingDisclosure(disclosureValue)
        : null
      if (!consents || !currentDisclosure)
        throw new ReflectionError(
          analysisErrorMessage(
            problemOf(consentsResponse.ok ? disclosureValue : consentsValue),
          ),
        )
      setDisclosure(currentDisclosure)
      const currentDecision = consents.decisions.find(
        (decision) => decision.consentType === 'AI_PROCESSING',
      )
      setConsentState(
        currentDecision?.granted === true &&
          currentDecision.policyVersion === currentDisclosure.version
          ? 'granted'
          : 'missing',
      )
    } catch (error) {
      setConsentState('error')
      setConsentError(
        error instanceof Error
          ? error.message
          : 'Không thể tải trạng thái đồng ý AI.',
      )
    }
  }, [])

  const acceptJob = useCallback(
    (value: unknown) => {
      const parsed = parseAnalysisJob(value)
      if (
        !parsed ||
        !matchesDisplayedRevision(parsed, entry.id, entry.currentRevision)
      )
        throw new ReflectionError(
          'Kết quả không khớp phiên bản nhật ký đang hiển thị.',
          'JOURNAL_REVISION_MISMATCH',
        )
      setJob(parsed)
      setAnalysisError('')
      const stored = parseStoredAnalysisRequest(
        window.localStorage.getItem(storageKey),
        entry.id,
        entry.currentRevision,
      )
      if (stored)
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ ...stored, jobId: parsed.jobId }),
        )
      return parsed
    },
    [entry.currentRevision, entry.id, storageKey],
  )

  const fetchJob = useCallback(
    async (jobId: string) => {
      const response = await fetch(
        `/api/journals/analysis-jobs/${encodeURIComponent(jobId)}`,
        { cache: 'no-store' },
      )
      const value = await read(response)
      if (!response.ok)
        throw new ReflectionError(
          analysisErrorMessage(problemOf(value)),
          problemOf(value)?.code,
        )
      return acceptJob(value)
    },
    [acceptJob],
  )

  const submitAnalysis = useCallback(
    async (stored?: StoredAnalysisRequest) => {
      const requestKey = stored?.requestKey ?? `analysis-${crypto.randomUUID()}`
      const pending: StoredAnalysisRequest = {
        journalId: entry.id,
        journalRevision: entry.currentRevision,
        requestKey,
        ...(stored?.jobId ? { jobId: stored.jobId } : {}),
      }
      window.localStorage.setItem(storageKey, JSON.stringify(pending))
      setRequesting(true)
      setAnalysisError('')
      try {
        const response = await fetch(
          `/api/journals/${entry.id}/revisions/${entry.currentRevision}/analysis-jobs`,
          { method: 'POST', headers: { 'Idempotency-Key': requestKey } },
        )
        const value = await read(response)
        if (!response.ok) {
          const problem = problemOf(value)
          if (problem?.code !== 'JOURNAL_MUTATION_OUTCOME_UNKNOWN')
            window.localStorage.removeItem(storageKey)
          throw new ReflectionError(
            analysisErrorMessage(problem),
            problem?.code,
          )
        }
        return acceptJob(value)
      } catch (error) {
        setAnalysisError(
          error instanceof Error
            ? error.message
            : 'Không thể yêu cầu phản ánh AI.',
        )
        return null
      } finally {
        setRequesting(false)
      }
    },
    [acceptJob, entry.currentRevision, entry.id, storageKey],
  )

  useEffect(() => {
    let cancelled = false
    const restoreTimer = window.setTimeout(() => {
      void loadConsent()
      const stored = parseStoredAnalysisRequest(
        window.localStorage.getItem(storageKey),
        entry.id,
        entry.currentRevision,
      )
      const restore = stored?.jobId
        ? fetchJob(stored.jobId)
        : stored
          ? submitAnalysis(stored)
          : Promise.resolve(null)
      void restore
        .catch((error: unknown) => {
          if (!cancelled)
            setAnalysisError(
              error instanceof Error
                ? error.message
                : 'Không thể khôi phục phản ánh AI.',
            )
        })
        .finally(() => {
          if (!cancelled) setRestoring(false)
        })
    }, 0)
    return () => {
      cancelled = true
      window.clearTimeout(restoreTimer)
    }
  }, [
    entry.currentRevision,
    entry.id,
    fetchJob,
    loadConsent,
    storageKey,
    submitAnalysis,
  ])

  useEffect(() => {
    if (job?.status !== 'RUNNING') return
    const timer = window.setTimeout(
      () => {
        void fetchJob(job.jobId).catch((error: unknown) =>
          setAnalysisError(
            error instanceof Error
              ? error.message
              : 'Không thể cập nhật trạng thái phản ánh AI.',
          ),
        )
      },
      job.attemptCount === 0 ? 1_000 : 1_500,
    )
    return () => window.clearTimeout(timer)
  }, [fetchJob, job])

  useEffect(() => {
    if (
      job?.status !== 'FAILED' ||
      !isConsentFailure(job.terminalReason ?? null)
    )
      return
    const timer = window.setTimeout(() => void loadConsent(), 0)
    return () => window.clearTimeout(timer)
  }, [job, loadConsent])

  async function recordConsent(granted: boolean) {
    if (!disclosure) return false
    const key = consentKey.current ?? crypto.randomUUID()
    consentKey.current = key
    setConsentWorking(true)
    setConsentError('')
    try {
      const response = await fetch('/api/care/consent-decisions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({
          consentType: 'AI_PROCESSING',
          policyVersion: disclosure.version,
          granted,
        }),
      })
      const value = await read(response)
      const parsed = response.ok
        ? parseConsentCollection({ decisions: [value] })
        : null
      if (!parsed)
        throw new ReflectionError(
          analysisErrorMessage(problemOf(value)),
          problemOf(value)?.code,
        )
      consentKey.current = undefined
      setConsentState(granted ? 'granted' : 'missing')
      setAccepted(false)
      return true
    } catch (error) {
      setConsentError(
        error instanceof Error
          ? error.message
          : 'Không thể lưu lựa chọn đồng ý AI.',
      )
      return false
    } finally {
      setConsentWorking(false)
    }
  }

  async function consentAndRequest() {
    if (!accepted || !(await recordConsent(true))) return
    if (job?.status !== 'SUCCEEDED') await submitAnalysis()
  }

  async function revokeConsent() {
    await recordConsent(false)
  }

  const reason = job?.terminalReason ?? null
  const action =
    job?.status === 'SUCCEEDED' && job.result
      ? actionRoutes[job.result.suggestedAction]
      : undefined
  const showRequest =
    consentState === 'granted' &&
    !restoring &&
    !requesting &&
    (!job || (job.status === 'FAILED' && canRetryAnalysis(reason)))

  return (
    <section className={styles.reflection} aria-labelledby="journal-ai-title">
      <header className={styles.header}>
        <span className={styles.eyebrow}>Nhìn lại cùng AI</span>
        <h3 id="journal-ai-title">
          AI giúp bạn hiểu rõ hơn những điều mình đã viết
        </h3>
        <p>
          AI có thể tóm tắt nội dung, nhận diện cảm xúc, chủ đề nổi bật và gợi ý
          những điều bạn có thể muốn quan tâm tiếp theo.
        </p>
        <p>
          Chỉ nội dung nhật ký này được dùng khi bạn chủ động yêu cầu. Kết quả
          AI không phải chẩn đoán hoặc chỉ dẫn chuyên môn.
        </p>
      </header>

      {restoring && (
        <div className={styles.state} role="status">
          <SystemLabel>Trạng thái phân tích</SystemLabel>
          <p>Đang kiểm tra kết quả phân tích cho nội dung hiện tại…</p>
        </div>
      )}

      {!restoring && !requesting && !job && entry.analysisState === 'stale' && (
        <div className={styles.state}>
          <SystemLabel />
          <strong>Kết quả phân tích trước cần cập nhật</strong>
          <p>
            Nhật ký đã được chỉnh sửa nên kết quả cũ không được gắn vào nội dung
            đang hiển thị.
          </p>
        </div>
      )}

      {!restoring &&
        !requesting &&
        !job &&
        entry.analysisState === 'current' && (
          <div className={styles.state}>
            <SystemLabel />
            <strong>Đã có kết quả cho nội dung này</strong>
            <p>
              Liên kết yêu cầu không còn trên trình duyệt này. Chỉ yêu cầu lại
              khi bạn muốn tạo một lần phân tích mới cho nội dung đang xem.
            </p>
          </div>
        )}

      {requesting && <AnalysisLoadingState phase="requesting" />}

      {!requesting && job?.status === 'RUNNING' && (
        <AnalysisLoadingState
          phase={job.attemptCount === 0 ? 'queued' : 'running'}
        />
      )}

      {!requesting && job?.status === 'FAILED' && (
        <div
          className={`${styles.state} ${styles.error}`}
          role="alert"
          aria-live="assertive"
        >
          <SystemLabel>Trạng thái phân tích</SystemLabel>
          <strong>
            {isStaleFailure(reason)
              ? 'Nhật ký đã được chỉnh sửa'
              : isConsentFailure(reason)
                ? 'Cần kiểm tra lại đồng ý AI'
                : 'Phân tích chưa hoàn tất'}
          </strong>
          <p>{terminalMessage(reason)}</p>
        </div>
      )}

      {!requesting && job?.status === 'SUCCEEDED' && job.result && (
        <div className={styles.result}>
          <h4>Kết quả phân tích nhật ký này</h4>
          {job.result.summary && (
            <p className={styles.typedSummary}>
              <TypingText key={job.result.summary} text={job.result.summary} />
            </p>
          )}
          {signalGroups(job).length > 0 && (
            <div className={styles.signals}>
              {signalGroups(job).map(([label, values]) => (
                <section className={styles.signalGroup} key={label}>
                  <h4>{label}</h4>
                  <ul>
                    {values.map((value) => (
                      <li key={value}>{value}</li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
          <details className={styles.technicalDetails}>
            <summary>Thông tin kỹ thuật</summary>
            {job.result.modelConfidence !== undefined && (
              <p className={styles.confidence}>
                Độ chắc chắn do mô hình tự báo cáo:{' '}
                {new Intl.NumberFormat('vi-VN', {
                  style: 'percent',
                  maximumFractionDigits: 0,
                }).format(job.result.modelConfidence)}
                .
              </p>
            )}
            <small className={styles.provenance}>
              Lần chỉnh sửa {job.journalRevision} · Nhà cung cấp{' '}
              {job.result.provider} · Mô hình {job.result.model} · Định dạng{' '}
              {job.result.schemaVersion}
            </small>
          </details>
          {action && (
            <div className={styles.actions}>
              <Link href={action.href}>{action.label}</Link>
            </div>
          )}
        </div>
      )}

      {analysisError && (
        <div className={`${styles.state} ${styles.error}`} role="alert">
          <SystemLabel>Thông báo hệ thống</SystemLabel>
          <p>{analysisError}</p>
          {job?.jobId && (
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => void fetchJob(job.jobId)}
              >
                Tải lại trạng thái
              </button>
            </div>
          )}
        </div>
      )}

      {consentState === 'loading' && (
        <div className={styles.state} role="status">
          <SystemLabel>Trạng thái hệ thống</SystemLabel>
          <p>Đang kiểm tra đồng ý xử lý AI…</p>
        </div>
      )}

      {(consentState === 'missing' || consentState === 'error') && (
        <div className={styles.consent}>
          <strong>{disclosure?.title ?? 'Đồng ý xử lý nhật ký bằng AI'}</strong>
          {disclosure && (
            <p className={styles.consentText}>{disclosure.content}</p>
          )}
          {consentError && <p role="alert">{consentError}</p>}
          {consentState === 'error' ? (
            <div className={styles.actions}>
              <button type="button" onClick={() => void loadConsent()}>
                Thử tải lại đồng ý
              </button>
            </div>
          ) : (
            <>
              <label className={styles.consentChoice}>
                <input
                  className={styles.consentInput}
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span className={styles.consentControl} aria-hidden="true">
                  <svg viewBox="0 0 16 16">
                    <path d="m3.2 8.2 3 3.1 6.7-7" />
                  </svg>
                </span>
                <span className={styles.consentLabel}>
                  Tôi đồng ý để AI phân tích nội dung nhật ký này.
                </span>
              </label>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={!accepted || consentWorking || requesting}
                  onClick={() => void consentAndRequest()}
                >
                  {consentWorking || requesting
                    ? 'Đang gửi yêu cầu…'
                    : job?.status === 'SUCCEEDED'
                      ? 'Lưu đồng ý AI'
                      : 'Đồng ý và phân tích nhật ký này'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {consentState === 'granted' && (
        <div className={styles.actions}>
          {showRequest && (
            <button
              type="button"
              disabled={requesting}
              onClick={() => void submitAnalysis()}
            >
              {requesting
                ? 'Đang gửi yêu cầu…'
                : job?.status === 'FAILED'
                  ? 'Thử phân tích lại'
                  : 'Phân tích nhật ký này'}
            </button>
          )}
          <button
            type="button"
            className={styles.secondary}
            disabled={consentWorking}
            onClick={() => void revokeConsent()}
          >
            {consentWorking ? 'Đang lưu…' : 'Rút lại đồng ý AI'}
          </button>
        </div>
      )}
    </section>
  )
}
