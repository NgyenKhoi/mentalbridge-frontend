'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'

import {
  deleteResourceBookmark,
  getResourceBookmarks,
  saveResourceBookmark,
  type ResourceBookmark,
} from '../api/browser-resource-engagement'

type BookmarkState = 'loading' | 'ready' | 'error' | 'stale'

export function useResourceBookmarks() {
  const [bookmarks, setBookmarks] = useState<ResourceBookmark[]>([])
  const [state, setState] = useState<BookmarkState>('loading')
  const [pendingResourceId, setPendingResourceId] = useState<string | null>(
    null,
  )

  const load = useCallback(async () => {
    setState('loading')
    try {
      setBookmarks(await getResourceBookmarks())
      setState('ready')
    } catch {
      setBookmarks([])
      setState('error')
    }
  }, [])

  useEffect(() => {
    let active = true
    void getResourceBookmarks()
      .then((items) => {
        if (!active) return
        setBookmarks(items)
        setState('ready')
      })
      .catch(() => {
        if (!active) return
        setBookmarks([])
        setState('error')
      })
    return () => {
      active = false
    }
  }, [])

  const ids = useMemo(
    () => new Set(bookmarks.map((bookmark) => bookmark.resourceId)),
    [bookmarks],
  )

  const toggle = useCallback(
    async (resourceId: string) => {
      if (state !== 'ready' || pendingResourceId) return false
      setPendingResourceId(resourceId)
      try {
        if (ids.has(resourceId)) {
          await deleteResourceBookmark(resourceId)
          setBookmarks((current) =>
            current.filter((bookmark) => bookmark.resourceId !== resourceId),
          )
        } else {
          const saved = await saveResourceBookmark(resourceId)
          setBookmarks((current) => [
            ...current.filter(
              (bookmark) => bookmark.resourceId !== saved.resourceId,
            ),
            saved,
          ])
        }
        return true
      } catch {
        // A transport failure can happen after Content committed the command.
        // Hide the old state until an authoritative reload succeeds.
        setBookmarks([])
        setState('stale')
        return false
      } finally {
        setPendingResourceId(null)
      }
    },
    [ids, pendingResourceId, state],
  )

  return {
    bookmarks,
    isBookmarked: (resourceId: string) => ids.has(resourceId),
    state,
    pendingResourceId,
    toggle,
    retry: load,
  }
}
