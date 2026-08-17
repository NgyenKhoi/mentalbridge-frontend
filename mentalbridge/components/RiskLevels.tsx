export default function RiskLevels() {
  return (
    <section className="section" id="risk">
      <div className="wrap">
        <div className="section-head reveal">
          <div className="eyebrow">Không có một câu trả lời chung</div>
          <h2>Mức hỗ trợ luôn tương xứng với điều bạn đang trải qua.</h2>
        </div>
        <div className="risk-grid">
          <div className="risk-card low reveal reveal-d1">
            <span className="risk-tag">Mức nhẹ</span>
            <h3>Tự chăm sóc</h3>
            <p>Cảm xúc tiêu cực ngắn hạn, chưa có dấu hiệu nghiêm trọng — như áp lực công việc hay mất động lực tạm thời.</p>
            <ul>
              <li>Bài tập thở & thiền hướng dẫn</li>
              <li>Nhật ký cảm xúc định kỳ</li>
              <li>Theo dõi mood trend nhẹ nhàng</li>
            </ul>
          </div>
          <div className="risk-card mid reveal reveal-d2">
            <span className="risk-tag">Cần chú ý</span>
            <h3>Ghép chuyên gia</h3>
            <p>Dấu hiệu lo âu hoặc trầm cảm kéo dài, giảm tương tác xã hội, tâm trạng tiêu cực thường xuyên hơn.</p>
            <ul>
              <li>Ghép nối chuyên gia phù hợp</li>
              <li>Hỗ trợ từ cộng đồng đồng cảm</li>
              <li>Theo dõi sát hơn theo tuần</li>
            </ul>
          </div>
          <div className="risk-card high reveal reveal-d3">
            <span className="risk-tag">Khẩn cấp</span>
            <h3>Cảnh báo & ưu tiên</h3>
            <p>Khi hệ thống nhận thấy dấu hiệu nguy cơ cao, MentalBridge phản hồi ngay lập tức và ưu tiên tuyệt đối.</p>
            <ul>
              <li>Thông báo khẩn đến người hỗ trợ</li>
              <li>Kết nối đường dây nóng ngay</li>
              <li>Ưu tiên xử lý & theo dõi liên tục</li>
            </ul>
          </div>
        </div>
      </div>
    </section>
  )
}
