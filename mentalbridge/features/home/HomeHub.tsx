'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { HomeNextStep } from '@/features/assessment/api/care-contract'
import type { PublicResourceSummary } from '@/features/resources/api/browser-resources'
import { PlanEmotionCheckIn } from '@/features/emotion-check-in/PlanEmotionCheckIn'
import { Skeleton } from '@/components/ui/Skeleton'
import { useMamPageTarget } from '@/features/mam/use-mam-target'
import HomeNextStepCard from './HomeNextStepCard'
import { HomeGreeting } from './HomeGreeting'
import { HomeQuickActions } from './HomeQuickActions'
import { HomeEmotionSection } from './HomeEmotionSection'
import { HomeResources } from './HomeResources'
import { HomeUpcomingAppointment } from './HomeUpcomingAppointment'
import { getHomeNextStep } from './browser-home-next-step'
import { homeDestination } from './home-destination'

type HomeState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | {
      phase: 'ready'
      home: HomeNextStep
      destination?: string
      remaining?: number
      resourceCategory?: PublicResourceSummary['category']
    }

export function HomeLoading() {
  return (
    <section
      className="home-next-step home-loading"
      aria-label="Đang tải bước tiếp theo"
      aria-busy="true"
      data-page-motion="off"
    >
      <Skeleton
        className="home-skeleton"
        width="min(100%, 380px)"
        height="22px"
      />
      <div className="home-band-row">
        <Skeleton className="home-skeleton home-art" />
        <div className="home-band-copy">
          <Skeleton className="home-skeleton" width="160px" height="14px" />
          <Skeleton
            className="home-skeleton"
            width="min(100%, 420px)"
            height="34px"
          />
          <Skeleton
            className="home-skeleton"
            width="min(100%, 260px)"
            height="28px"
          />
        </div>
        <Skeleton
          className="home-skeleton home-band-cta-skeleton"
          width="170px"
          height="52px"
        />
      </div>
      <div className="sr-only" role="status">
        Đang tải bước tiếp theo…
      </div>
    </section>
  )
}

export function HomeHub() {
  const search = useSearchParams()
  const planEmotion = ['occurrenceId', 'actionId', 'localDate'].some((key) =>
    search.has(key),
  )
  const query = search.toString()
  const [state, setState] = useState<HomeState>({ phase: 'loading' })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    void getHomeNextStep(controller.signal)
      .then(async (home) => {
        const context = await homeDestination(home)
        if (!controller.signal.aborted)
          setState({ phase: 'ready', home, ...context })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ phase: 'error' })
      })
    return () => controller.abort()
  }, [attempt, query])

  function reload() {
    // Preserve the saved mood acknowledgement while refreshing the next step.
    setAttempt((value) => value + 1)
  }

  const home = state.phase === 'ready' ? state.home : null
  const safety = home?.journey.nextAction === 'REVIEW_SAFETY_SUPPORT'
  const loading = state.phase === 'loading'
  // Safety support and the emotion check-in are no-interrupt zones (ADR).
  useMamPageTarget(safety || planEmotion ? null : { kind: 'dashboard.page' })

  return (
    <div
      className="home-hub"
      data-home-motion={safety || loading ? 'off' : 'on'}
      data-page-motion={safety ? 'off' : undefined}
    >
      <HomeGreeting home={home} safety={safety} />
      <div className="home-primary-slot" data-page-motion="off">
        {planEmotion && !safety ? (
          <section
            className="home-emotion-origin"
            aria-label="Cảm xúc trong kế hoạch"
          >
            <PlanEmotionCheckIn onPersisted={reload} />
            <Link className="home-quiet-link" href="/dashboard">
              Về trang chính
            </Link>
          </section>
        ) : loading ? (
          <HomeLoading />
        ) : state.phase === 'error' ? (
          <section
            className="home-next-step home-error"
            aria-label="Bước tiếp theo"
          >
            <div className="home-eyebrow">Bước tiếp theo</div>
            <h2>Chưa tải được bước tiếp theo.</h2>
            <div role="alert">Bạn có thể thử lại sau một chút.</div>
            <button
              type="button"
              className="home-primary"
              onClick={() => {
                setState({ phase: 'loading' })
                reload()
              }}
            >
              Thử lại
            </button>
          </section>
        ) : (
          home && (
            <HomeNextStepCard
              home={home}
              destination={
                state.phase === 'ready' ? state.destination : undefined
              }
              remaining={state.phase === 'ready' ? state.remaining : undefined}
              resourceCategory={
                state.phase === 'ready' ? state.resourceCategory : undefined
              }
              onRetry={reload}
            />
          )
        )}
      </div>
      {!safety && !planEmotion && <HomeEmotionSection onPersisted={reload} />}
      {!safety && (
        <div className="home-secondary-row" data-page-motion="off">
          <HomeResources
            home={home}
            loading={loading}
            summonable={!planEmotion}
          />
          <HomeUpcomingAppointment summonable={!planEmotion} />
        </div>
      )}
      {!safety && <HomeQuickActions home={home} />}
    </div>
  )
}
