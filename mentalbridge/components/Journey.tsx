export default function Journey() {
  return (
    <section className="section" id="journey">
      <div className="wrap">
        <div className="journey reveal">
          <div className="journey-bg-glow"></div>
          <div className="journey-inner">
            <div className="section-head" style={{ marginBottom: '12px' }}>
              <div className="eyebrow">
                Hành trình của bạn trên MentalBridge
              </div>
              <h2>Năm bước, một cây cầu.</h2>
              <p>
                Chọn bài sàng lọc, trả lời theo trải nghiệm gần đây và xem những
                bước hỗ trợ bạn có thể cân nhắc.
              </p>
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
              <div className="journey-line">
                <div className="journey-line-fill" id="journeyFill"></div>
                <span className="journey-traveler" id="journeyTraveler"></span>
              </div>
              <div className="journey-step" data-step="1">
                <div className="journey-dot">1</div>
                <h4>Chọn bài sàng lọc</h4>
                <p>Bắt đầu với PHQ-9 hoặc GAD-7 theo điều bạn muốn nhìn lại.</p>
              </div>
              <div className="journey-step" data-step="2">
                <div className="journey-dot">2</div>
                <h4>Trả lời</h4>
                <p>
                  Bạn chọn đủ chín mức tần suất cho trải nghiệm trong 14 ngày
                  gần đây.
                </p>
              </div>
              <div className="journey-step" data-step="3">
                <div className="journey-dot">3</div>
                <h4>Nhận kết quả</h4>
                <p>
                  Xem điểm và mức sàng lọc dựa trên những câu trả lời bạn đã
                  cung cấp.
                </p>
              </div>
              <div className="journey-step" data-step="4">
                <div className="journey-dot">4</div>
                <h4>Hiểu kết quả</h4>
                <p>
                  Đọc ý nghĩa, giới hạn và thông tin an toàn mà không xem đây là
                  chẩn đoán.
                </p>
              </div>
              <div className="journey-step" data-step="5">
                <div className="journey-dot">5</div>
                <h4>Chọn bước tiếp</h4>
                <p>
                  Xem tài nguyên, gợi ý hỗ trợ hoặc chuyên gia theo lĩnh vực bạn
                  quan tâm.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
