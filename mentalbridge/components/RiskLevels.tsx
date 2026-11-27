import TiltCard from '@/components/motion/TiltCard'

export default function RiskLevels() {
  return (
    <section className="section" id="risk">
      <div className="wrap">
        <div className="section-head reveal">
          <div className="eyebrow">Đọc kết quả đúng phạm vi</div>
          <h2>Ba điều cần biết sau khi hoàn thành PHQ-9.</h2>
        </div>
        <div className="risk-grid">
          <TiltCard
            wrapperClassName="motion-tilt-shell risk-tilt reveal reveal-d1"
            dataGroup="risk"
            className="risk-card low"
          >
            <span className="risk-tag">Điểm số</span>
            <h3>Sàng lọc triệu chứng</h3>
            <p>
              Chín câu trả lời được cộng lại và đối chiếu với dải điểm của
              PHQ-9.
            </p>
            <ul>
              <li>Khoảng điểm từ 0 đến 27</li>
              <li>Kết quả được xác nhận trước khi hiển thị</li>
            </ul>
          </TiltCard>
          <TiltCard
            wrapperClassName="motion-tilt-shell risk-tilt risk-tilt--offset reveal reveal-d2"
            dataGroup="risk"
            className="risk-card mid"
          >
            <span className="risk-tag">Mục an toàn</span>
            <h3>Độc lập với tổng điểm</h3>
            <p>
              Câu trả lời ở mục 9 được xem xét riêng và không tự thay đổi dải
              tổng điểm PHQ-9.
            </p>
            <ul>
              <li>Không suy diễn ý định hoặc mức khẩn cấp</li>
              <li>Không tự động liên hệ bên thứ ba</li>
              <li>Cách đánh giá được lưu cùng kết quả</li>
            </ul>
          </TiltCard>
          <TiltCard
            wrapperClassName="motion-tilt-shell risk-tilt reveal reveal-d3"
            dataGroup="risk"
            className="risk-card high"
          >
            <span className="risk-tag">Giới hạn</span>
            <h3>Hiển thị trung thực</h3>
            <p>
              Tính năng hỗ trợ chưa sẵn sàng sẽ được ghi rõ là chưa khả dụng.
            </p>
            <ul>
              <li>Không bịa khuyến nghị hoặc tài nguyên</li>
              <li>Không hứa ứng cứu hay giám sát 24/7</li>
              <li>Không khóa kết quả sau gói trả phí</li>
            </ul>
          </TiltCard>
        </div>
      </div>
    </section>
  )
}
