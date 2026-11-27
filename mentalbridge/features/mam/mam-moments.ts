// Mầm "moments" (owner copy, 2026-11-27, .artifacts/mam-kb2-owner-copy.md): Mầm stays with the user around a
// specialist booking (KB2), explains the Support Guide, and comforts after a skipped or missed plan activity.
// Pure: what to say for a moment, and which moment the current data calls for. The hook shows them.
import type { Appointment } from '@/lib/consultation/consultation-validation'
import { readMamDaily, writeMamDaily, mamDailyKey } from './mam-daily'
import type { MamBubbleSpec, MamGuideAction } from './mam-guide'

export type MamMomentKind =
  | 'booking-requested'
  | 'booking-confirmed'
  | 'booking-declined'
  | 'session-soon'
  | 'session-done'
  | 'session-rating'
  | 'guide-open'
  | 'guide-pick'
  | 'plan-skipped'
  | 'plan-missed-days'
  | 'plan-reminder'
  | 'plan-reask'

export type MamMoment = Readonly<{
  kind: MamMomentKind
  /** Shown once per key, ever (per account). */
  key: string
  /** guide-pick: the lightest activity, its name and where it opens. */
  activity?: Readonly<{ title: string; href: string }>
  /** plan-skipped / plan-reminder: where today's activity opens. */
  href?: string
  /** session-soon: the session is later today, not tomorrow. */
  today?: boolean
}>

export const MAM_MOMENT_EVENT = 'mam:moment'
/** Booking news older than this is history, not a moment (first visit after a long time stays quiet). */
export const MAM_MOMENT_FRESH_MS = 72 * 3_600_000
const SOON_MS = 24 * 3_600_000

const act = (
  label: string,
  tone: MamGuideAction['tone'],
  go: MamGuideAction['go'],
  href?: string,
): MamGuideAction => ({ label, tone, go, ...(href ? { href } : {}) })

