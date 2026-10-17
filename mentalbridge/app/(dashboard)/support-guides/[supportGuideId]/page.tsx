import SupportGuideJourney from '@/features/support-guide/components/SupportGuideJourney'
import { isUuid } from '@/lib/care/care-validation'

type Props = Readonly<{
  params: Promise<{ supportGuideId: string }>
  searchParams: Promise<{
    from?: string | string[]
    resultEvaluationId?: string | string[]
  }>
}>

export default async function SupportGuidePage({
  params,
  searchParams,
}: Props) {
  const [{ supportGuideId }, query] = await Promise.all([params, searchParams])
  return (
    <SupportGuideJourney
      supportGuideId={supportGuideId}
      historical={query.from === 'screening-history'}
      resultEvaluationId={
        isUuid(query.resultEvaluationId) ? query.resultEvaluationId : undefined
      }
    />
  )
}
