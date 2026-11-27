import type { Metadata } from 'next'

import { HistoricalCombinedMeaning } from '@/features/assessment/components/HistoricalCombinedMeaning'

export const metadata: Metadata = {
  title: 'Kết quả sàng lọc — MentalBridge',
}

export default async function HistoricalAssessmentResultPage(
  props: PageProps<'/assessments/results/[supportEvaluationId]'>,
) {
  const { supportEvaluationId } = await props.params
  return <HistoricalCombinedMeaning supportEvaluationId={supportEvaluationId} />
}
