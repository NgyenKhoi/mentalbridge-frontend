export default function Features() {
  return (
    <section className="section" id="features">
      <div className="wrap">
        <div className="section-head reveal">
          <div className="eyebrow">Bên trong MentalBridge</div>
          <h2>Mọi công cụ bạn cần, ở một nơi yên tĩnh.</h2>
        </div>
        <div className="feature-grid">
          <div className="feature-card reveal reveal-d1">
            <div className="feature-icon fi-teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5.5C4 4.7 4.7 4 5.5 4H16l4 4v10.5c0 .8-.7 1.5-1.5 1.5h-13A1.5 1.5 0 0 1 4 18.5v-13Z"/>
                <path d="M8 10h8M8 14h5"/>
              </svg>
            </div>
            <h3>Nhật ký cảm xúc</h3>
            <p>Viết ra điều bạn đang trải qua mỗi ngày — riêng tư, không cần chỉnh sửa cho hoàn hảo.</p>
          </div>
          <div className="feature-card reveal reveal-d2">
            <div className="feature-icon fi-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11l2 2 4-4M20 7v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7l4-4h8l4 4Z"/>
              </svg>
            </div>
            <h3>Sàng lọc PHQ-9 / GAD-7</h3>
            <p>Bộ câu hỏi đánh giá trầm cảm và lo âu theo chuẩn lâm sàng, kết quả rõ ràng và dễ hiểu.</p>
          </div>
          <div className="feature-card reveal reveal-d3">
            <div className="feature-icon fi-terra">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h3>Kết nối chuyên gia</h3>
            <p>Được ghép nối với chuyên gia phù hợp dựa trên mức độ, chủ đề và sự đồng cảm.</p>
          </div>
          <div className="feature-card reveal reveal-d4">
            <div className="feature-icon fi-lav">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-8.9 8.4 8.6 8.6 0 0 1-3.1-.6L3 21l1.7-4.9A8.4 8.4 0 1 1 21 11.5Z"/>
              </svg>
            </div>
            <h3>Trò chuyện thời gian thực</h3>
            <p>Nhắn tin trực tiếp với chuyên gia đã được xác nhận, an toàn và bảo mật.</p>
          </div>
          <div className="feature-card reveal reveal-d5">
            <div className="feature-icon fi-teal">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3c3 3 5 6 5 9a5 5 0 0 1-10 0c0-3 2-6 5-9Z"/>
              </svg>
            </div>
            <h3>Tài nguyên tự chăm sóc</h3>
            <p>Bài tập thở, thiền, và nội dung hướng dẫn nhẹ nhàng cho những ngày cần chậm lại.</p>
          </div>
          <div className="feature-card reveal">
            <div className="feature-icon fi-amber">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 17l5-5 4 4 8-9M20 7h-6M20 7v6"/>
              </svg>
            </div>
            <h3>Theo dõi tiến triển</h3>
            <p>Biểu đồ cảm xúc và điểm số theo thời gian, để bạn thấy rõ hành trình của chính mình.</p>
          </div>
        </div>
      </div>
    </section>
  )
}