/** The bubble for a moment; the copy is the owner's, word for word. */
export function momentSpec(moment: MamMoment): MamBubbleSpec {
  switch (moment.kind) {
    case 'booking-requested':
      return {
        kind: 'story',
        text: 'Đặt xong rồi nè. Mầm ở đây với bạn trong lúc chờ nhé, không để bạn chờ 1 mình đâu.',
        motion: { loop: 'sit_hug' },
      }
    case 'booking-confirmed':
      return {
        kind: 'story',
        text: 'Chuyên gia xác nhận rồi nè. Bạn đã làm được bước khó nhất rồi đó, là dám đặt lịch.',
        motion: { loop: 'happy', shot: 'thumbs_up' },
      }
    case 'booking-declined':
      return {
        kind: 'ask',
        text: 'Mầm nè, lịch này không được rồi. Không phải do bạn đâu, đừng buồn nhé. Mầm ở đây với bạn nè, mình tìm lịch khác với nhau nhé, được không?',
        actions: [
          act('Tìm chuyên gia khác', 'primary', 'go', '/specialists'),
          act('Để Mầm ở đây với bạn 1 chút', 'secondary', 'stay'),
        ],
        motion: { loop: 'gentle', shot: 'pop_up' },
      }
    case 'session-soon':
      return {
        kind: 'ask',
        text: `${moment.today ? 'Hôm nay' : 'Mai'} bạn gặp chuyên gia rồi nè. Bạn không cần chuẩn bị gì nhiều đâu. Chỉ cần nghĩ 1-2 điều muốn nói nhất là được rồi. Bạn muốn kể cho Mầm nghe thử trước không?`,
        actions: [
          act('Kể cho Mầm nghe thử', 'primary', 'go', '/ai-companion'),
          act('Để mình tự nghĩ 1 chút', 'secondary', 'decline'),
        ],
        motion: { loop: 'explaining', shot: 'point' },
      }
    case 'session-done':
      return {
        kind: 'ask',
        text: 'Bạn gặp xong rồi nè. Mầm vui vì bạn đã dám đi gặp. Hôm nay bạn thấy sao, có nhẹ hơn chút nào không?',
        actions: [
          act('Kể cho Mầm nghe', 'primary', 'go', '/ai-companion'),
          act('Để mình nghỉ chút', 'secondary', 'decline'),
        ],
        motion: { loop: 'gentle', shot: 'nod' },
      }
    case 'session-rating':
      return {
        kind: 'story',
        text: 'Bạn đánh giá giúp Mầm 1 chút nhé, để lần sau Mầm dẫn bạn đi đúng hơn. Không cần viết dài đâu, chọn sao thôi cũng được.',
        motion: { loop: 'listening', shot: 'point' },
      }
    case 'guide-open':
      return {
        kind: 'ask',
        text: 'Đây là kế hoạch của bạn nè. Bạn không cần làm hết đâu. Mầm chỉ bạn 1 cái nhẹ nhất để bắt đầu nhé, được không?',
        actions: [
          act('Chỉ Mầm đi', 'primary', 'pick'),
          act('Để mình tự xem', 'secondary', 'decline'),
        ],
        motion: { loop: 'explaining', shot: 'wave' },
      }
    case 'guide-pick':
      return {
        kind: 'ask',
        text: `Mầm thấy cái này nhẹ nhất nè: ${moment.activity?.title ?? 'hoạt động đầu tiên'}. Làm 5 phút thôi là xong. Bạn thử cái này với Mầm nhé?`,
        actions: [
          act('Làm cùng Mầm', 'primary', 'go', moment.activity?.href),
          act('Chọn cái khác', 'secondary', 'decline'),
        ],
        motion: { loop: 'explaining', shot: 'point' },
      }
    case 'plan-skipped':
      return {
        kind: 'ask',
        text: 'Mầm nè, hôm nay bạn chưa làm được cái đó đúng không? Không sao đâu, không sao hết. Mai mình làm 5 phút thôi cũng được, không cần làm hết đâu.',
        actions: [
          act('Mai Mầm nhắc mình nhé', 'primary', 'remind'),
          act('Để Mầm ở đây với mình 1 chút', 'secondary', 'stay'),
        ],
        // Sits beside the user: no standing up, no pointing.
        motion: { loop: 'sit_hug' },
      }
    case 'plan-missed-days':
      return {
        kind: 'ask',
        text: 'Mầm thấy mấy hôm nay bạn chưa làm được gì, Mầm vẫn ở đây nè. Không cần làm lại hết đâu, mình làm 1 cái nhỏ nhất thôi, được không?',
        actions: [
          act(
            'Làm 1 cái nhỏ với Mầm',
            'primary',
            'go',
            moment.href ?? '/support-plan',
          ),
          act('Để sau đi', 'secondary', 'decline'),
        ],
        motion: { loop: 'sit_hug', shot: 'nod' },
      }
    case 'plan-reask':
      // Free said "Để sau" to the plan in the walk: asked once more, a day later, then never again.
      return {
        kind: 'ask',
        text: 'Mầm hỏi lại một lần nha. Hôm trước Mầm có nhắc bạn vụ Kế hoạch hỗ trợ 14 ngày, bạn có muốn xem thử không? Không thì thôi, Mầm không hỏi nữa đâu.',
        actions: [
          act('Xem thử', 'primary', 'go', '/subscription'),
          act('Thôi, để sau', 'secondary', 'decline'),
        ],
        motion: { loop: 'curious', shot: 'look_around' },
      }
    case 'plan-reminder':
      // The reminder the user asked for after a skip ("Mai Mầm nhắc mình nhé"); same voice, 5 minutes only.
      return {
        kind: 'ask',
        text: 'Mầm nhắc nè: hôm nay mình làm 5 phút thôi nha, không cần làm hết đâu.',
        actions: [
          act(
            'Làm 5 phút với Mầm',
            'primary',
            'go',
            moment.href ?? '/support-plan',
          ),
          act('Để sau đi', 'secondary', 'decline'),
        ],
        motion: { loop: 'gentle', shot: 'wave' },
      }
  }
}

const seenKey = (accountId: string, key: string) =>
  mamDailyKey('moment', accountId, key)
export const momentSeen = (accountId: string, key: string) =>
  readMamDaily(seenKey(accountId, key)) !== null
export const markMomentSeen = (accountId: string, key: string) =>
  writeMamDaily(seenKey(accountId, key), '1')

const fresh = (at: string | null, now: number) =>
  at !== null && now - Date.parse(at) <= MAM_MOMENT_FRESH_MS

/**
 * The booking moments the user's appointments call for now, most needed first: a declined or expired request
 * (comfort right away), a session within a day, a fresh confirmation, a session just completed and, where the
 * rating button is on screen, the rating nudge after it. The hook shows each once, one at a time.
 */
