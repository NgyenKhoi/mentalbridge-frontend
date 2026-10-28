'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import { useMamTarget } from '@/features/mam/use-mam-target'
import {
  loadHomeResources,
  type HomeResource,
  type HomeResourcesData,
} from './home-resources'
import styles from './HomeSecondarySections.module.css'

const sourceTags = {
  plan: 'Trong kế hoạch',
  guide: 'Từ hướng dẫn của bạn',
  library: 'Từ thư viện',
}

function ResourceArt({ category }: Pick<HomeResource, 'category'>) {
  const path =
    category === 'ARTICLE' || category === 'JOURNALING'
      ? 'M14 22c8-4 16-4 22 2 6-6 14-6 22-2v30c-8-4-16-4-22 2-6-6-14-6-22-2zM36 24v30'
      : category === 'VIDEO'
        ? 'M14 18h44v36H14zM31 28l14 8-14 8z'
        : 'M36 14a22 22 0 1 0 0 44 22 22 0 0 0 0-44zM36 24a12 12 0 1 0 0 24 12 12 0 0 0 0-24zM36 32a4 4 0 1 0 0 8 4 4 0 0 0 0-8z'
  return (
    <svg
      width="72"
      height="72"
      viewBox="0 0 72 72"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  )
}

export function HomeResources({
  home,
  loading = false,
  hidden = false,
  summonable = true,
}: Readonly<{
  home: HomeNextStep | null
  loading?: boolean
  hidden?: boolean
  /** False inside a no-interrupt zone such as the plan emotion check-in. */
  summonable?: boolean
}>) {
  const mamTarget = useMamTarget(summonable ? { kind: 'home.resources' } : null)
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<
    | { status: 'loading' }
    | { status: 'ready'; home: HomeNextStep | null; data: HomeResourcesData }
    | { status: 'error'; home: HomeNextStep | null }
  >({ status: 'loading' })

  useEffect(() => {
    if (hidden || loading) return
    const controller = new AbortController()
    let active = true
    loadHomeResources(home, controller.signal).then(
      (data) => {
        if (active) setState({ status: 'ready', home, data })
      },
      () => {
        if (active) setState({ status: 'error', home })
      },
    )
    return () => {
      active = false
      controller.abort()
    }
  }, [home, loading, hidden, attempt])

  if (hidden) return null
  const pending = loading || state.status === 'loading' || state.home !== home
  const library =
    !pending && state.status === 'ready' && state.data.source === 'library'
  return (
    <section
      ref={mamTarget}
      className={styles.section}
      aria-labelledby="home-resources-heading"
      data-testid="home-resources"
    >
      <div className={styles.headingRow}>
        <h2 id="home-resources-heading">
          {library ? 'Từ thư viện MentalBridge' : 'Dành cho bạn'}
        </h2>
        <Link href="/resources">Tất cả tài nguyên →</Link>
      </div>
      {pending ? (
        <div
          className={styles.resourceGrid}
          role="status"
          aria-label="Đang tải tài nguyên"
          aria-busy="true"
        >
          {[0, 1, 2].map((index) => (
            <Skeleton
              key={index}
              className={`${styles.skeleton} ${styles.resourceSkeleton}`}
            />
          ))}
        </div>
      ) : state.status === 'error' ? (
        <div className={styles.localState}>
          <div role="status">Chưa tải được tài nguyên.</div>
          <button
            className={styles.quietAction}
            onClick={() => {
              setState({ status: 'loading' })
              setAttempt((value) => value + 1)
            }}
          >
            Thử lại
          </button>
        </div>
      ) : state.status === 'ready' && state.data.items.length === 0 ? (
        <div className={styles.localState}>
          <div>Chưa có tài nguyên để hiển thị.</div>
          <Link href="/resources" className={styles.quietAction}>
            Mở thư viện tài nguyên →
          </Link>
        </div>
      ) : state.status === 'ready' ? (
        <div className={styles.resourceGrid}>
          {state.data.items.map((resource, index) => (
            <Link
              className={`${styles.resource} ${styles.reveal}`}
              href={resource.href}
              key={`${resource.id}-${index}`}
              data-testid={`home-resource-${index}`}
              style={
                {
                  '--home-section-delay': `${260 + index * 60}ms`,
                } as CSSProperties
              }
            >
              <div className={`${styles.art} ${styles[`art${index}`]}`}>
                <div className={styles.tag}>
                  {sourceTags[state.data.source]}
                </div>
                <ResourceArt category={resource.category} />
              </div>
              <div className={styles.resourceBody}>
                {resource.meta && (
                  <div className={styles.meta}>{resource.meta}</div>
                )}
                <h3>{resource.title}</h3>
                <div className={styles.resourceAction}>
                  {resource.action} <div aria-hidden="true">→</div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  )
}
