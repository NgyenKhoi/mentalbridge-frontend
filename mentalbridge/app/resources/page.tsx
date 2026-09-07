'use client'

import { useEffect, useState } from 'react'

import type {
  ResourceListResponse,
  ResourceSummary,
} from '@/features/resources/api/content-contract'
import { getReviewedResources } from '@/features/resources/api/browser-resources'

import './resources.css'

const categoryLabels: Record<ResourceSummary['category'], string> = {
  BREATHING: 'Thở',
  MEDITATION: 'Thiền',
  ARTICLE: 'Bài viết',
  VIDEO: 'Video',
  JOURNALING: 'Nhật ký',
  COMMUNITY: 'Cộng đồng',
}

export default function ResourcesPage() {
  const [result, setResult] = useState<ResourceListResponse | null>(null)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      setResult(await getReviewedResources())
    } catch {
      setResult({
        data: [],
        count: 0,
        fallback: 'unavailable',
        message:
          'Tài nguyên hỗ trợ tạm thời không khả dụng. Vui lòng thử lại sau.',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <main className="resources-page">
      <section className="resources-hero">
        <div className="resources-hero-copy">
          <span className="resources-eyebrow">Thư viện tự chăm sóc</span>
          <h1>Tài nguyên đã được rà soát</h1>
          <p>
            Nội dung bên dưới được tải từ Content service. MentalBridge không
            thay thế bằng số liên hệ chưa được phê duyệt, nội dung lâm sàng
            hoặc hướng dẫn chưa được rà soát khi dịch vụ không khả dụng.
          </p>
        </div>
      </section>

      {loading ? (
        <section className="resource-runtime-state" aria-live="polite">
          <h2>Đang tải tài nguyên</h2>
          <p>Đang kiểm tra danh sách nội dung đã được xuất bản.</p>
        </section>
      ) : result?.fallback === 'unavailable' ? (
        <section className="resource-runtime-state" role="alert">
          <h2>Tài nguyên hiện chưa khả dụng</h2>
          <p>{result.message}</p>
          <button type="button" onClick={() => void load()}>
            Thử lại
          </button>
        </section>
      ) : result && result.data.length > 0 ? (
        <section className="resources-grid" aria-label="Danh sách tài nguyên">
          {result.data.map((resource) => (
            <article className="resource-card" key={resource.id}>
              <div className="resource-card-copy">
                <div className="resource-meta">
                  <span>{categoryLabels[resource.category]}</span>
                  <span>Đã rà soát</span>
                </div>
                <h2>{resource.title}</h2>
                <p>{resource.summary}</p>
                <small>
                  Rà soát ngày{' '}
                  {new Date(resource.reviewedAt as string).toLocaleDateString(
                    'vi-VN',
                  )}
                </small>
              </div>
              {resource.externalUrl && (
                <footer>
                  <a
                    href={resource.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Mở tài nguyên <span aria-hidden="true">→</span>
                  </a>
                </footer>
              )}
            </article>
          ))}
        </section>
      ) : (
        <section className="resource-runtime-state">
          <h2>Chưa có tài nguyên đã xuất bản</h2>
          <p>Content service chưa trả về nội dung phù hợp.</p>
        </section>
      )}
    </main>
  )
}
