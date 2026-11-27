import Link from 'next/link'

import { MamCharacter } from '@/features/mam/MamCharacter'

const steps = [
  {
    title: 'Hiểu mình trong 5 phút',
    text: 'Hai bài sàng lọc chuẩn PHQ-9 và GAD-7. Mầm giải thích kết quả bằng lời thường.',
  },
  {
    title: 'Chọn điều bạn muốn nhẹ đi',
    text: 'Giấc ngủ, áp lực học hay cô đơn. 14 ngày tới xoay quanh điều đó.',
  },
  {
    title: 'Mỗi ngày một việc nhỏ cùng Mầm',
    text: 'Mầm hỏi lại lời hẹn hôm qua, ở cạnh bạn ngày tệ, không trách khi bạn bỏ lỡ.',
  },
  {
    title: 'Ngày 14, thấy thay đổi của chính bạn',
    text: 'Nhìn lại cho thấy điều gì có vẻ giúp bạn. Cần thêm thì có chuyên gia thật.',
  },
]

export default function Journey() {
  return (
    <section className="section" id="journey">
      <div className="wrap">
        <div className="journey reveal">
          <div className="journey-bg-glow"></div>
          <div className="journey-inner">
            <div className="journey-intro">
              <figure className="journey-mam">
                <MamCharacter size={160} />
                <figcaption>Mầm, người bạn đồng hành</figcaption>
              </figure>
              <div className="section-head" style={{ marginBottom: '12px' }}>
                <div className="eyebrow">
                  Hành trình của bạn trên MentalBridge
                </div>
                <h2>14 ngày cùng Mầm.</h2>
                <p>
                  Khi bạn chưa biết mình đang bị sao và không còn sức tự tìm
                  cách, Mầm đi cùng bạn từng bước: hiểu mình đang ở đâu, mỗi
                  ngày một việc nhỏ, và gặp chuyên gia khi cần.
                </p>
                <Link
                  href="/assessment/anonymous"
                  className="btn btn-primary journey-cta"
                >
                  Bắt đầu 5 phút hiểu mình
                </Link>
              </div>
            </div>
            <div className="journey-path" id="journeyPath">
              <svg
                className="journey-arc"
                viewBox="0 0 1000 70"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path
                  d="M0,60 C 250,-10 750,-10 1000,60"
                  stroke="rgba(255,255,255,.16)"
                  strokeWidth="2"
                  fill="none"
                  strokeDasharray="6 10"
                />
              </svg>
              <div className="journey-line" aria-hidden="true">
                <div className="journey-line-fill" id="journeyFill"></div>
                <span className="journey-traveler" id="journeyTraveler"></span>
              </div>
              <ol className="journey-steps" role="list">
                {steps.map((step, index) => (
                  <li
                    className="journey-step"
                    data-step={index + 1}
                    key={step.title}
                  >
                    <div className="journey-dot" aria-hidden="true">
                      {index + 1}
                    </div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
