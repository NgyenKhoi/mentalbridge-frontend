'use client'

import { useCallback, useEffect, useId, useState } from 'react'

import LightSelect from '@/components/LightSelect'

import {
  getResourceCatalogue,
  type PublicResourceSummary,
} from '@/features/resources/api/browser-resources'

export default function CommunityResourceSelector({
  value,
  onChange,
  disabled = false,
  compact = false,
}: Readonly<{
  value: string | null
  onChange: (resourceId: string | null) => void
  disabled?: boolean
  compact?: boolean
}>) {
  const selectId = useId()
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
      <label htmlFor={selectId} id={`${selectId}-label`}>
        Tài nguyên MentalBridge <span>(không bắt buộc)</span>
      </label>
      {!compact && (
        <p>
          Chia sẻ tối đa một tài nguyên đã được duyệt, không sao chép nội dung
          vào bài viết.
        </p>
      )}
      <LightSelect
        id={selectId}
        labelledBy={`${selectId}-label`}
        value={value ?? ''}
        disabled={disabled || loading}
        onChange={(nextValue) => onChange(nextValue || null)}
        options={[
          { value: '', label: 'Không đính kèm tài nguyên' },
          ...(!currentAvailable && value
            ? [{ value, label: 'Tài nguyên hiện không còn khả dụng' }]
            : []),
          ...items.map((item) => ({ value: item.id, label: item.title })),
        ]}
      />
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
