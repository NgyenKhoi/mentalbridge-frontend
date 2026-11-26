// Mầm guide (mam-guide design, phase 1): leads a new user, one step at a time, from the first screening
// result through a first journal, a first chat and a call or a relaxation, then "graduates" them. Pure core:
// state, step order and the reviewed bubble copy. The host (`use-mam-guide.ts`) owns timers, storage and DOM.
import type { MamLoopingBehavior, MamOneShot } from './mam-contract'
import { slottedMamAccountId } from './MamDockSlot'

export type MamGuideStep = 'journal' | 'chat' | 'unwind'
export type MamGuidePlan = 'FREE' | 'PLUS' | 'PREMIUM'
export type MamGuideTier =
  | 'SELF_GUIDED_SUPPORT'
  | 'PROFESSIONAL_SUPPORT_RECOMMENDED'
  | 'SAFETY_FOLLOW_UP_RECOMMENDED'

export type MamGuideEvent =
  | Readonly<{ type: 'result'; tier: MamGuideTier }>
  | Readonly<{ type: 'journal-created' }>
  | Readonly<{ type: 'chat-replied'; userTurns: number; plan: MamGuidePlan }>
  | Readonly<{ type: 'call-ended' }>
  | Readonly<{ type: 'resource-done' }>

/** What just happened, and which step Mầm offers next. */
export type MamGuidePending = Readonly<{
  after: 'result' | 'journal' | 'chat' | 'call' | 'relax' | 'reoffer'
  next: MamGuideStep | 'graduate' | null
}>

export interface MamGuideState {
  version: 1
  startedAt: string
  done: Partial<Record<MamGuideStep, string>>
  declined: Partial<Record<MamGuideStep, { at: string; reoffered: boolean }>>
  pending: MamGuidePending | null
  unwindKind: 'call' | 'relax' | null
  plan: MamGuidePlan | null
  graduatedAt: string | null
}

export type MamGuideGo =
  | 'journal'
  | 'chat-journal'
  | 'chat-result'
  | 'call'
  | 'relax'
  | 'decline'
  | 'graduate'
  // Moments (mam-moments.ts): open the action's href, stay beside the user, remind tomorrow, pick one activity.
  | 'go'
  | 'stay'
  | 'remind'
  | 'pick'

export type MamGuideAction = Readonly<{
  label: string
  tone: 'primary' | 'secondary'
  go: MamGuideGo
  /** A moment action that opens a page (go: 'go'). */
  href?: string
}>

/** What Mầm does while a bubble is up: a looping look, and a one-shot as it opens. */
export type MamGuideMotion = Readonly<{
  loop: MamLoopingBehavior
  shot?: MamOneShot
}>

export type MamBubbleSpec =
  | Readonly<{
      kind: 'story'
      text: string
      withContext?: string
      motion?: MamGuideMotion
    }>
  | Readonly<{
      kind: 'ask'
      text: string
      actions: readonly MamGuideAction[]
      motion?: MamGuideMotion
    }>
  | Readonly<{ kind: 'consent' }>

/** "Thở chậm trong 5 phút", a reviewed catalogue item with a fixed seeded id. */
export const RELAX_RESOURCE_ID = '00000000-0000-4000-8000-000000000201'
export const MAM_GUIDE_EVENT = 'mam:guide'

/** Where an action leads; decline and graduate stay on the page. */
export function guideHref(go: MamGuideGo): string | null {
  switch (go) {
    case 'journal':
      return '/journal?compose=guide'
    case 'chat-journal':
      return '/ai-companion?opening=FROM_JOURNAL'
    case 'chat-result':
      return '/ai-companion?opening=FROM_RESULT'
    case 'call':
      return '/ai-companion?call=1'
    case 'relax':
      return `/resources/${RELAX_RESOURCE_ID}`
    default:
      return null
  }
}
export const MAM_GUIDE_CRUDE_WORDS = [
  'vãi',
  'vcl',
  'đm',
  'cc',
  'vl',
  'đéo',
] as const
const ORDER: readonly MamGuideStep[] = ['journal', 'chat', 'unwind']
const storageKey = (accountId: string) => `mb:mam-guide:v1:${accountId}`

/** A story holds at least 4 s; the longer v2 lines get reading time (about 20 characters a second), up to 9 s. */
export const guideHoldMs = (text: string) =>
  Math.min(9000, Math.max(4000, 2000 + 50 * text.length))

/**
 * Reports a verified moment to the guide. With a Mầm layout mounted the dock host hears it; screening runs
 * outside that layout, so there the caller passes the account and the moment is recorded for later.
 */
