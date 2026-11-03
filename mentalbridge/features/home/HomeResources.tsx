'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useEffect, useState, type CSSProperties } from 'react'
import { Skeleton } from '@/components/ui/Skeleton'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import { useMamTarget } from '@/features/mam/use-mam-target'
import { resourceArtwork } from '@/features/resources/model/resource-artwork'
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

function ResourceArt({ resource }: Readonly<{ resource: HomeResource }>) {
  const artwork = resourceArtwork(resource)
  return (
    <>
      <Image
        src={artwork.src}
        alt=""
        fill
        sizes="(max-width: 760px) 100vw, (max-width: 1280px) 25vw, 20vw"
        className={styles.artImage}
        style={{ objectPosition: artwork.position }}
      />
      <div className={styles.artLight} aria-hidden="true" />
      <svg
        className={styles.artSparkles}
        viewBox="0 0 100 60"
        fill="none"
        aria-hidden="true"
      >
        <path d="M78 12v8m-4-4h8M88 29v6m-3-3h6M68 36v5m-2.5-2.5h5" />
      </svg>
    </>
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
                <ResourceArt resource={resource} />
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
