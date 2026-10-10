'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FileCheck2, FilePenLine, Plus, Trash2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/Skeleton'
import { ApiError } from '@/lib/api/api-error'
import type {
  AgreedNextStepState,
  AgreedNextStepType,
  PublishSessionSummaryInput,
  ResourceProposalReasonCode,
  SessionSummary,
} from '@/lib/consultation/session-summary-validation'
import {
  getResourceCatalogue,
  getResourceDetail,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'
import { sessionSummaryBrowserClient } from '../api/session-summary-browser-client'
import { PlanChangeRequestCard } from './PlanChangeRequestCard'
import styles from './SessionSummaryPanel.module.css'

type DraftStep = {
  id: string
  type: AgreedNextStepType
  title: string
  details: string
  resourceId: string
  resourceVersion: string
  resourceProposalReasonCode: ResourceProposalReasonCode | ''
}

const REASON_LABELS: Record<ResourceProposalReasonCode, string> = {
  POST_CONSULTATION_CONTINUITY: 'Tiếp nối nội dung sau buổi tư vấn',
  TRY_ALTERNATIVE_RESOURCE: 'Thử một tài nguyên phù hợp khác',
  ADDRESS_REPORTED_BARRIER: 'Hỗ trợ trở ngại đã trao đổi',
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
  id: crypto.randomUUID(),
  type: 'CHECKLIST',
  title: '',
  details: '',
  resourceId: '',
  resourceVersion: '',
  resourceProposalReasonCode: '',
})

