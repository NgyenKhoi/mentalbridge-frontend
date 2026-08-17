import Link from 'next/link'
import './assessments.css'

const assessments = [
  { id: 'phq9', name: 'PHQ-9', fullName: 'Patient Health Questionnaire-9', description: 'Đánh giá mức độ triệu chứng trầm cảm trong 2 tuần qua.', duration: '3–5 phút', questions: 9 },
  { id: 'gad7', name: 'GAD-7', fullName: 'Generalized Anxiety Disorder-7', description: 'Đánh giá mức độ lo âu và căng thẳng trong 2 tuần gần đây.', duration: '3–5 phút', questions: 7 },
  { id: 'psqi', name: 'PSQI', fullName: 'Pittsburgh Sleep Quality Index', description: 'Đánh giá chất lượng giấc ngủ trong tháng qua.', duration: '5–7 phút', questions: 19 },
]

const history = [
  { id: 1, date: '10 tháng 8, 2026', day: 'Thứ Hai', assessment: 'PHQ-9', score: 8, level: 'Nhẹ', tone: 'neutral' },
  { id: 2, date: '25 tháng 7, 2026', day: 'Thứ Bảy', assessment: 'GAD-7', score: 5, level: 'Tối thiểu', tone: 'positive' },
  { id: 3, date: '10 tháng 7, 2026', day: 'Thứ Sáu', assessment: 'PHQ-9', score: 12, level: 'Trung bình', tone: 'neutral' },
]

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
}

export default function AssessmentsPage() {
  return <div className="assessment-page">
    <header className="assessment-page-header">
      <span className="assessment-kicker">Theo dõi sức khỏe tinh thần</span>
      <h1>Bài đánh giá</h1>
      <p>Việc kiểm tra định kỳ giúp bạn hiểu rõ tiến trình và nhận được hỗ trợ phù hợp. Chọn một bài đánh giá để bắt đầu.</p>
    </header>

    <section aria-labelledby="available-assessments">
      <h2 id="available-assessments" className="sr-only">Bài đánh giá khả dụng</h2>
      <div className="assessment-card-grid">
        {assessments.map((assessment, index) => <article className="assessment-card" key={assessment.id} style={{ '--delay': `${index * 70}ms` } as React.CSSProperties}>
          <div className="assessment-card-top"><h3>{assessment.name}</h3><span>{assessment.questions} câu hỏi</span></div>
          <strong>{assessment.fullName}</strong>
          <p>{assessment.description}</p>
          <div className="assessment-card-footer">
            <div className="assessment-duration"><ClockIcon />{assessment.duration}</div>
            <Link href={`/assessment/${assessment.id}`} className="assessment-start">Bắt đầu <span aria-hidden="true">→</span></Link>
          </div>
        </article>)}
      </div>
    </section>

    <section className="assessment-history" aria-labelledby="assessment-history-title">
      <div className="assessment-section-title"><div><span>Lịch sử</span><h2 id="assessment-history-title">Các lần đánh giá gần đây</h2></div><p>Điểm số giúp theo dõi xu hướng, không phải chẩn đoán.</p></div>
      <div className="assessment-table-wrap">
        <table className="assessment-table">
          <thead><tr><th>Ngày làm</th><th>Bài test</th><th>Điểm số</th><th>Kết quả</th><th><span className="sr-only">Hành động</span></th></tr></thead>
          <tbody>{history.map(item => <tr key={item.id}>
            <td><strong>{item.date}</strong><small>{item.day}</small></td>
            <td><span className="assessment-test-name">{item.assessment}</span></td>
            <td><span className="assessment-score">{item.score}</span><small>/ 27</small></td>
            <td><span className={`assessment-level ${item.tone}`}>{item.level}</span></td>
            <td><button className="assessment-row-action" aria-label={`Xem kết quả ${item.assessment} ngày ${item.date}`}>→</button></td>
          </tr>)}</tbody>
        </table>
        <div className="assessment-table-footer"><button className="btn-outline">Xem tất cả lịch sử</button></div>
      </div>
    </section>

    <aside className="assessment-note"><span>i</span><div><strong>Một lời nhắc nhẹ nhàng</strong><p>Kết quả chỉ mang tính hỗ trợ sàng lọc và không thay thế đánh giá từ chuyên gia sức khỏe tâm thần.</p></div></aside>
  </div>
}
