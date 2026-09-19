import type { SupportPlanDraft } from '../api/support-plan-contract'

const domainLabel = {
  DEPRESSIVE_SYMPTOMS: 'Hỗ trợ theo miền triệu chứng trầm cảm',
  ANXIETY_SYMPTOMS: 'Hỗ trợ theo miền triệu chứng lo âu',
} as const

const slotLabel: Record<string, string> = {
  CORE: 'Nội dung cốt lõi',
  OPTIONAL: 'Nội dung bổ trợ',
}

export default function SupportPlanCard({ plan }: { plan: SupportPlanDraft }) {
  const safetyPositive = plan.safety.status === 'POSITIVE_SAFETY_SCREEN'

  return (
    <article
      className="support-plan-card"
      aria-labelledby={`support-plan-${plan.supportPlanId}`}
    >
      <header className="support-plan-card-header">
        <div>
          <span>Bản nháp do Care quản lý</span>
          <h2 id={`support-plan-${plan.supportPlanId}`}>
            SupportPlan đề xuất cho bạn
          </h2>
        </div>
        <span className="support-plan-status">Chưa kích hoạt</span>
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

      <section className="support-plan-slots" aria-label="Nội dung đề xuất">
        <div className="support-plan-section-heading">
          <div>
            <span>Kế hoạch dự kiến</span>
            <h3>{plan.selectedResourceCount} nội dung đã được kiểm tra</h3>
          </div>
          <span>{plan.entitlement.packageCode}</span>
        </div>
        <ol>
          {plan.slots.map((slot, index) => (
            <li key={slot.slotId}>
              <div className="support-plan-slot-number" aria-hidden="true">
                {index + 1}
              </div>
              <div className="support-plan-slot-content">
                <div className="support-plan-slot-meta">
                  <span>{slotLabel[slot.kind]}</span>
                  <span>{domainLabel[slot.targetDomain]}</span>
                </div>
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
                {slot.allowedAlternatives.length > 0 && (
                  <details>
                    <summary>
                      {slot.allowedAlternatives.length} lựa chọn phù hợp khác
                    </summary>
                    <ul>
                      {slot.allowedAlternatives.map((alternative) => (
                        <li
                          key={`${slot.slotId}:${alternative.resourceId}:${alternative.contentVersion}`}
                        >
                          <strong>{alternative.title}</strong>
                          <span>{alternative.summary}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      </section>

      <aside className="support-plan-confirmation-note">
        <strong>Bạn vẫn là người xác nhận</strong>
        <p>
          Đây là bản nháp. MentalBridge chưa kích hoạt, thay đổi hay theo dõi kế
          hoạch cho đến khi có luồng xác nhận riêng.
        </p>
      </aside>

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
