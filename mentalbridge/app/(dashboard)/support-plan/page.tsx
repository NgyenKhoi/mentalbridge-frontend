import type { Metadata } from 'next'

import SupportPlanEntry from '@/features/support-plan/components/SupportPlanEntry'
import { parseEmotionPlanOrigin } from '@/features/support-plan/emotion-plan-origin'

export const metadata: Metadata = {
  title: 'Kế hoạch hỗ trợ — MentalBridge',
}

export default async function SupportPlanPage({
  searchParams,
}: PageProps<'/support-plan'>) {
  const values = await searchParams
  const query = new URLSearchParams()
  for (const key of ['occurrenceId', 'actionId', 'localDate']) {
    const value = values[key]
    if (typeof value === 'string') query.set(key, value)
  }
  const origin = parseEmotionPlanOrigin(query)
  return <SupportPlanEntry {...(origin ? { origin } : {})} />
}