export function dispatchMamGuide(event: MamGuideEvent, accountId?: string) {
  if (typeof window === 'undefined') return
  const slotted = slottedMamAccountId()
  if (slotted) {
    window.dispatchEvent(
      new CustomEvent(MAM_GUIDE_EVENT, {
        detail: { ...event, accountId: slotted },
      }),
    )
    return
  }
  if (!accountId) return
  const next = reduceGuide(
    readGuide(accountId),
    event,
    new Date().toISOString(),
  )
  if (next) writeGuide(accountId, next)
}

const PLANS: readonly string[] = ['FREE', 'PLUS', 'PREMIUM']
const TIERS: readonly string[] = [
  'SELF_GUIDED_SUPPORT',
  'PROFESSIONAL_SUPPORT_RECOMMENDED',
  'SAFETY_FOLLOW_UP_RECOMMENDED',
]

/** The event for this account, or null: another account or an unknown shape. */
export function parseMamGuideEvent(
  detail: unknown,
  accountId: string,
): MamGuideEvent | null {
  if (typeof detail !== 'object' || detail === null) return null
  const value = detail as Record<string, unknown>
  if (value.accountId !== accountId) return null
  switch (value.type) {
    case 'result':
      return TIERS.includes(String(value.tier))
        ? { type: 'result', tier: value.tier as MamGuideTier }
        : null
    case 'chat-replied':
      return Number.isInteger(value.userTurns) &&
        (value.userTurns as number) >= 0 &&
        PLANS.includes(String(value.plan))
        ? {
            type: 'chat-replied',
            userTurns: value.userTurns as number,
            plan: value.plan as MamGuidePlan,
          }
        : null
    case 'journal-created':
    case 'call-ended':
    case 'resource-done':
      return { type: value.type }
    default:
      return null
  }
}

export function readGuide(accountId: string): MamGuideState | null {
  try {
    const raw = window.localStorage.getItem(storageKey(accountId))
    if (!raw) return null
    const value = JSON.parse(raw) as MamGuideState
    return value && value.version === 1 && typeof value.startedAt === 'string'
      ? value
      : null
  } catch {
    return null
  }
}

export function writeGuide(accountId: string, state: MamGuideState) {
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(state))
  } catch {
    // Storage blocked: the guide lasts for this tab only.
  }
}

/** The next step to offer: the first one neither done nor waiting after a decline. */
function nextStep(state: MamGuideState): MamGuideStep | 'graduate' | null {
  if (ORDER.every((step) => state.done[step])) return 'graduate'
  return (
    ORDER.find((step) => !state.done[step] && !state.declined[step]) ?? null
  )
}

function complete(
  state: MamGuideState,
  step: MamGuideStep,
  after: MamGuidePending['after'],
  now: string,
): MamGuideState {
  if (state.done[step]) return state
  const declined = { ...state.declined }
  delete declined[step]
  const updated: MamGuideState = {
    ...state,
    declined,
    done: { ...state.done, [step]: now },
  }
  return { ...updated, pending: { after, next: nextStep(updated) } }
}

/** Pure: the state after an event. Null stays null except for a first mild result. */
export function reduceGuide(
  state: MamGuideState | null,
  event: MamGuideEvent,
  now: string,
): MamGuideState | null {
  if (!state) {
    // Phase 1 guides the mild pathway only; moderate+ and safety keep today's screens.
    if (event.type !== 'result' || event.tier !== 'SELF_GUIDED_SUPPORT')
      return null
    return {
      version: 1,
      startedAt: now,
      done: {},
      declined: {},
      pending: { after: 'result', next: 'journal' },
      unwindKind: null,
      plan: null,
      graduatedAt: null,
    }
  }
  if (state.graduatedAt) return state
  switch (event.type) {
    case 'result':
      return state
    case 'journal-created':
      return complete(state, 'journal', 'journal', now)
    case 'chat-replied': {
      const withPlan = { ...state, plan: event.plan }
      return event.userTurns >= 3
        ? complete(withPlan, 'chat', 'chat', now)
        : withPlan
    }
    case 'call-ended':
      return state.done.unwind
        ? state
        : complete({ ...state, unwindKind: 'call' }, 'unwind', 'call', now)
    case 'resource-done':
      return state.done.unwind
        ? state
        : complete({ ...state, unwindKind: 'relax' }, 'unwind', 'relax', now)
  }
}

