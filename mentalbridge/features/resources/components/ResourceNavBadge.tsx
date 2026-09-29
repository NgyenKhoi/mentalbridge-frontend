'use client'

import { useCallback, useEffect, useState } from 'react'

import { getResourceProgress } from '../api/browser-resource-progress'
import { getResourceCatalogue } from '../api/browser-resources'
import {
  completedDailyCount,
  dailyResources,
  localDate,
} from '../model/resource-experience'

export default function ResourceNavBadge() {
  const [remaining, setRemaining] = useState<number | null>(null)

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const today = localDate()
    try {
      const [catalogue, progress] = await Promise.all([
        getResourceCatalogue(signal),
        getResourceProgress(today, today),
      ])
      if (catalogue.unavailable) return
      const total = dailyResources(catalogue.items, today).length
      setRemaining(
        Math.max(
          0,
          total - completedDailyCount(catalogue.items, progress, today),
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
