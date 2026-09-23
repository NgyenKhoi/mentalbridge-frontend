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
          <p>Đang kiểm tra kết quả phân tích cho nội dung hiện tại…</p>
        </div>
      )}

      {!restoring && !job && entry.analysisState === 'stale' && (
        <div className={styles.state}>
          <strong>Kết quả phân tích trước cần cập nhật</strong>
          <p>
            Nhật ký đã được chỉnh sửa nên kết quả cũ không được gắn vào nội dung
            đang hiển thị.
          </p>
        </div>
      )}

      {!restoring && !job && entry.analysisState === 'current' && (
        <div className={styles.state}>
          <strong>Đã có kết quả cho nội dung này</strong>
          <p>
            Liên kết yêu cầu không còn trên trình duyệt này. Chỉ yêu cầu lại khi
            bạn muốn tạo một lần phân tích mới cho nội dung đang xem.
          </p>
        </div>
      )}

      {job?.status === 'RUNNING' && (
        <div className={styles.state} role="status" aria-live="polite">
          <strong>
            {job.attemptCount === 0
              ? 'Yêu cầu đang chờ xử lý'
              : 'Đang phân tích nhật ký này'}
          </strong>
          <p>
            Bạn có thể đóng cửa sổ và quay lại sau. Nhật ký vẫn dùng được trong
            khi xử lý.
          </p>
        </div>
      )}

      {job?.status === 'FAILED' && (
        <div
          className={`${styles.state} ${styles.error}`}
          role="alert"
          aria-live="assertive"
        >
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

      {job?.status === 'SUCCEEDED' && job.result && (
        <div className={styles.result}>
          <h4>Kết quả phân tích nhật ký này</h4>
          {job.result.summary && <p>{job.result.summary}</p>}
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
          <details>
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
                  type="checkbox"
                  checked={accepted}
                  onChange={(event) => setAccepted(event.target.checked)}
                />
                <span>Tôi đồng ý để AI phân tích nội dung nhật ký này.</span>
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
