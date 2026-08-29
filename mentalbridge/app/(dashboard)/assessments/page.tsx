'use client'
import { useState } from 'react'
import Link from 'next/link'
import AssessmentHistoryModal from '@/components/AssessmentHistoryModal'
import AssessmentResultModal from '@/components/AssessmentResultModal'
import AssessmentProgressModal from '@/components/AssessmentProgressModal'
import './assessments.css'

const assessments = [
  { id: 'phq9', name: 'PHQ-9', fullName: 'Patient Health Questionnaire-9', description: 'Đánh giá mức độ triệu chứng trầm cảm trong 2 tuần qua.', duration: '3–5 phút', questions: 9, icon: 'pulse' },
  { id: 'gad7', name: 'GAD-7', fullName: 'Generalized Anxiety Disorder-7', description: 'Đánh giá mức độ lo âu và căng thẳng trong 2 tuần gần đây.', duration: '3–5 phút', questions: 7, icon: 'wave' },
  { id: 'psqi', name: 'PSQI', fullName: 'Pittsburgh Sleep Quality Index', description: 'Đánh giá chất lượng giấc ngủ trong tháng qua.', duration: '5–7 phút', questions: 19, icon: 'moon' },
]

type AssessmentHistoryItem = {
  id: number
  date: string
  day: string
  assessment: string
  score: number
  level: string
  tone: 'positive' | 'neutral' | 'warning'
}

type AssessmentResult = AssessmentHistoryItem & {
  assessmentFull: string
  maxScore: number
  description: string
  recommendations: string[]
  questions: never[]
  previousScore: number
}

const history: AssessmentHistoryItem[] = [
  { id: 1, date: '10 tháng 8, 2026', day: 'Thứ Hai', assessment: 'PHQ-9', score: 8, level: 'Nhẹ', tone: 'neutral' },
  { id: 2, date: '25 tháng 7, 2026', day: 'Thứ Bảy', assessment: 'GAD-7', score: 5, level: 'Tối thiểu', tone: 'positive' },
  { id: 3, date: '10 tháng 7, 2026', day: 'Thứ Sáu', assessment: 'PHQ-9', score: 12, level: 'Trung bình', tone: 'neutral' },
]

function ClockIcon() {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>
}

function AssessmentIcon({ type }: { type: string }) {
  if (type === 'moon') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M19.5 14.3A7.6 7.6 0 0 1 9.7 4.5a7.7 7.7 0 1 0 9.8 9.8Z"/></svg>
  if (type === 'wave') return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h3l2-5 3 10 2-7 2 4h6"/></svg>
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12c2.2-7 4.4 7 6.6 0s4.4-7 6.6 0 4.4 7 4.8 0"/></svg>
}

