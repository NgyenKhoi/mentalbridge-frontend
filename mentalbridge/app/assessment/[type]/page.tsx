import Link from 'next/link'
import { notFound } from 'next/navigation'

const assessments = {
  phq9: { name: 'PHQ-9', title: 'Sàng lọc dấu hiệu trầm cảm', count: 9, time: '3–5 phút' },
  gad7: { name: 'GAD-7', title: 'Sàng lọc mức độ lo âu', count: 7, time: '3–5 phút' },
  psqi: { name: 'PSQI', title: 'Đánh giá chất lượng giấc ngủ', count: 19, time: '5–7 phút' },
}

export default async function AssessmentIntro({ params }: PageProps<'/assessment/[type]'>) {
  const { type } = await params
  const assessment = assessments[type as keyof typeof assessments]
  if (!assessment) notFound()
  return <main className="assessment-intro"><div className="assessment-intro-card">
    <Link href="/assessments" className="policy-back">← Tất cả bài đánh giá</Link>
    <span className="risk-tag">{assessment.name}</span>
    <h1>{assessment.title}</h1>
    <p>Bộ câu hỏi giúp bạn nhìn lại trải nghiệm gần đây một cách nhẹ nhàng và có cấu trúc.</p>
    <div className="assessment-facts"><span><strong>{assessment.count}</strong> câu hỏi</span><span><strong>{assessment.time}</strong> dự kiến</span><span><strong>Riêng tư</strong> và bảo mật</span></div>
    <div className="role-disclaimer"><strong>Lưu ý quan trọng</strong><p>Kết quả chỉ mang tính hỗ trợ sàng lọc, không thay thế chẩn đoán hoặc tư vấn từ chuyên gia sức khỏe tâm thần.</p></div>
    <div className="assessment-actions"><Link href="/assessment/anonymous" className="btn btn-primary">Bắt đầu bài đánh giá</Link><Link href="/assessments" className="btn btn-outline">Để sau</Link></div>
  </div></main>
}