export function appointmentMoments(
  items: readonly Appointment[],
  now: number,
  options: Readonly<{ withRating?: boolean }> = {},
): MamMoment[] {
  const moments: MamMoment[] = []
  for (const a of items)
    if (
      (a.status === 'REJECTED' && fresh(a.decidedAt, now)) ||
      (a.status === 'EXPIRED' && fresh(a.decisionDeadlineAt, now))
    )
      moments.push({ kind: 'booking-declined', key: `declined:${a.id}` })
  for (const a of items)
    if (
      a.status === 'CONFIRMED' &&
      Date.parse(a.scheduledStartAt) > now &&
      Date.parse(a.scheduledStartAt) - now <= SOON_MS
    )
      moments.push({
        kind: 'session-soon',
        key: `soon:${a.id}`,
        today:
          new Date(a.scheduledStartAt).toDateString() ===
          new Date(now).toDateString(),
      })
  for (const a of items)
    if (a.status === 'CONFIRMED' && fresh(a.decidedAt, now))
      moments.push({ kind: 'booking-confirmed', key: `confirmed:${a.id}` })
  for (const a of items)
    if (
      a.status === 'COMPLETED' &&
      fresh(a.sessionSettledAt ?? a.sessionEndedAt, now)
    ) {
      moments.push({ kind: 'session-done', key: `done:${a.id}` })
      if (options.withRating)
        moments.push({ kind: 'session-rating', key: `rating:${a.id}` })
    }
  return moments
}

/** Consecutive local days, ending yesterday, on which planned activities existed and none was completed. */
export function missedDayStreak(
  days: readonly Readonly<{
    localDate: string
    planned: number
    completed: number
  }>[],
  today: string,
): number {
  let streak = 0
  for (const day of [...days]
    .filter((d) => d.localDate < today)
    .sort((a, b) => b.localDate.localeCompare(a.localDate))) {
    if (day.planned === 0) continue
    if (day.completed > 0) break
    streak += 1
  }
  return streak
}

/** The lightest first activity of a Support Guide: a 5-minute practice before reading or watching. */
const LIGHTEST: readonly string[] = [
  'BREATHING',
  'MEDITATION',
  'JOURNALING',
  'ARTICLE',
  'VIDEO',
  'COMMUNITY',
]
export function lightestActivity(
  resources: readonly Readonly<{
    resourceId: string
    contentVersion: string
    category: string
    title: string
  }>[],
): Readonly<{ title: string; href: string }> | null {
  const rank = (category: string) => {
    const at = LIGHTEST.indexOf(category)
    return at < 0 ? LIGHTEST.length : at
  }
  const pick = [...resources].sort(
    (a, b) => rank(a.category) - rank(b.category),
  )[0]
  return pick
    ? {
        title: pick.title,
        href: `/resources/${pick.resourceId}?contentVersion=${encodeURIComponent(pick.contentVersion)}`,
      }
    : null
}

/**
 * Where a moment may speak. The Support Guide moments belong to the Guide page: anywhere else (the journal,
 * the chat) "Mầm chỉ bạn 1 cái nhẹ nhất" would be out of context (owner 2026-11-27). They wait for the Guide.
 */
export function momentFits(
  moment: MamMoment,
  pathname: string | null,
): boolean {
  if (moment.kind === 'guide-open' || moment.kind === 'guide-pick')
    return pathname?.startsWith('/support-guides') ?? false
  if (moment.kind === 'plan-reask') return pathname === '/dashboard'
  return true
}

export function dispatchMamMoment(moment: MamMoment) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(MAM_MOMENT_EVENT, { detail: moment }))
}

const KINDS: readonly MamMomentKind[] = [
  'booking-requested',
  'booking-confirmed',
  'booking-declined',
  'session-soon',
  'session-done',
  'session-rating',
  'guide-open',
  'guide-pick',
  'plan-skipped',
  'plan-missed-days',
  'plan-reminder',
  'plan-reask',
]
const SAFE_HREF = /^\/[A-Za-z0-9/_?=&.%-]*$/

export function parseMamMoment(detail: unknown): MamMoment | null {
  if (!detail || typeof detail !== 'object') return null
  const value = detail as Record<string, unknown>
  if (
    !KINDS.includes(value.kind as MamMomentKind) ||
    typeof value.key !== 'string' ||
    !value.key
  )
    return null
  const href =
    typeof value.href === 'string' && SAFE_HREF.test(value.href)
      ? value.href
      : undefined
  const activity =
    value.activity &&
    typeof value.activity === 'object' &&
    typeof (value.activity as { title?: unknown }).title === 'string' &&
    typeof (value.activity as { href?: unknown }).href === 'string' &&
    SAFE_HREF.test((value.activity as { href: string }).href)
      ? {
          title: (value.activity as { title: string }).title.slice(0, 80),
          href: (value.activity as { href: string }).href,
        }
      : undefined
  return {
    kind: value.kind as MamMomentKind,
    key: value.key,
    ...(href ? { href } : {}),
    ...(activity ? { activity } : {}),
    ...(value.today === true ? { today: true } : {}),
  }
}
