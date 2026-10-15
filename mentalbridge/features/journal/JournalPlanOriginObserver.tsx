'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  parseJournalPlanOrigin,
  resolveJournalPlanOrigin,
  type ResolvedJournalPlanOrigin,
} from '@/features/support-plan/journal-plan-origin'

export type JournalPlanContext =
  | { status: 'none' | 'loading' | 'invalid' | 'error'; query: string }
  | { status: 'ready'; query: string; origin: ResolvedJournalPlanOrigin }

/** Observe URL hints without ever owning or resetting the canonical editor. */
export function JournalPlanOriginObserver({
  onChange,
}: {
  onChange: (context: JournalPlanContext) => void
}) {
  const searchParams = useSearchParams()
  const query = searchParams?.toString() ?? ''
  const [retry, setRetry] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let active = true
    const params = new URLSearchParams(query)
    const requested = [
      'source',
      'occurrenceId',
      'actionId',
      'localDate',
      'journalId',
    ].some((key) => params.has(key))
    const origin = requested ? parseJournalPlanOrigin(params) : null
    const timer = window.setTimeout(() => {
      setFailed(false)
      if (!requested) {
        onChange({ status: 'none', query })
        return
      }
      if (!origin) {
        onChange({ status: 'invalid', query })
        return
      }
      onChange({ status: 'loading', query })
      void resolveJournalPlanOrigin(origin)
        .then((resolved) => {
          if (active) onChange({ status: 'ready', query, origin: resolved })
        })
        .catch(() => {
          if (active) {
            onChange({ status: 'error', query })
            setFailed(true)
          }
        })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [query, retry, onChange])
  return failed ? (
    <button
      type="button"
      className="btn btn-secondary"
      onClick={() => setRetry((value) => value + 1)}
    >
      Thử tải lại hoạt động
    </button>
  ) : null
}
