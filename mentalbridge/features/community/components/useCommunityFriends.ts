'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { getFriends } from '../api/browser-community-social'
import type { Friendship } from '../api/community-social'

export function useCommunityFriends(view = 'accepted') {
  const [items, setItems] = useState<Friendship[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const generation = useRef(0)

  const load = useCallback(
    async (next?: string) => {
      const requestGeneration = ++generation.current
      if (next) setLoadingMore(true)
      else setLoading(true)
      setError('')
      try {
        const page = await getFriends(view, next)
        if (generation.current !== requestGeneration) return
        setItems((current) =>
          next
            ? [
                ...current,
                ...page.items.filter(
                  (item) =>
                    !current.some(
                      (old) => old.friendshipId === item.friendshipId,
                    ),
                ),
              ]
            : page.items,
        )
        setCursor(page.nextCursor)
      } catch {
        if (generation.current === requestGeneration)
          setError('Chưa tải được danh sách bạn bè. Bạn có thể thử lại.')
      } finally {
        if (generation.current === requestGeneration) {
          setLoading(false)
          setLoadingMore(false)
        }
      }
    },
    [view],
  )

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => {
      window.clearTimeout(timer)
      generation.current += 1
    }
  }, [load])

  return {
    items,
    cursor,
    loading,
    loadingMore,
    error,
    refresh: () => void load(),
    loadMore: () => {
      if (cursor && !loadingMore) void load(cursor)
    },
  }
}
