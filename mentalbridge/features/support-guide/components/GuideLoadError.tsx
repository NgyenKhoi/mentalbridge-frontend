'use client'

import Link from 'next/link'
import { CloudOff, RefreshCw } from 'lucide-react'
import { useState } from 'react'

export default function GuideLoadError({
  message,
  onRetry,
  headingLevel: Heading = 'h1',
}: Readonly<{
  message: string
  onRetry: () => Promise<unknown>
  headingLevel?: 'h1' | 'h2'
}>) {
  const [retrying, setRetrying] = useState(false)

  const retry = async () => {
    if (retrying) return
    setRetrying(true)
    try {
      await onRetry()
    } finally {
      setRetrying(false)
    }
  }

  return (
    <section className="support-guide-error" role="alert">
      <span className="support-guide-error-icon" aria-hidden="true">
        <CloudOff />
      </span>
      <Heading>Chưa thể tải gợi ý hỗ trợ</Heading>
      <p>{message}</p>
      <div className="support-guide-error-actions">
        <button
          type="button"
          className="support-guide-primary"
          aria-busy={retrying}
          aria-disabled={retrying}
          data-busy={retrying || undefined}
          onClick={() => void retry()}
        >
          <RefreshCw aria-hidden="true" />
          {retrying ? 'Đang thử lại…' : 'Thử lại'}
        </button>
        <Link href="/assessments">Xem lịch sử sàng lọc</Link>
      </div>
    </section>
  )
}
