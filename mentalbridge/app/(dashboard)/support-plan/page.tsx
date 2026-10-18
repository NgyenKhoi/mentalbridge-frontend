import type { Metadata } from 'next'

import { parseEmotionPlanOrigin } from '@/features/support-plan/emotion-plan-origin'
import { parseJournalPlanOrigin } from '@/features/support-plan/journal-plan-origin'
import SupportPlanWorkspace from '@/features/support-plan/workspace/SupportPlanWorkspace'

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
  // A Resource or Journal return must never be interpreted as an Emotion
  // return, including malformed or duplicate source/candidate parameters.
  if (
    query.getAll('source').length === 1 &&
    query.get('source') === 'resource'
  ) {
    const resource = query.has('journalId')
      ? null
      : parseEmotionPlanOrigin(query)
    return resource ? (
      <SupportPlanWorkspace returnOrigin={{ kind: 'resource', ...resource }} />
    ) : (
      <SupportPlanWorkspace invalidOrigin />
    )
  }
  if (query.has('source') || query.has('journalId')) {
    const journal = parseJournalPlanOrigin(query)
    return journal ? (
      <SupportPlanWorkspace returnOrigin={{ ...journal, kind: 'journal' }} />
    ) : (
      <SupportPlanWorkspace invalidOrigin />
    )
  }
  if (!query.has('occurrenceId')) return <SupportPlanWorkspace />
  const emotion = parseEmotionPlanOrigin(query)
  return emotion ? (
    <SupportPlanWorkspace returnOrigin={{ kind: 'emotion', ...emotion }} />
  ) : (
    <SupportPlanWorkspace invalidOrigin />
  )
}
