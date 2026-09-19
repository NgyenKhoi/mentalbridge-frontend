'use client'

import { useMemo, useState } from 'react'

import type {
  ReplaceSupportPlanChoicesRequest,
  SupportPlan,
} from '../api/support-plan-contract'

const domainLabel = {
  DEPRESSIVE_SYMPTOMS: 'Hỗ trợ theo miền triệu chứng trầm cảm',
  ANXIETY_SYMPTOMS: 'Hỗ trợ theo miền triệu chứng lo âu',
} as const

const slotLabel: Record<string, string> = {
  CORE: 'Nội dung cốt lõi',
  OPTIONAL: 'Nội dung bổ trợ',
}

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
  busy: 'SAVING' | 'ACTIVATING' | null
  message: string
  onSaveChoices: (request: ReplaceSupportPlanChoicesRequest) => Promise<void>
  onActivate: () => Promise<void>
}>

export default function SupportPlanCard({
  plan,
  busy,
  message,
  onSaveChoices,
  onActivate,
}: Props) {
  const [choices, setChoices] = useState<Record<string, string>>(() =>
    initialChoices(plan),
  )
  const isDraft = plan.status === 'DRAFT'
  const safetyPositive = plan.safety.status === 'POSITIVE_SAFETY_SCREEN'

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

  return (
    <article
      className="support-plan-card"
      aria-labelledby={`support-plan-${plan.supportPlanId}`}
    >
      <header className="support-plan-card-header">
        <div>
          <span>
            {isDraft ? 'Bản nháp do Care quản lý' : 'Kế hoạch hiện tại'}
          </span>
          <h2 id={`support-plan-${plan.supportPlanId}`}>
            {isDraft
              ? 'SupportPlan đề xuất cho bạn'
              : 'SupportPlan đang hoạt động'}
          </h2>
        </div>
        <span className={`support-plan-status ${isDraft ? '' : 'active'}`}>
          {isDraft ? 'Chưa kích hoạt' : 'Đang hoạt động'}
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
          Safety do chính sách Care quyết định, không phụ thuộc AI hoặc gói dịch
          vụ.
        </small>
      </section>

      <section className="support-plan-rationale">
        <span>Vì sao có đề xuất này?</span>
        <p>{plan.rationale.text}</p>
      </section>

      <section className="support-plan-slots" aria-label="Nội dung SupportPlan">
        <div className="support-plan-section-heading">
          <div>
            <span>
              {isDraft ? 'Chọn nội dung phù hợp' : 'Kế hoạch đã xác nhận'}
            </span>
            <h3>{plan.selectedResourceCount} nội dung đã được kiểm tra</h3>
          </div>
          <span>{plan.entitlement.packageCode}</span>
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
                                Phiên bản {resource.contentVersion} ·{' '}
                                {resource.category}
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
                        Phiên bản {slot.selectedResource.contentVersion} ·{' '}
                        {slot.selectedResource.category}
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
          aria-label="Xác nhận SupportPlan"
        >
          <div>
            <strong>Bạn là người quyết định</strong>
            <p>
              Lưu lựa chọn trước, sau đó kích hoạt kế hoạch. Care sẽ kiểm tra
              lại quyền gói, kết quả đánh giá và từng phiên bản nội dung ngay
              trước khi kích hoạt.
            </p>
          </div>
          <div className="support-plan-action-buttons">
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
              {busy === 'ACTIVATING'
                ? 'Đang kích hoạt…'
                : 'Kích hoạt SupportPlan'}
            </button>
          </div>
          {dirty && (
            <p className="support-plan-action-hint">
              Hãy lưu lựa chọn mới trước khi kích hoạt.
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
        <aside className="support-plan-confirmation-note">
          <strong>SupportPlan đã được kích hoạt</strong>
          <p>
            Đây là trạng thái hiện tại do Care trả về. Mọi thay đổi tiếp theo
            cần đi qua một lệnh riêng và được kiểm tra lại.
          </p>
        </aside>
      )}

      <details className="support-plan-provenance">
        <summary>Nguồn và phiên bản quyết định</summary>
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
      </details>

      <footer>
        <p>{plan.disclaimer}</p>
        <time dateTime={plan.updatedAt}>
          Cập nhật {new Date(plan.updatedAt).toLocaleString('vi-VN')}
        </time>
      </footer>
    </article>
  )
}
