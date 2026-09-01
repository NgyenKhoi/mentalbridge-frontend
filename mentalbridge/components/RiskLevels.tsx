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
          <TiltCard wrapperClassName="motion-tilt-shell risk-tilt reveal reveal-d1" dataGroup="risk" className="risk-card low">
            <span className="risk-tag">Điểm số</span>
            <h3>Sàng lọc triệu chứng</h3>
            <p>Care cộng chín câu trả lời và đối chiếu dải điểm theo đúng phiên bản bộ câu hỏi.</p>
            <ul>
              <li>Khoảng điểm từ 0 đến 27</li>
              <li>Không nhận điểm do trình duyệt tự tính</li>
              <li>Không phải chẩn đoán y khoa</li>
            </ul>
          </TiltCard>
          <TiltCard wrapperClassName="motion-tilt-shell risk-tilt risk-tilt--offset reveal reveal-d2" dataGroup="risk" className="risk-card mid">
            <span className="risk-tag">Mục an toàn</span>
            <h3>Độc lập với tổng điểm</h3>
            <p>Câu 9 được Care đánh giá bằng một trạng thái riêng và không tự nâng dải điểm PHQ-9.</p>
            <ul>
              <li>Không suy diễn ý định hoặc mức khẩn cấp</li>
              <li>Không tự động liên hệ bên thứ ba</li>
              <li>Lưu cùng phiên bản policy đã dùng</li>
            </ul>
          </TiltCard>
          <TiltCard wrapperClassName="motion-tilt-shell risk-tilt reveal reveal-d3" dataGroup="risk" className="risk-card high">
            <span className="risk-tag">Giới hạn</span>
            <h3>Hiển thị trung thực</h3>
            <p>Nội dung hỗ trợ chưa có contract đã duyệt sẽ được ghi rõ là chưa khả dụng.</p>
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
