'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'

import {
  getResourceDetail,
  type PublicResourceDetail,
} from '@/features/resources/api/browser-resources'

const KIND_LABELS: Record<PublicResourceDetail['resourceKind'], string> = {
  LEARNING: 'Tìm hiểu',
  PRACTICE: 'Thực hành',
  HABIT: 'Thói quen',
  ACTION: 'Hành động',
  REFLECTION: 'Suy ngẫm',
}

export default function CommunityResourceAttachment({
  resourceId,
}: Readonly<{ resourceId: string }>) {
  const [generation, setGeneration] = useState(0)
  const requestKey = `${resourceId}:${generation}`
  const [result, setResult] = useState<{
    key: string
    state: 'available' | 'unavailable'
    resource?: PublicResourceDetail
  }>()

  const retry = useCallback(() => setGeneration((value) => value + 1), [])

  useEffect(() => {
    const controller = new AbortController()
    void getResourceDetail(resourceId, undefined, controller.signal)
      .then((resource) =>
        setResult({ key: requestKey, state: 'available', resource }),
      )
      .catch((cause: unknown) => {
        if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
          setResult({ key: requestKey, state: 'unavailable' })
        }
      })
    return () => controller.abort()
  }, [requestKey, resourceId])

  const current = result?.key === requestKey ? result : undefined
  const resource = current?.resource

  if (current?.state === 'unavailable') {
    return (
      <aside className="community-resource-card is-unavailable" role="status">
        <span>Tài nguyên MentalBridge</span>
        <strong>Tài nguyên này hiện không còn khả dụng</strong>
        <p>Liên kết đã được giữ lại, nhưng nội dung không được hiển thị.</p>
        <button type="button" onClick={retry}>
          Thử tải lại
        </button>
      </aside>
    )
  }

  if (!resource) {
    return (
      <aside
        className="community-resource-card is-loading"
        role="status"
        aria-busy="true"
      >
        Đang kiểm tra tài nguyên MentalBridge…
      </aside>
    )
  }

  return (
    <Link
      className="community-resource-card"
      href={`/resources/${resource.id}`}
      aria-label={`Mở tài nguyên ${resource.title}`}
    >
      <span>Tài nguyên MentalBridge đã được duyệt</span>
      <strong>{resource.title}</strong>
      <small>{KIND_LABELS[resource.resourceKind]}</small>
    </Link>
  )
}
