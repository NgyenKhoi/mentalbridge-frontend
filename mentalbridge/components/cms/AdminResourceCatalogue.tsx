'use client'

import Image from 'next/image'
import {
  Archive,
  ArrowRight,
  CircleCheck,
  Clock,
  Download,
  LayoutGrid,
  List,
  PencilLine,
  Plus,
  RefreshCw,
  Search,
} from 'lucide-react'

import { resourceArtwork } from '@/features/resources/model/resource-artwork'
import type {
  ResourceCategory,
  ResourceSummary,
} from '@/lib/api/admin-resources'

const categories = {
  JOURNALING: 'Nhật ký',
  MEDITATION: 'Thiền định',
  ARTICLE: 'Bài viết',
  VIDEO: 'Video hướng dẫn',
  COMMUNITY: 'Cộng đồng',
  BREATHING: 'Bài tập thở',
} satisfies Record<ResourceCategory, string>

const statuses = {
  PUBLISHED: 'Đã xuất bản',
  DRAFT: 'Bản nháp',
  ARCHIVED: 'Đã lưu trữ',
} satisfies Record<ResourceSummary['status'], string>

export type CatalogueView = {
  category: ResourceCategory | 'ALL'
  query: string
  sort: 'recent' | 'oldest' | 'title'
  layout: 'grid' | 'table'
}

export const defaultCatalogueView: CatalogueView = {
  category: 'ALL',
  query: '',
  sort: 'recent',
  layout: 'grid',
}

const dateFormatter = new Intl.DateTimeFormat('vi-VN', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Asia/Ho_Chi_Minh',
})

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : '—'
}

function searchText(value: string) {
  return value
    .toLocaleLowerCase('vi')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replaceAll('đ', 'd')
}

function exportCsv(resources: ResourceSummary[]) {
  const rows = [
    [
      'ID',
      'Tên tài nguyên',
      'Danh mục',
      'Trạng thái',
      'Ngôn ngữ',
      'Thời lượng (phút)',
      'Ngày cập nhật',
    ],
    ...resources.map((item) => [
      item.id,
      item.title,
      categories[item.category],
      statuses[item.status],
      item.locale,
      String(item.expectedDurationMinutes),
      formatDate(item.updatedAt ?? item.createdAt),
    ]),
  ]
  const csv = rows
    .map((row) =>
      row
        .map((value) => {
          const safe = /^[\s]*[=+@-]|^[\t\r\n]/.test(value)
            ? `'${value}`
            : value
          return `"${safe.replaceAll('"', '""')}"`
        })
        .join(','),
    )
    .join('\r\n')
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }),
  )
  const link = document.createElement('a')
  link.href = url
  link.download = 'tai-nguyen-tu-cham-soc.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function ResourceStatus({ status }: { status: ResourceSummary['status'] }) {
  return (
    <span className={`acm-badge acm-status-${status.toLowerCase()}`}>
      {statuses[status]}
    </span>
  )
}

function ResourceCard({
  resource,
  onOpen,
}: {
  resource: ResourceSummary
  onOpen: () => void
}) {
  const artwork =
    resource.category === 'JOURNALING'
      ? { src: '/images/emotional-journal.png', position: 'center' }
      : resourceArtwork(resource)

  return (
    <li>
      <article className="acm-card">
        <div className="acm-cover">
          <Image
            src={artwork.src}
            alt=""
            fill
            sizes="(max-width: 640px) 85vw, (max-width: 1200px) 42vw, 26vw"
            style={{ objectPosition: artwork.position }}
          />
          <div className="acm-cover-badges">
            <span
              className={`acm-badge acm-category-${resource.category.toLowerCase()}`}
            >
              {categories[resource.category]}
            </span>
            <ResourceStatus status={resource.status} />
          </div>
          {resource.expectedDurationMinutes > 0 && (
            <span className="acm-duration">
              <Clock size={14} /> {resource.expectedDurationMinutes} phút
            </span>
          )}
        </div>
        <div className="acm-card-body">
          <div className="acm-card-meta">
            <span title={resource.id}>
              {resource.id.slice(-8).toUpperCase()}
            </span>
            <span>{resource.locale}</span>
          </div>
          <h3>
            <button type="button" className="acm-card-open" onClick={onOpen}>
              {resource.title}
            </button>
          </h3>
          <p>{resource.summary}</p>
          <footer className="acm-card-footer">
            <span>
              <small>Cập nhật</small>
              {formatDate(resource.updatedAt ?? resource.createdAt)}
            </span>
            <span aria-hidden="true">
              <PencilLine size={16} />
              <ArrowRight size={18} />
            </span>
          </footer>
        </div>
      </article>
    </li>
  )
}

