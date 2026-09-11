import type {
  JournalCreate,
  JournalEntry,
  JournalPage,
  JournalTombstone,
  JournalWrite,
} from './journal-contract'

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const rfc3339 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/
const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: string[]) =>
  Object.keys(value).every((key) => keys.includes(key))
const dateTime = (value: unknown): value is string =>
  typeof value === 'string' &&
  rfc3339.test(value) &&
  !Number.isNaN(Date.parse(value))
const tags = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= 20 &&
  value.every(
    (tag) =>
      typeof tag === 'string' &&
      tag.trim() === tag &&
      tag.length > 0 &&
      tag.length <= 40,
  ) &&
  new Set(value).size === value.length

export const isJournalId = (value: unknown): value is string =>
  typeof value === 'string' && uuid.test(value)
export const isIdempotencyKey = (value: unknown): value is string =>
  typeof value === 'string' && value.length >= 16 && value.length <= 128

function metadata(value: Record<string, unknown>) {
  return (
    isJournalId(value.id) &&
    isJournalId(value.ownerAccountId) &&
    Number.isInteger(value.currentRevision) &&
    Number(value.currentRevision) >= 1 &&
    dateTime(value.occurredAt) &&
    dateTime(value.createdAt) &&
    dateTime(value.updatedAt) &&
    value.deleted === false &&
    tags(value.tags) &&
    object(value.encryption) &&
    exact(value.encryption, ['algorithm', 'keyId', 'encryptedAt']) &&
    value.encryption.algorithm === 'AES-256-GCM' &&
    typeof value.encryption.keyId === 'string' &&
    value.encryption.keyId.length > 0 &&
    dateTime(value.encryption.encryptedAt) &&
    ['not_requested', 'current', 'stale'].includes(String(value.analysisState))
  )
}

export function parseJournalEntry(value: unknown): JournalEntry | null {
  if (
    !object(value) ||
    !exact(value, [
      'id',
      'ownerAccountId',
      'currentRevision',
      'occurredAt',
      'createdAt',
      'updatedAt',
      'deleted',
      'tags',
      'encryption',
      'analysisState',
      'content',
    ]) ||
    !metadata(value) ||
    !object(value.content)
  )
    return null
  if (
    !exact(value.content, ['text', 'byteLength']) ||
    typeof value.content.text !== 'string' ||
    value.content.text.length < 1 ||
    value.content.text.length > 12_000 ||
    !Number.isInteger(value.content.byteLength) ||
    Number(value.content.byteLength) < 1
  )
    return null
  if (
    new TextEncoder().encode(value.content.text).byteLength !==
    value.content.byteLength
  )
    return null
  return value as JournalEntry
}

export function parseJournalPage(value: unknown): JournalPage | null {
  if (
    !object(value) ||
    !exact(value, ['items', 'page']) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    !object(value.page)
  )
    return null
  if (
    !exact(value.page, ['limit', 'hasMore', 'nextCursor']) ||
    !Number.isInteger(value.page.limit) ||
    Number(value.page.limit) < 1 ||
    Number(value.page.limit) > 50 ||
    typeof value.page.hasMore !== 'boolean' ||
    (value.page.nextCursor !== undefined &&
      (typeof value.page.nextCursor !== 'string' ||
        value.page.nextCursor.length < 1 ||
        value.page.nextCursor.length > 512))
  )
    return null
  const items = value.items.map((item) => {
    if (
      !object(item) ||
      !exact(item, [
        'id',
        'ownerAccountId',
        'currentRevision',
        'occurredAt',
        'createdAt',
        'updatedAt',
        'deleted',
        'tags',
        'encryption',
        'analysisState',
        'content',
      ]) ||
      !metadata(item) ||
      !object(item.content)
    )
      return null
    if (
      !exact(item.content, ['preview', 'byteLength']) ||
      typeof item.content.preview !== 'string' ||
      Array.from(item.content.preview).length > 160 ||
      !Number.isInteger(item.content.byteLength) ||
      Number(item.content.byteLength) < 1
    )
      return null
    return item
  })
  if (items.some((item) => item === null)) return null
  return value as JournalPage
}

export function parseTombstone(value: unknown): JournalTombstone | null {
  if (
    !object(value) ||
    !exact(value, ['id', 'ownerAccountId', 'deleted', 'deletedAt']) ||
    !isJournalId(value.id) ||
    !isJournalId(value.ownerAccountId) ||
    value.deleted !== true ||
    !dateTime(value.deletedAt)
  )
    return null
  return value as JournalTombstone
}

export function parseJournalWrite(value: unknown): JournalWrite | null {
  if (
    !object(value) ||
    !exact(value, ['content', 'tags']) ||
    !object(value.content) ||
    !exact(value.content, ['text']) ||
    typeof value.content.text !== 'string' ||
    value.content.text.length < 1 ||
    value.content.text.length > 12_000 ||
    (value.tags !== undefined && !tags(value.tags))
  )
    return null
  return value as JournalWrite
}

export function parseJournalCreate(value: unknown): JournalCreate | null {
  if (
    !object(value) ||
    !exact(value, ['clientEntryId', 'occurredAt', 'content', 'tags']) ||
    !isJournalId(value.clientEntryId) ||
    !dateTime(value.occurredAt)
  )
    return null
  const write = parseJournalWrite({
    content: value.content,
    ...(value.tags === undefined ? {} : { tags: value.tags }),
  })
  return write ? (value as JournalCreate) : null
}
