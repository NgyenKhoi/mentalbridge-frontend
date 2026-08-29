import BarrierIllustration from '@/components/BarrierIllustration'
import TiltCard from '@/components/motion/TiltCard'

export default function Barriers() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="section-head reveal">
          <div className="eyebrow">Vì sao chúng tôi tồn tại</div>
          <h2>Rào cản lớn nhất không phải là bệnh, mà là bước đầu tiên.</h2>
          <p>Rất nhiều người mang theo lo âu, mất ngủ, mệt mỏi kéo dài nhưng chưa từng đi tìm hỗ trợ. Không phải vì họ không cần, mà vì con đường đến đó chưa từng rõ ràng.</p>
        </div>
        <div className="barrier-grid">
          <TiltCard wrapperClassName="motion-tilt-shell barrier-tilt barrier-tilt--primary reveal reveal-d1" dataGroup="barrier" className="barrier-card">
            <BarrierIllustration variant="mind" />
            <span className="barrier-num">Tâm lý</span>
            <h3>Ngại thừa nhận</h3>
            <p>Nỗi sợ bị đánh giá khiến nhiều người giữ im lặng, ngay cả với người thân của mình.</p>
          </TiltCard>
          <TiltCard wrapperClassName="motion-tilt-shell barrier-tilt reveal reveal-d2" dataGroup="barrier" className="barrier-card">
            <BarrierIllustration variant="awareness" />
            <span className="barrier-num">Nhận thức</span>
            <h3>Không gọi tên được cảm xúc</h3>
            <p>Mệt mỏi, lo âu, mất ngủ, nhưng không chắc đó là dấu hiệu của điều gì đang cần chú ý.</p>
          </TiltCard>
          <TiltCard wrapperClassName="motion-tilt-shell barrier-tilt reveal reveal-d3" dataGroup="barrier" className="barrier-card">
            <BarrierIllustration variant="access" />
            <span className="barrier-num">Tiếp cận</span>
            <h3>Không biết bắt đầu từ đâu</h3>
            <p>Tìm ai, đặt lịch thế nào, mức độ của mình có &quot;đủ nghiêm trọng&quot; để tìm chuyên gia hay chưa.</p>
          </TiltCard>
        </div>
      </div>
    </section>
  )
}