/** Pure: the user answered the ask bubble of the pending sequence. */
export function actGuide(
  state: MamGuideState,
  go: MamGuideGo,
  now: string,
): MamGuideState {
  const offered = state.pending?.next
  const cleared = { ...state, pending: null }
  if (go === 'graduate') return { ...cleared, graduatedAt: now }
  if (go === 'decline' && offered && offered !== 'graduate')
    return {
      ...cleared,
      declined: {
        ...state.declined,
        [offered]: {
          at: now,
          reoffered: state.pending?.after === 'reoffer',
        },
      },
    }
  return cleared
}

/**
 * Pure: on a new page session, offer a declined step once more, softly; or, when the user took a side path
 * (relax or chat first) and left it unfinished, pick the walk up again at the next open step.
 */
export function startGuideSession(state: MamGuideState): MamGuideState {
  if (state.graduatedAt || state.pending) return state
  const step = ORDER.find(
    (item) =>
      !state.done[item] &&
      state.declined[item] &&
      !state.declined[item]?.reoffered,
  )
  if (!step) {
    // A step said no to twice keeps Mầm quiet: the side-path pickup is only for a walk left half way.
    if (Object.keys(state.declined).length) return state
    const open = nextStep(state)
    return open && open !== 'graduate'
      ? { ...state, pending: { after: 'reoffer', next: open } }
      : state
  }
  return {
    ...state,
    declined: {
      ...state.declined,
      [step]: { ...state.declined[step]!, reoffered: true },
    },
    pending: { after: 'reoffer', next: step },
  }
}

const decline = (label = 'Để sau đi'): MamGuideAction => ({
  label,
  tone: 'secondary',
  go: 'decline',
})

function offer(
  step: MamGuideStep,
  after: MamGuidePending['after'],
  plan: MamGuidePlan | null,
): MamBubbleSpec {
  if (step === 'journal')
    return {
      kind: 'ask',
      text: 'Mầm có 1 việc nhỏ thôi: viết ra 3 thứ đang làm bạn khó chịu nhất hôm nay. Viết ra là nhẹ hơn giữ trong đầu đó, bạn thử viết cùng Mầm không?',
      motion: { loop: 'explaining', shot: 'point' },
      actions: [
        { label: 'Viết nhật ký cùng Mầm', tone: 'primary', go: 'journal' },
        ...(after === 'result'
          ? ([
              {
                label: 'Nhắn với Mầm một chút',
                tone: 'secondary',
                go: 'chat-result',
              },
              { label: 'Nghe 1 bài thư giãn', tone: 'secondary', go: 'relax' },
            ] as const)
          : []),
        decline(),
      ],
    }
  if (step === 'chat')
    return after === 'journal'
      ? {
          kind: 'ask',
          text: 'Giờ kể thêm cho Mầm nghe bằng tin nhắn được không? Không cần dài như nhật ký đâu, kể 1 đoạn làm bạn mệt nhất thôi cũng được.',
          motion: { loop: 'listening' },
          actions: [
            { label: 'Kể tiếp đi', tone: 'primary', go: 'chat-journal' },
            decline('Để mình nghỉ chút'),
          ],
        }
      : {
          kind: 'ask',
          text: 'Kể cho Mầm nghe chuyện dạo này bằng tin nhắn nhé? Gõ ngắn cũng được, Mầm đọc hết mà.',
          motion: { loop: 'listening' },
          actions: [
            { label: 'Nhắn với Mầm', tone: 'primary', go: 'chat-result' },
            decline(),
          ],
        }
  return plan === 'PLUS' || plan === 'PREMIUM'
    ? {
        kind: 'ask',
        text: 'Gõ nhiều mỏi tay rồi ha. Để Mầm gọi cho bạn nhé? Không cần nhìn ai, chỉ cần nói thôi, Mầm nghe bạn là được rồi.',
        motion: { loop: 'listening' },
        actions: [
          { label: 'Gọi cho Mầm', tone: 'primary', go: 'call' },
          { label: 'Nghe nhạc thư giãn trước', tone: 'secondary', go: 'relax' },
          decline(),
        ],
      }
    : {
        kind: 'ask',
        text: 'Nghe 1 bài thư giãn 3 phút với Mầm nhé? Cho đầu mình nghỉ 1 chút, rồi mình kể tiếp sau cũng được.',
        motion: { loop: 'listening' },
        actions: [
          { label: 'Nghe thư giãn', tone: 'primary', go: 'relax' },
          decline(),
        ],
      }
}

