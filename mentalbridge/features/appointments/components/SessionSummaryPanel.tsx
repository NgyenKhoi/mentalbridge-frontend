'use client'

import { useCallback, useRef, useState } from 'react'
import { ApiError } from '@/lib/api/api-error'
import type {
  AgreedNextStepState,
  AgreedNextStepType,
  PublishSessionSummaryInput,
  SessionSummary,
} from '@/lib/consultation/session-summary-validation'
import {
  getResourceCatalogue,
  getResourceDetail,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'
import { sessionSummaryBrowserClient } from '../api/session-summary-browser-client'
import styles from './SessionSummaryPanel.module.css'

type DraftStep = {
  type: AgreedNextStepType
  title: string
  details: string
  resourceId: string
  resourceVersion: string
}

const STEP_LABELS: Record<AgreedNextStepType, string> = {
  CHECKLIST: 'Việc cần làm',
  JOURNAL: 'Viết nhật ký',
  EMOTION_CHECK_IN: 'Ghi nhận cảm xúc',
  REASSESSMENT: 'Làm lại bài đánh giá',
  FOLLOW_UP_APPOINTMENT: 'Đặt lịch tiếp theo',
  PLATFORM_RESOURCE: 'Tài nguyên trên MentalBridge',
}

const STATE_LABELS: Record<AgreedNextStepState, string> = {
  PENDING: 'Chưa thực hiện',
  COMPLETED: 'Đã hoàn thành',
  SKIPPED: 'Bỏ qua',
}

const emptyStep = (): DraftStep => ({
  type: 'CHECKLIST',
  title: '',
  details: '',
  resourceId: '',
  resourceVersion: '',
})

function errorText(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 412)
      return 'Dữ liệu vừa được cập nhật ở nơi khác. Hãy tải lại rồi thử lại.'
    if (error.status === 403)
      return 'Bạn không có quyền thực hiện thao tác này.'
    if (error.status === 409)
      return (
        error.message ||
        'Bản tóm tắt chưa thể được cập nhật ở trạng thái hiện tại.'
      )
  }
  return 'Chưa thể tải hoặc cập nhật bản tóm tắt. Vui lòng thử lại.'
}

function replaceSummary(items: SessionSummary[], updated: SessionSummary) {
  return items.map((item) => (item.id === updated.id ? updated : item))
}

function SummaryContent({ summary }: { summary: SessionSummary }) {
  return (
    <div className={styles.summaryContent}>
      <div className={styles.meta}>
        <span>Phiên bản {summary.version}</span>
        <time>
          {new Intl.DateTimeFormat('vi-VN', {
            dateStyle: 'medium',
            timeStyle: 'short',
          }).format(new Date(summary.publishedAt))}
        </time>
      </div>
      <div>
        <h4>Nội dung đã trao đổi</h4>
        <div className={styles.tags}>
          {summary.topicsDiscussed.map((topic) => (
            <span key={topic}>{topic}</span>
          ))}
        </div>
      </div>
      {summary.progressSummary && (
        <div>
          <h4>Điều đã ghi nhận trong phiên</h4>
          <p>{summary.progressSummary}</p>
        </div>
      )}
      {summary.specialistNoteForUser && (
        <div>
          <h4>Lời nhắn từ chuyên gia</h4>
          <p>{summary.specialistNoteForUser}</p>
        </div>
      )}
      {summary.followUpSuggested && (
        <p className={styles.followUp}>
          Chuyên gia đề xuất một buổi trao đổi tiếp theo.
        </p>
      )}
    </div>
  )
}

