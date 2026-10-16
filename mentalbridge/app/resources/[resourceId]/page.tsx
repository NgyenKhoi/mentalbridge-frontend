import ResourceDetail from '@/features/resources/components/ResourceDetail'
import { isUuid } from '@/lib/care/care-validation'

type Props = Readonly<{
  params: Promise<{ resourceId: string }>
  searchParams: Promise<{
    from?: string | string[]
    date?: string | string[]
    contentVersion?: string | string[]
    supportGuideId?: string | string[]
  }>
}>

export default async function ResourceDetailPage({
  params,
  searchParams,
}: Props) {
  const [{ resourceId }, query] = await Promise.all([params, searchParams])
  return (
    <ResourceDetail
      resourceId={resourceId}
      fromSupportPlan={query.from === 'support-plan'}
      returnSupportGuideId={
        query.from === 'support-guide' && isUuid(query.supportGuideId)
          ? query.supportGuideId
          : undefined
      }
      activityDate={typeof query.date === 'string' ? query.date : undefined}
      contentVersion={
        typeof query.contentVersion === 'string'
          ? query.contentVersion
          : undefined
      }
    />
  )
}
