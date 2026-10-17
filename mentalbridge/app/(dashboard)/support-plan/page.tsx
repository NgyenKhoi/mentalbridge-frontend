import type { Metadata } from 'next'

import SupportPlanEntry from '@/features/support-plan/components/SupportPlanEntry'
import { parseEmotionPlanOrigin } from '@/features/support-plan/emotion-plan-origin'
import { parseJournalPlanOrigin } from '@/features/support-plan/journal-plan-origin'

export const metadata: Metadata = {
  title: 'Kế hoạch hỗ trợ — MentalBridge',
}

export default async function SupportPlanPage({
  searchParams,
}: PageProps<'/support-plan'>) {
  const values = await searchParams
  const query = new URLSearchParams()
  for (const key of [
    'source',
    'occurrenceId',
    'actionId',
    'localDate',
    'journalId',
  ]) {
    const value = values[key]
    if (typeof value === 'string') query.append(key, value)
    else if (Array.isArray(value))
      for (const entry of value) query.append(key, entry)
  }
  // A Journal return must never be interpreted as an Emotion return, including
  // malformed or duplicate source/candidate parameters.
  if (query.has('source') || query.has('journalId')) {
    const journalOrigin = parseJournalPlanOrigin(query)
    return (
      <SupportPlanEntry
        {...(journalOrigin
          ? { journalOrigin }
          : { invalidJournalOrigin: true })}
      />
    )
  }
  const origin = parseEmotionPlanOrigin(query)
  return <SupportPlanEntry {...(origin ? { origin } : {})} />
}
