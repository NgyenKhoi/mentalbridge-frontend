'use client'

import { useMemo, useState } from 'react'

import { Dialog } from '@/components/ui/Dialog'
import { Disclosure } from '@/components/ui/Disclosure'
import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
} from '../api/support-plan-contract'
import SupportPlanSchedule from './SupportPlanSchedule'

const domainLabel = {
  DEPRESSIVE_SYMPTOMS: 'Hỗ trợ dấu hiệu trầm cảm',
  ANXIETY_SYMPTOMS: 'Hỗ trợ dấu hiệu lo âu',
} as const

const resourceCategoryLabel: Record<string, string> = {
  ARTICLE: 'Bài viết',
  AUDIO: 'Âm thanh',
  VIDEO: 'Video',
  EXERCISE: 'Bài thực hành',
}

const slotLabel: Record<string, string> = {
  CORE: 'Nội dung cốt lõi',
  OPTIONAL: 'Nội dung bổ trợ',
}

const packageLabel = {
  PLUS: 'Plus',
  PREMIUM: 'Premium',
} as const

function resourceKey(
  resource: SupportPlan['slots'][number]['selectedResource'],
) {
  return resource ? `${resource.resourceId}:${resource.contentVersion}` : ''
}

function initialChoices(plan: SupportPlan) {
  return Object.fromEntries(
    plan.slots.map((slot) => [slot.slotId, resourceKey(slot.selectedResource)]),
  )
}

type Props = Readonly<{
  plan: SupportPlan
  busy: 'SAVING' | 'ACTIVATING' | 'LIFECYCLE' | null
  message: string
  onSaveChoices: (request: ReplaceSupportPlanChoicesRequest) => Promise<void>
  onActivate: () => Promise<void>
  onStatusChange: (
    status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED',
    completionReason?: 'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER',
  ) => Promise<void>
}>

type LifecycleStatus = 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'DISCARDED'

const lifecycleConfirmation = {
  PAUSED: {
    title: 'Tạm dừng kế hoạch?',
    message:
      'Các hoạt động tương lai sẽ được hủy trong lúc tạm dừng. Bạn có thể tiếp tục lại sau.',
    action: 'Xác nhận tạm dừng',
  },
  ACTIVE: {
    title: 'Tiếp tục kế hoạch?',
    message:
      'Chỉ các hoạt động vẫn còn ở tương lai mới được khôi phục và lên lịch lại.',
    action: 'Xác nhận tiếp tục',
  },
  COMPLETED: {
    title: 'Kết thúc kế hoạch?',
    message:
      'Kế hoạch sẽ chuyển vào lịch sử và không thể tiếp tục lại. Thao tác này không có nghĩa là bạn đã hồi phục.',
    action: 'Xác nhận kết thúc',
  },
  DISCARDED: {
    title: 'Hủy kế hoạch?',
    message:
      'Kế hoạch sẽ chuyển vào lịch sử và không thể bắt đầu sau đó. Kế hoạch đang thực hiện, nếu có, không bị thay đổi.',
    action: 'Xác nhận hủy kế hoạch',
  },
} as const

