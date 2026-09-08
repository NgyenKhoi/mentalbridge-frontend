'use client'

import { useMemo, useState, useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminResourcesApi,
  type ResourceSummary,
  type ResourceDetail,
  type ResourceCategory,
} from '../lib/api/admin-resources'

import './admin-content-manager.css'

type ContentItem = ResourceSummary & {
  icon: string
  meta: string
}

const categoryIcons: Record<ResourceCategory, string> = {
  BREATHING: '◌',
  MEDITATION: '◯',
  ARTICLE: '▣',
  VIDEO: '▷',
  JOURNALING: '✎',
  COMMUNITY: '◈',
}

const categoryLabels: Record<ResourceCategory, string> = {
  BREATHING: 'Thở',
  MEDITATION: 'Thiền',
  ARTICLE: 'Bài viết',
  VIDEO: 'Video',
  JOURNALING: 'Nhật ký',
  COMMUNITY: 'Cộng đồng',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Bản nháp',
  PUBLISHED: 'Đã xuất bản',
  ARCHIVED: 'Đã lưu trữ',
}

function formatDate(dateString: string | null): string {
  if (!dateString) return ''
  const date = new Date(dateString)
  return date.toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export default function AdminContentManager({
  onNotice,
}: {
  onNotice: (message: string) => void
}) {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)

  const {
    data: resourcesData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['admin', 'resources'],
    queryFn: () => adminResourcesApi.list(),
  })

  const resources: ContentItem[] = useMemo(() => {
    if (!resourcesData?.data) return []
    return resourcesData.data.map((r) => ({
      ...r,
      icon: categoryIcons[r.category] || '?',
      meta: `${categoryLabels[r.category]} · ${r.locale}`,
    }))
  }, [resourcesData])

  const filtered = useMemo(() => {
    const keyword = query.trim().toLocaleLowerCase('vi')
    return keyword
      ? resources.filter((item) =>
          `${item.title} ${item.meta} ${statusLabels[item.status]}`
            .toLocaleLowerCase('vi')
            .includes(keyword),
        )
      : resources
  }, [query, resources])

  const selectedResource = resources.find((item) => item.id === selectedId)

  useEffect(() => {
    if (resources.length > 0 && !selectedId) {
      setSelectedId(resources[0].id)
    }
  }, [resources, selectedId])

  const { data: detailData } = useQuery({
    queryKey: ['admin', 'resources', selectedId],
    queryFn: () => adminResourcesApi.getById(selectedId!),
    enabled: !!selectedId,
  })

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      version,
      data,
    }: {
      id: string
      version: number
      data: { title?: string; summary?: string }
    }) => adminResourcesApi.update(id, version, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã cập nhật tài nguyên thành công')
    },
    onError: () => {
      onNotice('Không thể cập nhật tài nguyên')
    },
  })

  const publishMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.publish(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã xuất bản tài nguyên thành công')
    },
    onError: () => {
      onNotice('Không thể xuất bản tài nguyên')
    },
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.archive(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      onNotice('Đã lưu trữ tài nguyên thành công')
    },
    onError: () => {
      onNotice('Không thể lưu trữ tài nguyên')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminResourcesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      setSelectedId(null)
      onNotice('Đã xóa tài nguyên thành công')
    },
    onError: () => {
      onNotice('Không thể xóa tài nguyên')
    },
  })

  const handlePublish = () => {
    if (!selectedId || !detailData?.version) return
    publishMutation.mutate({ id: selectedId, version: detailData.version })
  }

  const handleArchive = () => {
    if (!selectedId || !detailData?.version) return
    archiveMutation.mutate({ id: selectedId, version: detailData.version })
  }

  const handleDelete = () => {
    if (!selectedId) return
    if (
      confirm('Bạn có chắc chắn muốn xóa tài nguyên này? Chỉ có thể xóa bản nháp.')
    ) {
      deleteMutation.mutate(selectedId)
    }
  }

  if (isLoading) {
    return (
      <div className="admin-content-manager">
        <div className="role-heading acm-heading">
          <div>
            <span className="eyebrow">Quản trị nền tảng</span>
            <h1>Tài nguyên tự chăm sóc</h1>
            <p>Đang tải...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="admin-content-manager">
        <div className="role-heading acm-heading">
          <div>
            <span className="eyebrow">Quản trị nền tảng</span>
            <h1>Tài nguyên tự chăm sóc</h1>
            <p style={{ color: 'red' }}>Lỗi khi tải dữ liệu</p>
          </div>
        </div>
      </div>
    )
  }

  const publishedCount = resources.filter((r) => r.status === 'PUBLISHED').length
  const draftCount = resources.filter((r) => r.status === 'DRAFT').length
  const archivedCount = resources.filter((r) => r.status === 'ARCHIVED').length

  return (
    <div className="admin-content-manager">
      <div className="role-heading acm-heading">
        <div>
          <span className="eyebrow">Quản trị nền tảng</span>
          <h1>Tài nguyên tự chăm sóc</h1>
          <p>Quản lý nội dung đã được rà soát trước khi công bố.</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          + Thêm tài nguyên
        </button>
      </div>

      <section className="acm-overview" aria-label="Tổng quan nội dung">
        <article className="acm-overview-primary">
          <span>Nội dung đang hiển thị</span>
          <strong>{publishedCount}</strong>
          <p>Tài nguyên đã được công bố</p>
        </article>
        <article>
          <span>Bản nháp</span>
          <strong>{draftCount}</strong>
          <p>Chưa hiển thị với người dùng</p>
        </article>
        <article>
          <span>Đã lưu trữ</span>
          <strong>{archivedCount}</strong>
          <p>Không còn hiển thị</p>
        </article>
        <aside>
          <i aria-hidden="true">✓</i>
          <div>
            <strong>Nội dung đang hoạt động ổn định</strong>
            <small>Chỉ hiển thị phiên bản đã được rà soát</small>
          </div>
        </aside>
      </section>

      <section className="acm-workspace">
        <nav className="acm-tabs" aria-label="Loại nội dung">
          <button className="active">
            <span aria-hidden="true">▣</span>
            <div>
              <strong>Tài nguyên tự chăm sóc</strong>
              <small>Bài tập và nội dung hướng dẫn</small>
            </div>
            <b>{resources.length}</b>
          </button>
        </nav>

        <div className="acm-body">
          <aside className="acm-library">
            <header>
              <div>
                <span>DANH SÁCH</span>
                <h2>Thư viện nội dung</h2>
              </div>
              <b>{filtered.length}</b>
            </header>
            <label className="acm-search">
              <span aria-hidden="true">⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm theo tên hoặc trạng thái..."
              />
            </label>
            <div className="acm-items">
              {filtered.map((item) => (
                <button
                  key={item.id}
                  className={selectedId === item.id ? 'selected' : ''}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="acm-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="acm-item-copy">
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                    <em>
                      {item.id.substring(0, 8)} · Cập nhật{' '}
                      {formatDate(item.updatedAt ?? null)}
                    </em>
                  </span>
                  <span
                    className={`acm-status ${item.status === 'DRAFT' ? 'draft' : ''}`}
                  >
                    <i />
                    {statusLabels[item.status]}
                  </span>
                  <b aria-hidden="true">→</b>
                </button>
              ))}
            </div>
          </aside>

          {selectedResource && detailData && (
            <article className="acm-editor">
              <header>
                <div>
                  <span>CHI TIẾT TÀI NGUYÊN</span>
                  <h2>{selectedResource.title}</h2>
                  <p>
                    {selectedResource.id.substring(0, 8)} · Cập nhật gần nhất{' '}
                    {formatDate(selectedResource.updatedAt ?? null)}
                  </p>
                </div>
                <label className="acm-visibility">
                  <span>
                    <strong>
                      {selectedResource.status === 'PUBLISHED'
                        ? 'Đang hiển thị'
                        : statusLabels[selectedResource.status]}
                    </strong>
                    <small>
                      {selectedResource.status === 'PUBLISHED'
                        ? 'Người dùng có thể truy cập'
                        : 'Không hiển thị với người dùng'}
                    </small>
                  </span>
                </label>
              </header>

              <div className="acm-editor-summary">
                <span>
                  <small>Trạng thái</small>
                  <strong>{statusLabels[selectedResource.status]}</strong>
                </span>
                <span>
                  <small>Danh mục &amp; Ngôn ngữ</small>
                  <strong>{selectedResource.meta}</strong>
                </span>
                <span>
                  <small>Phiên bản</small>
                  <strong>v{detailData.version}</strong>
                </span>
              </div>

              <section className="acm-form">
                <header>
                  <span>01</span>
                  <div>
                    <h3>Thông tin hiển thị</h3>
                    <p>Nội dung người dùng nhìn thấy trên MentalBridge.</p>
                  </div>
                </header>
                <div className="acm-form-grid">
                  <label>
                    <span>Tiêu đề</span>
                    <input
                      defaultValue={selectedResource.title}
                      key={`${selectedResource.id}-title`}
                      disabled={selectedResource.status !== 'DRAFT'}
                    />
                  </label>
                  <label>
                    <span>Danh mục</span>
                    <input
                      value={categoryLabels[selectedResource.category]}
                      disabled
                    />
                  </label>
                  <label className="wide">
                    <span>Mô tả ngắn</span>
                    <textarea
                      defaultValue={selectedResource.summary}
                      key={`${selectedResource.id}-description`}
                      rows={3}
                      disabled={selectedResource.status !== 'DRAFT'}
                    />
                  </label>
                </div>
              </section>

              <section className="acm-safety">
                <header>
                  <span>02</span>
                  <div>
                    <h3>Kiểm tra an toàn</h3>
                    <p>Đảm bảo thông tin phù hợp trước khi công khai.</p>
                  </div>
                </header>
                <div>
                  <p>
                    <i>{selectedResource.reviewedAt ? '✓' : '○'}</i>
                    <span>
                      <strong>
                        {selectedResource.reviewedAt
                          ? 'Đã rà soát chuyên môn'
                          : 'Chưa rà soát'}
                      </strong>
                      <small>
                        {selectedResource.reviewedAt
                          ? `Rà soát lúc ${formatDate(selectedResource.reviewedAt)}`
                          : 'Cần rà soát trước khi xuất bản'}
                      </small>
                    </span>
                  </p>
                </div>
              </section>

              <aside className="acm-note">
                <i aria-hidden="true">i</i>
                <p>
                  <strong>Nội dung tự chăm sóc không thay thế điều trị.</strong>
                  <span>
                    Mọi hướng dẫn cần dùng ngôn ngữ an toàn và tránh đưa ra kết
                    luận lâm sàng.
                  </span>
                </p>
              </aside>
              
              <footer>
                {selectedResource.status === 'DRAFT' && (
                  <>
                    <button onClick={handleDelete} disabled={deleteMutation.isPending}>
                      Xóa bản nháp
                    </button>
                    <button
                      className="acm-save"
                      onClick={handlePublish}
                      disabled={publishMutation.isPending}
                    >
                      Xuất bản
                    </button>
                  </>
                )}
                {selectedResource.status === 'PUBLISHED' && (
                  <button
                    onClick={handleArchive}
                    disabled={archiveMutation.isPending}
                  >
                    Lưu trữ
                  </button>
                )}
                {selectedResource.status === 'ARCHIVED' && (
                  <p>
                    <em>Tài nguyên đã được lưu trữ và không thể chỉnh sửa</em>
                  </p>
                )}
              </footer>
            </article>
          )}
        </div>
      </section>
    </div>
  )
}
