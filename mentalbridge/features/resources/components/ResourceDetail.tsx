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

type Props = Readonly<{
  resourceId: string
  fromSupportPlan: boolean
  contentVersion?: string
}>

export default function ResourceDetail({
  resourceId,
  fromSupportPlan,
  contentVersion,
}: Props) {
  const requestKey = `${resourceId}:${contentVersion ?? ''}`
  const [result, setResult] = useState<{
    requestKey: string
    state: 'success' | 'not-found' | 'error'
    resource?: PublicResourceDetail
  }>()

  useEffect(() => {
    const controller = new AbortController()
    void getResourceDetail(resourceId, contentVersion, controller.signal)
      .then((value) => {
        setResult({ requestKey, state: 'success', resource: value })
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === 'AbortError') return
        setResult({
          requestKey,
          state:
            error instanceof ResourceBrowserError && error.status === 404
              ? 'not-found'
              : 'error',
        })
      })
    return () => controller.abort()
  }, [contentVersion, requestKey, resourceId])

  const backHref = fromSupportPlan ? '/support-plan' : '/resources'
  const backLabel = fromSupportPlan
    ? 'Quay lại kế hoạch hỗ trợ'
    : 'Quay lại thư viện'
  const state = result?.requestKey === requestKey ? result.state : 'loading'
  const resource =
    result?.requestKey === requestKey ? result.resource : undefined

  if (state === 'loading') {
    return (
      <main className={styles.page} aria-busy="true">
        <section className={styles.state} role="status">
          <span className={styles.loader} aria-hidden="true" />
          <h1>Đang tải nội dung…</h1>
          <p>Tài nguyên đã rà soát đang được chuẩn bị.</p>
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
            {notFound
              ? 'Không tìm thấy tài nguyên'
              : 'Tài nguyên này tạm thời chưa tải được'}
          </h1>
          <p>
            {notFound
              ? 'Tài nguyên có thể đã được lưu trữ hoặc không còn trong thời gian phát hành.'
              : 'Vui lòng thử lại sau hoặc quay lại thư viện tài nguyên.'}
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

        {(resource.sourceTitle || sourceUrl || resource.sourceOrganization) && (
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
