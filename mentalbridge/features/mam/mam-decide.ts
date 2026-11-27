// Mầm's daily decision table (mam-v3, ADR_MAM_RIVE_V2_CONTRACT "Mục tiêu của Mầm và bảng quyết định hằng ngày").
// Pure: what the first FULL-route visit of the local day does, from levels, enums and dates only. First match
// wins; the last row is silence. Guide and moments keep their higher priority and never come through here.
import type {
  CompanionCommitment,
  CompanionState,
} from '@/lib/companion-state/contract'
import { COMMITMENT_PHRASE, dueCommitment } from './companion-copy'
import type { MamIntent } from './mam-orchestrator'
import {
  MAM_CELEBRATORY_STATES,
  daysBetween,
  type MamTrajectoryState,
} from './mam-trajectory'

/** Days Mầm waits before inviting the focus pick again. */
export const MAM_FOCUS_ASK_DAYS = 3

const COMFORT_STATES: ReadonlySet<MamTrajectoryState> = new Set([
  'PERSISTENT_LOW',
  'FIRST_LOW',
  'DIP_AFTER_GOOD',
])
const STATE_STATES: ReadonlySet<MamTrajectoryState> = new Set([
  'BOUNCE_BACK',
  'IMPROVING',
  'STEADY_GOOD',
  'WELCOME_BACK',
  'FLAT',
])

export type MamDecisionInput = Readonly<{
  state: MamTrajectoryState
  /** The look-back allows cheering (mam-trajectory-source `mamCheerable`). */
  cheerable: boolean
  /** The signed-in account's companion state; null when it could not be read (rows 2 and 4 stay silent). */
  companion: Pick<CompanionState, 'focus' | 'commitments'> | null
  /** Home's safety state: Mầm only says the lines that are about her own objective when it is not. */
  safety: boolean
  /** Care says the 14-day review is due. */
  reviewDue: boolean
  /** A screening exists (the journey is past ASSESSMENT_REQUIRED). */
  hasScreening: boolean
  /** The local date Mầm last invited the focus pick; null: never. */
  focusAskedOn: string | null
  today: string
}>

export type MamDecision =
  | Readonly<{ kind: 'state'; row: 1 | 5; state: MamTrajectoryState }>
  | Readonly<{
      kind: 'line'
      row: 2 | 3 | 4
      intent: MamIntent
      text: string
    }>

/** Row 2's line: the lời hẹn due yesterday or today. */
export const commitmentAskLine = (
  commitment: Pick<CompanionCommitment, 'kind' | 'dueOn'>,
  today: string,
) =>
  commitment.dueOn === today
    ? `Hôm nay mình hẹn ${COMMITMENT_PHRASE[commitment.kind]} nè, 5 phút thôi cũng được.`
    : `Hôm qua mình có hẹn ${COMMITMENT_PHRASE[commitment.kind]} nè. Ghé thẻ Hôm nay kể Mầm nghe nhé.`

export const REVIEW_LINE = 'Tròn 14 ngày rồi nè. Mình cùng nhìn lại nhé?'
export const FOCUS_INVITE_LINE =
  '14 ngày tới bạn muốn điều gì nhẹ đi? Chọn ở thẻ Hôm nay nhé.'

/** The one thing Mầm does on the daily visit, or null for silence. */
export function decideMamDaily(input: MamDecisionInput): MamDecision | null {
  const { state, companion, today } = input
  if (COMFORT_STATES.has(state)) return { kind: 'state', row: 1, state }

  const due =
    companion && !input.safety ? dueCommitment(companion, today) : null
  if (due)
    return {
      kind: 'line',
      row: 2,
      intent: 'LISTEN',
      text: commitmentAskLine(due, today),
    }
  // Row 3 needs no companion state: Care's Home step alone says the review is due.
  if (!input.safety && input.reviewDue)
    return { kind: 'line', row: 3, intent: 'LISTEN', text: REVIEW_LINE }
  if (
    companion &&
    !input.safety &&
    input.hasScreening &&
    !companion.focus &&
    (input.focusAskedOn === null ||
      daysBetween(input.focusAskedOn, today) >= MAM_FOCUS_ASK_DAYS)
  )
    return { kind: 'line', row: 4, intent: 'LISTEN', text: FOCUS_INVITE_LINE }

  if (STATE_STATES.has(state))
    return MAM_CELEBRATORY_STATES.has(state) && !input.cheerable
      ? null
      : { kind: 'state', row: 5, state }
  return null
}
