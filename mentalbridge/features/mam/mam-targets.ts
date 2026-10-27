// Target registry (docs/ADR_MAM_RIVE_V1_CONTRACT.md, "Ownership" and
// "Explanation sources in V1"). A target declares its kind and context IDs
// from props; Mầm never reads page text. Outside SupportPlan every answer is
// reviewed copy declared here, so no target sends anything to a model.
import { MAM_RESOURCE_FALLBACK, mamResourceAnswer } from './mam-resources'

export const MAM_TARGETS_VERSION = 'mam-targets-v1'

export const MAM_INTENTS = ['EXPLAIN', 'WHERE_TO_START'] as const
export type MamIntent = (typeof MAM_INTENTS)[number]

export const MAM_INTENT_LABELS: Record<MamIntent, string> = {
  EXPLAIN: 'Mầm giải thích',
  WHERE_TO_START: 'Nên bắt đầu từ đâu?',
}

type MamTargetDefinition = Readonly<{
  /** A page target is summoned from the dock; others from their element. */
  page: boolean
  intents: readonly MamIntent[]
  /** Context keys a target may pass. Anything else is dropped. */
  contextKeys: readonly string[]
  explain: string
  /** Shown instead of the intent's template when no answer resolves. */
  fallback?: string
}>

const MAM_TARGET_DEFINITIONS = {
  'dashboard.page': {
    page: true,
    intents: ['EXPLAIN', 'WHERE_TO_START'],
    contextKeys: [],
    explain:
      'Đây là trang chính của bạn. Thẻ trên cùng là bước nên làm tiếp theo. Bên dưới là cảm xúc tuần này, bài đọc và buổi hẹn sắp tới.',
  },
  'home.next-step': {
    page: false,
    intents: ['EXPLAIN'],
    contextKeys: [],
    explain:
      'Thẻ này cho biết bạn đang ở đâu trên hành trình và một việc nên làm tiếp. Bạn có thể làm ngay hoặc để sau.',
  },
  'home.resources': {
    page: false,
    intents: ['EXPLAIN'],
    contextKeys: [],
    explain:
      'Đây là vài bài đọc và bài tập ngắn từ thư viện MentalBridge. Chọn bài nào cũng được, không cần làm hết.',
  },
  'home.appointment': {
    page: false,
    intents: ['EXPLAIN'],
    contextKeys: [],
    explain:
      'Thẻ này hiện buổi hẹn gần nhất với chuyên gia. Mở thẻ để xem giờ hẹn và cách tham gia.',
  },
  'achievements.page': {
    page: true,
    intents: ['EXPLAIN'],
    contextKeys: [],
    explain:
      'Trang này giữ những dấu mốc được lưu từ hoạt động của bạn. Không có xếp hạng hay chuỗi phải giữ, chỉ để bạn nhìn lại.',
  },
  'resources.card': {
    page: false,
    intents: ['EXPLAIN'],
    contextKeys: ['resourceId'],
    // Answered from the published catalogue item (mam-resources.ts).
    explain: '',
    fallback: MAM_RESOURCE_FALLBACK,
  },
  'resources.page': {
    page: true,
    intents: ['EXPLAIN'],
    contextKeys: [],
    explain:
      'Đây là thư viện bài đọc, bài tập và video. Bạn chọn theo chủ đề mình quan tâm và làm theo nhịp của mình.',
  },
} as const satisfies Record<string, MamTargetDefinition>

export type MamTargetKind = keyof typeof MAM_TARGET_DEFINITIONS

export type MamTargetDescriptor = Readonly<{
  kind: MamTargetKind
  context?: Readonly<Record<string, string>>
}>

export type MamTarget = Readonly<{
  version: typeof MAM_TARGETS_VERSION
  kind: MamTargetKind
  page: boolean
  intents: readonly MamIntent[]
  context: Readonly<Record<string, string>>
}>

// Context carries identifiers only: never titles, notes or other free text.
const CONTEXT_ID = /^[A-Za-z0-9_-]{1,64}$/

const definitionOf = (kind: unknown): MamTargetDefinition | null =>
  typeof kind === 'string' && Object.hasOwn(MAM_TARGET_DEFINITIONS, kind)
    ? MAM_TARGET_DEFINITIONS[kind as MamTargetKind]
    : null

/** Fails closed: an unknown kind is null; context outside the allowlist is dropped. */
export function resolveMamTarget(descriptor: unknown): MamTarget | null {
  if (!descriptor || typeof descriptor !== 'object') return null
  const { kind, context } = descriptor as Record<string, unknown>
  const definition = definitionOf(kind)
  if (!definition) return null
  const allowed: Record<string, string> = {}
  if (context && typeof context === 'object') {
    for (const key of definition.contextKeys) {
      const value = (context as Record<string, unknown>)[key]
      if (typeof value === 'string' && CONTEXT_ID.test(value))
        allowed[key] = value
    }
  }
  return {
    version: MAM_TARGETS_VERSION,
    kind: kind as MamTargetKind,
    page: definition.page,
    intents: definition.intents,
    context: allowed,
  }
}

export type MamAnswer = Readonly<{
  text: string
  /** A registered target the answer can take the user to. */
  focusKind?: MamTargetKind
  /** A reviewed Resource detail the answer can open. */
  href?: string
}>

export const MAM_FALLBACK_TEXT: Record<MamIntent, string> = {
  EXPLAIN:
    'Mầm chưa giải thích được phần này lúc này. Bạn cứ dùng trang như bình thường nhé.',
  WHERE_TO_START:
    'Mầm chưa gợi ý được lúc này. Bạn có thể bắt đầu từ thẻ đầu tiên trên trang.',
}

/**
 * Reviewed copy for a starter. `isRegistered` says whether a target kind is on
 * the page now, so "where to start" points only at a card that exists.
 */
export function mamReviewedAnswer(
  target: MamTarget,
  intent: MamIntent,
  isRegistered: (kind: MamTargetKind) => boolean,
): MamAnswer | null {
  if (!target.intents.includes(intent)) return null
  if (target.kind === 'resources.card')
    return mamResourceAnswer(target.context.resourceId)
  if (intent === 'EXPLAIN')
    return { text: MAM_TARGET_DEFINITIONS[target.kind].explain }
  if (target.kind === 'dashboard.page' && isRegistered('home.next-step'))
    return {
      text: 'Bắt đầu từ thẻ “Bước tiếp theo” nhé. Một việc nhỏ ở đó là đủ cho hôm nay.',
      focusKind: 'home.next-step',
    }
  return null
}

/** The text for a failed or unresolved starter on this target. */
export const mamFallbackText = (target: MamTarget, intent: MamIntent) =>
  (MAM_TARGET_DEFINITIONS[target.kind] as MamTargetDefinition).fallback ??
  MAM_FALLBACK_TEXT[intent]

export const isMamTargetKind = (value: unknown): value is MamTargetKind =>
  definitionOf(value) !== null
