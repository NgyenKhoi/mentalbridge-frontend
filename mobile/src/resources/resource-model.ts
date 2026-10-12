import type {
  ResourceCategory,
  ResourceDetail,
  ResourceProgressItem,
  ResourceSummary,
} from './resource-contract'

export const resourceCategories: readonly {
  value: ResourceCategory | 'ALL'
  label: string
}[] = [
  { value: 'ALL', label: 'Tất cả' },
  { value: 'BREATHING', label: 'Thở' },
  { value: 'MEDITATION', label: 'Thư giãn' },
  { value: 'ARTICLE', label: 'Bài đọc' },
  { value: 'VIDEO', label: 'Video' },
  { value: 'JOURNALING', label: 'Viết và suy ngẫm' },
  { value: 'COMMUNITY', label: 'Vận động' },
]

export function resourceFormat(resource: ResourceSummary) {
  if (resource.interactionType === 'VIDEO_TRANSCRIPT') return 'Video'
  if (resource.interactionType === 'STRUCTURED_READER') return 'Bài đọc'
  return 'Thực hành'
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : undefined
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    const direct = text(entry)
    if (direct) return [direct]
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const label = text((entry as Record<string, unknown>).label)
    return label ? [label] : []
  })
}

export function structuredResourceContent(resource: ResourceDetail) {
  const content = resource.structuredContent
  const overview = text(content.overview) ?? text(resource.contentBody)
  return {
    overview,
    whenUseful: text(content.whenUseful),
    keyIdeas: textList(content.keyIdeas),
    steps: textList(content.steps),
    cautions: textList(content.cautions),
    nextStep: text(content.nextStep),
  }
}

export type ResourceAction = Readonly<{
  id: string
  label: string
  seconds?: number
}>

export function resourceActions(resource: ResourceDetail): ResourceAction[] {
  const steps = resource.interactionConfig.steps
  if (!Array.isArray(steps)) return []
  return steps.flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return []
    const value = entry as Record<string, unknown>
    const id = text(value.id)
    const label = text(value.label)
    if (!id || !/^[A-Za-z0-9:_-]{1,64}$/.test(id) || !label) return []
    const seconds = value.seconds
    return [
      {
        id,
        label,
        ...(Number.isSafeInteger(seconds) &&
        (seconds as number) > 0 &&
        (seconds as number) <= 7200
          ? { seconds: seconds as number }
          : {}),
      },
    ]
  })
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  return Number.isSafeInteger(value) &&
    (value as number) >= minimum &&
    (value as number) <= maximum
    ? (value as number)
    : undefined
}

export function resourceTimerSeconds(resource: ResourceDetail) {
  if (resource.completionMode !== 'TIMED') return undefined
  const configured = boundedInteger(
    resource.interactionConfig.durationSeconds,
    1,
    7200,
  )
  if (configured) return configured

  if (resource.interactionType === 'BREATHING_PACER') {
    const inhale = boundedInteger(
      resource.interactionConfig.inhaleSeconds,
      1,
      60,
    )
    const exhale = boundedInteger(
      resource.interactionConfig.exhaleSeconds,
      1,
      60,
    )
    const hold =
      boundedInteger(resource.interactionConfig.holdSeconds, 0, 60) ?? 0
    const cycles = boundedInteger(resource.interactionConfig.cycles, 1, 120)
    if (inhale && exhale && cycles) {
      return Math.min(7200, (inhale + hold + exhale) * cycles)
    }
  }

  const actionSeconds = resourceActions(resource).reduce(
    (total, action) => total + (action.seconds ?? 0),
    0,
  )
  return actionSeconds > 0 ? Math.min(7200, actionSeconds) : undefined
}

export function localDateInTimeZone(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? ''
  return `${part('year')}-${part('month')}-${part('day')}`
}

export function shiftLocalDate(localDate: string, days: number) {
  const [year, month, day] = localDate.split('-').map(Number)
  const value = new Date(Date.UTC(year!, month! - 1, day! + days))
  return value.toISOString().slice(0, 10)
}

export function recentLocalDates(today: string) {
  return Array.from({ length: 7 }, (_, index) =>
    shiftLocalDate(today, index - 6),
  )
}

export function progressFor(
  progress: readonly ResourceProgressItem[],
  resourceId: string,
  localDate: string,
) {
  return progress.find(
    (item) => item.resourceId === resourceId && item.localDate === localDate,
  )
}