// Owner copy v2 (2026-11-26): every line carries one comforting clause; the motion reuses the v0.8 asset's looks.
const REACTIONS: Record<MamGuidePending['after'], readonly MamBubbleSpec[]> = {
  result: [
    {
      kind: 'story',
      text: 'Mầm đọc kết quả của bạn rồi nè. Cảm ơn bạn vì đã làm hết bài, lúc mệt mà làm hết được như vậy là cố lắm rồi đó.',
      motion: { loop: 'curious', shot: 'nod' },
    },
    {
      kind: 'story',
      text: 'Bạn không cần hiểu hết web này đâu. Đi cùng Mầm từng bước nha, Mầm ở đây với bạn mà.',
      motion: { loop: 'gentle', shot: 'wave' },
    },
    {
      kind: 'story',
      text: 'Dạo này bạn hơi mệt trong lòng, nhưng vẫn đang cố giữ mọi thứ ổn đúng không? Mầm nghe được cái mệt đó của bạn rồi nè.',
      motion: { loop: 'listening' },
    },
  ],
  journal: [
    { kind: 'consent' },
    {
      kind: 'story',
      text: 'Mầm thấy bạn vừa viết xong rồi nè. Viết xong chắc trong người cũng nhẹ hơn được 1 chút rồi đúng không?',
      withContext:
        'Ê, Mầm đọc rồi nè. Hôm nay của bạn đúng là 1 ngày oải thật sự luôn á, Mầm đọc mà cũng thấy nặng lòng theo bạn.',
      motion: { loop: 'listening', shot: 'nod' },
    },
    {
      kind: 'story',
      text: 'Dám viết ra hết như vậy là dũng cảm lắm rồi đó. Nhiều người mệt mà còn không dám viết ra đâu, bạn làm được rồi nè.',
      motion: { loop: 'happy', shot: 'clap' },
    },
  ],
  chat: [
    {
      kind: 'story',
      text: 'Cảm ơn bạn đã kể cho Mầm nghe nè. Kể được tới đây là bạn đã tin Mầm lắm rồi đó, Mầm trân trọng cái đó lắm.',
      motion: { loop: 'gentle', shot: 'nod' },
    },
  ],
  call: [
    {
      kind: 'story',
      text: 'Mầm vui vì bạn đã thử gọi cho Mầm nè. Lúc đầu còn ngại mà vẫn dám gọi, là bạn đã tự chăm mình 1 bước rồi đó.',
      motion: { loop: 'happy', shot: 'stretch' },
    },
  ],
  relax: [
    {
      kind: 'story',
      text: 'Thư giãn xong rồi, cơ thể bạn cũng được nghỉ một chút nè. Giờ trong người bạn thấy nhẹ hơn được chút nào chưa?',
      motion: { loop: 'happy', shot: 'stretch' },
    },
  ],
  reoffer: [
    {
      kind: 'story',
      text: 'Mầm hỏi lại một lần nha. Không sao đâu, lúc nãy bạn chưa sẵn sàng thôi mà, giờ Mầm hỏi lại nhẹ nhàng nè.',
      motion: { loop: 'curious', shot: 'look_around' },
    },
  ],
}

function graduation(unwindKind: MamGuideState['unwindKind']): MamBubbleSpec[] {
  return [
    {
      kind: 'story',
      text: 'Nè, bạn thấy không?',
      motion: { loop: 'happy', shot: 'pop_up' },
    },
    {
      kind: 'story',
      text: `Nãy giờ bạn đã tự đi hết 1 vòng rồi đó: viết nhật ký, nhắn với Mầm, rồi ${unwindKind === 'call' ? 'gọi cho Mầm' : 'nghe thư giãn'}. Bạn tự đi được hết luôn, Mầm chỉ đi bên cạnh thôi đó.`,
      motion: { loop: 'explaining' },
    },
    {
      kind: 'story',
      text: 'Từ giờ Mầm sẽ không dẫn từng bước nữa đâu. Vì bạn biết đường rồi, Mầm tin bạn tự đi được.',
      motion: { loop: 'gentle', shot: 'wave' },
    },
    {
      kind: 'ask',
      text: 'Mệt mà muốn xả thì vào Nhật ký, muốn có người nghe thì nhắn Mầm. Mầm vẫn ở góc này nè, cần là gọi Mầm là Mầm chạy ra, chịu không?',
      motion: { loop: 'idle', shot: 'wave' },
      actions: [{ label: 'Chịu, Mầm ơi', tone: 'primary', go: 'graduate' }],
    },
  ]
}

/** The bubbles of a pending sequence: what Mầm says about what happened, then the next offer. */
export function sequenceFor(
  pending: MamGuidePending,
  state: Pick<MamGuideState, 'plan' | 'unwindKind'>,
): MamBubbleSpec[] {
  const lead = [...REACTIONS[pending.after]]
  if (pending.next === 'graduate')
    return [...lead, ...graduation(state.unwindKind)]
  if (!pending.next) return lead
  return [...lead, offer(pending.next, pending.after, state.plan)]
}