export default function AdminResourceCatalogue({
  resources,
  view,
  onViewChange,
  onOpen,
  onCreate,
  onRefresh,
  loading,
  refreshing,
  error,
}: {
  resources: ResourceSummary[]
  view: CatalogueView
  onViewChange: (view: CatalogueView) => void
  onOpen: (id: string) => void
  onCreate: () => void
  onRefresh: () => void
  loading: boolean
  refreshing: boolean
  error: boolean
}) {
  const categoryCounts = new Map<ResourceCategory, number>()
  const counts = { PUBLISHED: 0, DRAFT: 0, ARCHIVED: 0 }
  let reviewedPublished = 0
  for (const resource of resources) {
    categoryCounts.set(
      resource.category,
      (categoryCounts.get(resource.category) ?? 0) + 1,
    )
    counts[resource.status]++
    if (resource.status === 'PUBLISHED' && resource.reviewedAt)
      reviewedPublished++
  }
  const keyword = searchText(view.query.trim())
  const filtered = resources.filter(
    (item) =>
      (view.category === 'ALL' || item.category === view.category) &&
      (!keyword ||
        searchText(
          `${item.title} ${item.id} ${statuses[item.status]}`,
        ).includes(keyword)),
  )
  filtered.sort((a, b) => {
    if (view.sort === 'title') return a.title.localeCompare(b.title, 'vi')
    const difference =
      Date.parse(b.updatedAt ?? b.createdAt) -
      Date.parse(a.updatedAt ?? a.createdAt)
    return view.sort === 'recent' ? difference : -difference
  })
  const showCounts = !loading && (!error || resources.length > 0)
  const visibleCategories = (
    Object.keys(categories) as ResourceCategory[]
  ).filter((category) => categoryCounts.has(category))

  return (
    <div className="admin-content-manager acm-catalogue">
      <header className="acm-heading">
        <div>
          <span className="acm-kicker">Quản trị nền tảng</span>
          <h1>Tài nguyên tự chăm sóc</h1>
          <p>
            Quản lý bản nháp, duyệt nội dung và công bố học liệu tự chăm sóc.
          </p>
        </div>
        <div className="acm-actions">
          <button
            type="button"
            className="acm-button"
            disabled={!filtered.length}
            onClick={() => exportCsv(filtered)}
          >
            <Download size={17} /> Xuất dữ liệu
          </button>
          <button
            type="button"
            className="acm-button acm-button-primary"
            onClick={onCreate}
          >
            <Plus size={18} /> Thêm tài nguyên mới
          </button>
        </div>
      </header>

      <section className="acm-overview" aria-label="Tổng quan học liệu">
        <article className="acm-stat acm-stat-primary">
          <div className="acm-stat-top">
            <span>Nội dung đang hiển thị</span>
            <small>Đang hoạt động</small>
          </div>
          <div className="acm-stat-value">
            <strong>{showCounts ? counts.PUBLISHED : '—'}</strong>
            <span>học liệu</span>
          </div>
          <footer>
            <CircleCheck size={16} /> Đã công bố cho người dùng
          </footer>
        </article>
        <article className="acm-stat">
          <div className="acm-stat-top">
            <span>Bản nháp</span>
            <i className="acm-stat-icon acm-stat-draft">
              <PencilLine size={18} />
            </i>
          </div>
          <div className="acm-stat-value">
            <strong>{showCounts ? counts.DRAFT : '—'}</strong>
            <span>chưa công bố</span>
          </div>
          <footer>
            Chưa hiển thị với người dùng
          </footer>
        </article>
        <article className="acm-stat">
          <div className="acm-stat-top">
            <span>Đã lưu trữ / Tạm ẩn</span>
            <i className="acm-stat-icon">
              <Archive size={18} />
            </i>
          </div>
          <div className="acm-stat-value">
            <strong>{showCounts ? counts.ARCHIVED : '—'}</strong>
            <span>mục lưu trữ</span>
          </div>
          <footer>Không còn hiển thị trên ứng dụng</footer>
        </article>
        <article className="acm-stat acm-stat-quality">
          <div className="acm-stat-top">
            <span>Kiểm định chất lượng</span>
            <i className="acm-stat-icon">
              <CircleCheck size={18} />
            </i>
          </div>
          <div>
            <strong>Rà soát nội dung</strong>
            <p>Kiểm tra nguồn và nội dung trước khi công bố học liệu.</p>
          </div>
          <footer>
            <CircleCheck size={16} />{' '}
            {showCounts
              ? `${reviewedPublished}/${counts.PUBLISHED} mục đã công bố có ghi nhận rà soát`
              : 'Đang tải trạng thái rà soát'}
          </footer>
        </article>
      </section>

      <section className="acm-library" aria-labelledby="resource-library-title">
        <header className="acm-library-header">
          <div>
            <div className="acm-library-kicker">
              <span className="acm-kicker">Danh sách học liệu</span>
              {showCounts && (
                <span className="acm-count">{filtered.length} mục</span>
              )}
            </div>
            <h2 id="resource-library-title">Thư viện nội dung tự chăm sóc</h2>
          </div>
          <div className="acm-actions">
            <div
              className="acm-view-toggle"
              role="group"
              aria-label="Kiểu hiển thị"
            >
              <button
                type="button"
                aria-pressed={view.layout === 'table'}
                onClick={() => onViewChange({ ...view, layout: 'table' })}
              >
                <List size={16} /> Bảng
              </button>
              <button
                type="button"
                aria-pressed={view.layout === 'grid'}
                onClick={() => onViewChange({ ...view, layout: 'grid' })}
              >
                <LayoutGrid size={15} /> Lưới
              </button>
            </div>
            <button
              type="button"
              className="acm-button acm-button-small"
              disabled={refreshing}
              onClick={onRefresh}
            >
              <RefreshCw size={14} /> {refreshing ? 'Đang tải…' : 'Làm mới'}
            </button>
          </div>
        </header>

        <div className="acm-controls">
          <div
            className="acm-filters"
            role="group"
            aria-label="Lọc theo danh mục"
          >
            <button
              type="button"
              aria-pressed={view.category === 'ALL'}
              onClick={() => onViewChange({ ...view, category: 'ALL' })}
            >
              Tất cả {showCounts && `(${resources.length})`}
            </button>
            {visibleCategories.map((category) => (
              <button
                key={category}
                type="button"
                aria-pressed={view.category === category}
                onClick={() => onViewChange({ ...view, category })}
              >
                {categories[category]} ({categoryCounts.get(category)})
              </button>
            ))}
          </div>
          <div className="acm-find">
            <label className="acm-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                value={view.query}
                onChange={(event) =>
                  onViewChange({ ...view, query: event.target.value })
                }
                aria-label="Tìm tài nguyên theo tên hoặc ID"
                placeholder="Tìm theo tên bài hoặc ID…"
              />
            </label>
            <select
              aria-label="Sắp xếp học liệu"
              value={view.sort}
              onChange={(event) =>
                onViewChange({
                  ...view,
                  sort: event.target.value as CatalogueView['sort'],
                })
              }
            >
              <option value="recent">Mới cập nhật nhất</option>
              <option value="oldest">Cũ nhất</option>
              <option value="title">Tên A–Z</option>
            </select>
          </div>
        </div>

        {error && (
          <p role="alert" className="acm-message">
            Không thể tải danh sách học liệu. Chọn Làm mới để thử lại.
          </p>
        )}
        {loading ? (
          <p role="status" className="acm-message">
            Đang tải học liệu…
          </p>
        ) : filtered.length ? (
          view.layout === 'grid' ? (
            <ul className="acm-grid">
              {filtered.map((resource) => (
                <ResourceCard
                  key={resource.id}
                  resource={resource}
                  onOpen={() => onOpen(resource.id)}
                />
              ))}
            </ul>
          ) : (
            <div
              className="acm-table-wrap"
              tabIndex={0}
              role="region"
              aria-label="Bảng học liệu"
            >
              <table className="acm-table">
                <thead>
                  <tr>
                    <th scope="col">Tên học liệu</th>
                    <th scope="col">Danh mục</th>
                    <th scope="col">Ngôn ngữ</th>
                    <th scope="col">Trạng thái</th>
                    <th scope="col">Cập nhật</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((resource) => (
                    <tr key={resource.id}>
                      <td>
                        <button
                          type="button"
                          onClick={() => onOpen(resource.id)}
                        >
                          {resource.title} <ArrowRight size={15} />
                        </button>
                      </td>
                      <td>{categories[resource.category]}</td>
                      <td>{resource.locale}</td>
                      <td>
                        <ResourceStatus status={resource.status} />
                      </td>
                      <td>
                        {formatDate(resource.updatedAt ?? resource.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          !error && (
            <p className="acm-message">
              {resources.length
                ? 'Không tìm thấy học liệu phù hợp.'
                : 'Chưa có học liệu. Thêm tài nguyên mới để bắt đầu.'}
            </p>
          )
        )}
      </section>
    </div>
  )
}
