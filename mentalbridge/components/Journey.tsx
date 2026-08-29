export default function Journey() {
  return (
    <section className="section" id="journey">
      <div className="wrap">
        <div className="journey reveal">
          <div className="journey-bg-glow"></div>
          <div className="journey-inner">
            <div className="section-head" style={{marginBottom:'12px'}}>
              <div className="eyebrow">Hành trình của bạn trên MentalBridge</div>
              <h2>Năm bước, một cây cầu.</h2>
              <p>Từ những dòng nhật ký đầu tiên đến sự đồng hành lâu dài, mỗi bước đều được thiết kế nhẹ nhàng, kín đáo và đúng lúc.</p>
            </div>
            <div className="journey-path" id="journeyPath">
              <svg className="journey-arc" viewBox="0 0 1000 70" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0,60 C 250,-10 750,-10 1000,60" stroke="rgba(255,255,255,.16)" strokeWidth="2" fill="none" strokeDasharray="6 10"/>
              </svg>
              <div className="journey-line">
                <div className="journey-line-fill" id="journeyFill"></div>
                <span className="journey-traveler" id="journeyTraveler"></span>
              </div>
              <div className="journey-step" data-step="1">
                <div className="journey-dot">1</div>
                <h4>Ghi nhận</h4>
                <p>Khảo sát PHQ-9, GAD-7 và nhật ký cảm xúc hằng ngày, chỉ mất vài phút.</p>
              </div>
              <div className="journey-step" data-step="2">
                <div className="journey-dot">2</div>
                <h4>Thấu hiểu</h4>
                <p>AI phân tích ngôn ngữ tự nhiên để nhận ra điều bạn thực sự đang cảm thấy.</p>
              </div>
              <div className="journey-step" data-step="3">
                <div className="journey-dot">3</div>
                <h4>Đánh giá</h4>
                <p>Phân loại mức độ: nhẹ, cần chú ý, hay cần hỗ trợ khẩn cấp.</p>
              </div>
              <div className="journey-step" data-step="4">
                <div className="journey-dot">4</div>
                <h4>Hỗ trợ</h4>
                <p>Gợi ý tự chăm sóc, ghép nối chuyên gia phù hợp, hoặc kích hoạt cảnh báo khi cần.</p>
              </div>
              <div className="journey-step" data-step="5">
                <div className="journey-dot">5</div>
                <h4>Đồng hành</h4>
                <p>Theo dõi thay đổi theo thời gian. MentalBridge luôn ở đó, kể cả khi mọi thứ đã ổn.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
