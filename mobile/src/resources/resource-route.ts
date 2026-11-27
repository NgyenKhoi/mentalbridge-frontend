import type { Href } from 'expo-router'

export function resourceDetailHref(
  resourceId: string,
  localDate: string,
  category: string,
): Href {
  return `/resources/${encodeURIComponent(resourceId)}?date=${encodeURIComponent(localDate)}&category=${encodeURIComponent(category)}` as Href
}
