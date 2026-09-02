import Link from 'next/link'

import './assessments.css'

const assessments = [
  {
    id: 'phq9',
    name: 'PHQ-9',
    fullName: 'Patient Health Questionnaire-9',
    description:
      'Bộ câu hỏi được tải từ phiên bản đã công bố của Care service.',
    duration: '3–5 phút',
    questions: 9,
    available: true,
  },
  {
    id: 'gad7',
    name: 'GAD-7',
    fullName: 'Generalized Anxiety Disorder-7',
    description: 'Contract và nội dung đã duyệt hiện chưa khả dụng.',
    duration: 'Chưa khả dụng',
    questions: 7,
    available: false,
  },
  {
    id: 'psqi',
    name: 'PSQI',
    fullName: 'Pittsburgh Sleep Quality Index',
    description: 'Contract và nội dung đã duyệt hiện chưa khả dụng.',
    duration: 'Chưa khả dụng',
    questions: 19,
    available: false,
  },
]

function AssessmentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 12c2.2-7 4.4 7 6.6 0s4.4-7 6.6 0 4.4 7 4.8 0" />
    </svg>
  )
}

export default function AssessmentsPage() {
  return (
    <div className="assessment-page">
      <header className="assessment-page-header">
        <div className="assessment-page-title">
          <span className="assessment-kicker">Theo dõi sức khỏe tinh thần</span>
          <h1>Bài đánh giá</h1>
          <p>
            Câu hỏi và kết quả được lấy trực tiếp qua Care service. Trình duyệt
            không tự tính điểm hoặc suy diễn mức độ.
          </p>
        </div>
      </header>

      <section aria-labelledby="available-assessments">
        <h2 id="available-assessments" className="sr-only">
          Bài đánh giá khả dụng
        </h2>
        <div className="assessment-card-grid">
          {assessments.map((assessment, index) => (
            <article
              className={`assessment-card ${assessment.available ? '' : 'assessment-card-unavailable'}`}
              key={assessment.id}
              style={{ '--delay': `${index * 70}ms` } as React.CSSProperties}
            >
              <div className="assessment-card-top">
                <span className="assessment-icon pulse">
                  <AssessmentIcon />
                </span>
                <span className="assessment-question-count">
                  {assessment.questions} câu hỏi
                </span>
                <h3>{assessment.name}</h3>
              </div>
              <strong>{assessment.fullName}</strong>
              <p>{assessment.description}</p>
              <div className="assessment-card-footer">
                <div className="assessment-duration">{assessment.duration}</div>
                {assessment.available ? (
                  <Link href="/assessment/phq9" className="assessment-start">
                    Bắt đầu <span aria-hidden="true">→</span>
                  </Link>
                ) : (
                  <span className="assessment-unavailable-label">
                    Chưa khả dụng
                  </span>
                )}
              </div>
            </article>
          ))}
        </div>
      </section>

      <section
        className="assessment-history"
        aria-labelledby="assessment-history-title"
      >
        <div className="assessment-section-title">
          <div>
            <span>Lịch sử</span>
            <h2 id="assessment-history-title">Các lần đánh giá gần đây</h2>
          </div>
          <p>Điểm số giúp theo dõi xu hướng, không phải chẩn đoán.</p>
        </div>
        <div className="assessment-history-unavailable">
          <strong>Lịch sử đánh giá hiện chưa khả dụng</strong>
          <p>
            Care contract hiện chỉ hỗ trợ mở lại kết quả gần nhất trong phiên,
            chưa cung cấp danh sách lịch sử. MentalBridge không hiển thị dữ liệu
            mẫu thay thế.
          </p>
        </div>
      </section>

      <aside className="assessment-note">
        <span>i</span>
        <div>
          <strong>Một lời nhắc nhẹ nhàng</strong>
          <p>
            Kết quả chỉ mang tính hỗ trợ sàng lọc và không thay thế chẩn đoán
            hoặc tư vấn từ chuyên gia sức khỏe tâm thần.
          </p>
        </div>
      </aside>
    </div>
  )
}