export default function SupportPlanCard({
  plan,
  busy,
  message,
  onSaveChoices,
  onActivate,
  onStatusChange,
}: Props) {
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    initialChoices(plan),
  )
  const [pendingStatus, setPendingStatus] = useState<LifecycleStatus | null>(
    null,
  )
  const [completionReason, setCompletionReason] = useState('')
  const isDraft = plan.status === 'DRAFT'
  const safetyPositive = plan.safety.status === 'POSITIVE_SAFETY_SCREEN'
  const statusLabel = {
    DRAFT: 'Chưa bắt đầu',
    ACTIVE: 'Đang hoạt động',
    PAUSED: 'Đang tạm dừng',
    COMPLETED: 'Đã kết thúc',
    SUPERSEDED: 'Đã được thay thế',
    DISCARDED: 'Đã hủy trước khi bắt đầu',
  }[plan.status]
  const titleLabel = {
    DRAFT: 'Kế hoạch hỗ trợ đề xuất cho bạn',
    ACTIVE: 'Kế hoạch đang thực hiện',
    PAUSED: 'Kế hoạch đang tạm dừng',
    COMPLETED: 'Kế hoạch đã kết thúc',
    SUPERSEDED: 'Kế hoạch đã được thay thế',
    DISCARDED: 'Kế hoạch đã hủy trước khi bắt đầu',
  }[plan.status]

  const dirty = useMemo(
    () =>
      plan.slots.some(
        (slot) => choices[slot.slotId] !== resourceKey(slot.selectedResource),
      ),
    [choices, plan],
  )

  const submitChoices = async () => {
    const slotSelections = plan.slots.flatMap((slot) => {
      const selectedKey = choices[slot.slotId]
      if (!selectedKey) return []
      const resources = [
        ...(slot.selectedResource ? [slot.selectedResource] : []),
        ...slot.allowedAlternatives,
      ]
      const selected = resources.find(
        (resource) => resourceKey(resource) === selectedKey,
      )
      return selected
        ? [
            {
              slotId: slot.slotId,
              resourceId: selected.resourceId,
              contentVersion: selected.contentVersion,
            },
          ]
        : []
    })
    await onSaveChoices({ slotSelections })
  }

  const requestLifecycle = (status: LifecycleStatus) => {
    setCompletionReason('')
    setPendingStatus(status)
  }

  const closeLifecycle = () => {
    setPendingStatus(null)
  }

  const confirmLifecycle = async () => {
    if (!pendingStatus) return
    await onStatusChange(
      pendingStatus,
      pendingStatus === 'COMPLETED' && completionReason
        ? (completionReason as
            'USER_DECISION' | 'PLAN_NO_LONGER_FITS' | 'OTHER')
        : undefined,
    )
    closeLifecycle()
  }

  return (
    <article
      className="support-plan-card"
      aria-labelledby={`support-plan-${plan.supportPlanId}`}
    >
      <header className="support-plan-card-header">
        <div>
          <span>{isDraft ? 'Kế hoạch chưa bắt đầu' : 'Kế hoạch hiện tại'}</span>
          <h2 id={`support-plan-${plan.supportPlanId}`}>{titleLabel}</h2>
        </div>
        <span
          className={`support-plan-status ${plan.status === 'ACTIVE' ? 'active' : ''}`}
        >
          {statusLabel}
        </span>
      </header>

      <section
        className={`support-plan-safety ${safetyPositive ? 'attention' : ''}`}
        aria-label="Hướng dẫn an toàn"
      >
        <strong>
          {safetyPositive ? 'Ưu tiên hướng dẫn an toàn' : 'Nhắc nhở an toàn'}
        </strong>
        <p>{plan.safety.guidance}</p>
        <small>
          Thông tin an toàn không phụ thuộc vào AI hoặc gói dịch vụ.
        </small>
      </section>

      <section className="support-plan-rationale">
        <span>Vì sao có đề xuất này?</span>
        <p>{plan.rationale.text}</p>
      </section>

      <section
        className="support-plan-slots"
        aria-label="Nội dung kế hoạch hỗ trợ"
      >
        <div className="support-plan-section-heading">
          <div>
            <span>
              {isDraft ? 'Chọn nội dung phù hợp' : 'Kế hoạch đã xác nhận'}
            </span>
            <h3>{plan.selectedResourceCount} nội dung đã được kiểm tra</h3>
          </div>
          <span>{packageLabel[plan.entitlement.packageCode]}</span>
        </div>
        <ol>
          {plan.slots.map((slot, index) => {
            const resources = [
              ...(slot.selectedResource ? [slot.selectedResource] : []),
              ...slot.allowedAlternatives,
            ].filter(
              (resource, resourceIndex, all) =>
                all.findIndex(
                  (candidate) =>
                    resourceKey(candidate) === resourceKey(resource),
                ) === resourceIndex,
            )
            return (
              <li key={slot.slotId}>
                <div className="support-plan-slot-number" aria-hidden="true">
                  {index + 1}
                </div>
                <div className="support-plan-slot-content">
                  <div className="support-plan-slot-meta">
                    <span>{slotLabel[slot.kind]}</span>
                    <span>{domainLabel[slot.targetDomain]}</span>
                  </div>
                  {isDraft ? (
                    <fieldset disabled={busy !== null}>
                      <legend>
                        {slot.kind === 'CORE'
                          ? 'Chọn một nội dung cốt lõi'
                          : 'Chọn hoặc bỏ nội dung bổ trợ'}
                      </legend>
                      {resources.map((resource) => {
                        const value = resourceKey(resource)
                        return (
                          <label key={`${slot.slotId}:${value}`}>
                            <input
                              type="radio"
                              name={`support-plan-slot-${slot.slotId}`}
                              value={value}
                              checked={choices[slot.slotId] === value}
                              onChange={() =>
                                setChoices((current) => ({
                                  ...current,
                                  [slot.slotId]: value,
                                }))
                              }
                            />
                            <span>
                              <strong>{resource.title}</strong>
                              <small>{resource.summary}</small>
                              <small>
                                {resourceCategoryLabel[resource.category] ??
                                  resource.category}
                              </small>
                            </span>
                          </label>
                        )
                      })}
                      {slot.kind === 'OPTIONAL' && (
                        <label>
                          <input
                            type="radio"
                            name={`support-plan-slot-${slot.slotId}`}
                            value=""
                            checked={!choices[slot.slotId]}
                            onChange={() =>
                              setChoices((current) => ({
                                ...current,
                                [slot.slotId]: '',
                              }))
                            }
                          />
                          <span>
                            <strong>Bỏ nội dung bổ trợ này</strong>
                            <small>
                              Nội dung cốt lõi vẫn được giữ trong kế hoạch.
                            </small>
                          </span>
                        </label>
                      )}
                    </fieldset>
                  ) : slot.selectedResource ? (
                    <div className="support-plan-selected-resource">
                      <h4>{slot.selectedResource.title}</h4>
                      <p>{slot.selectedResource.summary}</p>
                      <small>
                        {resourceCategoryLabel[
                          slot.selectedResource.category
                        ] ?? slot.selectedResource.category}
                      </small>
                      {slot.selectedResource.externalUrl && (
                        <a
                          href={slot.selectedResource.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Mở nội dung đã duyệt
                        </a>
                      )}
                    </div>
                  ) : (
                    <p>Không chọn nội dung bổ trợ cho mục này.</p>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </section>

      {isDraft ? (
        <section
          className="support-plan-actions"
          aria-label="Xác nhận kế hoạch hỗ trợ"
        >
          <div>
            <strong>Bạn là người quyết định</strong>
            <p>
              Lưu lựa chọn trước, sau đó bắt đầu kế hoạch. MentalBridge sẽ kiểm
              tra lại quyền lợi gói, kết quả sàng lọc và nội dung hỗ trợ trước
              khi áp dụng.
            </p>
          </div>
          <div className="support-plan-action-buttons">
            <button
              className="btn btn-ghost"
              type="button"
              disabled={busy !== null}
              onClick={() => requestLifecycle('DISCARDED')}
            >
              Hủy kế hoạch
            </button>
            <button
              className="btn btn-ghost"
              type="button"
              disabled={!dirty || busy !== null}
              onClick={() => void submitChoices()}
            >
              {busy === 'SAVING' ? 'Đang lưu…' : 'Lưu lựa chọn'}
            </button>
            <button
              className="btn btn-primary"
              type="button"
              disabled={dirty || busy !== null}
              onClick={() => void onActivate()}
            >
              {busy === 'ACTIVATING' ? 'Đang bắt đầu…' : 'Bắt đầu kế hoạch'}
            </button>
          </div>
          {dirty && (
            <p className="support-plan-action-hint">
              Hãy lưu lựa chọn mới trước khi bắt đầu kế hoạch.
            </p>
          )}
          <p
            className="support-plan-action-message"
            role="status"
            aria-live="polite"
          >
            {message}
          </p>
        </section>
      ) : (
        <>
          <aside className="support-plan-confirmation-note">
            <strong>Quản lý trạng thái kế hoạch</strong>
            <p>
              Tạm dừng sẽ hủy các lịch tương lai; tiếp tục chỉ khôi phục các mục
              vẫn còn ở tương lai. Kết thúc không mang ý nghĩa phục hồi.
            </p>
            {(plan.status === 'ACTIVE' || plan.status === 'PAUSED') && (
              <div className="support-plan-lifecycle-actions">
                <button
                  className="btn btn-outline"
                  type="button"
                  disabled={busy !== null}
                  onClick={() =>
                    requestLifecycle(
                      plan.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE',
                    )
                  }
                >
                  {plan.status === 'ACTIVE'
                    ? 'Tạm dừng kế hoạch'
                    : 'Tiếp tục kế hoạch'}
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  disabled={busy !== null}
                  onClick={() => requestLifecycle('COMPLETED')}
                >
                  Kết thúc kế hoạch
                </button>
              </div>
            )}
          </aside>
          {(plan.status === 'ACTIVE' || plan.status === 'PAUSED') && (
            <SupportPlanSchedule planStatus={plan.status} />
          )}
        </>
      )}

      <Disclosure
        className="support-plan-provenance"
        summary="Thông tin kỹ thuật"
      >
        <dl>
          <div>
            <dt>Đánh giá hỗ trợ</dt>
            <dd>{plan.source.evaluationPolicyVersion}</dd>
          </div>
          <div>
            <dt>Chính sách chọn nội dung</dt>
            <dd>{plan.source.selectionPolicyVersion}</dd>
          </div>
          <div>
            <dt>Kiểm tra tài nguyên</dt>
            <dd>{plan.source.resourceEligibilityPolicyVersion}</dd>
          </div>
          <div>
            <dt>Quyền gói</dt>
            <dd>
              {plan.entitlement.policyVersion} · {plan.entitlement.source}
            </dd>
          </div>
        </dl>
      </Disclosure>

      <footer>
        <p>{plan.disclaimer}</p>
        <time dateTime={plan.updatedAt}>
          Cập nhật {new Date(plan.updatedAt).toLocaleString('vi-VN')}
        </time>
      </footer>

      <Dialog
        className="support-plan-dialog"
        open={pendingStatus !== null}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && busy === null) closeLifecycle()
        }}
        labelledBy="support-plan-lifecycle-title"
        describedBy="support-plan-lifecycle-description"
      >
        {pendingStatus && (
          <div className="support-plan-dialog-content">
            <span className="support-plan-dialog-icon" aria-hidden="true">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 8v5" />
                <path d="M12 17h.01" />
                <path d="M10.3 3.7 2.4 18a2 2 0 0 0 1.8 3h15.6a2 2 0 0 0 1.8-3L13.7 3.7a2 2 0 0 0-3.4 0Z" />
              </svg>
            </span>
            <h3 id="support-plan-lifecycle-title">
              {lifecycleConfirmation[pendingStatus].title}
            </h3>
            <p id="support-plan-lifecycle-description">
              {lifecycleConfirmation[pendingStatus].message}
            </p>
            {pendingStatus === 'COMPLETED' && (
              <label>
                Lý do (không bắt buộc)
                <select
                  value={completionReason}
                  disabled={busy !== null}
                  onChange={(event) => setCompletionReason(event.target.value)}
                >
                  <option value="">Không nêu lý do</option>
                  <option value="USER_DECISION">Tôi chủ động kết thúc</option>
                  <option value="PLAN_NO_LONGER_FITS">
                    Kế hoạch không còn phù hợp
                  </option>
                  <option value="OTHER">Lý do khác</option>
                </select>
              </label>
            )}
            <div>
              <button
                className="btn btn-ghost"
                type="button"
                disabled={busy !== null}
                onClick={closeLifecycle}
              >
                Quay lại
              </button>
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy !== null}
                autoFocus
                onClick={() => void confirmLifecycle()}
              >
                {busy === 'LIFECYCLE'
                  ? 'Đang cập nhật…'
                  : lifecycleConfirmation[pendingStatus].action}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </article>
  )
}
