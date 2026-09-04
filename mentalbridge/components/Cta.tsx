import Link from 'next/link'
import MagneticButton from '@/components/motion/MagneticButton'

export default function Cta() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="cta reveal">
          <div className="cta-orb o1" aria-hidden="true"></div>
          <div className="cta-orb o2" aria-hidden="true"></div>
          <h2>Bước đầu tiên không cần phải lớn.</h2>
          <p>
            Chỉ cần vài phút cho một khảo sát ngắn. MentalBridge sẽ đồng hành
            cùng bạn từ đó.
          </p>
          <MagneticButton>
            <Link
              href="/assessment/anonymous"
              className="btn btn-primary"
              data-cursor="action"
            >
              Bắt đầu sàng lọc miễn phí
            </Link>
          </MagneticButton>
        </div>
      </div>
    </section>
  )
}
