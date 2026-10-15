import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  CircleHelp,
  HeartHandshake,
  Info,
  ShieldCheck,
} from 'lucide-react'

import type {
  ScreeningLevel,
  SupportEvaluation,
} from '@/features/assessment/api/care-contract'
import type { SupportGuide } from '../api/support-guide-contract'

const resourceStateCopy: Record<
  SupportGuide['resourceResolution']['status'],
  string
> = {
  AVAILABLE:
    'Những bài tập dưới đây có thể giúp bạn thư giãn, nhận biết cảm xúc và xây dựng thói quen chăm sóc bản thân.',
  PARTIAL:
    'Một số tài nguyên đã lưu cùng gợi ý này hiện tạm thời không khả dụng.',
  EMPTY: 'Lần đánh giá này không có tài nguyên đã lưu kèm theo.',
  STALE:
    'Phiên bản tài nguyên đã thay đổi nên MentalBridge không mở nội dung cũ.',
  UNAVAILABLE:
    'Chưa thể kiểm tra các tài nguyên đã lưu. Bạn có thể thử mở lại sau.',
}

const levelLabels: Record<ScreeningLevel, string> = {
  MINIMAL: 'Tối thiểu',
  MILD: 'Nhẹ',
  MODERATE: 'Trung bình',
  MODERATELY_SEVERE: 'Khá nặng',
  SEVERE: 'Nặng',
}

export type SupportGuideScore = Readonly<{
  totalScore: number
  screeningLevel: ScreeningLevel
  submittedAt?: string
}>
export type SupportGuideScorePair = Readonly<{
  phq9: SupportGuideScore
  gad7: SupportGuideScore
}>

function knownLevel(value: string | undefined): ScreeningLevel | undefined {
  return value === 'MINIMAL' ||
    value === 'MILD' ||
    value === 'MODERATE' ||
    value === 'MODERATELY_SEVERE' ||
    value === 'SEVERE'
    ? value
    : undefined
}

