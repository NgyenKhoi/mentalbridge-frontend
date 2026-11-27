// Mầm's words for the 14-day focus goal and the lời hẹn kinds (mam-v3 handoff tables), plus the one
// commitment Home asks about. Pure: copy and a date rule, no storage.
import type {
  CompanionCommitment,
  CompanionCommitmentKind,
  CompanionCommitmentMinutes,
  CompanionFocusGoal,
  CompanionState,
} from '@/lib/companion-state/contract'
import { localDateInTimeZone } from '@/lib/emotion-check-in/presentation'

/** Goal chips in the order the picker shows them. */
export const COMPANION_GOALS: readonly CompanionFocusGoal[] = [
  'SLEEP',
  'STUDY_WORK_PRESSURE',
  'LONELINESS',
  'FAMILY',
  'RELATIONSHIPS',
  'SELF_WORTH',
  'NOT_SURE',
]

/** The chip label of a goal. */
export const GOAL_LABEL: Record<CompanionFocusGoal, string> = {
  SLEEP: 'Giấc ngủ',
  STUDY_WORK_PRESSURE: 'Áp lực học hoặc làm',
  LONELINESS: 'Cảm giác cô đơn',
  FAMILY: 'Chuyện gia đình',
  RELATIONSHIPS: 'Các mối quan hệ',
  SELF_WORTH: 'Cách mình nhìn bản thân',
  NOT_SURE: 'Mình chưa rõ',
}

/** The goal inside a sentence ("mình để ý {phrase} nhé"); null for NOT_SURE, which has its own line. */
export const GOAL_PHRASE: Record<CompanionFocusGoal, string | null> = {
  SLEEP: 'giấc ngủ',
  STUDY_WORK_PRESSURE: 'áp lực học, làm',
  LONELINESS: 'cảm giác cô đơn',
  FAMILY: 'chuyện gia đình',
  RELATIONSHIPS: 'các mối quan hệ',
  SELF_WORTH: 'cách bạn nhìn bản thân',
  NOT_SURE: null,
}

/** The line Mầm says once a goal is saved. */
export const focusSavedLine = (goal: CompanionFocusGoal) => {
  const phrase = GOAL_PHRASE[goal]
  return phrase
    ? `Ok, 14 ngày tới mình để ý ${phrase} nhé.`
    : 'Ok, mình cứ đi rồi tìm ra dần nhé.'
}

/** Kinds the picker offers as chips, in order (SPECIALIST_STEP only comes from a session summary). */
export const COMMITMENT_CHIP_KINDS: readonly CompanionCommitmentKind[] = [
  'STUDY_WORK_STEP',
  'REST',
  'MOVE',
  'CONNECT_PERSON',
  'JOURNAL',
  'RELAX',
  'PLAN_ACTIVITY',
]

/** The chip label of a kind; null: not offered as a chip. */
export const COMMITMENT_CHIP: Record<CompanionCommitmentKind, string | null> = {
  STUDY_WORK_STEP: 'Học/làm 1 bước',
  REST: 'Nghỉ, ngủ sớm',
  MOVE: 'Vận động nhẹ',
  CONNECT_PERSON: 'Nhắn cho 1 người',
  JOURNAL: 'Viết nhật ký',
  RELAX: 'Thư giãn',
  PLAN_ACTIVITY: '1 việc trong kế hoạch',
  SPECIALIST_STEP: null,
}

/** The kind inside a sentence ("Hôm qua mình có hẹn {phrase} nè"). */
export const COMMITMENT_PHRASE: Record<CompanionCommitmentKind, string> = {
  STUDY_WORK_STEP: 'một bước nhỏ cho việc học hoặc làm',
  REST: 'nghỉ ngơi hoặc ngủ sớm hơn',
  MOVE: 'vận động nhẹ',
  CONNECT_PERSON: 'nhắn hoặc gọi cho một người',
  JOURNAL: 'viết vài dòng nhật ký',
  RELAX: 'thư giãn, hít thở',
  PLAN_ACTIVITY: 'một việc trong kế hoạch',
  SPECIALIST_STEP: 'một bước đã thống nhất với chuyên gia',
}

/** Durations the picker offers; null (no time) exists only for steps made without a chip. */
export const COMMITMENT_MINUTES: readonly CompanionCommitmentMinutes[] = [
  5, 10, 15, 25, 30,
]

/** The local date `days` after `date` (both `YYYY-MM-DD`). */
export function shiftLocalDate(date: string, days: number) {
  const day = new Date(`${date}T00:00:00.000Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

/** The local date before `date` (both `YYYY-MM-DD`). */
export const previousLocalDate = (date: string) => shiftLocalDate(date, -1)

/** The user's local today (browser time zone), the day lời hẹn and the focus goal are dated by. */
export const localToday = () =>
  localDateInTimeZone(
    new Date(),
    Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
  )

export type CommitmentWhen = 'today' | 'tomorrow'
export const COMMITMENT_WHEN_LABEL: Record<CommitmentWhen, string> = {
  today: 'Hôm nay',
  tomorrow: 'Ngày mai',
}
export const COMMITMENT_LIMIT_LINE =
  'Bạn đang có 3 lời hẹn rồi, làm xong một cái rồi hẹn thêm nhé.'
export const COMMITMENT_FAILED_LINE = 'Chưa lưu được lời hẹn. Bạn thử lại nhé.'

/** What Mầm says once a lời hẹn is saved. */
export const commitmentSavedLine = (
  kind: CompanionCommitmentKind,
  when: CommitmentWhen,
) =>
  `Đã hẹn: ${COMMITMENT_PHRASE[kind]}, ${when === 'today' ? 'hôm nay' : 'ngày mai'}. Mầm sẽ hỏi lại.`

/**
 * The lời hẹn Mầm asks about on `today`: the newest OPEN one due yesterday or today. An older open one is
 * left alone (no nagging about the past); a later one is not due yet.
 */
export function dueCommitment(
  state: Pick<CompanionState, 'commitments'> | null,
  today: string,
): CompanionCommitment | null {
  const yesterday = previousLocalDate(today)
  let found: CompanionCommitment | null = null
  for (const item of state?.commitments ?? [])
    if (
      item.status === 'OPEN' &&
      item.dueOn >= yesterday &&
      item.dueOn <= today &&
      (!found || item.createdAt >= found.createdAt)
    )
      found = item
  return found
}

/** The composer text "Soạn tin cùng Mầm" and `/ai-companion?draft=connect` start with; the user finishes and sends it. */
export const CONNECT_DRAFT =
  'Mầm giúp mình soạn một tin nhắn ngắn gửi cho một người mình tin nha. Mình muốn nói là: '