export default function AssessmentsPage() {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [isProgressOpen, setIsProgressOpen] = useState(false)
  const [selectedResult, setSelectedResult] = useState<AssessmentResult | null>(null)
  const [isResultOpen, setIsResultOpen] = useState(false)

  const handleViewResult = (item: AssessmentHistoryItem) => {
    // Mock detailed result data
    const detailedResult = {
      ...item,
      assessmentFull: item.assessment === 'PHQ-9' 
        ? 'Patient Health Questionnaire-9'
        : item.assessment === 'GAD-7'
        ? 'Generalized Anxiety Disorder-7'
        : 'Pittsburgh Sleep Quality Index',
      maxScore: item.assessment === 'PHQ-9' ? 27 : item.assessment === 'GAD-7' ? 21 : 21,
      description: item.level === 'Nhẹ'
        ? 'Kết quả cho thấy bạn đang có một số triệu chứng nhẹ. Điều này là bình thường và có thể quản lý được với các biện pháp tự chăm sóc.'
        : item.level === 'Tối thiểu'
        ? 'Kết quả rất tích cực! Bạn đang có triệu chứng ở mức tối thiểu. Hãy tiếp tục duy trì lối sống lành mạnh hiện tại.'
        : 'Kết quả cho thấy triệu chứng ở mức trung bình. Khuyến nghị bạn nên tham khảo ý kiến chuyên gia để được hỗ trợ tốt hơn.',
      recommendations: item.level === 'Nhẹ'
        ? [
            'Duy trì thói quen ngủ đủ giấc (7-8 tiếng mỗi đêm)',
            'Tập thể dục nhẹ nhàng 30 phút mỗi ngày',
            'Thực hành kỹ thuật thư giãn và mindfulness',
            'Chia sẻ cảm xúc với người thân hoặc bạn bè'
          ]
        : item.level === 'Tối thiểu'
        ? [
            'Tiếp tục duy trì lối sống lành mạnh',
            'Thực hành biết ơn hàng ngày',
            'Dành thời gian cho sở thích cá nhân',
            'Kết nối với cộng đồng xung quanh'
          ]
        : [
            'Cân nhắc đặt lịch tư vấn với chuyên gia tâm lý',
            'Theo dõi triệu chứng và ghi nhật ký cảm xúc',
            'Tham gia các nhóm hỗ trợ nếu có thể',
            'Thảo luận với bác sĩ về các phương án điều trị'
          ],
      questions: [],
      previousScore: item.assessment === 'PHQ-9' ? item.score + 2 : item.score + 1
    }
    
    setSelectedResult(detailedResult)
    setIsResultOpen(true)
  }

  return <>
    <div className="assessment-page">
    <header className="assessment-page-header">
      <div className="assessment-page-title"><span className="assessment-kicker">Theo dõi sức khỏe tinh thần</span><h1>Bài đánh giá</h1><p>Việc kiểm tra định kỳ giúp bạn hiểu rõ tiến trình và nhận được hỗ trợ phù hợp. Chọn một bài đánh giá để bắt đầu.</p></div>
      <button className="assessment-progress-trigger" onClick={() => setIsProgressOpen(true)}><span>↗</span><div><strong>Theo dõi tiến trình</strong><small>Biểu đồ và các mốc đánh giá</small></div></button>
    </header>

    <section aria-labelledby="available-assessments">
      <h2 id="available-assessments" className="sr-only">Bài đánh giá khả dụng</h2>
      <div className="assessment-card-grid">
        {assessments.map((assessment, index) => <article className="assessment-card" key={assessment.id} style={{ '--delay': `${index * 70}ms` } as React.CSSProperties}>
          <div className="assessment-card-top">
            <span className={`assessment-icon ${assessment.icon}`}><AssessmentIcon type={assessment.icon} /></span>
            <span className="assessment-question-count">{assessment.questions} câu hỏi</span>
            <h3>{assessment.name}</h3>
          </div>
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
            <td><button className="assessment-row-action" aria-label={`Xem kết quả ${item.assessment} ngày ${item.date}`} onClick={() => handleViewResult(item)}>→</button></td>
          </tr>)}</tbody>
        </table>
        <div className="assessment-table-footer"><button className="btn-outline" onClick={() => setIsHistoryOpen(true)}>Xem tất cả lịch sử</button></div>
      </div>
    </section>

    <aside className="assessment-note"><span>i</span><div><strong>Một lời nhắc nhẹ nhàng</strong><p>Kết quả chỉ mang tính hỗ trợ sàng lọc và không thay thế đánh giá từ chuyên gia sức khỏe tâm thần.</p></div></aside>
  </div>

  <AssessmentHistoryModal 
    isOpen={isHistoryOpen} 
    onClose={() => setIsHistoryOpen(false)}
    onViewResult={handleViewResult}
  />

  <AssessmentResultModal
    isOpen={isResultOpen}
    onClose={() => setIsResultOpen(false)}
    result={selectedResult}
  />

  <AssessmentProgressModal
    isOpen={isProgressOpen}
    onClose={() => setIsProgressOpen(false)}
  />
  </>
}
