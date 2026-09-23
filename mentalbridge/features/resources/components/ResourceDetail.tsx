'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import {
  getResourceDetail,
  ResourceBrowserError,
  type PublicResourceDetail,
} from '../api/browser-resources'
import styles from './resource-detail.module.css'

const categoryLabels: Record<PublicResourceDetail['category'], string> = {
  ARTICLE: 'Bài viết',
  VIDEO: 'Video',
  BREATHING: 'Bài thở',
  MEDITATION: 'Thực hành chú tâm',
  JOURNALING: 'Gợi ý viết',
  COMMUNITY: 'Cộng đồng',
}

function safeHttpUrl(value: string | null | undefined) {
  if (!value) return null
  try {
    const url = new URL(value)
    return ['http:', 'https:'].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.toString()
      : null
  } catch {
    return null
  }
}

function externalActionLabel(category: PublicResourceDetail['category']) {
  return category === 'VIDEO'
    ? 'Xem video tại nguồn'
    : 'Mở tài nguyên tại nguồn'
}

type Props = Readonly<{ resourceId: string; fromSupportPlan: boolean }>

export default function ResourceDetail({ resourceId, fromSupportPlan }: Props) {
  const [result, setResult] = useState<{
    resourceId: string
    state: 'success' | 'not-found' | 'error'
    resource?: PublicResourceDetail
  }>()

  useEffect(() => {
    const controller = new AbortController()
    void getResourceDetail(resourceId, controller.signal)
      .then((value) => {
        setResult({ resourceId, state: 'success', resource: value })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setResult({
          resourceId,
          state:
            error instanceof ResourceBrowserError && error.status === 404
              ? 'not-found'
              : 'error',
        })
      })
    return () => controller.abort()
  }, [resourceId])

  const backHref = fromSupportPlan ? '/support-plan' : '/resources'
  const backLabel = fromSupportPlan
    ? 'Quay lại kế hoạch hỗ trợ'
    : 'Quay lại thư viện'
  const state = result?.resourceId === resourceId ? result.state : 'loading'
  const resource =
    result?.resourceId === resourceId ? result.resource : undefined

  if (state === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <section className={styles.state} role="status">
          <span className={styles.loader} aria-hidden="true" />
          <h1>Đang tải tài nguyên…</h1>
          <p>Nội dung đã rà soát đang được lấy từ Content service.</p>
        </section>
      </main>
    )
  }

  if (state !== 'success' || !resource) {
    const notFound = state === 'not-found'
    return (
      <main className={styles.page}>
        <section className={styles.state} role="alert">
          <span className={styles.stateIcon} aria-hidden="true">
            {notFound ? '○' : '!'}
          </span>
          <h1>
            {notFound ? 'Không tìm thấy tài nguyên' : 'Chưa thể tải tài nguyên'}
          </h1>
          <p>
            {notFound
              ? 'Tài nguyên có thể đã được lưu trữ hoặc không còn trong thời gian phát hành.'
              : 'Content service đang tạm thời không khả dụng. Vui lòng thử lại sau.'}
          </p>
          <Link className={styles.backButton} href={backHref}>
            {backLabel}
          </Link>
        </section>
      </main>
    )
  }

  const externalUrl = safeHttpUrl(resource.externalUrl)
  const sourceUrl = safeHttpUrl(resource.sourceUrl)

  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <Link className={styles.backLink} href={backHref}>
          <span aria-hidden="true">←</span> {backLabel}
        </Link>

        <header className={styles.header}>
          <span className={styles.category}>
            {categoryLabels[resource.category]}
          </span>
          <h1>{resource.title}</h1>
          <p className={styles.summary}>{resource.summary}</p>
          {resource.sourceOrganization && (
            <p className={styles.reviewedBy}>
              Nguồn tham khảo: <strong>{resource.sourceOrganization}</strong>
            </p>
          )}
        </header>

        {resource.contentBody && (
          <section
            className={styles.content}
            aria-labelledby="resource-content-title"
          >
            <h2 id="resource-content-title">Nội dung hướng dẫn</h2>
            {resource.contentBody.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </section>
        )}

        {externalUrl && (
          <a
            className={styles.primaryAction}
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            {externalActionLabel(resource.category)}{' '}
            <span aria-hidden="true">↗</span>
          </a>
        )}

        {(resource.sourceTitle || sourceUrl || resource.sourceReviewNote) && (
          <aside
            className={styles.source}
            aria-labelledby="resource-source-title"
          >
            <span className={styles.sourceEyebrow}>Thông tin nguồn</span>
            <h2 id="resource-source-title">
              {resource.sourceTitle ??
                resource.sourceOrganization ??
                'Nguồn tham khảo'}
            </h2>
            {resource.sourceOrganization && (
              <p>{resource.sourceOrganization}</p>
            )}
            {resource.sourceReviewNote && (
              <p className={styles.reviewNote}>{resource.sourceReviewNote}</p>
            )}
            {sourceUrl && (
              <a href={sourceUrl} target="_blank" rel="noopener noreferrer">
                Xem nguồn tham khảo <span aria-hidden="true">↗</span>
              </a>
            )}
          </aside>
        )}

        <p className={styles.boundary}>
          Nội dung này nhằm hỗ trợ tự chăm sóc, không dùng để chẩn đoán hoặc
          thay thế đánh giá và điều trị từ chuyên gia.
        </p>
      </article>
    </main>
  )
}
