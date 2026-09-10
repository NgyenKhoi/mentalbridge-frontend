'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  adminResourcesApi,
  type ResourceDetail,
  type ResourceSummary,
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

// Tách phần edit ra component riêng để dùng key reset state đúng cách
function ResourceEditor({
  resource,
  detail,
  onPublish,
  onArchive,
  onDelete,
  onUpdate,
  publishPending,
  archivePending,
  deletePending,
  updatePending,
}: {
  resource: ContentItem
  detail: ResourceDetail
  onPublish: () => void
  onArchive: () => void
  onDelete: () => void
  onUpdate: (title: string, summary: string) => void
  publishPending: boolean
  archivePending: boolean
  deletePending: boolean
  updatePending: boolean
}) {
  // State khởi tạo từ server data - hợp lệ vì dùng key để reset
  const [editTitle, setEditTitle] = useState(detail.title)
  const [editSummary, setEditSummary] = useState(detail.summary)

  const hasEdits = editTitle !== detail.title || editSummary !== detail.summary

  return (
    <article className="acm-editor">
      <header>
        <div>
          <span>CHI TIẾT TÀI NGUYÊN</span>
          <h2>{resource.title}</h2>
          <p>
            {resource.id.substring(0, 8)} · Cập nhật gần nhất{' '}
            {formatDate(resource.updatedAt ?? null)}
          </p>
        </div>
        <label className="acm-visibility">
          <span>
            <strong>
              {resource.status === 'PUBLISHED' ? 'Đang hiển thị' : statusLabels[resource.status]}
            </strong>
            <small>
              {resource.status === 'PUBLISHED'
                ? 'Người dùng có thể truy cập'
                : 'Không hiển thị với người dùng'}
            </small>
          </span>
        </label>
      </header>

      <div className="acm-editor-summary">
        <span>
          <small>Trạng thái</small>
          <strong>{statusLabels[resource.status]}</strong>
        </span>
        <span>
          <small>Danh mục &amp; Ngôn ngữ</small>
          <strong>{resource.meta}</strong>
        </span>
        <span>
          <small>Phiên bản</small>
          <strong>v{detail.version}</strong>
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
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              disabled={resource.status !== 'DRAFT'}
            />
          </label>
          <label>
            <span>Danh mục</span>
            <input value={categoryLabels[resource.category]} disabled />
          </label>
          <label className="wide">
            <span>Mô tả ngắn</span>
            <textarea
              value={editSummary}
              onChange={(e) => setEditSummary(e.target.value)}
              rows={3}
              disabled={resource.status !== 'DRAFT'}
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
            <i>{resource.reviewedAt ? '✓' : '○'}</i>
            <span>
              <strong>
                {resource.reviewedAt ? 'Đã rà soát chuyên môn' : 'Chưa rà soát'}
              </strong>
              <small>
                {resource.reviewedAt
                  ? `Rà soát lúc ${formatDate(resource.reviewedAt)}`
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
            Mọi hướng dẫn cần dùng ngôn ngữ an toàn và tránh đưa ra kết luận lâm sàng.
          </span>
        </p>
      </aside>

      <footer>
        {resource.status === 'DRAFT' && (
          <>
            <button onClick={onDelete} disabled={deletePending}>
              Xóa bản nháp
            </button>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              {hasEdits && (
                <button onClick={() => onUpdate(editTitle, editSummary)} disabled={updatePending}>
                  {updatePending ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              )}
              <button className="acm-save" onClick={onPublish} disabled={publishPending}>
                Xuất bản
              </button>
            </div>
          </>
        )}
        {resource.status === 'PUBLISHED' && (
          <button onClick={onArchive} disabled={archivePending}>
            Lưu trữ
          </button>
        )}
        {resource.status === 'ARCHIVED' && (
          <p>
            <em>Tài nguyên đã được lưu trữ và không thể chỉnh sửa</em>
          </p>
        )}
      </footer>
    </article>
  )
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

  // Auto-select first resource nếu chưa có selection
  const activeId = selectedId || resources[0]?.id || null

  const selectedResource = useMemo(
    () => resources.find((item) => item.id === activeId),
    [resources, activeId],
  )

  const { data: detailData } = useQuery({
    queryKey: ['admin', 'resources', activeId],
    queryFn: () => adminResourcesApi.getById(activeId!),
    enabled: !!activeId,
  })

  const publishMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.publish(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', activeId] })
      onNotice('Đã xuất bản tài nguyên thành công')
    },
    onError: () => onNotice('Không thể xuất bản tài nguyên'),
  })

  const archiveMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.archive(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', activeId] })
      onNotice('Đã lưu trữ tài nguyên thành công')
    },
    onError: () => onNotice('Không thể lưu trữ tài nguyên'),
  })

  const deleteMutation = useMutation({
    mutationFn: ({ id, version }: { id: string; version: number }) =>
      adminResourcesApi.delete(id, version),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      setSelectedId(null)
      onNotice('Đã xóa tài nguyên thành công')
    },
    onError: () => onNotice('Không thể xóa tài nguyên'),
  })

  const createMutation = useMutation({
    mutationFn: (data: {
      category: ResourceCategory
      title: string
      summary: string
      contentBody?: string
      externalUrl?: string
    }) => adminResourcesApi.create(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources'] })
      setShowCreateForm(false)
      setSelectedId(data.id)
      onNotice('Đã tạo tài nguyên mới thành công')
    },
    onError: () => onNotice('Không thể tạo tài nguyên mới'),
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
      queryClient.invalidateQueries({ queryKey: ['admin', 'resources', activeId] })
      onNotice('Đã cập nhật tài nguyên thành công')
    },
    onError: () => onNotice('Không thể cập nhật tài nguyên'),
  })

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const category = formData.get('category') as ResourceCategory
    const title = formData.get('title') as string
    const summary = formData.get('summary') as string
    const contentBody = formData.get('contentBody') as string
    const externalUrl = formData.get('externalUrl') as string

    if (!category || !title || !summary) {
      onNotice('Vui lòng điền đầy đủ thông tin bắt buộc')
      return
    }

    createMutation.mutate({
      category,
      title,
      summary,
      contentBody: contentBody || undefined,
      externalUrl: externalUrl || undefined,
    })
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
      {showCreateForm && (
        <div className="acm-modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="acm-modal-content" onClick={(e) => e.stopPropagation()}>
            <header>
              <h2>Tạo tài nguyên mới</h2>
              <button onClick={() => setShowCreateForm(false)} aria-label="Đóng">
                ✕
              </button>
            </header>
            <form onSubmit={handleCreateSubmit}>
              <label>
                <span>
                  Danh mục <em>*</em>
                </span>
                <select name="category" required>
                  <option value="">-- Chọn danh mục --</option>
                  <option value="BREATHING">Thở</option>
                  <option value="MEDITATION">Thiền</option>
                  <option value="ARTICLE">Bài viết</option>
                  <option value="VIDEO">Video</option>
                  <option value="JOURNALING">Nhật ký</option>
                  <option value="COMMUNITY">Cộng đồng</option>
                </select>
              </label>
              <label>
                <span>
                  Tiêu đề <em>*</em>
                </span>
                <input
                  name="title"
                  type="text"
                  maxLength={255}
                  required
                  placeholder="Nhập tiêu đề tài nguyên"
                />
              </label>
              <label>
                <span>
                  Mô tả ngắn <em>*</em>
                </span>
                <textarea
                  name="summary"
                  rows={3}
                  required
                  placeholder="Mô tả ngắn gọn về nội dung"
                />
              </label>
              <label>
                <span>Nội dung chi tiết</span>
                <textarea
                  name="contentBody"
                  rows={5}
                  placeholder="Nội dung đầy đủ (hoặc để trống nếu dùng liên kết bên ngoài)"
                />
              </label>
              <label>
                <span>Liên kết bên ngoài</span>
                <input name="externalUrl" type="url" placeholder="https://..." />
              </label>
              <footer>
                <button type="button" onClick={() => setShowCreateForm(false)}>
                  Hủy
                </button>
                <button type="submit" className="btn-primary" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Đang tạo...' : 'Tạo bản nháp'}
                </button>
              </footer>
            </form>
          </div>
        </div>
      )}

      <div className="role-heading acm-heading">
        <div>
          <span className="eyebrow">Quản trị nền tảng</span>
          <h1>Tài nguyên tự chăm sóc</h1>
          <p>Quản lý nội dung đã được rà soát trước khi công bố.</p>
        </div>
        <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
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
                  className={activeId === item.id ? 'selected' : ''}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="acm-item-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  <span className="acm-item-copy">
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                    <em>
                      {item.id.substring(0, 8)} · Cập nhật {formatDate(item.updatedAt ?? null)}
                    </em>
                  </span>
                  <span className={`acm-status ${item.status === 'DRAFT' ? 'draft' : ''}`}>
                    <i />
                    {statusLabels[item.status]}
                  </span>
                  <b aria-hidden="true">→</b>
                </button>
              ))}
            </div>
          </aside>

          {selectedResource && detailData && typeof detailData.version === 'number' && (
            // key = detail.id đảm bảo ResourceEditor reset state khi chuyển resource
            <ResourceEditor
              key={detailData.id}
              resource={selectedResource}
              detail={detailData}
              onPublish={() =>
                publishMutation.mutate({ id: selectedResource.id, version: detailData.version as number })
              }
              onArchive={() =>
                archiveMutation.mutate({ id: selectedResource.id, version: detailData.version as number })
              }
              onDelete={() => {
                if (confirm('Bạn có chắc chắn muốn xóa tài nguyên này? Chỉ có thể xóa bản nháp.')) {
                  deleteMutation.mutate({ id: selectedResource.id, version: detailData.version as number })
                }
              }}
              onUpdate={(title, summary) =>
                updateMutation.mutate({
                  id: selectedResource.id,
                  version: detailData.version as number,
                  data: { title, summary },
                })
              }
              publishPending={publishMutation.isPending}
              archivePending={archiveMutation.isPending}
              deletePending={deleteMutation.isPending}
              updatePending={updateMutation.isPending}
            />
          )}
        </div>
      </section>
    </div>
  )
}
