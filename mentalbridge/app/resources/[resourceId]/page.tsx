import ResourceDetail from '@/features/resources/components/ResourceDetail'
import {
  parseEmotionPlanOrigin,
  resourcePlanHref,
} from '@/features/support-plan/emotion-plan-origin'
import { isUuid } from '@/lib/care/care-validation'

type Props = Readonly<{
  params: Promise<{ resourceId: string }>
  searchParams: Promise<{
    from?: string | string[]
    date?: string | string[]
    contentVersion?: string | string[]
    supportGuideId?: string | string[]
    guideHistory?: string | string[]
    resultEvaluationId?: string | string[]
    occurrenceId?: string | string[]
    actionId?: string | string[]
    localDate?: string | string[]
  }>
}>

function planReturnHref(query: Awaited<Props['searchParams']>) {
  if (query.from !== 'support-plan') return undefined
  const params = new URLSearchParams()
  for (const key of ['occurrenceId', 'actionId', 'localDate'] as const)
    for (const value of [query[key] ?? []].flat()) params.append(key, value)
  const origin = parseEmotionPlanOrigin(params)
  return origin ? resourcePlanHref(origin) : '/support-plan'
}

export default async function ResourceDetailPage({
  params,
  searchParams,
}: Props) {
  const [{ resourceId }, query] = await Promise.all([params, searchParams])
  const guideHistory =
    query.from === 'support-guide' && query.guideHistory === '1'
  return (
    <ResourceDetail
      resourceId={resourceId}
      supportPlanReturnHref={planReturnHref(query)}
      returnSupportGuideId={
        query.from === 'support-guide' && isUuid(query.supportGuideId)
          ? query.supportGuideId
          : undefined
      }
      returnGuideContext={{
        historical: guideHistory,
        resultEvaluationId:
          guideHistory && isUuid(query.resultEvaluationId)
            ? query.resultEvaluationId
            : undefined,
      }}
      activityDate={typeof query.date === 'string' ? query.date : undefined}
      contentVersion={
        typeof query.contentVersion === 'string'
          ? query.contentVersion
          : undefined
      }
    />
  )
}
