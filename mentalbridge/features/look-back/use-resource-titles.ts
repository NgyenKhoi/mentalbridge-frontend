import { useEffect, useState } from 'react'

import { getResourceCatalogue } from '@/features/resources/api/browser-resources'

const none: ReadonlyMap<string, string> = new Map()

/** Names of the activities a reflection points at; without them the quote still shows under a plain label. */
export function useResourceTitles(needed: boolean) {
  const [titles, setTitles] = useState(none)
  useEffect(() => {
    if (!needed) return
    const controller = new AbortController()
    getResourceCatalogue(controller.signal)
      .then((catalogue) =>
        setTitles(
          new Map(catalogue.items.map((item) => [item.id, item.title])),
        ),
      )
      .catch(() => undefined)
    return () => controller.abort()
  }, [needed])
  return titles
}
