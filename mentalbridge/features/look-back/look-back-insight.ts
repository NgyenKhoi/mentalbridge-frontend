import { moodLabel } from './look-back-copy'
import type { LookBack } from './look-back-model'

const MIN_DAYS = 3
const MIN_GAP = 0.5

export type LookBackInsight = Readonly<{
  kind: 'PLAN' | 'JOURNAL'
  withDays: number
  withoutDays: number
  withMood: string
  withoutMood: string
}>

const mean = (levels: readonly number[]) =>
  levels.reduce((sum, level) => sum + level, 0) / levels.length

function compare(
  days: LookBack['days'],
  active: (day: LookBack['days'][number]) => boolean | null,
  kind: LookBackInsight['kind'],
): LookBackInsight | null {
  const yes: number[] = []
  const no: number[] = []
  for (const day of days) {
    const flag = active(day)
    // Unknown source or no check-in: the day says nothing about this comparison.
    if (day.emotionLevel === null || flag === null) continue
    ;(flag ? yes : no).push(day.emotionLevel)
  }
  if (yes.length < MIN_DAYS || no.length < MIN_DAYS) return null
  const withMean = mean(yes)
  const withoutMean = mean(no)
  // Only the positive direction: a lower mood on activity days is people acting on hard days.
  if (withMean - withoutMean < MIN_GAP) return null
  const withMood = moodLabel(withMean).label.toLowerCase()
  const withoutMood = moodLabel(withoutMean).label.toLowerCase()
  // Same word on both sides would read as no difference: let the next comparison try.
  if (withMood === withoutMood) return null
  return {
    kind,
    withDays: yes.length,
    withoutDays: no.length,
    withMood,
    withoutMood,
  }
}

/** Association on self-reported days; plan activity first, journal second, else nothing to say. */
export function lookBackInsight(days: LookBack['days']) {
  return (
    compare(
      days,
      (day) =>
        day.supportCompleted === null ? null : day.supportCompleted > 0,
      'PLAN',
    ) ??
    compare(
      days,
      (day) => (day.journalEntries === null ? null : day.journalEntries > 0),
      'JOURNAL',
    )
  )
}

export function insightSentence(insight: LookBackInsight) {
  const verb =
    insight.kind === 'PLAN'
      ? 'bạn làm ít nhất một việc trong kế hoạch'
      : 'bạn viết nhật ký'
  return `${insight.withDays} ngày ${verb}, cảm xúc bạn ghi thường ở mức ${insight.withMood}. ${insight.withoutDays} ngày không làm: ${insight.withoutMood}.`
}
