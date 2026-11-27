import { isLocalDate } from '@/lib/emotion-check-in/validation'
import type {
  CompanionChapter,
  CompanionChapterConnected,
  CompanionChapterInput,
  CompanionChapterObstacle,
  CompanionChapterRating,
  CompanionCommitment,
  CompanionCommitmentKind,
  CompanionCommitmentMinutes,
  CompanionCommitmentSource,
  CompanionCommitmentStatus,
  CompanionFocus,
  CompanionFocusGoal,
  CompanionState,
  CreateCompanionCommitmentRequest,
  ResolveCompanionCommitmentRequest,
  UpdateCompanionStateRequest,
} from './contract'

const set = (...values: string[]): ReadonlySet<string> => new Set(values)
// Typed against the generated enums: a contract change that drops a value fails typecheck here.
const goals = set(
  ...([
    'SLEEP',
    'STUDY_WORK_PRESSURE',
    'LONELINESS',
    'FAMILY',
    'RELATIONSHIPS',
    'SELF_WORTH',
    'NOT_SURE',
  ] satisfies CompanionFocusGoal[]),
)
const ratings = set(
  ...([
    'LIGHTER',
    'SAME',
    'HEAVIER',
    'UNSURE',
  ] satisfies CompanionChapterRating[]),
)
const obstacles = set(
  ...([
    'BUSY',
    'FORGOT',
    'LOW_ENERGY',
    'NOT_A_FIT',
    'OTHER',
  ] satisfies CompanionChapterObstacle[]),
)
const connections = set(
  ...([
    'YES',
    'NOT_YET',
    'PREFER_NOT_SAY',
  ] satisfies CompanionChapterConnected[]),
)
const kinds = set(
  ...([
    'STUDY_WORK_STEP',
    'REST',
    'MOVE',
    'CONNECT_PERSON',
    'JOURNAL',
    'RELAX',
    'PLAN_ACTIVITY',
    'SPECIALIST_STEP',
  ] satisfies CompanionCommitmentKind[]),
)
const sources = set(
  ...([
    'CHAT',
    'PLAN_SKIP',
    'SESSION',
    'LOOK_BACK',
    'GUIDE',
    'HOME',
  ] satisfies CompanionCommitmentSource[]),
)
const statuses = set(
  ...([
    'OPEN',
    'DONE',
    'NOT_YET',
    'SWAPPED',
  ] satisfies CompanionCommitmentStatus[]),
)
const minutesValues: readonly CompanionCommitmentMinutes[] = [
  5,
  10,
  15,
  25,
  30,
  null,
]

export const MAX_GUIDE_LENGTH = 6144
export const MAX_SEEN_ADD = 50
export const SEEN_KEY = /^[a-z0-9:_-]{1,80}$/
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const object = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const exact = (value: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(value).every((key) => keys.includes(key))
const oneOf = (allowed: ReadonlySet<string>, value: unknown) =>
  typeof value === 'string' && allowed.has(value)
const optional = (allowed: ReadonlySet<string>, value: unknown) =>
  value === undefined || oneOf(allowed, value)
const timestamp = (value: unknown) =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))

export const isCommitmentId = (value: unknown): value is string =>
  typeof value === 'string' && uuid.test(value)

const isMinutes = (value: unknown): value is CompanionCommitmentMinutes =>
  minutesValues.includes(value as CompanionCommitmentMinutes)

function parseFocus(value: unknown): CompanionFocus | null {
  return object(value) &&
    exact(value, ['goal', 'chosenOn']) &&
    oneOf(goals, value.goal) &&
    isLocalDate(value.chosenOn)
    ? (value as CompanionFocus)
    : null
}

function parseChapterInput(value: unknown): CompanionChapterInput | null {
  return object(value) &&
    exact(value, ['startedOn', 'goal', 'rating', 'obstacle', 'connected']) &&
    isLocalDate(value.startedOn) &&
    optional(goals, value.goal) &&
    optional(ratings, value.rating) &&
    optional(obstacles, value.obstacle) &&
    optional(connections, value.connected)
    ? (value as CompanionChapterInput)
    : null
}

/** Request body of PATCH /companion-state: strict, every section optional, at least one. */
export function parseUpdateCompanionState(
  value: unknown,
): UpdateCompanionStateRequest | null {
  if (
    !object(value) ||
    Object.keys(value).length === 0 ||
    !exact(value, ['focus', 'chapter', 'guide', 'seenAdd'])
  )
    return null
  if ('focus' in value && value.focus !== null && !parseFocus(value.focus))
    return null
  if ('chapter' in value && !parseChapterInput(value.chapter)) return null
  if (
    'guide' in value &&
    value.guide !== null &&
    (typeof value.guide !== 'string' || value.guide.length > MAX_GUIDE_LENGTH)
  )
    return null
  if (
    'seenAdd' in value &&
    !(
      Array.isArray(value.seenAdd) &&
      value.seenAdd.length >= 1 &&
      value.seenAdd.length <= MAX_SEEN_ADD &&
      value.seenAdd.every(
        (key) => typeof key === 'string' && SEEN_KEY.test(key),
      )
    )
  )
    return null
  return value as UpdateCompanionStateRequest
}

export function parseCreateCommitment(
  value: unknown,
): CreateCompanionCommitmentRequest | null {
  return object(value) &&
    exact(value, ['kind', 'minutes', 'dueOn', 'source']) &&
    oneOf(kinds, value.kind) &&
    isMinutes(value.minutes) &&
    isLocalDate(value.dueOn) &&
    oneOf(sources, value.source)
    ? (value as CreateCompanionCommitmentRequest)
    : null
}

export function parseResolveCommitment(
  value: unknown,
): ResolveCompanionCommitmentRequest | null {
  return object(value) &&
    exact(value, ['status']) &&
    (value.status === 'DONE' ||
      value.status === 'NOT_YET' ||
      value.status === 'SWAPPED')
    ? (value as ResolveCompanionCommitmentRequest)
    : null
}

export function parseCompanionCommitment(
  value: unknown,
): CompanionCommitment | null {
  return object(value) &&
    isCommitmentId(value.id) &&
    oneOf(kinds, value.kind) &&
    isMinutes(value.minutes) &&
    isLocalDate(value.dueOn) &&
    oneOf(sources, value.source) &&
    oneOf(statuses, value.status) &&
    timestamp(value.createdAt) &&
    (value.resolvedAt === null || timestamp(value.resolvedAt))
    ? (value as CompanionCommitment)
    : null
}

const isChapter = (value: unknown): value is CompanionChapter =>
  object(value) &&
  isLocalDate(value.startedOn) &&
  optional(goals, value.goal) &&
  optional(ratings, value.rating) &&
  optional(obstacles, value.obstacle) &&
  optional(connections, value.connected) &&
  timestamp(value.updatedAt)

/** Response check, used by the BFF client and the browser client. */
export function parseCompanionState(value: unknown): CompanionState | null {
  if (
    !object(value) ||
    !(value.focus === null || parseFocus(value.focus)) ||
    !Array.isArray(value.chapters) ||
    !value.chapters.every(isChapter) ||
    !Array.isArray(value.commitments) ||
    !value.commitments.every((item) => parseCompanionCommitment(item)) ||
    !object(value.ui) ||
    !(
      value.ui.guide === null ||
      (typeof value.ui.guide === 'string' &&
        value.ui.guide.length <= MAX_GUIDE_LENGTH)
    ) ||
    !Array.isArray(value.ui.seen) ||
    !value.ui.seen.every((key) => typeof key === 'string') ||
    !Number.isInteger(value.revision)
  )
    return null
  return value as CompanionState
}
