import type { PublicResourceSummary } from '../api/browser-resources'
import type { ResourceProgressItem } from '../api/browser-resource-progress'

export type ResourceDifficulty = 'GENTLE' | 'BALANCED' | 'CHALLENGE'
export type ResourceFormat = 'READ' | 'VIDEO' | 'PRACTICE'
export type ResourceStickerVariant =
  | 'breathe'
  | 'meditate'
  | 'read'
  | 'video'
  | 'journal'
  | 'community'
  | 'complete'
  | 'garden'
  | 'rest'

export type ResourcePresentation = Readonly<{
  difficulty: ResourceDifficulty
  format: ResourceFormat
  minutes: number
  sticker: ResourceStickerVariant
  accent: 'mint' | 'peach' | 'butter' | 'lavender'
}>

const presentationByCategory: Readonly<
  Record<PublicResourceSummary['category'], ResourcePresentation>
> = {
  BREATHING: {
    difficulty: 'GENTLE',
    format: 'PRACTICE',
    minutes: 4,
    sticker: 'breathe',
    accent: 'mint',
  },
  MEDITATION: {
    difficulty: 'BALANCED',
    format: 'PRACTICE',
    minutes: 8,
    sticker: 'meditate',
    accent: 'lavender',
  },
  ARTICLE: {
    difficulty: 'GENTLE',
    format: 'READ',
    minutes: 6,
    sticker: 'read',
    accent: 'butter',
  },
  VIDEO: {
    difficulty: 'BALANCED',
    format: 'VIDEO',
    minutes: 7,
    sticker: 'video',
    accent: 'peach',
  },
  JOURNALING: {
    difficulty: 'CHALLENGE',
    format: 'PRACTICE',
    minutes: 10,
    sticker: 'journal',
    accent: 'butter',
  },
  COMMUNITY: {
    difficulty: 'CHALLENGE',
    format: 'READ',
    minutes: 8,
    sticker: 'community',
    accent: 'peach',
  },
}

export const difficultyLabels: Readonly<Record<ResourceDifficulty, string>> = {
  GENTLE: 'Nhẹ nhàng',
  BALANCED: 'Vừa sức',
  CHALLENGE: 'Thử thách',
}

export const formatLabels: Readonly<Record<ResourceFormat, string>> = {
  READ: 'Bài đọc',
  VIDEO: 'Video',
  PRACTICE: 'Bài tập',
}

export function resourcePresentation(
  resource: PublicResourceSummary,
): ResourcePresentation {
  return presentationByCategory[resource.category]
}

export function localDate(value = new Date()): string {
  const year = value.getFullYear()
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function shiftDate(value: string, days: number): string {
  const instant = new Date(`${value}T12:00:00`)
  instant.setDate(instant.getDate() + days)
  return localDate(instant)
}

export function recentDates(today: string): readonly string[] {
  return Array.from({ length: 7 }, (_, index) => shiftDate(today, index - 6))
}

function score(seed: string): number {
  let value = 2166136261
  for (const character of seed) {
    value ^= character.charCodeAt(0)
    value = Math.imul(value, 16777619)
  }
  return value >>> 0
}

export function dailyResources(
  resources: readonly PublicResourceSummary[],
  date: string,
  count = 4,
): readonly PublicResourceSummary[] {
  return [...resources]
    .sort((left, right) => {
      const difference =
        score(`${date}:${left.id}`) - score(`${date}:${right.id}`)
      return difference || left.id.localeCompare(right.id)
    })
    .slice(0, Math.min(count, resources.length))
}

export function progressFor(
  progress: readonly ResourceProgressItem[],
  resourceId: string,
  date: string,
): ResourceProgressItem | undefined {
  return progress.find(
    (entry) => entry.resourceId === resourceId && entry.localDate === date,
  )
}

export function completedDailyCount(
  resources: readonly PublicResourceSummary[],
  progress: readonly ResourceProgressItem[],
  date: string,
): number {
  return dailyResources(resources, date).filter(
    (resource) =>
      progressFor(progress, resource.id, date)?.status === 'COMPLETED',
  ).length
}

export function currentStreak(
  resources: readonly PublicResourceSummary[],
  progress: readonly ResourceProgressItem[],
  today: string,
): number {
  if (resources.length === 0) return 0
  let date = today
  const todayItems = dailyResources(resources, today)
  if (
    todayItems.length > 0 &&
    completedDailyCount(resources, progress, today) < todayItems.length
  ) {
    date = shiftDate(today, -1)
  }
  let streak = 0
  for (let index = 0; index < 14; index += 1) {
    const items = dailyResources(resources, date)
    if (
      items.length === 0 ||
      completedDailyCount(resources, progress, date) !== items.length
    ) {
      break
    }
    streak += 1
    date = shiftDate(date, -1)
  }
  return streak
}
