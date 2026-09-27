import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInCreate,
  EmotionCheckInList,
  EmotionCheckInProgress,
  EmotionCheckInValue,
} from './contract'

const emotions = new Set<Emotion>(['GREAT', 'GOOD', 'OKAY', 'LOW', 'VERY_LOW'])
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key))
const timestamp = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

export const isLocalDate = (value: unknown): value is string => {
  if (typeof value !== 'string' || !localDatePattern.test(value)) return false
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  )
}

export const isIdempotencyKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 16 && value.length <= 128

export const isEmotion = (value: unknown): value is Emotion =>
  typeof value === 'string' && emotions.has(value as Emotion)

const isValue = (value: Record<string, unknown>) =>
  isEmotion(value.emotion) &&
  Number.isInteger(value.intensity) &&
  Number(value.intensity) >= 1 &&
  Number(value.intensity) <= 5 &&
  (value.note === undefined ||
    value.note === null ||
    (typeof value.note === 'string' &&
      value.note.trim().length > 0 &&
      value.note.length <= 500))

export function parseEmotionValue(value: unknown): EmotionCheckInValue | null {
  return object(value) &&
    exact(value, ['emotion', 'intensity', 'note']) &&
    isValue(value)
    ? (value as EmotionCheckInValue)
    : null
}

export function parseEmotionCreate(
  value: unknown,
): EmotionCheckInCreate | null {
  if (
    !object(value) ||
    !exact(value, ['emotion', 'intensity', 'note', 'localDate', 'timezone']) ||
    !isValue(value) ||
    !isLocalDate(value.localDate) ||
    typeof value.timezone !== 'string' ||
    value.timezone.length < 1 ||
    value.timezone.length > 64
  )
    return null
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value.timezone })
  } catch {
    return null
  }
  return value as EmotionCheckInCreate
}

export function parseEmotionCheckIn(value: unknown): EmotionCheckIn | null {
  if (
    !object(value) ||
    !exact(value, [
      'id',
      'localDate',
      'timezone',
      'emotion',
      'intensity',
      'note',
      'sourceLabel',
      'clinicalUse',
      'revision',
      'recordedAt',
      'createdAt',
      'updatedAt',
    ]) ||
    typeof value.id !== 'string' ||
    !uuid.test(value.id) ||
    !isLocalDate(value.localDate) ||
    typeof value.timezone !== 'string' ||
    value.timezone.length < 1 ||
    value.timezone.length > 64 ||
    !isValue(value) ||
    value.note === undefined ||
    value.sourceLabel !== 'SELF_REPORTED_EMOTION' ||
    value.clinicalUse !== 'NOT_A_DIAGNOSIS_OR_SAFETY_CLASSIFIER' ||
    !Number.isInteger(value.revision) ||
    Number(value.revision) < 1 ||
    Number(value.revision) > 32 ||
    !timestamp(value.recordedAt) ||
    !timestamp(value.createdAt) ||
    !timestamp(value.updatedAt)
  )
    return null
  return value as EmotionCheckIn
}

const nonNegativeInteger = (value: unknown) =>
  Number.isInteger(value) && Number(value) >= 0

export function parseEmotionCheckInList(
  value: unknown,
): EmotionCheckInList | null {
  if (
    !object(value) ||
    !exact(value, ['items', 'page', 'label', 'interpretation']) ||
    !Array.isArray(value.items) ||
    value.items.length > 90 ||
    value.items.some((item) => !parseEmotionCheckIn(item)) ||
    !object(value.page) ||
    !exact(value.page, ['limit', 'hasMore', 'nextBefore']) ||
    !Number.isInteger(value.page.limit) ||
    Number(value.page.limit) < 1 ||
    Number(value.page.limit) > 90 ||
    typeof value.page.hasMore !== 'boolean' ||
    (value.page.nextBefore !== undefined &&
      !isLocalDate(value.page.nextBefore)) ||
    value.label !== 'SELF_REPORTED_EMOTION' ||
    value.interpretation !== 'NOT_DIAGNOSIS_OR_RECOVERY'
  )
    return null
  return value as EmotionCheckInList
}

export function parseEmotionCheckInProgress(
  value: unknown,
): EmotionCheckInProgress | null {
  if (
    !object(value) ||
    !exact(value, [
      'asOfLocalDate',
      'timezone',
      'currentEmotion',
      'currentStreak',
      'longestStreak',
      'windows',
      'label',
      'interpretation',
    ]) ||
    !isLocalDate(value.asOfLocalDate) ||
    typeof value.timezone !== 'string' ||
    value.timezone.length < 1 ||
    value.timezone.length > 64 ||
    (value.currentEmotion !== null && !isEmotion(value.currentEmotion)) ||
    !nonNegativeInteger(value.currentStreak) ||
    !nonNegativeInteger(value.longestStreak) ||
    !Array.isArray(value.windows) ||
    value.windows.length !== 3 ||
    value.label !== 'SELF_REPORTED_EMOTION' ||
    value.interpretation !== 'FACTUAL_COUNTS_NOT_DIAGNOSIS_OR_RECOVERY'
  )
    return null

  const expectedDays = [7, 14, 30]
  for (const [index, window] of value.windows.entries()) {
    if (
      !object(window) ||
      !exact(window, [
        'days',
        'startLocalDate',
        'endLocalDate',
        'checkedInDays',
        'totalDays',
        'distribution',
      ]) ||
      window.days !== expectedDays[index] ||
      window.totalDays !== window.days ||
      !isLocalDate(window.startLocalDate) ||
      !isLocalDate(window.endLocalDate) ||
      !nonNegativeInteger(window.checkedInDays) ||
      Number(window.checkedInDays) > Number(window.days) ||
      !object(window.distribution) ||
      !exact(window.distribution, [
        'GREAT',
        'GOOD',
        'OKAY',
        'LOW',
        'VERY_LOW',
      ]) ||
      Object.values(window.distribution).some(
        (count) => !nonNegativeInteger(count),
      ) ||
      Object.values(window.distribution).reduce<number>(
        (sum, count) => sum + Number(count),
        0,
      ) !== window.checkedInDays
    )
      return null
  }
  return value as EmotionCheckInProgress
}
