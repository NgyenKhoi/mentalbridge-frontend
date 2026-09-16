import type {
  Emotion,
  EmotionCheckIn,
  EmotionCheckInCreate,
  EmotionCheckInList,
  EmotionCheckInTombstone,
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

export function parseEmotionList(value: unknown): EmotionCheckInList | null {
  if (
    !object(value) ||
    !exact(value, ['items', 'page', 'label', 'interpretation']) ||
    value.label !== 'SELF_REPORTED_EMOTION' ||
    value.interpretation !== 'NOT_DIAGNOSIS_OR_RECOVERY' ||
    !Array.isArray(value.items) ||
    value.items.length > 90 ||
    value.items.some((item) => !parseEmotionCheckIn(item)) ||
    !object(value.page) ||
    !exact(value.page, ['limit', 'hasMore', 'nextBefore']) ||
    !Number.isInteger(value.page.limit) ||
    Number(value.page.limit) < 1 ||
    Number(value.page.limit) > 90 ||
    typeof value.page.hasMore !== 'boolean' ||
    (value.page.nextBefore !== undefined && !isLocalDate(value.page.nextBefore))
  )
    return null
  return value as EmotionCheckInList
}

export function parseEmotionTombstone(
  value: unknown,
): EmotionCheckInTombstone | null {
  if (
    !object(value) ||
    !exact(value, ['localDate', 'deleted', 'deletedAt']) ||
    !isLocalDate(value.localDate) ||
    value.deleted !== true ||
    !timestamp(value.deletedAt)
  )
    return null
  return value as EmotionCheckInTombstone
}
