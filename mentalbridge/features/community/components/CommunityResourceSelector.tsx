'use client'

import { useCallback, useEffect, useState } from 'react'

import {
  getResourceCatalogue,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'

export default function CommunityResourceSelector({
  value,
  onChange,
  disabled = false,
}: Readonly<{
  value: string | null
  onChange: (resourceId: string | null) => void
  disabled?: boolean
}>) {
  const [generation, setGeneration] = useState(0)
  const [result, setResult] = useState<{
    key: number
    state: 'loaded' | 'failed'
    items: PublicResourceSummary[]
  }>()
  const retry = useCallback(() => setGeneration((current) => current + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    void getResourceCatalogue(controller.signal, 'vi-VN')
      .then((catalogue) =>
        setResult({ key: generation, state: 'loaded', items: catalogue.items }),
      )
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setResult({ key: generation, state: 'failed', items: [] })
        }
      })
    return () => controller.abort()
  }, [generation])

  const current = result?.key === generation ? result : undefined
  const items = current?.items ?? []
  const loading = current === undefined
  const failed = current?.state === 'failed'
  const currentAvailable = !value || items.some((item) => item.id === value)

  return (
    <div className="community-resource-selector">
      <label htmlFor="community-resource-select">
        Tài nguyên MentalBridge <span>(không bắt buộc)</span>
      </label>
      <p>
        Chia sẻ tối đa một tài nguyên đã được duyệt, không sao chép nội dung vào
        bài viết.
      </p>
      <select
        id="community-resource-select"
        value={value ?? ''}
        disabled={disabled || loading}
        onChange={(event) => onChange(event.target.value || null)}
      >
        <option value="">Không đính kèm tài nguyên</option>
        {!currentAvailable && value && (
          <option value={value}>Tài nguyên hiện không còn khả dụng</option>
        )}
        {items.map((item) => (
          <option key={item.id} value={item.id}>
            {item.title}
          </option>
        ))}
      </select>
      {loading && <small role="status">Đang tải danh sách tài nguyên…</small>}
      {failed && (
        <div className="community-resource-selector-error" role="alert">
          <span>
            Chưa thể tải tài nguyên. Bạn vẫn có thể đăng bài không đính kèm.
          </span>
          <button type="button" onClick={retry}>
            Thử lại
          </button>
        </div>
      )}
      {!loading && !failed && items.length === 0 && (
        <small role="status">Hiện chưa có tài nguyên phù hợp để chia sẻ.</small>
      )}
    </div>
  )
}