function SpecialistForm({
  appointmentId,
  current,
  resources,
  onPublished,
}: {
  appointmentId: string
  current: SessionSummary | null
  resources: PublicResourceSummary[]
  onPublished: (summary: SessionSummary) => void
}) {
  const [topics, setTopics] = useState(
    current?.topicsDiscussed.join('\n') ?? '',
  )
  const [progress, setProgress] = useState(current?.progressSummary ?? '')
  const [note, setNote] = useState(current?.specialistNoteForUser ?? '')
  const [followUp, setFollowUp] = useState(current?.followUpSuggested ?? false)
  const [steps, setSteps] = useState<DraftStep[]>([emptyStep()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const idempotencyKey = useRef(crypto.randomUUID())

  const updateStep = (index: number, patch: Partial<DraftStep>) =>
    setSteps((items) =>
      items.map((item, position) =>
        position === index ? { ...item, ...patch } : item,
      ),
    )

  const chooseResource = async (index: number, resourceId: string) => {
    const resource = resources.find((item) => item.id === resourceId)
    updateStep(index, {
      resourceId,
      title: resource?.title ?? '',
      resourceVersion: '',
    })
    if (!resourceId) return
    try {
      const detail = await getResourceDetail(resourceId)
      updateStep(index, {
        resourceId,
        title: detail.title,
        resourceVersion: detail.contentVersion,
      })
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  const publish = async () => {
    setError('')
    const topicList = topics
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
    if (topicList.length === 0) {
      setError('Hãy thêm ít nhất một nội dung đã trao đổi.')
      return
    }
    const usedSteps = steps.filter((step) => step.title.trim())
    if (
      usedSteps.some(
        (step) => step.type === 'PLATFORM_RESOURCE' && !step.resourceVersion,
      )
    ) {
      setError('Hãy chọn một tài nguyên hợp lệ trước khi xuất bản.')
      return
    }
    const input: PublishSessionSummaryInput = {
      topicsDiscussed: topicList,
      progressSummary: progress.trim() || null,
      specialistNoteForUser: note.trim() || null,
      followUpSuggested: followUp,
      agreedNextSteps: usedSteps.map((step) => ({
        type: step.type,
        title: step.title.trim(),
        details: step.details.trim() || null,
        resourceId: step.type === 'PLATFORM_RESOURCE' ? step.resourceId : null,
        resourceVersion:
          step.type === 'PLATFORM_RESOURCE' ? step.resourceVersion : null,
      })),
    }
    setSaving(true)
    try {
      const saved = await sessionSummaryBrowserClient.publish(
        appointmentId,
        input,
        idempotencyKey.current,
        current?.version,
      )
      idempotencyKey.current = crypto.randomUUID()
      onPublished(saved)
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.form}>
      <p className={styles.formIntro}>
        {current
          ? 'Đính chính tạo một phiên bản mới; bản cũ vẫn được giữ lại.'
          : 'Chỉ ghi lại nội dung đã trao đổi và các bước hai bên đã thống nhất.'}
      </p>
      <label>
        Nội dung đã trao đổi <small>Mỗi dòng là một mục, tối đa 8 mục</small>
        <textarea
          value={topics}
          onChange={(event) => setTopics(event.target.value)}
          rows={3}
        />
      </label>
      <label>
        Điều đã ghi nhận trong phiên
        <textarea
          value={progress}
          onChange={(event) => setProgress(event.target.value)}
          maxLength={1000}
          rows={3}
        />
      </label>
      <label>
        Lời nhắn cho người dùng
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          maxLength={1000}
          rows={3}
        />
      </label>
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={followUp}
          onChange={(event) => setFollowUp(event.target.checked)}
        />{' '}
        Đề xuất một buổi trao đổi tiếp theo
      </label>
      <div className={styles.stepsEditor}>
        <div className={styles.sectionHeading}>
          <h4>Các bước đã thống nhất</h4>
          {steps.length < 8 && (
            <button
              type="button"
              onClick={() => setSteps((items) => [...items, emptyStep()])}
            >
              Thêm bước
            </button>
          )}
        </div>
        {steps.map((step, index) => (
          <div className={styles.stepEditor} key={index}>
            <select
              aria-label={`Loại bước ${index + 1}`}
              value={step.type}
              onChange={(event) =>
                updateStep(index, {
                  type: event.target.value as AgreedNextStepType,
                  resourceId: '',
                  resourceVersion: '',
                  title: '',
                })
              }
            >
              {Object.entries(STEP_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {step.type === 'PLATFORM_RESOURCE' ? (
              <select
                aria-label={`Tài nguyên ${index + 1}`}
                value={step.resourceId}
                onChange={(event) =>
                  void chooseResource(index, event.target.value)
                }
              >
                <option value="">Chọn tài nguyên</option>
                {resources.map((resource) => (
                  <option key={resource.id} value={resource.id}>
                    {resource.title}
                  </option>
                ))}
              </select>
            ) : (
              <input
                aria-label={`Tên bước ${index + 1}`}
                placeholder="Tên bước"
                value={step.title}
                onChange={(event) =>
                  updateStep(index, { title: event.target.value })
                }
              />
            )}
            <input
              aria-label={`Chi tiết bước ${index + 1}`}
              placeholder="Chi tiết (không bắt buộc)"
              value={step.details}
              maxLength={500}
              onChange={(event) =>
                updateStep(index, { details: event.target.value })
              }
            />
            {steps.length > 1 && (
              <button
                type="button"
                className={styles.remove}
                onClick={() =>
                  setSteps((items) =>
                    items.filter((_, position) => position !== index),
                  )
                }
              >
                Xóa
              </button>
            )}
          </div>
        ))}
      </div>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <button
        className={styles.primary}
        type="button"
        disabled={saving}
        onClick={() => void publish()}
      >
        {saving
          ? 'Đang xuất bản…'
          : current
            ? 'Xuất bản bản đính chính'
            : 'Xuất bản cho người dùng'}
      </button>
    </div>
  )
}

export function SessionSummaryPanel({
  appointmentId,
  viewer,
}: {
  appointmentId: string
  viewer: 'USER' | 'SPECIALIST'
}) {
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [summaries, setSummaries] = useState<SessionSummary[]>([])
  const [resources, setResources] = useState<PublicResourceSummary[]>([])
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await sessionSummaryBrowserClient.list(appointmentId, viewer)
      setSummaries(data.items)
      setLoaded(true)
      if (viewer === 'SPECIALIST') {
        try {
          const catalogue = await getResourceCatalogue()
          setResources(catalogue.items)
        } catch {
          setResources([])
        }
      }
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setLoading(false)
    }
  }, [appointmentId, viewer])

  const latest = summaries[0] ?? null
  const updateConsent = async (summary: SessionSummary, approved: boolean) => {
    setPending(`consent:${summary.id}`)
    try {
      const updated = await sessionSummaryBrowserClient.updateConsent(
        summary.id,
        approved,
        summary.reuseConsent?.version ?? 0,
      )
      setSummaries((items) => replaceSummary(items, updated))
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setPending(null)
    }
  }
  const updateUserStep = async (
    stepId: string,
    state: AgreedNextStepState,
    hidden: boolean,
    version: number,
  ) => {
    setPending(stepId)
    try {
      const updated = await sessionSummaryBrowserClient.updateStep(
        stepId,
        { state, hidden },
        version,
      )
      setSummaries((items) => replaceSummary(items, updated))
    } catch (caught) {
      setError(errorText(caught))
    } finally {
      setPending(null)
    }
  }

  return (
    <details
      className={styles.panel}
      onToggle={(event) => {
        if (event.currentTarget.open && !loaded && !loading) void load()
      }}
    >
      <summary>
        <span>
          <strong>Tóm tắt sau phiên</strong>
          <small>
            {viewer === 'SPECIALIST'
              ? 'Xuất bản nội dung đã thống nhất'
              : 'Xem lại và quản lý các bước của bạn'}
          </small>
        </span>
        <span aria-hidden="true">⌄</span>
      </summary>
      <div className={styles.body}>
        {loading && <p className={styles.state}>Đang tải bản tóm tắt…</p>}
        {error && (
          <div className={styles.error} role="alert">
            {error}{' '}
            <button type="button" onClick={() => void load()}>
              Thử lại
            </button>
          </div>
        )}
        {!loading && loaded && !latest && viewer === 'USER' && (
          <p className={styles.state}>
            Chuyên gia chưa xuất bản bản tóm tắt cho phiên này.
          </p>
        )}
        {latest && <SummaryContent summary={latest} />}
        {latest && latest.agreedNextSteps.length > 0 && (
          <div className={styles.nextSteps}>
            <h4>Các bước đã thống nhất</h4>
            {latest.agreedNextSteps.map((step) => (
              <div
                className={styles.nextStep}
                data-hidden={step.hidden}
                key={step.id}
              >
                <div>
                  <span>{STEP_LABELS[step.type]}</span>
                  <strong>{step.title}</strong>
                  {step.details && <p>{step.details}</p>}
                  {step.hidden && <small>Đã ẩn khỏi danh sách của bạn</small>}
                </div>
                {viewer === 'USER' && (
                  <div className={styles.stepActions}>
                    <select
                      aria-label={`Trạng thái ${step.title}`}
                      value={step.state ?? 'PENDING'}
                      disabled={pending === step.id}
                      onChange={(event) =>
                        void updateUserStep(
                          step.id,
                          event.target.value as AgreedNextStepState,
                          step.hidden,
                          step.stateVersion ?? 0,
                        )
                      }
                    >
                      {Object.entries(STATE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={pending === step.id}
                      onClick={() =>
                        void updateUserStep(
                          step.id,
                          step.state ?? 'PENDING',
                          !step.hidden,
                          step.stateVersion ?? 0,
                        )
                      }
                    >
                      {step.hidden ? 'Hiện lại' : 'Ẩn'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        {viewer === 'USER' && latest && (
          <div className={styles.consent}>
            <div>
              <strong>Cho phép dùng lại ở lần tư vấn sau</strong>
              <p>
                Khi bật, chuyên gia được giao cho lịch hẹn tương lai có thể xem
                bản tóm tắt này. Bạn có thể tắt bất cứ lúc nào.
              </p>
            </div>
            <label>
              <input
                type="checkbox"
                checked={latest.reuseConsent?.approved ?? false}
                disabled={pending === `consent:${latest.id}`}
                onChange={(event) =>
                  void updateConsent(latest, event.target.checked)
                }
              />
              <span>
                {latest.reuseConsent?.approved
                  ? 'Đang cho phép'
                  : 'Không chia sẻ'}
              </span>
            </label>
          </div>
        )}
        {viewer === 'SPECIALIST' && loaded && !editing && (
          <button
            className={styles.primary}
            type="button"
            onClick={() => setEditing(true)}
          >
            {latest ? 'Đính chính bản tóm tắt' : 'Tạo bản tóm tắt'}
          </button>
        )}
        {viewer === 'SPECIALIST' && editing && (
          <SpecialistForm
            appointmentId={appointmentId}
            current={latest}
            resources={resources}
            onPublished={(saved) => {
              setSummaries((items) => [saved, ...items])
              setEditing(false)
            }}
          />
        )}
        {summaries.length > 1 && (
          <details className={styles.history}>
            <summary>Xem {summaries.length - 1} phiên bản trước</summary>
            {summaries.slice(1).map((summary) => (
              <div className={styles.historyItem} key={summary.id}>
                <SummaryContent summary={summary} />
                {viewer === 'USER' && summary.agreedNextSteps.length > 0 && (
                  <div className={styles.nextSteps}>
                    <h4>Các bước của phiên bản này</h4>
                    {summary.agreedNextSteps.map((step) => (
                      <div
                        className={styles.nextStep}
                        data-hidden={step.hidden}
                        key={step.id}
                      >
                        <div>
                          <span>{STEP_LABELS[step.type]}</span>
                          <strong>{step.title}</strong>
                          {step.details && <p>{step.details}</p>}
                          {step.hidden && (
                            <small>Đã ẩn khỏi danh sách của bạn</small>
                          )}
                        </div>
                        <div className={styles.stepActions}>
                          <select
                            aria-label={`Trạng thái ${step.title} (phiên bản ${summary.version})`}
                            value={step.state ?? 'PENDING'}
                            disabled={pending === step.id}
                            onChange={(event) =>
                              void updateUserStep(
                                step.id,
                                event.target.value as AgreedNextStepState,
                                step.hidden,
                                step.stateVersion ?? 0,
                              )
                            }
                          >
                            {Object.entries(STATE_LABELS).map(
                              ([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ),
                            )}
                          </select>
                          <button
                            type="button"
                            disabled={pending === step.id}
                            onClick={() =>
                              void updateUserStep(
                                step.id,
                                step.state ?? 'PENDING',
                                !step.hidden,
                                step.stateVersion ?? 0,
                              )
                            }
                          >
                            {step.hidden ? 'Hiện lại' : 'Ẩn'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {viewer === 'USER' && (
                  <div className={styles.consent}>
                    <div>
                      <strong>
                        Cho phép dùng lại phiên bản {summary.version}
                      </strong>
                      <p>
                        Quyền này áp dụng riêng cho đúng phiên bản và có thể thu
                        hồi bất cứ lúc nào.
                      </p>
                    </div>
                    <label>
                      <input
                        type="checkbox"
                        checked={summary.reuseConsent?.approved ?? false}
                        disabled={pending === `consent:${summary.id}`}
                        onChange={(event) =>
                          void updateConsent(summary, event.target.checked)
                        }
                      />
                      <span>
                        {summary.reuseConsent?.approved
                          ? 'Đang cho phép'
                          : 'Không chia sẻ'}
                      </span>
                    </label>
                  </div>
                )}
              </div>
            ))}
          </details>
        )}
      </div>
    </details>
  )
}