const draftStep = (
  step: SessionSummary['agreedNextSteps'][number],
): DraftStep => ({
  id: crypto.randomUUID(),
  type: step.type,
  title: step.title,
  details: step.details ?? '',
  resourceId: step.resourceId ?? '',
  resourceVersion: step.resourceVersion ?? '',
  resourceProposalReasonCode: step.resourceProposalReasonCode ?? '',
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
  onCancel,
}: {
  appointmentId: string
  current: SessionSummary | null
  resources: PublicResourceSummary[]
  onPublished: (summary: SessionSummary) => void
  onCancel: () => void
}) {
  const [topics, setTopics] = useState(
    current?.topicsDiscussed.join('\n') ?? '',
  )
  const [progress, setProgress] = useState(current?.progressSummary ?? '')
  const [note, setNote] = useState(current?.specialistNoteForUser ?? '')
  const [followUp, setFollowUp] = useState(current?.followUpSuggested ?? false)
  const [steps, setSteps] = useState<DraftStep[]>(
    current?.agreedNextSteps.length
      ? current.agreedNextSteps.map(draftStep)
      : [emptyStep()],
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const idempotencyKey = useRef(crypto.randomUUID())
  const firstInput = useRef<HTMLTextAreaElement>(null)
  const submitBusy = useRef(false)

  useEffect(() => {
    firstInput.current?.focus({ preventScroll: true })
  }, [])

  const updateStep = (id: string, patch: Partial<DraftStep>) =>
    setSteps((items) =>
      items.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    )

  const chooseResource = async (id: string, resourceId: string) => {
    const resource = resources.find((item) => item.id === resourceId)
    updateStep(id, {
      resourceId,
      title: resource?.title ?? '',
      resourceVersion: '',
      resourceProposalReasonCode: 'POST_CONSULTATION_CONTINUITY',
    })
    if (!resourceId) return
    try {
      const detail = await getResourceDetail(resourceId)
      setSteps((items) =>
        items.map((item) =>
          item.id === id &&
          item.type === 'PLATFORM_RESOURCE' &&
          item.resourceId === resourceId
            ? {
                ...item,
                title: detail.title,
                resourceVersion: detail.contentVersion,
              }
            : item,
        ),
      )
    } catch (caught) {
      setError(errorText(caught))
    }
  }

  const publish = async () => {
    if (submitBusy.current) return
    setError('')
    const topicList = topics
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
    if (
      topicList.length === 0 ||
      topicList.length > 8 ||
      topicList.some((topic) => topic.length > 160)
    ) {
      setError(
        'Hãy ghi từ 1 đến 8 nội dung đã trao đổi, mỗi mục tối đa 160 ký tự.',
      )
      firstInput.current?.focus()
      return
    }
    const usedSteps = steps.filter((step) => step.title.trim())
    if (
      usedSteps.some(
        (step) =>
          step.type === 'PLATFORM_RESOURCE' &&
          (!step.resourceVersion || !step.resourceProposalReasonCode),
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
        resourceProposalReasonCode:
          step.type === 'PLATFORM_RESOURCE'
            ? step.resourceProposalReasonCode || null
            : null,
      })),
    }
    submitBusy.current = true
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
      submitBusy.current = false
      setSaving(false)
    }
  }

  return (
    <form
      className={styles.form}
      onSubmit={(event) => {
        event.preventDefault()
        void publish()
      }}
      aria-label={current ? 'Đính chính bản tóm tắt' : 'Tạo bản tóm tắt'}
    >
      <header className={styles.formHeading}>
        <FilePenLine size={22} aria-hidden="true" />
        <h4>
          {current
            ? 'Đính chính bản tổng hợp sau tư vấn'
            : 'Biên soạn bản tổng hợp sau tư vấn'}
        </h4>
      </header>
      <p className={styles.formIntro}>
        {current
          ? 'Đính chính tạo một phiên bản mới; bản cũ vẫn được giữ lại.'
          : 'Chỉ ghi lại nội dung đã trao đổi và các bước hai bên đã thống nhất.'}
      </p>
      <fieldset disabled={saving} className={styles.fields}>
        <label>
          Nội dung đã trao đổi <small>Mỗi dòng là một mục, tối đa 8 mục</small>
          <textarea
            ref={firstInput}
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
            <span className={styles.stepCount}>{steps.length} / 8</span>
            <button
              type="button"
              disabled={steps.length >= 8}
              onClick={() => setSteps((items) => [...items, emptyStep()])}
            >
              <Plus size={16} aria-hidden="true" /> Thêm bước
            </button>
          </div>
          {steps.map((step, index) => (
            <div className={styles.stepEditor} key={step.id}>
              <select
                aria-label={`Loại bước ${index + 1}`}
                value={step.type}
                onChange={(event) =>
                  updateStep(step.id, {
                    type: event.target.value as AgreedNextStepType,
                    resourceId: '',
                    resourceVersion: '',
                    resourceProposalReasonCode:
                      event.target.value === 'PLATFORM_RESOURCE'
                        ? 'POST_CONSULTATION_CONTINUITY'
                        : '',
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
                <div className={styles.resourceFields}>
                  <select
                    aria-label={`Tài nguyên ${index + 1}`}
                    value={step.resourceId}
                    onChange={(event) =>
                      void chooseResource(step.id, event.target.value)
                    }
                  >
                    <option value="">Chọn tài nguyên</option>
                    {resources.map((resource) => (
                      <option key={resource.id} value={resource.id}>
                        {resource.title}
                      </option>
                    ))}
                  </select>
                  <select
                    aria-label={`Lý do đề xuất ${index + 1}`}
                    value={step.resourceProposalReasonCode}
                    onChange={(event) =>
                      updateStep(step.id, {
                        resourceProposalReasonCode: event.target
                          .value as ResourceProposalReasonCode,
                      })
                    }
                  >
                    {Object.entries(REASON_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input
                  aria-label={`Tên bước ${index + 1}`}
                  placeholder="Tên bước"
                  value={step.title}
                  maxLength={160}
                  onChange={(event) =>
                    updateStep(step.id, { title: event.target.value })
                  }
                />
              )}
              <input
                aria-label={`Chi tiết bước ${index + 1}`}
                placeholder="Chi tiết (không bắt buộc)"
                value={step.details}
                maxLength={500}
                onChange={(event) =>
                  updateStep(step.id, { details: event.target.value })
                }
              />
              {steps.length > 1 && (
                <button
                  type="button"
                  className={styles.remove}
                  aria-label={`Xóa bước ${index + 1}`}
                  onClick={() =>
                    setSteps((items) =>
                      items.filter((item) => item.id !== step.id),
                    )
                  }
                >
                  <Trash2 size={18} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.cancel}
          onClick={onCancel}
          disabled={saving}
        >
          Hủy bỏ
        </button>
        <button className={styles.primary} type="submit" disabled={saving}>
          {saving
            ? 'Đang xuất bản…'
            : current
              ? 'Xuất bản bản đính chính'
              : 'Xuất bản cho người dùng'}
        </button>
      </div>
    </form>
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
  const editButton = useRef<HTMLButtonElement>(null)

  const finishEditing = () => {
    setEditing(false)
    requestAnimationFrame(() =>
      editButton.current?.focus({ preventScroll: true }),
    )
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await sessionSummaryBrowserClient.list(appointmentId, viewer)
      setSummaries(data.items)
      setLoaded(true)
      if (viewer === 'SPECIALIST') {
        try {
          const catalogue = await getResourceCatalogue(undefined, 'vi-VN')
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
      data-viewer={viewer}
      data-specialist-journey={viewer === 'SPECIALIST' ? 'summary' : undefined}
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
        {loading && (
          <div
            className={styles.loading}
            role="status"
            aria-label="Đang tải bản tóm tắt"
          >
            <Skeleton width="65%" height={24} />
            <Skeleton width="90%" height={48} />
          </div>
        )}
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
        {latest && !editing && (
          <>
            <header className={styles.publishedHeading}>
              <FileCheck2 size={22} aria-hidden="true" />
              <strong>Bản tổng hợp đã xuất bản</strong>
            </header>
            <SummaryContent summary={latest} />
          </>
        )}
        {latest && !editing && latest.agreedNextSteps.length > 0 && (
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
                  {step.type === 'PLATFORM_RESOURCE' && (
                    <PlanChangeRequestCard
                      proposalId={step.id}
                      viewer={viewer}
                    />
                  )}
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
                Khi bật, bạn có thể chọn bản tóm tắt này khi chuẩn bị hồ sơ chia
                sẻ cho một lịch hẹn sau. Chuyên gia chỉ xem được khi bạn phê
                duyệt hồ sơ đó và trong thời gian truy cập của cuộc hẹn. Bạn có
                thể tắt bất cứ lúc nào.
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
          <div className={styles.editPrompt}>
            {!latest && (
              <div>
                <h4>Chưa có bản tổng hợp sau tư vấn</h4>
                <p>
                  Ghi lại nội dung đã trao đổi và các bước hai bên đã thống
                  nhất.
                </p>
              </div>
            )}
            <button
              ref={editButton}
              className={styles.primary}
              type="button"
              onClick={() => setEditing(true)}
            >
              {latest ? 'Đính chính bản tóm tắt' : 'Tạo bản tóm tắt'}
            </button>
          </div>
        )}
        {viewer === 'SPECIALIST' && editing && (
          <SpecialistForm
            appointmentId={appointmentId}
            current={latest}
            resources={resources}
            onCancel={finishEditing}
            onPublished={(saved) => {
              setSummaries((items) => [saved, ...items])
              finishEditing()
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
