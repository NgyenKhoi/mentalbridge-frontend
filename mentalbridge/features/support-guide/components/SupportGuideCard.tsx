import Link from 'next/link'

import type { SupportGuide } from '../api/support-guide-contract'

const resourceStateCopy: Record<
  SupportGuide['resourceResolution']['status'],
  string
> = {
  AVAILABLE:
    'Các tài nguyên bên dưới đã được kiểm tra theo đúng phiên bản kết quả.',
  PARTIAL: 'Một số tài nguyên phù hợp đang tạm thời không khả dụng.',
  EMPTY: 'Hiện chưa có tài nguyên đã duyệt phù hợp với kết quả này.',
  STALE:
    'Phiên bản tài nguyên đã thay đổi nên MentalBridge không hiển thị gợi ý cũ.',
  UNAVAILABLE:
    'Không thể kiểm tra tài nguyên lúc này. Hướng dẫn an toàn vẫn luôn khả dụng.',
}

export default function SupportGuideCard({ guide }: { guide: SupportGuide }) {
  const safetyPositive = guide.safety.status === 'POSITIVE_SAFETY_SCREEN'
  return (
    <article
      className="support-guide-card"
      aria-labelledby={`guide-${guide.supportGuideId}`}
    >
      <header>
        <div>
          <span className="support-guide-kicker">
            Dựa trên kết quả gần nhất
          </span>
          <h2 id={`guide-${guide.supportGuideId}`}>Gợi ý sau sàng lọc</h2>
        </div>
        <span className="support-guide-kind">Bạn chủ động lựa chọn</span>
      </header>

      <p className="support-guide-explanation">{guide.explanation.text}</p>

      <section
        className={`support-guide-safety ${safetyPositive ? 'positive' : ''}`}
      >
        <strong>
          {safetyPositive ? 'Ưu tiên thông tin an toàn' : 'Thông tin an toàn'}
        </strong>
        <p>{guide.safety.guidance}</p>
        <small>An toàn không phụ thuộc gói dịch vụ hoặc AI.</small>
      </section>

      <section
        className="support-guide-resources"
        aria-label="Tài nguyên được gợi ý"
      >
        <h3>Tài nguyên đã rà soát</h3>
        <p>{resourceStateCopy[guide.resourceResolution.status]}</p>
        {guide.resources.length > 0 && (
          <ul>
            {guide.resources.map((resource) => (
              <li key={`${resource.resourceId}:${resource.domain}`}>
                <strong>{resource.title}</strong>
                <p>{resource.summary}</p>
                <span>
                  {resource.domain === 'DEPRESSIVE_SYMPTOMS'
                    ? 'Triệu chứng trầm cảm'
                    : 'Triệu chứng lo âu'}{' '}
                </span>
                {resource.externalUrl && (
                  <a
                    href={resource.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở tài nguyên
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {guide.phrasing.status === 'AI_UNAVAILABLE_FALLBACK' && (
        <p className="support-guide-fallback" role="status">
          Nội dung đã được chuẩn bị sẵn đang được hiển thị. Việc AI tạm thời
          không khả dụng không làm thay đổi kết quả sàng lọc.
        </p>
      )}

      <details className="support-guide-provenance">
        <summary>Thông tin kỹ thuật</summary>
        <dl>
          <div>
            <dt>Chính sách hướng dẫn</dt>
            <dd>{guide.guidePolicyVersion}</dd>
          </div>
          <div>
            <dt>Chính sách đánh giá</dt>
            <dd>{guide.provenance.supportEvaluationPolicyVersion}</dd>
          </div>
          <div>
            <dt>Chính sách tài nguyên</dt>
            <dd>{guide.resourceResolution.policyVersion}</dd>
          </div>
        </dl>
        <ul>
          {guide.provenance.assessmentResults.map((result) => (
            <li key={result.assessmentId}>
              {result.instrument} · {result.questionnaireVersion} ·{' '}
              {result.scoringVersion}
            </li>
          ))}
        </ul>
      </details>

      <footer>
        <time dateTime={guide.generatedAt}>
          Tạo lúc {new Date(guide.generatedAt).toLocaleString('vi-VN')}
        </time>
        <Link href={`/support-guides/${guide.supportGuideId}`}>
          Mở lại hướng dẫn này
        </Link>
      </footer>
    </article>
  )
}