function guideDateTime(value: string) {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function ScoreCard({
  instrument,
  evidence,
  score,
}: Readonly<{
  instrument: 'PHQ9' | 'GAD7'
  evidence: SupportGuide['provenance']['assessmentResults'][number] | undefined
  score: SupportGuideScore | undefined
}>) {
  const phq9 = instrument === 'PHQ9'
  const level = knownLevel(score?.screeningLevel ?? evidence?.screeningLevel)
  return (
    <section
      className={`support-guide-score level-${level?.toLowerCase().replaceAll('_', '-') ?? 'unavailable'}`}
    >
      <div>
        <h3>Bài sàng lọc {phq9 ? 'PHQ-9' : 'GAD-7'}</h3>
        <p>{phq9 ? 'Dấu hiệu về tâm trạng' : 'Dấu hiệu lo âu'}</p>
      </div>
      <div className="support-guide-score-result">
        <strong>{score ? `${score.totalScore}/${phq9 ? 27 : 21}` : '—'}</strong>
        <span className="support-guide-level">
          {level
            ? `Mức ${levelLabels[level].toLowerCase()}`
            : 'Không đủ dữ liệu điểm'}
        </span>
      </div>
    </section>
  )
}

export default function SupportGuideCard({
  guide,
  historical = false,
  scorePair,
  supportTier,
  resultEvaluationId,
  headingLevel = 'h2',
  showOpenLink = true,
}: {
  guide: SupportGuide
  historical?: boolean
  scorePair?: SupportGuideScorePair | null
  supportTier?: SupportEvaluation['supportTier']
  resultEvaluationId?: string
  headingLevel?: 'h1' | 'h2'
  showOpenLink?: boolean
}) {
  const AnswerHeading = headingLevel
  const safetyPositive = guide.safety.status === 'POSITIVE_SAFETY_SCREEN'
  const professional =
    !safetyPositive &&
    (supportTier === 'PROFESSIONAL_SUPPORT_RECOMMENDED' ||
      (!supportTier &&
        guide.provenance.assessmentResults.some((result) =>
          ['MODERATE', 'MODERATELY_SEVERE', 'SEVERE'].includes(
            result.screeningLevel,
          ),
        )))
  const phq9Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'PHQ9',
  )
  const gad7Evidence = guide.provenance.assessmentResults.find(
    (result) => result.instrument === 'GAD7',
  )
  const answerTitle = safetyPositive
    ? historical
      ? 'Với kết quả của lần đánh giá này, thông tin an toàn được ưu tiên trước'
      : 'Với kết quả này, ưu tiên hàng đầu là kết nối hỗ trợ an toàn ngay'
    : professional
      ? historical
        ? 'Với kết quả của lần đánh giá này, gợi ý được lưu là nên trao đổi với chuyên gia tâm lý'
        : 'Với kết quả này, bạn nên trao đổi với chuyên gia tâm lý'
      : historical
        ? 'Với kết quả của lần đánh giá này, gợi ý được lưu là bắt đầu từ những bước nhỏ'
        : 'Với kết quả này, bạn có thể bắt đầu từ những bước nhỏ'
  const resourcesTitle =
    'Bài tập hỗ trợ có thể giúp bạn cải thiện tình trạng này'

  return (
    <article
      className={`support-guide-card${historical ? ' is-historical' : ''}`}
      aria-labelledby={`guide-${guide.supportGuideId}`}
    >
      {historical && (
        <>
          <div className="support-guide-back-row">
            <Link
              href={
                resultEvaluationId
                  ? `/assessments/results/${resultEvaluationId}`
                  : '/assessments'
              }
            >
              <ArrowLeft aria-hidden="true" />{' '}
              {resultEvaluationId
                ? 'Quay lại Kết quả trước đây'
                : 'Quay lại Lịch sử sàng lọc'}
            </Link>
            <span>Từ kết quả này bạn có thể quay lại Lịch sử sàng lọc</span>
          </div>
          <aside className="support-guide-history-notice">
            <Info aria-hidden="true" />
            <p>
              <strong>Lưu ý quan trọng:</strong> Đây là gợi ý được lưu tại thời
              điểm đánh giá ({guideDateTime(guide.generatedAt)}) và có thể không
              phản ánh tình trạng hiện tại của bạn.
            </p>
          </aside>
        </>
      )}
      {safetyPositive && (
        <section
          className="support-guide-safety-priority"
          aria-labelledby={`guide-safety-${guide.supportGuideId}`}
        >
          <span className="support-guide-safety-icon">
            <ShieldCheck aria-hidden="true" />
          </span>
          <div>
            <span className="support-guide-kicker">Ưu tiên an toàn</span>
            <h2 id={`guide-safety-${guide.supportGuideId}`}>
              Xem hướng dẫn an toàn và tìm hỗ trợ trực tiếp
            </h2>
            <p>{guide.safety.guidance}</p>
            <Link href="/safety-directory?trigger=positive-item-9">
              Xem hỗ trợ trong khu vực <ArrowRight aria-hidden="true" />
            </Link>
          </div>
        </section>
      )}
      <section
        className="support-guide-answer"
        data-purpose="hero-guide-answer"
      >
        <div className="support-guide-answer-copy">
          <div className="support-guide-badges">
            {historical && (
              <span className="support-guide-history-badge">
                Bản ghi lịch sử · Chỉ đọc
              </span>
            )}
            <span>
              {historical ? 'Gợi ý của lần đánh giá này' : 'Gợi ý sau sàng lọc'}
            </span>
          </div>
          <span className="support-guide-question">
            <CircleHelp aria-hidden="true" /> Hỏi &amp; Đáp: Với kết quả này,
            tôi nên làm gì?
          </span>
          <AnswerHeading id={`guide-${guide.supportGuideId}`}>
            {answerTitle}
          </AnswerHeading>
          <p>{guide.explanation.text}</p>
          {!professional && !safetyPositive && (
            <div className="support-guide-priority-list">
              <strong>3 bước tự hỗ trợ có thể bắt đầu ngay:</strong>
              <ol>
                <li>
                  <span>1</span>
                  <div>
                    <strong>Giữ giờ ngủ và giờ thức tương đối ổn định:</strong>{' '}
                    Giúp bạn duy trì nhịp sinh hoạt đều đặn.
                  </div>
                </li>
                <li>
                  <span>2</span>
                  <div>
                    <strong>
                      Chọn một hoạt động nhẹ bạn có thể thực hiện hôm nay:
                    </strong>{' '}
                    Đi dạo, giãn cơ hoặc uống đủ nước.
                  </div>
                </li>
                <li>
                  <span>3</span>
                  <div>
                    <strong>
                      Theo dõi cảm xúc và những thay đổi khiến bạn thấy khó
                      chịu:
                    </strong>{' '}
                    Lắng nghe bản thân và ghi chép ngắn gọn không phán xét.
                  </div>
                </li>
              </ol>
            </div>
          )}
          {professional && (
            <div className="support-guide-professional-note">
              <strong>
                <HeartHandshake aria-hidden="true" /> Trao đổi với chuyên gia
              </strong>
              <p>
                Các dấu hiệu được ghi nhận cho thấy việc trao đổi với chuyên gia
                có thể giúp bạn hiểu rõ hơn điều mình đang trải qua và lựa chọn
                hướng hỗ trợ phù hợp. Bạn hoàn toàn chủ động lựa chọn thời gian
                và chuyên gia phù hợp với mình.
              </p>
            </div>
          )}
          <div className="support-guide-answer-actions">
            {!safetyPositive &&
              (professional ? (
                <Link className="support-guide-primary" href="/specialists">
                  <HeartHandshake aria-hidden="true" /> Tìm chuyên gia phù hợp
                </Link>
              ) : guide.resources.length > 0 ? (
                <a
                  className="support-guide-primary"
                  href="#support-guide-resources"
                >
                  <BookOpen aria-hidden="true" /> Khám phá bài tập phù hợp
                </a>
              ) : (
                <Link className="support-guide-primary" href="/resources">
                  Khám phá thư viện tài nguyên
                </Link>
              ))}
            {(safetyPositive || professional) && guide.resources.length > 0 && (
              <a
                className="support-guide-secondary"
                href="#support-guide-resources"
              >
                Xem bài tập hỗ trợ trong lúc chờ
              </a>
            )}
            {!professional && !safetyPositive && (
              <small>
                Miễn phí cho mọi tài khoản · Tự do thực hành, không áp lực
              </small>
            )}
          </div>
          <div className="support-guide-answer-meta">
            <CalendarDays aria-hidden="true" />
            <span>
              Gợi ý được lưu lúc:{' '}
              <strong>{guideDateTime(guide.generatedAt)}</strong>
            </span>
            <span>Gắn với lần đánh giá này</span>
          </div>
        </div>
      </section>
      <section
        className="support-guide-linked-results"
        aria-labelledby={`guide-results-${guide.supportGuideId}`}
      >
        <header>
          <h2 id={`guide-results-${guide.supportGuideId}`}>
            Cặp kết quả liên kết với gợi ý này
          </h2>
          <small>Đúng cặp đánh giá đã chọn</small>
        </header>
        <div className="support-guide-score-grid">
          <ScoreCard
            instrument="PHQ9"
            evidence={phq9Evidence}
            score={scorePair?.phq9}
          />
          <ScoreCard
            instrument="GAD7"
            evidence={gad7Evidence}
            score={scorePair?.gad7}
          />
        </div>
      </section>
      <section
        className="support-guide-resources"
        id="support-guide-resources"
        aria-labelledby={`guide-resources-${guide.supportGuideId}`}
      >
        <header>
          <div>
            <h2 id={`guide-resources-${guide.supportGuideId}`}>
              {resourcesTitle}
            </h2>
            <p>{resourceStateCopy[guide.resourceResolution.status]}</p>
          </div>
          <span className="support-guide-resource-status">
            {professional
              ? 'Hỗ trợ tạm thời'
              : safetyPositive
                ? 'Hỗ trợ thêm'
                : 'Bạn chủ động lựa chọn'}
          </span>
        </header>
        {professional && (
          <p className="support-guide-resource-note">
            Các bài tập dưới đây đóng vai trò hỗ trợ tạm thời trong lúc chờ trao
            đổi với chuyên gia; không thay thế quá trình làm việc cùng chuyên
            gia tâm lý.
          </p>
        )}
        {guide.resources.length > 0 ? (
          <ol>
            {guide.resources.map((resource, index) => (
              <li key={`${resource.resourceId}:${resource.contentVersion}`}>
                <div className="support-guide-resource-top">
                  <span className="support-guide-resource-number">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="support-guide-resource-domain">
                    {resource.domain === 'DEPRESSIVE_SYMPTOMS'
                      ? 'Tâm trạng'
                      : 'Lo âu'}
                  </span>
                </div>
                <div className="support-guide-resource-copy">
                  <h3>{resource.title}</h3>
                  <p>{resource.summary}</p>
                </div>
                <a
                  href={
                    resource.externalUrl ??
                    `/resources/${resource.resourceId}?contentVersion=${encodeURIComponent(resource.contentVersion)}`
                  }
                  target={resource.externalUrl ? '_blank' : undefined}
                  rel={resource.externalUrl ? 'noreferrer' : undefined}
                >
                  {resource.externalUrl ? 'Mở tài nguyên' : 'Xem bài tập'}
                  <ArrowRight aria-hidden="true" />
                </a>
              </li>
            ))}
          </ol>
        ) : (
          <div className="support-guide-resource-empty">
            <Info aria-hidden="true" />
            <p>{resourceStateCopy[guide.resourceResolution.status]}</p>
            {!historical && (
              <Link href="/resources">Xem thư viện tài nguyên hiện tại</Link>
            )}
          </div>
        )}
        {!safetyPositive && !professional && (
          <aside className="support-guide-professional-fallback">
            <div>
              <h3>
                <CircleHelp aria-hidden="true" /> Bạn vẫn cảm thấy không yên
                tâm?
              </h3>
              <p>
                Nếu bạn cảm thấy không yên tâm về tình trạng sức khỏe tinh thần
                hoặc muốn được giải thích rõ hơn về kết quả, bạn có thể trao đổi
                với chuyên gia tâm lý.
              </p>
            </div>
            <Link href="/specialists">
              Trao đổi với chuyên gia <ArrowRight aria-hidden="true" />
            </Link>
          </aside>
        )}
        {guide.phrasing.status === 'AI_UNAVAILABLE_FALLBACK' && (
          <p className="support-guide-fallback" role="status">
            Nội dung chuẩn bị sẵn đang được hiển thị. Kết quả sàng lọc và các
            tài nguyên đã lưu không thay đổi.
          </p>
        )}
        <div className="support-guide-disclosures">
          <details>
            <summary>Vì sao có gợi ý này?</summary>
            <p>{guide.explanation.text}</p>
            <p>
              Bạn luôn chủ động lựa chọn bước phù hợp với mình. Kết quả sàng lọc
              không thay thế chẩn đoán y khoa.
            </p>
          </details>
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
        </div>
      </section>
      <footer className="support-guide-footer">
        <time dateTime={guide.generatedAt}>
          <CalendarDays aria-hidden="true" /> Tạo lúc{' '}
          {guideDateTime(guide.generatedAt)}
        </time>
        {historical ? (
          <Link href="/assessments">
            <ArrowLeft aria-hidden="true" /> Quay lại lịch sử sàng lọc
          </Link>
        ) : showOpenLink ? (
          <Link href={`/support-guides/${guide.supportGuideId}`}>
            Mở lại hướng dẫn này <ArrowRight aria-hidden="true" />
          </Link>
        ) : null}
      </footer>
    </article>
  )
}
