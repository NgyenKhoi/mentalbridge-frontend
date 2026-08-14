import Link from 'next/link'

export default function Cta() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="cta reveal">
          <div className="cta-orb o1" aria-hidden="true"></div>
          <div className="cta-orb o2" aria-hidden="true"></div>
          <h2>Bước đầu tiên không cần phải lớn.</h2>
          <p>Chỉ cần vài phút cho một khảo sát ngắn — MentalBridge sẽ đồng hành cùng bạn từ đó.</p>
          <Link href="/assessment/anonymous" className="btn btn-primary">Bắt đầu sàng lọc miễn phí</Link>
        </div>
      </div>
    </section>
  )
}
