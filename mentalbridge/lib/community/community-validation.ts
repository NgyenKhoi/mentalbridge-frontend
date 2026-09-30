import type { components } from '@/contracts/community.generated'

export type CommunityFeedPage = components['schemas']['CommunityFeedPage']
export type CommunityAuthor = components['schemas']['CommunityAuthor']
export type CommunityPostSummary = components['schemas']['CommunityPostSummary']
export type CommunityPostDetail = components['schemas']['CommunityPostDetail']
export type CommunityTopic = components['schemas']['CommunityTopic']
export type CommunityTopicCode = components['schemas']['CommunityTopicCode']
export type CommunityProfile = components['schemas']['CommunityProfile']
export type CommunityAvatarPreset =
  components['schemas']['CommunityAvatarPreset']
export type PutCommunityProfileRequest =
  components['schemas']['PutCommunityProfileRequest']
export type CommunityProblem = components['schemas']['Problem']
export type CommunityPostWrite = components['schemas']['CreatePostRequest']

const UUID =
  /^[\da-f]{8}-[\da-f]{4}-[1-8][\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/i
const TOPICS = new Set<CommunityTopicCode>([
  'MY_STORY',
  'SMALL_MILESTONE',
  'HELPFUL_REFLECTION',
  'PEER_QUESTION',
  'EXPERIENCE_SHARING',
  'HELPFUL_RESOURCE',
])
const MEDIA_TYPES = new Set(['IMAGE', 'VIDEO'])
const MEDIA_AVAILABILITY = new Set(['NONE', 'READY', 'PARTIAL', 'UNAVAILABLE'])
const AVATAR_PRESETS = new Set<CommunityAvatarPreset>([
  'LEAF',
  'SUNRISE',
  'WAVE',
  'LOTUS',
  'CLOUD',
  'SPROUT',
])

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  const keys = Object.keys(value)
  return (
    keys.length === allowed.length && keys.every((key) => allowed.includes(key))
  )
}

function dateTime(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
}

function nonNegativeInteger(value: unknown) {
  return Number.isSafeInteger(value) && Number(value) >= 0
}

function nullablePositiveInteger(value: unknown) {
  return value === null || (Number.isSafeInteger(value) && Number(value) > 0)
}

function text(
  value: unknown,
  minimum: number,
  maximum: number,
): value is string {
  if (typeof value !== 'string') return false
  const length = [...value].length
  return length >= minimum && length <= maximum
}

function avatarPreset(value: unknown): value is CommunityAvatarPreset | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      AVATAR_PRESETS.has(value as CommunityAvatarPreset))
  )
}

function httpsUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password
  } catch {
    return false
  }
}

function parseAuthor(value: unknown): CommunityAuthor | null {
  const author = record(value)
  if (!author) return null
  const hasAvatarPreset = Object.hasOwn(author, 'avatarPreset')
  const allowedKeys = hasAvatarPreset
    ? ['communityProfileId', 'displayName', 'avatarPreset', 'state']
    : ['communityProfileId', 'displayName', 'state']
  const normalizedAvatarPreset = hasAvatarPreset ? author.avatarPreset : null
  if (
    !exactKeys(author, allowedKeys) ||
    typeof author.communityProfileId !== 'string' ||
    !UUID.test(author.communityProfileId) ||
    !text(author.displayName, 1, 80) ||
    !avatarPreset(normalizedAvatarPreset) ||
    (author.state !== 'ACTIVE' && author.state !== 'DELETED')
  ) {
    return null
  }
  return {
    communityProfileId: author.communityProfileId,
    displayName: author.displayName,
    avatarPreset: normalizedAvatarPreset,
    state: author.state,
  }
}

export function parseCommunityProfile(value: unknown): CommunityProfile | null {
  const profile = record(value)
  if (
    !profile ||
    !exactKeys(profile, [
      'communityProfileId',
      'displayName',
      'avatarPreset',
      'status',
      'version',
      'createdAt',
      'updatedAt',
    ]) ||
    typeof profile.communityProfileId !== 'string' ||
    !UUID.test(profile.communityProfileId) ||
    !text(profile.displayName, 1, 80) ||
    !avatarPreset(profile.avatarPreset) ||
    (profile.status !== 'ACTIVE' && profile.status !== 'DELETED') ||
    !nonNegativeInteger(profile.version) ||
    !dateTime(profile.createdAt) ||
    !dateTime(profile.updatedAt)
  ) {
    return null
  }
  return profile as CommunityProfile
}

export function parseCommunityProfileInput(
  value: unknown,
): PutCommunityProfileRequest | null {
  const input = record(value)
  if (
    !input ||
    !exactKeys(input, ['displayName', 'avatarPreset']) ||
    !text(input.displayName, 1, 80) ||
    input.displayName !== (input.displayName as string).trim() ||
    !avatarPreset(input.avatarPreset)
  ) {
    return null
  }
  return input as PutCommunityProfileRequest
}

export function isCommunityEtag(value: string | null): value is string {
  return value !== null && /^"(0|[1-9]\d*)"$/.test(value)
}

function parseCounts(value: unknown) {
  const counts = record(value)
  return Boolean(
    counts &&
    exactKeys(counts, ['comments', 'reactions']) &&
    nonNegativeInteger(counts.comments) &&
    nonNegativeInteger(counts.reactions),
  )
}

