import ResourcesList from '@/components/ResourcesList'

import './resources.css'

export default function ResourcesPage() {
  return (
    <main className="resources-page">
      <section className="resources-hero">
        <div className="resources-hero-copy">
          <span className="resources-eyebrow">Thư viện tự chăm sóc</span>
          <h1>Tài nguyên đã được rà soát</h1>
          <p>
            Nội dung được tải qua Content service. Nếu dịch vụ không xác nhận
            được danh mục, MentalBridge hiển thị trạng thái không khả dụng và
            không tạo nội dung thay thế.
          </p>
        </div>
      </section>
      <ResourcesList limit={20} />
    </main>
  )
}
