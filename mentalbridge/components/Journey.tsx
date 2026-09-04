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
                Luồng PHQ-9 đi từ nội dung đã công bố đến kết quả do Care
                service tính, không chèn dữ liệu mẫu thay thế.
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
                <h4>Tải phiên bản</h4>
                <p>
                  Ứng dụng lấy bộ câu hỏi PHQ-9 tiếng Việt đang được Care công
                  bố.
                </p>
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
                <h4>Care tính điểm</h4>
                <p>
                  Trình duyệt chỉ gửi mã câu hỏi và lựa chọn; Care sở hữu cách
                  tính điểm.
                </p>
              </div>
              <div className="journey-step" data-step="4">
                <div className="journey-dot">4</div>
                <h4>Xem kết quả</h4>
                <p>
                  Dải triệu chứng và trạng thái mục 9 được hiển thị độc lập, kèm
                  giới hạn sử dụng.
                </p>
              </div>
              <div className="journey-step" data-step="5">
                <div className="journey-dot">5</div>
                <h4>Chọn bước tiếp</h4>
                <p>
                  Tính năng chưa có policy hoặc contract sẽ được ghi rõ là chưa
                  khả dụng.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