function parseMedia(value: unknown) {
  const media = record(value)
  return Boolean(
    media &&
    exactKeys(media, [
      'mediaId',
      'type',
      'url',
      'width',
      'height',
      'durationSeconds',
      'altText',
    ]) &&
    typeof media.mediaId === 'string' &&
    UUID.test(media.mediaId) &&
    typeof media.type === 'string' &&
    MEDIA_TYPES.has(media.type) &&
    httpsUrl(media.url) &&
    nullablePositiveInteger(media.width) &&
    nullablePositiveInteger(media.height) &&
    nullablePositiveInteger(media.durationSeconds) &&
    (media.altText === null || text(media.altText, 0, 300)),
  )
}

function parsePost(
  value: unknown,
  detail: boolean,
): CommunityPostSummary | CommunityPostDetail | null {
  const post = record(value)
  const content = detail ? post?.content : post?.contentPreview
  const author = parseAuthor(post?.author)
  if (
    !post ||
    !exactKeys(post, [
      'postId',
      'author',
      detail ? 'content' : 'contentPreview',
      'topics',
      'media',
      'mediaAvailability',
      'counts',
      'publishedAt',
      'updatedAt',
    ]) ||
    typeof post.postId !== 'string' ||
    !UUID.test(post.postId) ||
    !author ||
    !text(content, 1, detail ? 5000 : 421) ||
    !Array.isArray(post.topics) ||
    post.topics.length < 1 ||
    !post.topics.every(
      (topic) =>
        typeof topic === 'string' && TOPICS.has(topic as CommunityTopicCode),
    ) ||
    new Set(post.topics).size !== post.topics.length ||
    !Array.isArray(post.media) ||
    post.media.length > 10 ||
    !post.media.every(parseMedia) ||
    typeof post.mediaAvailability !== 'string' ||
    !MEDIA_AVAILABILITY.has(post.mediaAvailability) ||
    !parseCounts(post.counts) ||
    !dateTime(post.publishedAt) ||
    !dateTime(post.updatedAt)
  ) {
    return null
  }
  return { ...post, author } as CommunityPostSummary | CommunityPostDetail
}

export function isCommunityPostId(value: string) {
  return UUID.test(value)
}

export function isCommunityTopic(value: string): value is CommunityTopicCode {
  return TOPICS.has(value as CommunityTopicCode)
}

export function parseCommunityPostWrite(
  value: unknown,
): CommunityPostWrite | null {
  const input = record(value)
  if (
    !input ||
    !exactKeys(input, ['content', 'topics', 'mediaIds']) ||
    !text(input.content, 1, 5000) ||
    (input.content as string).trim().length === 0 ||
    !Array.isArray(input.topics) ||
    input.topics.length < 1 ||
    input.topics.length > 3 ||
    !input.topics.every(
      (topic) =>
        typeof topic === 'string' && TOPICS.has(topic as CommunityTopicCode),
    ) ||
    new Set(input.topics).size !== input.topics.length ||
    !Array.isArray(input.mediaIds) ||
    input.mediaIds.length > 10 ||
    !input.mediaIds.every((mediaId) =>
      typeof mediaId === 'string' ? UUID.test(mediaId) : false,
    ) ||
    new Set(input.mediaIds).size !== input.mediaIds.length
  ) {
    return null
  }
  return input as CommunityPostWrite
}

export function parseOwnerVersion(value: string | null): number | null {
  if (!value || !/^"(?:0|[1-9]\d*)"$/.test(value)) return null
  const version = Number(value.slice(1, -1))
  return Number.isSafeInteger(version) ? version : null
}

export function parseCommunityFeedPage(
  value: unknown,
): CommunityFeedPage | null {
  const page = record(value)
  const items = Array.isArray(page?.items)
    ? page.items.map((item) => parsePost(item, false))
    : null
  if (
    !page ||
    !exactKeys(page, ['items', 'nextCursor', 'hasMore']) ||
    !items ||
    items.some((item) => item === null) ||
    !(page.nextCursor === null || typeof page.nextCursor === 'string') ||
    (typeof page.nextCursor === 'string' && page.nextCursor.length > 256) ||
    typeof page.hasMore !== 'boolean' ||
    (page.hasMore && !page.nextCursor)
  ) {
    return null
  }
  return { ...page, items } as CommunityFeedPage
}

export function parseCommunityPostDetail(
  value: unknown,
): CommunityPostDetail | null {
  return parsePost(value, true) as CommunityPostDetail | null
}

export function parseCommunityTopics(value: unknown): CommunityTopic[] | null {
  if (
    !Array.isArray(value) ||
    value.length !== 6 ||
    !value.every((entry) => {
      const topic = record(entry)
      return Boolean(
        topic &&
        exactKeys(topic, ['code', 'label', 'description']) &&
        typeof topic.code === 'string' &&
        TOPICS.has(topic.code as CommunityTopicCode) &&
        text(topic.label, 1, 80) &&
        text(topic.description, 1, 240),
      )
    }) ||
    new Set(value.map((entry) => (entry as { code: string }).code)).size !== 6
  ) {
    return null
  }
  return value as CommunityTopic[]
}

export function parseCommunityProblem(
  value: unknown,
  responseStatus: number,
): CommunityProblem | null {
  const problem = record(value)
  if (
    !problem ||
    typeof problem.type !== 'string' ||
    typeof problem.title !== 'string' ||
    problem.status !== responseStatus ||
    typeof problem.code !== 'string' ||
    !/^[A-Z0-9_]{1,64}$/.test(problem.code)
  ) {
    return null
  }
  return problem as CommunityProblem
}
