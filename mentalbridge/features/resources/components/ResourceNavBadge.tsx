'use client'

import { useCallback, useEffect, useState } from 'react'

import { getResourceJourney } from '../api/browser-resource-journey'
import { localDate } from '../model/resource-experience'

export default function ResourceNavBadge() {
  const [remaining, setRemaining] = useState<number | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const today = localDate()
    try {
      const journey = await getResourceJourney(
        today,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        signal,
      )
      setRemaining(
        Math.max(
          0,
          journey.progress.dailyTotal - journey.progress.dailyCompleted,
        ),
      )
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      setRemaining(null)
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    const initialRefresh = window.setTimeout(
      () => void refresh(controller.signal),
      0,
    )
    const handleProgressUpdate = () => void refresh()
    window.addEventListener(
      'mb:resource-progress-updated',
      handleProgressUpdate,
    )
    return () => {
      window.clearTimeout(initialRefresh)
      controller.abort()
      window.removeEventListener(
        'mb:resource-progress-updated',
        handleProgressUpdate,
      )
    }
  }, [refresh])

  if (!remaining) return null
  return (
    <b aria-label={`${remaining} hoạt động còn lại hôm nay`}>{remaining}</b>
  )
}
